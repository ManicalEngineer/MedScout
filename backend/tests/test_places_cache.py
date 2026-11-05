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
             "geometry": {"location": {"lat": 34.09 + i * 0.001, "lng": -118.41}}}
            for i, n in enumerate(names)
        ],
    }
    return r


def get(client, auth, lat=34.0912, lng=-118.4103, **kw):
    return client.get(URL, headers=auth, params={"lat": lat, "lng": lng, **kw})


@patch("routers.pharmacies.httpx.get")
def test_same_cell_hits_cache_and_queries_cell_centre(mock_get, client, auth):
    mock_get.return_value = places_response()
    assert get(client, auth, 34.0912, -118.4103).status_code == 200
    assert get(client, auth, 34.0920, -118.4118).status_code == 200   # same 0.005 cell
    assert mock_get.call_count == 1
    sent = mock_get.call_args.kwargs["params"]["location"]
    assert sent == "34.09,-118.41"                                     # cell centre, not the user
    assert mock_get.call_args.kwargs["timeout"] == 5
    assert ph._places_cache.stats()["hits"] == 1


@patch("routers.pharmacies.httpx.get")
def test_distance_uses_real_position_and_other_cell_misses(mock_get, client, auth):
    mock_get.return_value = places_response()
    a = get(client, auth, 34.0912, -118.4103).json()[0]["distance_miles"]
    get(client, auth, 34.0912, -118.4103)
    get(client, auth, 34.20, -118.41)                                  # different cell
    assert mock_get.call_count == 2
    assert a is not None


@patch("routers.pharmacies.httpx.get")
def test_already_saved_is_per_user_even_on_cache_hit(mock_get, client, auth, auth2):
    mock_get.return_value = places_response(("Alpha Pharmacy",))
    make_pharmacy(client, auth, name="Alpha Pharmacy")
    assert get(client, auth).json()[0]["already_saved"] is True
    assert get(client, auth2).json()[0]["already_saved"] is False
    assert mock_get.call_count == 1


@patch("routers.pharmacies.httpx.get")
def test_timeout_is_503_not_500_and_failure_cached_briefly(mock_get, client, auth):
    mock_get.side_effect = httpx.ConnectTimeout("slow")
    r = get(client, auth)
    assert r.status_code == 503
    assert "temporarily unavailable" in r.json()["detail"]
    assert get(client, auth).status_code == 503
    assert mock_get.call_count == 1                                    # failure served from cache


@patch("routers.pharmacies.httpx.get")
def test_failure_expires_after_30s_and_recovery_is_cached_long(mock_get, client, auth):
    mock_get.side_effect = httpx.ConnectTimeout("slow")
    get(client, auth)
    assert ph.PLACES_FAILURE_TTL <= 30
    real = time.monotonic
    with patch("cache_util.time.monotonic", lambda: real() + 31):
        mock_get.side_effect = None
        mock_get.return_value = places_response()
        assert get(client, auth).status_code == 200
        assert get(client, auth).status_code == 200
    assert mock_get.call_count == 2


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
def test_zero_results_is_cached_success(mock_get, client, auth):
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


def test_single_flight_one_load_for_concurrent_misses():
    c = TTLCache("t", maxsize=10, ttl=100)
    calls = []

    def loader():
        calls.append(1)
        time.sleep(0.2)
        return "v", None

    out = []
    ts = [threading.Thread(target=lambda: out.append(c.get_or_load("k", loader))) for _ in range(6)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert len(calls) == 1 and out == ["v"] * 6
