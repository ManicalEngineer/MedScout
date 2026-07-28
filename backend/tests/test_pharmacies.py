from unittest.mock import MagicMock, patch

from conftest import register, make_pharmacy


def _fake_place_details_response():
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "status": "OK",
        "result": {
            "name": "Places Pharmacy",
            "formatted_phone_number": "(555) 123-4567",
            "formatted_address": "1 Market St, San Francisco, CA 94105",
            "geometry": {"location": {"lat": 37.79, "lng": -122.40}},
            "address_components": [{"types": ["postal_code"], "short_name": "94105"}],
        },
    }
    return resp


@patch("routers.pharmacies.httpx.get")
def test_add_from_place(mock_get, client, auth, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    mock_get.return_value = _fake_place_details_response()

    r = client.post(
        "/api/v1/pharmacies/from-place", headers=auth,
        json={"place_id": "abc123", "is_vaulted": True},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Places Pharmacy"
    assert body["is_vaulted"] is True


def test_create_and_list(client, auth):
    make_pharmacy(client, auth)
    r = client.get("/api/v1/pharmacies/", headers=auth)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Test Pharmacy"


def test_other_users_pharmacy_is_invisible(client, auth):
    p = make_pharmacy(client, auth)
    other = register(client, "other@test.com")

    assert client.get("/api/v1/pharmacies/", headers=other).json() == []
    assert client.patch(f"/api/v1/pharmacies/{p['id']}", headers=other, json={"name": "hacked"}).status_code == 404
    assert client.delete(f"/api/v1/pharmacies/{p['id']}", headers=other).status_code == 404


def test_update_and_delete(client, auth):
    p = make_pharmacy(client, auth)
    r = client.patch(f"/api/v1/pharmacies/{p['id']}", headers=auth, json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed"

    assert client.delete(f"/api/v1/pharmacies/{p['id']}", headers=auth).status_code == 204
    assert client.get("/api/v1/pharmacies/", headers=auth).json() == []


def test_vault_toggle(client, auth):
    p = make_pharmacy(client, auth)
    r = client.post(f"/api/v1/pharmacies/{p['id']}/vault", headers=auth)
    assert r.status_code == 200
    assert r.json()["is_vaulted"] is True


def test_proximity_sort_requires_coordinates(client, auth):
    make_pharmacy(client, auth)
    r = client.get("/api/v1/pharmacies/?sort_by=proximity", headers=auth)
    assert r.status_code == 400


def test_proximity_sort_orders_by_distance(client, auth):
    make_pharmacy(client, auth, name="Far", latitude=40.0, longitude=-118.41)
    make_pharmacy(client, auth, name="Near", latitude=34.10, longitude=-118.41)
    r = client.get("/api/v1/pharmacies/?sort_by=proximity&lat=34.09&lng=-118.41", headers=auth)
    names = [p["name"] for p in r.json()]
    assert names == ["Near", "Far"]
