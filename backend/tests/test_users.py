def test_update_me(client, auth):
    r = client.patch("/api/v1/users/me", headers=auth, json={"caregiver_mode": True})
    assert r.status_code == 200
    assert r.json()["caregiver_mode"] is True


def test_medication_profile_lifecycle(client, auth):
    r = client.post("/api/v1/users/me/medication-profiles", headers=auth,
                    json={"medication_name": "Vyvanse", "strength": "30mg"})
    assert r.status_code == 201
    profile_id = r.json()["id"]

    listed = client.get("/api/v1/users/me/medication-profiles", headers=auth).json()
    assert [p["medication_name"] for p in listed] == ["Vyvanse"]

    # Delete is a soft-delete: profile leaves the list
    assert client.delete(f"/api/v1/users/me/medication-profiles/{profile_id}", headers=auth).status_code == 204
    assert client.get("/api/v1/users/me/medication-profiles", headers=auth).json() == []


def test_refill_countdown(client, auth):
    profile = client.post("/api/v1/users/me/medication-profiles", headers=auth,
                          json={"medication_name": "Vyvanse", "strength": "30mg"}).json()
    url = f"/api/v1/users/me/medication-profiles/{profile['id']}/refill-countdown"

    r = client.get(url, headers=auth)
    assert r.status_code == 200
    assert r.json()["days_supply"] == 30

    r = client.put(url, headers=auth, json={"last_fill_date": "2026-07-01", "days_supply": 30})
    assert r.status_code == 200
    assert r.json()["run_out_date"] == "2026-07-31"
    assert r.json()["days_remaining"] is not None


def test_alert_settings(client, auth):
    r = client.get("/api/v1/users/me/alert-settings", headers=auth)
    assert r.status_code == 200
    assert r.json()["radius_miles"] == 10

    r = client.put("/api/v1/users/me/alert-settings", headers=auth, json={"radius_miles": 25})
    assert r.json()["radius_miles"] == 25
