"""/pharmacies/nearby: grid cache, graceful failure, connection released."""
import threading
import time
from unittest.mock import MagicMock, patch

import httpx
import pytest

import routers.pharmacies as ph
from cache_util import TTLCache
from conftest import make_pharmacy, register
from database import engine

URL = "/api/v1/pharmacies/nearby"


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")


def places_response(names=("Alpha Pharmacy",), status="OK"):
    r = MagicMock()
    r.status_code = 200
    r.json.return_value = {
        "status": status,
        "results": [
            {"place_id": f"pid-{n}", "name": n, "vicinity": "1 Main St", "types": ["pharmacy"],
             "rating": 4.7, "user_ratings_total": 321, "opening_hours": {"open_now": True},
             "photos": [{"photo_reference": "secret"}], "business_status": "OPERATIONAL",
             "geometry": {"location": {"lat": 34.09 + i * 0.001, "lng": -118.41}}}
            for i, n in enumerate(names)
        ],
    }
    return r


def get(client, auth, lat=34.0912, lng=-118.4103, **kw):
    return client.get(URL, headers=auth, params={"lat": lat, "lng": lng, **kw})


@pytest.fixture
def ttl(monkeypatch):
    """Turn retention on, deliberately, for the tests that exercise it."""
    monkeypatch.setenv("PLACES_CACHE_TTL_SECONDS", "86400")


def test_default_is_no_retention(monkeypatch):
    monkeypatch.delenv("PLACES_CACHE_TTL_SECONDS", raising=False)
    assert ph._places_cache_ttl() == 0
    monkeypatch.setenv("PLACES_CACHE_TTL_SECONDS", "garbage")
    assert ph._places_cache_ttl() == 0
    monkeypatch.setenv("PLACES_CACHE_TTL_SECONDS", "-5")
    assert ph._places_cache_ttl() == 0


@patch("routers.pharmacies.httpx.get")
def test_default_stores_nothing_after_the_call_completes(mock_get, client, auth):
    mock_get.return_value = places_response()
    assert get(client, auth).status_code == 200
    assert get(client, auth).status_code == 200
    assert mock_get.call_count == 2                      # nothing was reused
    assert ph._places_cache._data == {} and ph._places_cache._inflight == {}
    assert ph._places_cache.stats()["size"] == 0


@patch("routers.pharmacies.httpx.get")
def test_concurrent_same_cell_requests_share_one_google_call(mock_get, client, auth):
    release = threading.Event()

    def slow(*a, **k):
        release.wait(5)
        return places_response()

    mock_get.side_effect = slow
    out = []
    ts = [threading.Thread(target=lambda: out.append(get(client, auth, 34.0912 + i * 0.0001).status_code)) for i in range(6)]
    [t.start() for t in ts]
    time.sleep(0.5)                                      # let them all arrive while the call is in flight
    release.set()
    [t.join() for t in ts]
    assert out == [200] * 6
    assert mock_get.call_count == 1
    assert ph._places_cache.stats()["coalesced"] == 5
    assert ph._places_cache._data == {} and ph._places_cache._inflight == {}


@patch("routers.pharmacies.httpx.get")
def test_only_slim_fields_leave_the_loader(mock_get, client, auth):
    mock_get.return_value = places_response()
    kind, places = ph._load_places_nearby("k", 34.09, -118.41, 8000)[0]
    assert kind == "ok"
    assert set(places[0]) == {"place_id", "name", "vicinity", "types", "lat", "lng"}
    body = get(client, auth).json()[0]
    assert set(body) == {"place_id", "name", "address", "latitude", "longitude", "distance_miles", "already_saved"}


@patch("routers.pharmacies.httpx.get")
def test_with_ttl_same_cell_hits_cache_and_queries_cell_centre(mock_get, ttl, client, auth):
    mock_get.return_value = places_response()
    assert get(client, auth, 34.0912, -118.4103).status_code == 200
    assert get(client, auth, 34.0920, -118.4118).status_code == 200   # same 0.005 cell
    assert mock_get.call_count == 1
    sent = mock_get.call_args.kwargs["params"]["location"]
    assert sent == "34.09,-118.41"                                     # cell centre, not the user
    assert mock_get.call_args.kwargs["timeout"] == 5
    assert ph._places_cache.stats()["hits"] == 1
    stored = next(iter(ph._places_cache._data.values()))[1]
    assert set(stored[1][0]) == {"place_id", "name", "vicinity", "types", "lat", "lng"}   # no ratings/hours/photos


@patch("routers.pharmacies.httpx.get")
def test_with_ttl_other_cell_misses_and_distance_uses_real_position(mock_get, ttl, client, auth):
    mock_get.return_value = places_response()
    d1 = get(client, auth, 34.0912, -118.4103).json()[0]["distance_miles"]
    d2 = get(client, auth, 34.0920, -118.4118).json()[0]["distance_miles"]   # same cell, different position
    get(client, auth, 34.20, -118.41)                                        # different cell
    assert mock_get.call_count == 2
    assert d1 != d2


@patch("routers.pharmacies.httpx.get")
def test_already_saved_is_per_user_even_when_cached(mock_get, ttl, client, auth, auth2):
    mock_get.return_value = places_response(("Alpha Pharmacy",))
    make_pharmacy(client, auth, name="Alpha Pharmacy")
    assert get(client, auth).json()[0]["already_saved"] is True
    assert get(client, auth2).json()[0]["already_saved"] is False
    assert mock_get.call_count == 1


@patch("routers.pharmacies.httpx.get")
def test_timeout_is_503_not_500(mock_get, client, auth):
    mock_get.side_effect = httpx.ConnectTimeout("slow")
    r = get(client, auth)
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"]


@patch("routers.pharmacies.httpx.get")
def test_failures_are_never_cached_even_with_ttl(mock_get, ttl, client, auth):
    mock_get.side_effect = httpx.ConnectTimeout("slow")
    assert get(client, auth).status_code == 503
    assert ph._places_cache._data == {}
    mock_get.side_effect = None
    mock_get.return_value = places_response()
    assert get(client, auth).status_code == 200                        # retried immediately
    assert mock_get.call_count == 2


@patch("routers.pharmacies.httpx.get")
def test_concurrent_failure_is_shared_but_not_kept(mock_get, client, auth):
    release = threading.Event()

    def slow_fail(*a, **k):
        release.wait(5)
        raise httpx.ConnectTimeout("slow")

    mock_get.side_effect = slow_fail
    out = []
    ts = [threading.Thread(target=lambda: out.append(get(client, auth).status_code)) for _ in range(4)]
    [t.start() for t in ts]
    time.sleep(0.5)
    release.set()
    [t.join() for t in ts]
    assert out == [503] * 4 and mock_get.call_count == 1
    assert ph._places_cache._data == {}


@pytest.mark.parametrize("resp", ["http500", "denied", "badjson"])
@patch("routers.pharmacies.httpx.get")
def test_upstream_errors_are_503(mock_get, resp, client, auth):
    if resp == "http500":
        mock_get.return_value = MagicMock(status_code=500)
    elif resp == "denied":
        mock_get.return_value = places_response(status="REQUEST_DENIED")
    else:
        m = MagicMock(status_code=200)
        m.json.side_effect = ValueError("not json")
        mock_get.return_value = m
    r = get(client, auth)
    assert r.status_code == 503 and isinstance(r.json()["detail"], str)


@patch("routers.pharmacies.httpx.get")
def test_zero_results_is_a_success_and_cached_only_with_ttl(mock_get, ttl, client, auth):
    mock_get.return_value = places_response(names=(), status="ZERO_RESULTS")
    assert get(client, auth).json() == []
    assert get(client, auth).json() == []
    assert mock_get.call_count == 1


@patch("routers.pharmacies.httpx.get")
def test_db_connection_not_held_during_google_call(mock_get, client, auth):
    seen = []

    def fake_get(*a, **kw):
        seen.append(engine.pool.checkedout())
        return places_response()

    mock_get.side_effect = fake_get
    assert get(client, auth).status_code == 200
    assert seen == [0]


def test_lru_is_bounded_and_evicts_least_recent():
    c = TTLCache("t", maxsize=2, ttl=100)
    c.get_or_load("a", lambda: (1, None))
    c.get_or_load("b", lambda: (2, None))
    c.get_or_load("a", lambda: (9, None))           # touch a
    c.get_or_load("c", lambda: (3, None))           # evicts b
    assert c.stats()["size"] == 2
    assert c.get_or_load("a", lambda: (99, None)) == 1
    assert c.get_or_load("b", lambda: (22, None)) == 22


def test_ttl_zero_coalesces_but_retains_nothing():
    c = TTLCache("t", maxsize=10, ttl=100)
    calls = []

    def loader():
        calls.append(1)
        time.sleep(0.2)
        return "v", 0

    out = []
    ts = [threading.Thread(target=lambda: out.append(c.get_or_load("k", loader))) for _ in range(6)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert len(calls) == 1 and out == ["v"] * 6
    assert c._data == {} and c._inflight == {}
    c.get_or_load("k", loader)
    assert len(calls) == 2                           # nothing was kept


def test_loader_exception_reaches_waiters_and_is_not_stored():
    c = TTLCache("t", maxsize=10, ttl=100)

    def loader():
        time.sleep(0.2)
        raise RuntimeError("boom")

    errs = []

    def run():
        try:
            c.get_or_load("k", loader)
        except RuntimeError as e:
            errs.append(str(e))

    ts = [threading.Thread(target=run) for _ in range(3)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert errs == ["boom"] * 3 and c._data == {} and c._inflight == {}
