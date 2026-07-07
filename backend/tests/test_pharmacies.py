from conftest import register, make_pharmacy


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
