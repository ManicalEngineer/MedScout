from conftest import make_pharmacy


def submit_report(client, headers, **overrides):
    body = {
        "pharmacy_name": "Rx Corner",
        "zip_code": "90210",
        "latitude": 34.09,
        "longitude": -118.41,
        "medication_name": "Adderall XR",
        "strength": "20mg",
        "status": "in_stock",
    }
    body.update(overrides)
    return client.post("/api/v1/availability/report", headers=headers, json=body)


def test_map_includes_own_call_logs(client, auth):
    # my_logs is opt-in via ?sources= — private call logs shouldn't show up on
    # a bare /map fetch by default, only when explicitly requested.
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth,
                json={"pharmacy_id": p["id"], "status": "check_back"})
    r = client.get("/api/v1/availability/map?sources=my_logs", headers=auth)
    assert r.status_code == 200
    assert any(item["source"] == "my_logs" for item in r.json()["reports"])


def test_map_defaults_exclude_own_call_logs(client, auth):
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth,
                json={"pharmacy_id": p["id"], "status": "check_back"})
    r = client.get("/api/v1/availability/map", headers=auth)
    assert r.status_code == 200
    assert not any(item["source"] == "my_logs" for item in r.json()["reports"])


def test_map_strength_filter_does_not_crash(client, auth):
    # Regression: this 500'd when CallLog.extracted_strength was removed
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth, json={"pharmacy_id": p["id"], "status": "in_stock"})
    r = client.get("/api/v1/availability/map?strength=20mg", headers=auth)
    assert r.status_code == 200


def test_submit_report_and_trust_level(client, auth):
    r = submit_report(client, auth)
    assert r.status_code == 201
    assert r.json()["trust_level"] == "fresh"


def test_report_validation(client, auth):
    assert submit_report(client, auth, latitude=91).status_code == 422
    assert submit_report(client, auth, longitude=-200).status_code == 422
    assert submit_report(client, auth, zip_code="not-a-zip").status_code == 422
    assert submit_report(client, auth, medication_name="").status_code == 422
    assert submit_report(client, auth, pharmacy_name="x" * 500).status_code == 422


def test_per_user_report_throttle(client, auth):
    assert submit_report(client, auth).status_code == 201
    assert submit_report(client, auth).status_code == 429


def test_map_radius_filter(client, auth):
    submit_report(client, auth)  # at 34.09,-118.41
    near = client.get("/api/v1/availability/map?lat=34.09&lng=-118.41&radius_miles=5", headers=auth)
    far = client.get("/api/v1/availability/map?lat=40.7&lng=-74.0&radius_miles=5", headers=auth)
    assert len(near.json()["reports"]) == 1
    assert len(far.json()["reports"]) == 0


def test_heatmap_is_gated_until_contribution(client, auth):
    r = client.get("/api/v1/availability/heatmap", headers=auth)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "contribute_required"

    submit_report(client, auth)
    r = client.get("/api/v1/availability/heatmap", headers=auth)
    assert r.status_code == 200
    zips = {row["zip_code"] for row in r.json()}
    assert "90210" in zips


def test_map_community_reports_gated_until_contribution(client, auth, auth2):
    # auth2 contributes a report; auth (never contributed) should not see it.
    submit_report(client, auth2)

    locked = client.get("/api/v1/availability/map", headers=auth)
    assert locked.status_code == 200
    body = locked.json()
    assert body["community_locked"] is True
    assert body["reports"] == []

    # Contributing unlocks it for auth.
    submit_report(client, auth)
    unlocked = client.get("/api/v1/availability/map", headers=auth)
    body = unlocked.json()
    assert body["community_locked"] is False
    assert len(body["reports"]) == 2


def test_map_my_logs_unaffected_by_gating(client, auth):
    # A user's own private call logs should always be visible, contributor or not.
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth,
                json={"pharmacy_id": p["id"], "status": "check_back"})
    r = client.get("/api/v1/availability/map?sources=my_logs", headers=auth)
    body = r.json()
    assert body["community_locked"] is False
    assert any(item["source"] == "my_logs" for item in body["reports"])


# --- Flagging / hiding contributors (App Store 1.2) ---

def _third_user(client):
    from conftest import register
    return register(client, email="user3@test.com")


def _fourth_user(client):
    from conftest import register
    return register(client, email="user4@test.com")


def _community(client, headers):
    return client.get("/api/v1/availability/map", headers=headers).json()["reports"]


def test_flag_requires_valid_reason_and_is_once_per_user(client, auth, auth2):
    rid = submit_report(client, auth2).json()["id"]
    assert client.post(f"/api/v1/availability/reports/{rid}/flag", headers=auth, json={"reason": "nope"}).status_code == 422
    assert client.post(f"/api/v1/availability/reports/{rid}/flag", headers=auth, json={"reason": "spam"}).status_code == 201
    assert client.post(f"/api/v1/availability/reports/{rid}/flag", headers=auth, json={"reason": "spam"}).status_code == 409
    assert client.post("/api/v1/availability/reports/9999/flag", headers=auth, json={"reason": "spam"}).status_code == 404


def test_three_flags_from_different_users_auto_hide(client, auth, auth2):
    rid = submit_report(client, auth2).json()["id"]
    submit_report(client, auth)  # unlock community reports for auth
    u3, u4 = _third_user(client), _fourth_user(client)
    submit_report(client, u3)
    submit_report(client, u4)
    assert any(r["id"] == rid for r in _community(client, auth))
    for h in (auth, u3):
        r = client.post(f"/api/v1/availability/reports/{rid}/flag", headers=h, json={"reason": "wrong_or_outdated"})
        assert r.json()["hidden"] is False
    r = client.post(f"/api/v1/availability/reports/{rid}/flag", headers=u4, json={"reason": "abusive"})
    assert r.json()["hidden"] is True
    assert all(x["id"] != rid for x in _community(client, auth))
    assert all(x["id"] != rid for x in _community(client, auth2))


def test_flagged_report_is_hidden_for_the_flagger_only(client, auth, auth2):
    rid = submit_report(client, auth2).json()["id"]
    submit_report(client, auth)  # unlock community reports for auth
    assert any(x["id"] == rid for x in _community(client, auth))
    client.post(f"/api/v1/availability/reports/{rid}/flag", headers=auth, json={"reason": "spam"})
    assert all(x["id"] != rid for x in _community(client, auth))
    assert any(x["id"] == rid for x in _community(client, auth2))


def test_reports_and_calls_hold_no_link_to_an_account():
    from models import AvailabilityReport, CallLog
    assert not hasattr(AvailabilityReport, "contributor_id")
    assert not hasattr(AvailabilityReport, "user_id")
    assert not hasattr(CallLog, "contributed_report_id")


def test_own_contributed_call_not_shown_twice(client, auth):
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth, json={
        "pharmacy_id": p["id"], "status": "in_stock", "contribute_to_community": True,
        "medication_name": "Adderall", "strength": "20mg"})
    r = client.get("/api/v1/availability/map?sources=my_logs,community", headers=auth).json()["reports"]
    assert len(r) == 1 and r[0]["source"] == "my_logs"


def test_deleting_account_keeps_report_and_removes_flags(client, auth, auth2):
    rid = submit_report(client, auth2).json()["id"]
    submit_report(client, auth)
    client.post(f"/api/v1/availability/reports/{rid}/flag", headers=auth, json={"reason": "spam"})
    r = client.request("DELETE", "/api/v1/users/me", headers=auth, json={"password": "password123"})
    assert r.status_code == 204
    from database import SessionLocal
    from models import AvailabilityReport, ReportFlag
    db = SessionLocal()
    assert db.get(AvailabilityReport, rid) is not None
    assert db.query(ReportFlag).count() == 0
    db.close()
