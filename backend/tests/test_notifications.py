from unittest.mock import patch

from conftest import register


def setup_recipient(client, push_token="ExponentPushToken[recipient]", **alert_overrides):
    """A user with matching alert-settings medication/strength, a nearby
    pharmacy, and alerts enabled."""
    auth = register(client, email="recipient@test.com")
    client.post(
        "/api/v1/pharmacies/", headers=auth,
        json={"name": "Recipient's Pharmacy", "phone": "5551234567",
              "latitude": 34.09, "longitude": -118.41},
    )
    client.patch("/api/v1/users/me", headers=auth, json={"push_token": push_token})
    alert_body = {
        "enabled": True, "radius_miles": 25, "quiet_hours_start": 22, "quiet_hours_end": 8,
        "medication_name": "Adderall XR", "strength": "20mg",
    }
    alert_body.update(alert_overrides)
    client.put("/api/v1/users/me/alert-settings", headers=auth, json=alert_body)
    return auth


def submit_nearby_report(client, reporter_auth, **overrides):
    body = {
        "pharmacy_name": "Rx Corner",
        "latitude": 34.10,  # ~1mi from the recipient's pharmacy
        "longitude": -118.42,
        "zip_code": "90210",
        "medication_name": "Adderall XR",
        "strength": "20mg",
        "status": "in_stock",
    }
    body.update(overrides)
    return client.post("/api/v1/availability/report", headers=reporter_auth, json=body)


@patch("notifications.httpx.post")
def test_notifies_matching_nearby_user(mock_post, client):
    setup_recipient(client)
    reporter = register(client, email="reporter@test.com")

    r = submit_nearby_report(client, reporter)
    assert r.status_code == 201

    assert mock_post.called
    messages = mock_post.call_args.kwargs["json"]
    assert len(messages) == 1
    assert messages[0]["to"] == "ExponentPushToken[recipient]"
    assert "Adderall XR" in messages[0]["body"]


@patch("notifications.httpx.post")
def test_does_not_notify_out_of_range(mock_post, client):
    setup_recipient(client, radius_miles=1)
    reporter = register(client, email="reporter@test.com")

    # ~500 miles away
    r = submit_nearby_report(client, reporter, latitude=40.71, longitude=-74.01)
    assert r.status_code == 201
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_when_disabled(mock_post, client):
    setup_recipient(client, enabled=False)
    reporter = register(client, email="reporter@test.com")

    submit_nearby_report(client, reporter)
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_without_push_token(mock_post, client):
    setup_recipient(client, push_token=None)
    reporter = register(client, email="reporter@test.com")

    submit_nearby_report(client, reporter)
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_mismatched_medication(mock_post, client):
    setup_recipient(client)
    reporter = register(client, email="reporter@test.com")

    submit_nearby_report(client, reporter, medication_name="Vyvanse", strength="30mg")
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_out_of_stock_report(mock_post, client):
    setup_recipient(client)
    reporter = register(client, email="reporter@test.com")

    submit_nearby_report(client, reporter, status="out_of_stock")
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_self_contribution(mock_post, client):
    # The recipient calling in their own pharmacy's stock shouldn't notify themselves.
    auth = setup_recipient(client)
    p = client.post(
        "/api/v1/pharmacies/", headers=auth,
        json={"name": "Self Pharmacy", "phone": "5559998888", "latitude": 34.09, "longitude": -118.41},
    ).json()
    r = client.post(
        "/api/v1/calls/", headers=auth,
        json={
            "pharmacy_id": p["id"], "status": "in_stock", "contribute_to_community": True,
            "medication_name": "Adderall XR", "strength": "20mg",
        },
    )
    assert r.status_code == 201
    assert not mock_post.called


@patch("notifications.httpx.post")
def test_does_not_notify_during_quiet_hours(mock_post, client):
    from datetime import datetime, timezone
    current_hour = datetime.now(timezone.utc).astimezone().hour
    # Quiet hours window covering the current hour, e.g. now->now+1 (wrapping midnight-safe)
    setup_recipient(client, quiet_hours_start=current_hour, quiet_hours_end=(current_hour + 1) % 24)
    reporter = register(client, email="reporter@test.com")

    submit_nearby_report(client, reporter)
    assert not mock_post.called
