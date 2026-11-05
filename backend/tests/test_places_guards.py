"""Spend guards on GET /pharmacies/nearby: IP limit, hourly ceiling, concurrency cap."""
import logging
import threading
import time
from unittest.mock import patch

import pytest

import spend_guard
from conftest import register
from test_places_cache import get, places_response  # noqa: F401  (fixtures: key autouse below)

URL = "/api/v1/pharmacies/nearby"


@pytest.fixture(autouse=True)
def key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")


def cell(i):
    """Latitude of distinct grid cells."""
    return 30.0 + i * 0.5


# --- (a) second limit by IP -------------------------------------------------

@patch("routers.pharmacies.httpx.get")
def test_ip_limit_200_per_hour_on_top_of_per_user_60(mock_get, client):
    mock_get.return_value = places_response()
    users = [register(client, f"ip{i}@test.com") for i in range(4)]
    codes = []
    for h in users:
        for _ in range(60):
            codes.append(get(client, h).status_code)
    assert codes.count(200) == 200 and codes[200:] == [429] * 40      # 4 users x 60 = 240; IP cap 200
    assert get(client, users[0]).status_code == 429


@patch("routers.pharmacies.httpx.get")
def test_per_user_limit_still_60(mock_get, client, auth):
    mock_get.return_value = places_response()
    codes = [get(client, auth).status_code for _ in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429


# --- (b) hourly ceiling -----------------------------------------------------

@patch("routers.pharmacies.httpx.get")
def test_hourly_ceiling_trips_with_503_retry_after_and_warning(mock_get, monkeypatch, client, auth, caplog):
    monkeypatch.setenv("PLACES_MAX_CALLS_PER_HOUR", "3")
    mock_get.return_value = places_response()
    with caplog.at_level(logging.WARNING, logger="spend_guard"):
        codes = [get(client, auth, lat=cell(i)).status_code for i in range(5)]
    assert codes == [200, 200, 200, 503, 503]
    assert mock_get.call_count == 3                                    # refused requests never reached Google
    r = get(client, auth, lat=cell(9))
    assert r.status_code == 503 and "busy" in r.json()["detail"]
    assert 1 <= int(r.headers["Retry-After"]) <= 3600
    trips = [m for m in caplog.messages if "places_guard_tripped kind=hourly_ceiling" in m]
    assert len(trips) == 1                                             # logged once, not per request


@patch("routers.pharmacies.httpx.get")
def test_ceiling_frees_up_as_the_hour_rolls(mock_get, monkeypatch, client, auth):
    monkeypatch.setenv("PLACES_MAX_CALLS_PER_HOUR", "1")
    mock_get.return_value = places_response()
    assert get(client, auth, lat=cell(0)).status_code == 200
    assert get(client, auth, lat=cell(1)).status_code == 503
    real = time.monotonic
    with patch("spend_guard.time.monotonic", lambda: real() + 3601):
        assert get(client, auth, lat=cell(2)).status_code == 200


@patch("routers.pharmacies.httpx.get")
def test_coalesced_waiters_are_not_counted_against_the_ceiling(mock_get, client, auth):
    release = threading.Event()
    mock_get.side_effect = lambda *a, **k: (release.wait(5), places_response())[1]
    out = []
    ts = [threading.Thread(target=lambda: out.append(get(client, auth).status_code)) for _ in range(6)]
    [t.start() for t in ts]
    time.sleep(0.5)
    release.set()
    [t.join() for t in ts]
    assert out == [200] * 6 and mock_get.call_count == 1
    assert spend_guard.places_ceiling.count() == 1


@patch("routers.pharmacies.httpx.get")
def test_failed_calls_still_count_but_cache_hits_do_not(mock_get, monkeypatch, client, auth):
    monkeypatch.setenv("PLACES_CACHE_TTL_SECONDS", "3600")
    mock_get.return_value = places_response()
    get(client, auth)
    get(client, auth)                                                  # cache hit: no Google call
    assert spend_guard.places_ceiling.count() == 1


# --- (c) concurrency cap ----------------------------------------------------

@patch("routers.pharmacies.httpx.get")
def test_concurrency_cap_refuses_instead_of_queueing(mock_get, monkeypatch, client, auth):
    monkeypatch.setenv("PLACES_MAX_CONCURRENT", "2")
    release = threading.Event()
    mock_get.side_effect = lambda *a, **k: (release.wait(5), places_response())[1]
    results = {}

    def go(i):
        t0 = time.monotonic()
        r = get(client, auth, lat=cell(i))
        results[i] = (r.status_code, r.headers.get("Retry-After"), time.monotonic() - t0)

    ts = [threading.Thread(target=go, args=(i,)) for i in range(4)]
    [t.start() for t in ts]
    time.sleep(0.8)
    # The two refused requests have already answered, while the two admitted ones are still waiting.
    refused = [v for v in results.values() if v[0] == 503]
    assert len(refused) == 2 and all(v[1] is not None and v[2] < 2 for v in refused)
    assert spend_guard.places_concurrency.in_flight == 2
    release.set()
    [t.join() for t in ts]
    assert sorted(v[0] for v in results.values()) == [200, 200, 503, 503]
    assert spend_guard.places_concurrency.in_flight == 0              # slots released
    assert get(client, auth, lat=cell(10)).status_code == 200


@patch("routers.pharmacies.httpx.get")
def test_slot_released_when_google_call_fails(mock_get, monkeypatch, client, auth):
    import httpx
    monkeypatch.setenv("PLACES_MAX_CONCURRENT", "1")
    mock_get.side_effect = httpx.ConnectTimeout("slow")
    for i in range(3):
        assert get(client, auth, lat=cell(i)).status_code == 503
    assert spend_guard.places_concurrency.in_flight == 0
    assert mock_get.call_count == 3                                    # never stuck on "busy"


def test_env_defaults_and_bad_values(monkeypatch):
    monkeypatch.delenv("PLACES_MAX_CONCURRENT", raising=False)
    monkeypatch.delenv("PLACES_MAX_CALLS_PER_HOUR", raising=False)
    assert spend_guard.env_int("PLACES_MAX_CONCURRENT", 8) == 8
    assert spend_guard.env_int("PLACES_MAX_CALLS_PER_HOUR", 3000) == 3000
    monkeypatch.setenv("PLACES_MAX_CONCURRENT", "nope")
    assert spend_guard.env_int("PLACES_MAX_CONCURRENT", 8) == 8
