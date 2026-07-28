from conftest import make_pharmacy


def log_call(client, headers, pharmacy_id, **overrides):
    body = {"pharmacy_id": pharmacy_id, "status": "in_stock", "contribute_to_community": False}
    body.update(overrides)
    return client.post("/api/v1/calls/", headers=headers, json=body)


def community_reports(client, headers):
    r = client.get("/api/v1/availability/map?source=community", headers=headers)
    assert r.status_code == 200
    return r.json()["reports"]


def test_log_call(client, auth):
    p = make_pharmacy(client, auth)
    r = log_call(client, auth, p["id"])
    assert r.status_code == 201
    assert r.json()["status"] == "in_stock"
    assert r.json()["contributed_to_community"] is False


def test_contribution_carries_client_supplied_medication(client, auth):
    # Medication profiles live on-device only — the client sends
    # medication_name/strength explicitly with the call log.
    p = make_pharmacy(client, auth)
    r = log_call(client, auth, p["id"], contribute_to_community=True,
                 medication_name="Adderall XR", strength="20mg")
    assert r.status_code == 201, r.text

    reports = community_reports(client, auth)
    assert len(reports) == 1
    assert reports[0]["medication_name"] == "Adderall XR"
    assert reports[0]["strength"] == "20mg"

    # Contributing promotes the tier
    me = client.get("/api/v1/users/me", headers=auth)
    assert me.json()["subscription_tier"] == "contributor"


def test_contribution_without_medication_is_skipped(client, auth):
    p = make_pharmacy(client, auth)
    r = log_call(client, auth, p["id"], contribute_to_community=True)
    assert r.status_code == 201
    # No medication supplied -> no unusable anonymous report
    assert community_reports(client, auth) == []


def test_vaulted_pharmacy_never_contributes(client, auth):
    p = make_pharmacy(client, auth)
    client.post(f"/api/v1/pharmacies/{p['id']}/vault", headers=auth)
    r = log_call(client, auth, p["id"], contribute_to_community=True,
                 medication_name="Adderall XR", strength="20mg")
    assert r.status_code == 201
    assert r.json()["contributed_to_community"] is False
    assert community_reports(client, auth) == []


def test_cannot_log_call_to_foreign_pharmacy(client, auth):
    from conftest import register
    other = register(client, "other@test.com")
    p = make_pharmacy(client, other)
    assert log_call(client, auth, p["id"]).status_code == 404


def test_patch_toggle_on_creates_report(client, auth):
    p = make_pharmacy(client, auth)
    call = log_call(client, auth, p["id"], medication_name="Adderall XR", strength="20mg").json()

    r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth,
                     json={"contribute_to_community": True})
    assert r.status_code == 200
    assert r.json()["contributed_to_community"] is True
    assert len(community_reports(client, auth)) == 1


def test_patch_cannot_retract_contribution(client, auth):
    p = make_pharmacy(client, auth)
    call = log_call(client, auth, p["id"], contribute_to_community=True,
                     medication_name="Adderall XR", strength="20mg").json()

    r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth,
                     json={"contribute_to_community": False})
    assert r.status_code == 400


def test_list_filters_by_pharmacy(client, auth):
    p1 = make_pharmacy(client, auth, name="One")
    p2 = make_pharmacy(client, auth, name="Two")
    log_call(client, auth, p1["id"])
    log_call(client, auth, p2["id"])

    r = client.get(f"/api/v1/calls/?pharmacy_id={p1['id']}", headers=auth)
    assert [c["pharmacy_id"] for c in r.json()] == [p1["id"]]
