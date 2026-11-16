"""GET /admin/report-stats: key-gated aggregate report counts."""
from datetime import timedelta

from database import SessionLocal
from models import ReportStatsDaily
from timeutil import utcnow

URL = "/api/v1/admin/report-stats"


def _seed():
    today = utcnow().date()
    with SessionLocal() as db:
        db.add_all([
            ReportStatsDaily(day=today, channel="manual", zip_code="12207", area_code="A1", count=12),
            ReportStatsDaily(day=today - timedelta(days=3), channel="call", zip_code="12207", area_code="A1", count=3),
            ReportStatsDaily(day=today - timedelta(days=40), channel="manual", zip_code="10001", area_code="B2", count=4),
        ])
        db.commit()


def test_disabled_without_key_configured(client, monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    assert client.get(URL, headers={"X-Admin-Key": "anything"}).status_code == 404


def test_wrong_or_missing_key_rejected(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    assert client.get(URL).status_code == 401
    assert client.get(URL, headers={"X-Admin-Key": "nope"}).status_code == 401


def test_user_token_is_not_enough(client, auth, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    assert client.get(URL, headers=auth).status_code == 401


def test_totals_windows_and_small_area_suppression(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    _seed()
    r = client.get(URL, headers={"X-Admin-Key": "s3cret"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["windows"]["all_time"]["total"] == 19
    assert d["windows"]["last_30_days"]["total"] == 15
    assert d["windows"]["last_7_days"]["by_channel"] == {"manual": 12, "call": 3}
    assert d["distinct_zips"] == 2 and d["distinct_areas"] == 2
    areas = {a["area_code"]: a for a in d["top_areas"]}
    assert areas["A1"]["all_time"]["count"] == 15
    assert areas["B2"]["all_time"] == {"count": None, "fewer_than": 10}
    assert len(d["last_14_days"]) == 14
    assert d["last_14_days"][0]["count"] == 12


def test_signup_counts(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    from conftest import register
    register(client, "a@test.com")
    register(client, "b@test.com")
    d = client.get(URL, headers={"X-Admin-Key": "s3cret"}).json()["signups"]
    assert d["total"] == 2 and d["last_7_days"] == 2 and d["last_30_days"] == 2
    assert d["by_sign_in_method"]["email_password"] == 2
    assert d["with_at_least_one_report"] == 0
    assert d["last_14_days"][0]["count"] == 2
    assert sum(x["count"] for x in d["last_14_days"]) == 2
    # no emails or ids anywhere in the response
    assert "@" not in str(d)
