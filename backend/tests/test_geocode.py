"""Manual pharmacy add/edit geocoding: success, every failure mode, no address,
and what happens to calls contributed from a pharmacy we couldn't locate."""
import logging
from unittest.mock import MagicMock, patch

import httpx
import pytest

from database import SessionLocal
from models import AvailabilityReport, ReportStatsDaily, User

ADDRESS = "1219 Amsterdam Ave, New York, NY 10027"
KEY = "test-geo-key-123"


def _resp(body, status_code=200):
    m = MagicMock()
    m.status_code = status_code
    m.json.return_value = body
    m.raise_for_status.return_value = None
    return m


OK_BODY = {
    "status": "OK",
    "results": [{
        "geometry": {"location": {"lat": 40.8076, "lng": -73.9585}},
        "address_components": [{"short_name": "10027", "types": ["postal_code"]}],
    }],
}


def _add(client, auth, **body):
    payload = {"name": "Hartley Pharmacy", "phone": "5551234567", "address": ADDRESS}
    payload.update(body)
    return client.post("/api/v1/pharmacies/", headers=auth, json=payload)


@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", KEY)


@patch("routers.pharmacies.httpx.get")
def test_geocode_success_saves_location(mock_get, client, auth):
    mock_get.return_value = _resp(OK_BODY)
    r = _add(client, auth)
    assert r.status_code == 201, r.text
    p = r.json()
    assert (p["zip_code"], p["latitude"], p["longitude"]) == ("10027", 40.8076, -73.9585)
    assert p["location_unverified"] is False
    assert p["geocode_status"] == "ok"
    # listed pharmacies carry the flag too
    listed = client.get("/api/v1/pharmacies/", headers=auth).json()
    assert listed[0]["location_unverified"] is False


@pytest.mark.parametrize("body", [
    {"status": "REQUEST_DENIED", "error_message": "This API key is not authorized to use this service or API."},
    {"status": "OVER_QUERY_LIMIT", "error_message": "quota"},
    {"status": "ZERO_RESULTS", "results": []},
    {"status": "OK", "results": [{**OK_BODY["results"][0], "partial_match": True}]},
    {"status": "OK", "results": [{"geometry": {"location": {"lat": 1.0, "lng": 2.0}}, "address_components": []}]},
])
@patch("routers.pharmacies.httpx.get")
def test_geocode_failure_still_saves_unverified(mock_get, body, client, auth, caplog):
    mock_get.return_value = _resp(body)
    with caplog.at_level(logging.INFO, logger="routers.pharmacies"):
        r = _add(client, auth)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["location_unverified"] is True and p["geocode_status"] == "failed"
    assert (p["zip_code"], p["latitude"], p["longitude"]) == (None, None, None)
    logged = " ".join(rec.getMessage() for rec in caplog.records if rec.name == "routers.pharmacies")
    assert "geocode" in logged
    if body["status"] not in ("OK",):
        assert body["status"] in logged
    # never the address or the key
    assert "Amsterdam" not in logged and "10027" not in logged and KEY not in logged


def test_request_denied_is_logged_as_error(client, auth, caplog):
    body = {"status": "REQUEST_DENIED", "error_message": "not authorized"}
    with patch("routers.pharmacies.httpx.get", return_value=_resp(body)), \
            caplog.at_level(logging.INFO, logger="routers.pharmacies"):
        _add(client, auth)
    errs = [r for r in caplog.records if r.levelno >= logging.ERROR and "REQUEST_DENIED" in r.getMessage()]
    assert errs and "not authorized" in errs[0].getMessage()


@pytest.mark.parametrize("exc", [httpx.ReadTimeout("slow"), httpx.ConnectError("down")])
def test_geocode_network_failure_still_saves(exc, client, auth, caplog):
    with patch("routers.pharmacies.httpx.get", side_effect=exc), \
            caplog.at_level(logging.INFO, logger="routers.pharmacies"):
        r = _add(client, auth)
    assert r.status_code == 201
    assert r.json()["location_unverified"] is True
    assert any("geocode failed" in rec.getMessage() for rec in caplog.records)


@patch("routers.pharmacies.httpx.get")
def test_no_address_skips_google_and_is_unverified(mock_get, client, auth):
    r = client.post("/api/v1/pharmacies/", headers=auth, json={"name": "X", "phone": "5551234567", "address": "   "})
    assert r.status_code == 201
    assert r.json()["geocode_status"] == "no_address"
    assert r.json()["location_unverified"] is True
    mock_get.assert_not_called()


@patch("routers.pharmacies.httpx.get")
def test_edit_address_regeocodes(mock_get, client, auth):
    mock_get.return_value = _resp({"status": "REQUEST_DENIED"})
    pid = _add(client, auth).json()["id"]
    mock_get.return_value = _resp(OK_BODY)
    r = client.patch(f"/api/v1/pharmacies/{pid}", headers=auth, json={"address": ADDRESS})
    assert r.status_code == 200
    assert r.json()["geocode_status"] == "ok" and r.json()["location_unverified"] is False


@patch("routers.pharmacies.httpx.get")
def test_failed_edit_keeps_existing_location(mock_get, client, auth):
    mock_get.return_value = _resp(OK_BODY)
    pid = _add(client, auth).json()["id"]
    mock_get.return_value = _resp({"status": "REQUEST_DENIED"})
    r = client.patch(f"/api/v1/pharmacies/{pid}", headers=auth, json={"address": "1220 Amsterdam Ave, New York, NY 10027"})
    assert r.status_code == 200
    assert r.json()["geocode_status"] == "failed"
    assert r.json()["zip_code"] == "10027"  # a Google outage never wipes a good location


# --- contribution from an unverified pharmacy ---------------------------------

def _contribute(client, headers, pharmacy_id):
    r = client.post("/api/v1/calls/", headers=headers, json={
        "pharmacy_id": pharmacy_id, "status": "in_stock", "contribute_to_community": True,
        "medication_name": "Adderall XR", "strength": "20mg",
    })
    assert r.status_code == 201, r.text


@patch("routers.pharmacies.httpx.get")
def test_call_from_unverified_pharmacy_is_recorded_but_off_map(mock_get, client, auth, auth2):
    mock_get.return_value = _resp({"status": "REQUEST_DENIED"})
    unverified = _add(client, auth).json()
    _contribute(client, auth, unverified["id"])

    with SessionLocal() as db:
        rep = db.query(AvailabilityReport).one()
        assert (rep.zip_code, rep.latitude, rep.longitude) == (None, None, None)
        bucket = db.query(ReportStatsDaily).one()
        assert (bucket.channel, bucket.zip_code, bucket.area_code, bucket.count) == ("call", "", "", 1)
        u = db.query(User).filter(User.email == "user@test.com").one()
        assert u.contribution_count == 1
        assert u.founding_checked is False  # still gets a founding check on a report with a ZIP

    # auth2 becomes a contributor with a located report, then looks at the map
    from conftest import make_pharmacy
    located = make_pharmacy(client, auth2)
    _contribute(client, auth2, located["id"])
    for qs in ("", "?lat=40.80&lng=-73.95&radius_miles=50"):
        reports = client.get(f"/api/v1/availability/map{qs}", headers=auth2).json()["reports"]
        assert all(r["latitude"] is not None and r["longitude"] is not None for r in reports)
        assert "Hartley Pharmacy" not in {r["pharmacy_name"] for r in reports}
    heat = client.get("/api/v1/availability/heatmap", headers=auth2).json()
    assert {row["zip_code"] for row in heat} == {"90210"}
