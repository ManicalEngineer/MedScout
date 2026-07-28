def test_script_autofills_from_client_supplied_medication(client, auth):
    # Medication profiles live on-device only — the client passes
    # medication_name/strength directly instead of a profile_id.
    r = client.get(
        "/api/v1/scripts/?tone=polite&medication_name=Adderall+XR&strength=20mg", headers=auth
    )
    assert r.status_code == 200
    assert "20mg Adderall XR" in r.json()["text"]


def test_script_placeholders_without_medication(client, auth):
    r = client.get("/api/v1/scripts/", headers=auth)
    assert r.status_code == 200
    assert "{medication name}" in r.json()["text"]


def test_invalid_tone_rejected(client, auth):
    r = client.get("/api/v1/scripts/?tone=aggressive", headers=auth)
    assert r.status_code == 400


def test_caregiver_variant(client, auth):
    client.patch("/api/v1/users/me", headers=auth, json={"caregiver_mode": True})
    r = client.get(
        "/api/v1/scripts/?tone=polite&medication_name=Adderall+XR&strength=10mg&is_child_profile=true",
        headers=auth,
    )
    assert "child" in r.json()["text"]
