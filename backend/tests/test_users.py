def test_update_me(client, auth):
    r = client.patch("/api/v1/users/me", headers=auth, json={"caregiver_mode": True})
    assert r.status_code == 200
    assert r.json()["caregiver_mode"] is True


def test_delete_account_requires_correct_password(client, auth):
    r = client.request("DELETE", "/api/v1/users/me", headers=auth, json={"password": "wrong-password"})
    assert r.status_code == 401
    # Account still exists — token still works
    assert client.get("/api/v1/users/me", headers=auth).status_code == 200


def test_delete_account_requires_password_at_all(client, auth):
    r = client.request("DELETE", "/api/v1/users/me", headers=auth, json={})
    assert r.status_code == 401


def test_delete_account_cascades(client, auth):
    p = client.post("/api/v1/pharmacies/", headers=auth,
                     json={"name": "Rx Corner", "phone": "555-1234"}).json()
    client.put("/api/v1/users/me/refill-countdown", headers=auth,
               json={"medication_name": "Vyvanse", "days_supply": 30})
    client.post("/api/v1/calls/", headers=auth, json={"pharmacy_id": p["id"], "status": "in_stock"})

    r = client.request("DELETE", "/api/v1/users/me", headers=auth, json={"password": "password123"})
    assert r.status_code == 204

    # Token is dead — user no longer exists
    assert client.get("/api/v1/users/me", headers=auth).status_code == 401

    # Re-registering the same email works again (old account is truly gone)
    r = client.post("/api/v1/auth/register", json={"email": "user@test.com", "password": "password123"})
    assert r.status_code == 201


def test_refill_countdown(client, auth):
    # Medication profiles live on-device only now — the client just sends
    # medication_name directly to key the countdown.
    r = client.get("/api/v1/users/me/refill-countdown?medication_name=Vyvanse", headers=auth)
    assert r.status_code == 200
    assert r.json()["days_supply"] == 30

    r = client.put(
        "/api/v1/users/me/refill-countdown", headers=auth,
        json={"medication_name": "Vyvanse", "last_fill_date": "2026-07-01", "days_supply": 30},
    )
    assert r.status_code == 200
    assert r.json()["run_out_date"] == "2026-07-31"
    assert r.json()["days_remaining"] is not None


def test_track_medication_is_anonymous(client, auth):
    r = client.post(
        "/api/v1/users/tracked-medications", headers=auth,
        json={"medication_name": "Vyvanse", "strength": "30mg"},
    )
    assert r.status_code == 204
    # Idempotent — a second call for the same medication/strength just
    # refreshes last_seen_at rather than erroring or duplicating.
    r = client.post(
        "/api/v1/users/tracked-medications", headers=auth,
        json={"medication_name": "Vyvanse", "strength": "30mg"},
    )
    assert r.status_code == 204


def test_alert_settings(client, auth):
    r = client.get("/api/v1/users/me/alert-settings", headers=auth)
    assert r.status_code == 200
    assert r.json()["radius_miles"] == 10

    r = client.put("/api/v1/users/me/alert-settings", headers=auth, json={"radius_miles": 25})
    assert r.json()["radius_miles"] == 25


def test_alert_subscriptions_lifecycle(client, auth):
    assert client.get("/api/v1/users/me/alert-subscriptions", headers=auth).json() == []

    r = client.post(
        "/api/v1/users/me/alert-subscriptions", headers=auth,
        json={"medication_name": "Adderall XR", "strength": "20mg"},
    )
    assert r.status_code == 201
    assert r.json()["medication_name"] == "Adderall XR"

    # A user can be subscribed to more than one medication at once.
    r = client.post(
        "/api/v1/users/me/alert-subscriptions", headers=auth,
        json={"medication_name": "Vyvanse", "strength": "30mg"},
    )
    assert r.status_code == 201

    subs = client.get("/api/v1/users/me/alert-subscriptions", headers=auth).json()
    assert {s["medication_name"] for s in subs} == {"Adderall XR", "Vyvanse"}

    # Resubscribing to one already active is idempotent, not an error.
    r = client.post(
        "/api/v1/users/me/alert-subscriptions", headers=auth,
        json={"medication_name": "Adderall XR", "strength": "20mg"},
    )
    assert r.status_code == 201
    assert len(client.get("/api/v1/users/me/alert-subscriptions", headers=auth).json()) == 2

    r = client.request(
        "DELETE", "/api/v1/users/me/alert-subscriptions", headers=auth,
        json={"medication_name": "Adderall XR", "strength": "20mg"},
    )
    assert r.status_code == 204
    subs = client.get("/api/v1/users/me/alert-subscriptions", headers=auth).json()
    assert [s["medication_name"] for s in subs] == ["Vyvanse"]
