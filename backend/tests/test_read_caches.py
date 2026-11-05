"""In-process caches for non-user-specific reads."""
import time
from unittest.mock import patch

from sqlalchemy import event

import scheduler
from conftest import register
from database import SessionLocal, engine
from models import ShortageStatus
from test_availability import submit_report
from test_scheduler import _fake_fda_response

MAP = "/api/v1/availability/map"


class QueryCounter:
    """Counts SELECTs touching a table."""
    def __init__(self, table):
        self.table, self.n = table, 0

    def __enter__(self):
        event.listen(engine, "before_cursor_execute", self._cb)
        return self

    def __exit__(self, *a):
        event.remove(engine, "before_cursor_execute", self._cb)

    def _cb(self, conn, cursor, statement, *a):
        if statement.lstrip().upper().startswith("SELECT") and f"FROM {self.table}" in statement:
            self.n += 1


def contributor(client, email):
    h = register(client, email)
    assert submit_report(client, h, pharmacy_name=f"P-{email}").status_code == 201
    return h


def test_map_community_query_cached_across_users(client):
    a, b = contributor(client, "a@test.com"), contributor(client, "b@test.com")
    with QueryCounter("availability_reports") as q:
        ra = client.get(MAP, headers=a).json()
        rb = client.get(MAP, headers=b).json()
    assert q.n == 1
    assert len(ra["reports"]) == len(rb["reports"]) == 2


def test_map_cache_does_not_leak_flags_between_users(client):
    a, b = contributor(client, "a@test.com"), contributor(client, "b@test.com")
    rid = next(r["id"] for r in client.get(MAP, headers=b).json()["reports"] if r["pharmacy_name"] == "P-b@test.com")
    assert client.post(f"/api/v1/availability/reports/{rid}/flag", headers=a, json={"reason": "spam"}).status_code == 201
    ids_a = {r["id"] for r in client.get(MAP, headers=a).json()["reports"]}
    ids_b = {r["id"] for r in client.get(MAP, headers=b).json()["reports"]}
    assert rid not in ids_a and rid in ids_b


def test_map_cache_keeps_contributor_gate(client, auth):
    h = contributor(client, "c@test.com")
    client.get(MAP, headers=h)                         # warm the cache
    r = client.get(MAP, headers=auth).json()           # non-contributor, same query
    assert r["community_locked"] is True and r["reports"] == []


def test_map_cache_key_separates_filters(client):
    h = contributor(client, "a@test.com")
    all_ = client.get(MAP, headers=h).json()["reports"]
    none = client.get(MAP, headers=h, params={"medication_name": "Nonexistent"}).json()["reports"]
    assert all_ and none == []


def test_map_cache_expires(client):
    h = contributor(client, "a@test.com")
    client.get(MAP, headers=h)
    real = time.monotonic
    with QueryCounter("availability_reports") as q, patch("cache_util.time.monotonic", lambda: real() + 46):
        client.get(MAP, headers=h)
    assert q.n == 1


def test_map_trust_level_not_frozen_in_cache(client):
    h = contributor(client, "a@test.com")
    first = client.get(MAP, headers=h).json()["reports"][0]
    assert first["trust_level"] == "fresh"


def test_heatmap_cached_and_still_gated(client, auth):
    h = contributor(client, "a@test.com")
    with QueryCounter("availability_reports") as q:
        r1 = client.get("/api/v1/availability/heatmap", headers=h)
        r2 = client.get("/api/v1/availability/heatmap", headers=h)
    assert r1.status_code == r2.status_code == 200 and r1.json() == r2.json()
    assert q.n == 1
    assert client.get("/api/v1/availability/heatmap", headers=auth).status_code == 403


def test_shortage_status_cached_and_cleared_by_scheduler(client, auth):
    db = SessionLocal()
    db.add(ShortageStatus(medication_name="Adderall", source="fda", status="limited", detail="d"))
    db.commit()
    url = "/api/v1/availability/shortage-status?medication_name=Adderall"
    with QueryCounter("shortage_status") as q:
        assert client.get(url, headers=auth).json()["status"] == "limited"
        assert client.get(url, headers=auth).json()["status"] == "limited"
    assert q.n == 1

    client.post("/api/v1/users/tracked-medications", headers=auth, json={"medication_name": "Adderall", "strength": "20mg"})
    with patch("scheduler.httpx.get", return_value=_fake_fda_response(["Unavailable"])):
        scheduler.run_fda_shortage_ingestion(db)
    db.close()
    assert client.get(url, headers=auth).json()["status"] == "unavailable"


def test_shortage_status_cache_clears_even_if_ingestion_raises(client, auth):
    import caches
    caches.shortage_cache.set("x", {"stale": True})
    db = SessionLocal()
    with patch("scheduler._ingest_shortages", side_effect=RuntimeError("boom")):
        try:
            scheduler.run_fda_shortage_ingestion(db)
        except RuntimeError:
            pass
    db.close()
    assert caches.shortage_cache.stats()["size"] == 0


def test_missing_shortage_row_is_cached_as_none(client, auth):
    url = "/api/v1/availability/shortage-status?medication_name=NeverHeardOfIt"
    assert client.get(url, headers=auth).json() is None
    assert client.get(url, headers=auth).json() is None
