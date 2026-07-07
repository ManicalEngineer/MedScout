from conftest import make_pharmacy


def log_call(client, headers, pharmacy_id, **overrides):
    body = {"pharmacy_id": pharmacy_id, "status": "in_stock", "contribute_to_community": False}
    body.update(overrides)
    return client.post("/api/v1/calls/", headers=headers, json=body)


def community_reports(client, headers):
    r = client.get("/api/v1/availability/map?source=community", headers=headers)
    assert r.status_code == 200
    return r.json()


def test_log_call(client, auth):
    p = make_pharmacy(client, auth)
    r = log_call(client, auth, p["id"])
    assert r.status_code == 201
    assert r.json()["status"] == "in_stock"
    assert r.json()["contributed_to_community"] is False


def test_contribution_carries_profile_medication(client, auth_with_profile):
    p = make_pharmacy(client, auth_with_profile)
    r = log_call(client, auth_with_profile, p["id"], contribute_to_community=True)
    assert r.status_code == 201, r.text

    reports = community_reports(client, auth_with_profile)
    assert len(reports) == 1
    assert reports[0]["medication_name"] == "Adderall XR"
    assert reports[0]["strength"] == "20mg"

    # Contributing promotes the tier
    me = client.get("/api/v1/users/me", headers=auth_with_profile)
    assert me.json()["subscription_tier"] == "contributor"


def test_contribution_without_any_profile_is_skipped(client, auth):
    p = make_pharmacy(client, auth)
    r = log_call(client, auth, p["id"], contribute_to_community=True)
    assert r.status_code == 201
    # No medication resolvable -> no unusable anonymous report
    assert community_reports(client, auth) == []


def test_vaulted_pharmacy_never_contributes(client, auth_with_profile):
    p = make_pharmacy(client, auth_with_profile)
    client.post(f"/api/v1/pharmacies/{p['id']}/vault", headers=auth_with_profile)
    r = log_call(client, auth_with_profile, p["id"], contribute_to_community=True)
    assert r.status_code == 201
    assert r.json()["contributed_to_community"] is False
    assert community_reports(client, auth_with_profile) == []


def test_cannot_log_call_to_foreign_pharmacy(client, auth):
    from conftest import register
    other = register(client, "other@test.com")
    p = make_pharmacy(client, other)
    assert log_call(client, auth, p["id"]).status_code == 404


def test_patch_toggle_on_creates_report(client, auth_with_profile):
    p = make_pharmacy(client, auth_with_profile)
    call = log_call(client, auth_with_profile, p["id"]).json()

    r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth_with_profile,
                     json={"contribute_to_community": True})
    assert r.status_code == 200
    assert r.json()["contributed_to_community"] is True
    assert len(community_reports(client, auth_with_profile)) == 1


def test_patch_cannot_retract_contribution(client, auth_with_profile):
    p = make_pharmacy(client, auth_with_profile)
    call = log_call(client, auth_with_profile, p["id"], contribute_to_community=True).json()

    r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth_with_profile,
                     json={"contribute_to_community": False})
    assert r.status_code == 400


def test_list_filters_by_pharmacy(client, auth):
    p1 = make_pharmacy(client, auth, name="One")
    p2 = make_pharmacy(client, auth, name="Two")
    log_call(client, auth, p1["id"])
    log_call(client, auth, p2["id"])

    r = client.get(f"/api/v1/calls/?pharmacy_id={p1['id']}", headers=auth)
    assert [c["pharmacy_id"] for c in r.json()] == [p1["id"]]
