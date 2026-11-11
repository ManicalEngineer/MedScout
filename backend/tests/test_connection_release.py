"""No DB connection is held while a handler waits on an outbound service."""
from unittest.mock import MagicMock, patch

import apple_auth
from conftest import register
from database import engine
from routers import auth as auth_router
from test_notifications import setup_recipient, submit_nearby_report


def checked_out():
    return engine.pool.checkedout()


@patch("notifications.httpx.post")
def test_submit_report_releases_connection_during_expo_push(mock_post, client):
    setup_recipient(client)
    seen = []
    mock_post.side_effect = lambda *a, **k: seen.append(checked_out()) or MagicMock()
    reporter = register(client, "reporter@test.com")
    r = submit_nearby_report(client, reporter)
    assert r.status_code == 201
    assert seen == [0]
    assert r.json()["medication_name"] == "Adderall XR"      # response still builds after release


@patch("notifications.httpx.post")
def test_call_log_contribution_releases_connection_during_push(mock_post, client):
    setup_recipient(client)
    seen = []
    mock_post.side_effect = lambda *a, **k: seen.append(checked_out()) or MagicMock()
    auth = register(client, "caller@test.com")
    ph = client.post("/api/v1/pharmacies/", headers=auth, json={
        "name": "Rx Corner", "phone": "5551234567", "latitude": 34.10, "longitude": -118.42, "zip_code": "90210"}).json()
    r = client.post("/api/v1/calls/", headers=auth, json={
        "pharmacy_id": ph["id"], "status": "in_stock", "contribute_to_community": True,
        "medication_name": "Adderall XR", "strength": "20mg"})
    assert r.status_code == 201, r.text
    assert seen == [0]


def test_geocode_on_create_and_update_releases_connection(client, auth):
    seen = []

    def fake_geocode(address):
        seen.append(checked_out())
        return {"latitude": 34.0, "longitude": -118.0, "zip_code": "90001"}

    with patch("routers.pharmacies._geocode_address", fake_geocode):
        r = client.post("/api/v1/pharmacies/", headers=auth, json={"name": "G", "phone": "5551234567", "address": "1 Main St"})
        assert r.status_code == 201 and r.json()["latitude"] == 34.0
        r2 = client.patch(f"/api/v1/pharmacies/{r.json()['id']}", headers=auth, json={"address": "2 Main St", "latitude": None})
        assert r2.status_code == 200
    assert seen[0] == 0


def test_update_geocode_releases_connection_and_saves(client, auth):
    with patch("routers.pharmacies._geocode_address", lambda a: {"latitude": 1.0, "longitude": 2.0, "zip_code": "11111"}):
        pid = client.post("/api/v1/pharmacies/", headers=auth, json={"name": "G", "phone": "5551234567"}).json()["id"]
    seen = []

    def fake(address):
        seen.append(checked_out())
        return {"latitude": 5.0, "longitude": 6.0, "zip_code": "22222"}

    with patch("routers.pharmacies._geocode_address", fake):
        r = client.patch(f"/api/v1/pharmacies/{pid}", headers=auth, json={"address": "New St"})
    assert r.status_code == 200 and seen == [0]
    assert (r.json()["latitude"], r.json()["longitude"]) == (5.0, 6.0)


def test_from_place_releases_connection_during_details_call(client, auth, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "k")
    seen = []

    def fake_get(*a, **k):
        seen.append(checked_out())
        m = MagicMock(status_code=200)
        m.json.return_value = {"status": "OK", "result": {
            "name": "P", "formatted_phone_number": "555", "formatted_address": "A",
            "geometry": {"location": {"lat": 1.0, "lng": 2.0}}, "address_components": []}}
        return m

    with patch("routers.pharmacies.httpx.get", fake_get):
        r = client.post("/api/v1/pharmacies/from-place", headers=auth, json={"place_id": "pid"})
    assert r.status_code == 201 and seen == [0]
    assert client.get("/api/v1/pharmacies/", headers=auth).json()[0]["name"] == "P"


def test_apple_exchange_and_revoke_release_connection(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(auth_router, "_verify_oauth_id_token",
                        lambda p, t: {"sub": "s1", "email": "a@test.com", "email_verified": "true"})
    monkeypatch.setattr(apple_auth, "exchange_code_for_refresh_token", lambda c: seen.setdefault("ex", checked_out()) or "tok")
    monkeypatch.setattr(apple_auth, "revoke_refresh_token", lambda t: seen.setdefault("rv", checked_out()) is not None)
    r = client.post("/api/v1/auth/oauth", json={"provider": "apple", "id_token": "x", "authorization_code": "c"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.request("DELETE", "/api/v1/users/me", headers=h, json={}).status_code == 204
    assert seen == {"ex": 0, "rv": 0}
