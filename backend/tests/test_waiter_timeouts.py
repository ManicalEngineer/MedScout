"""Single-flight waiters: bounded waits, Places total deadline, no pooled connection while waiting."""
import threading
import time
from unittest.mock import patch

import pytest

import routers.availability as av
import routers.pharmacies as ph
import spend_guard
from cache_util import FlightTimeout, TTLCache
from database import engine
from test_places_cache import get, places_response
from test_read_caches import MAP, contributor


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")


def _start(fn, n=1):
    ts = [threading.Thread(target=fn) for _ in range(n)]
    [t.start() for t in ts]
    return ts


# --- cache primitive ---------------------------------------------------------

def test_waiter_timeout_raise_and_load_and_on_wait():
    c = TTLCache("t", maxsize=5, ttl=100)
    gate = threading.Event()
    waited = []

    def slow():
        gate.wait(5)
        return "leader", None

    leader = _start(lambda: c.get_or_load("k", slow))
    time.sleep(0.2)
    t0 = time.monotonic()
    with pytest.raises(FlightTimeout):
        c.get_or_load("k", slow, wait_timeout=0.3, on_timeout="raise", on_wait=lambda: waited.append(1))
    assert 0.25 < time.monotonic() - t0 < 1.5 and waited == [1]
    assert c.get_or_load("k", lambda: ("direct", None), wait_timeout=0.3, on_timeout="load") == "direct"
    assert c.stats()["wait_timeouts"] == 2
    gate.set()
    leader[0].join()
    assert c.get_or_load("k", lambda: ("never", None)) == "leader"      # leader's own result was stored


def test_waiter_gets_leader_result_when_it_finishes_in_time():
    c = TTLCache("t", maxsize=5, ttl=100)
    out = []
    leader = _start(lambda: c.get_or_load("k", lambda: (time.sleep(0.3) or "v", 0)))
    time.sleep(0.1)
    assert c.get_or_load("k", lambda: ("direct", 0), wait_timeout=3) == "v"
    leader[0].join()


# --- Places ------------------------------------------------------------------

@patch("routers.pharmacies.httpx.get")
def test_places_waiter_times_out_with_503_and_retry_after(mock_get, monkeypatch, client, auth):
    monkeypatch.setattr(ph, "PLACES_WAITER_TIMEOUT", 0.4)
    gate = threading.Event()
    mock_get.side_effect = lambda *a, **k: (gate.wait(5), places_response())[1]
    out = {}
    leader = _start(lambda: out.setdefault("leader", get(client, auth).status_code))
    time.sleep(0.3)
    t0 = time.monotonic()
    r = get(client, auth)
    assert r.status_code == 503 and r.headers["Retry-After"] and time.monotonic() - t0 < 2
    gate.set()
    leader[0].join()
    assert out["leader"] == 200
    assert mock_get.call_count == 1


@patch("routers.pharmacies.httpx.get")
def test_places_total_deadline_bounds_a_call_that_never_finishes(mock_get, monkeypatch, client, auth):
    monkeypatch.setattr(ph, "PLACES_TOTAL_DEADLINE", 0.5)
    monkeypatch.setenv("PLACES_CACHE_TTL_SECONDS", "3600")             # even with caching on, a late result is dropped
    gate = threading.Event()
    mock_get.side_effect = lambda *a, **k: (gate.wait(5), places_response())[1]
    t0 = time.monotonic()
    r = get(client, auth)
    elapsed = time.monotonic() - t0
    assert r.status_code == 503 and elapsed < 2
    assert spend_guard.places_concurrency.in_flight == 1               # the real call is still out there: slot stays held
    gate.set()
    time.sleep(0.3)
    assert spend_guard.places_concurrency.in_flight == 0               # and is freed when it really ends
    assert ph._places_cache._data == {}                                # the late response was not stored


# --- DB-backed caches ---------------------------------------------------------

def _hold_leader(monkeypatch):
    """Make the first map loader (the leader) block after it has queried the DB."""
    gate, entered = threading.Event(), threading.Event()
    real = av._report_response

    def blocking(r):
        if not entered.is_set():
            entered.set()
            gate.wait(5)
        return real(r)

    monkeypatch.setattr(av, "_report_response", blocking)
    return gate, entered


def test_db_cache_waiter_holds_no_pooled_connection(monkeypatch, client):
    a, b = contributor(client, "a@test.com"), contributor(client, "b@test.com")
    gate, entered = _hold_leader(monkeypatch)
    codes = []
    leader = _start(lambda: codes.append(client.get(MAP, headers=a).status_code))
    assert entered.wait(3)
    waiter = _start(lambda: codes.append(client.get(MAP, headers=b).status_code))
    time.sleep(0.6)                                                    # waiter is now blocked on the flight
    assert engine.pool.checkedout() == 1                               # only the leader's connection
    gate.set()
    [t.join() for t in leader + waiter]
    assert codes == [200, 200] and engine.pool.checkedout() == 0


def test_db_cache_waiter_falls_back_to_its_own_query_after_timeout(monkeypatch, client):
    a, b = contributor(client, "a@test.com"), contributor(client, "b@test.com")
    monkeypatch.setattr(av, "CACHE_WAIT_SECONDS", 0.4)
    gate, entered = _hold_leader(monkeypatch)
    leader = _start(lambda: client.get(MAP, headers=a))
    assert entered.wait(3)
    # the patched loader helper blocks only the first caller; the waiter's fallback load goes straight through
    t0 = time.monotonic()
    r = client.get(MAP, headers=b)
    assert r.status_code == 200 and len(r.json()["reports"]) == 2 and time.monotonic() - t0 < 3
    gate.set()
    leader[0].join()
