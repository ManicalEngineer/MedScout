def test_script_autofills_from_profile(client, auth):
    client.post("/api/v1/users/me/medication-profiles", headers=auth,
                json={"medication_name": "Adderall XR", "strength": "20mg"})
    r = client.get("/api/v1/scripts/?tone=polite", headers=auth)
    assert r.status_code == 200
    assert "20mg Adderall XR" in r.json()["text"]


def test_script_placeholders_without_profile(client, auth):
    r = client.get("/api/v1/scripts/", headers=auth)
    assert r.status_code == 200
    assert "{medication name}" in r.json()["text"]


def test_invalid_tone_rejected(client, auth):
    r = client.get("/api/v1/scripts/?tone=aggressive", headers=auth)
    assert r.status_code == 400


def test_caregiver_variant(client, auth):
    client.patch("/api/v1/users/me", headers=auth, json={"caregiver_mode": True})
    client.post("/api/v1/users/me/medication-profiles", headers=auth,
                json={"medication_name": "Adderall XR", "strength": "10mg",
                      "is_child_profile": True, "child_name": "Sam"})
    r = client.get("/api/v1/scripts/?tone=polite", headers=auth)
    assert "child" in r.json()["text"]
