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
    p = make_pharmacy(client, auth)
    client.post("/api/v1/calls/", headers=auth,
                json={"pharmacy_id": p["id"], "status": "check_back"})
    r = client.get("/api/v1/availability/map", headers=auth)
    assert r.status_code == 200
    assert any(item["source"] == "my_logs" for item in r.json())


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
    assert len(near.json()) == 1
    assert len(far.json()) == 0


def test_heatmap_is_gated_until_contribution(client, auth):
    r = client.get("/api/v1/availability/heatmap", headers=auth)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "contribute_required"

    submit_report(client, auth)
    r = client.get("/api/v1/availability/heatmap", headers=auth)
    assert r.status_code == 200
    zips = {row["zip_code"] for row in r.json()}
    assert "90210" in zips
