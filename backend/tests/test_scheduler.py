from datetime import date, timedelta
from unittest.mock import patch, MagicMock

from conftest import register, make_pharmacy
from database import SessionLocal
from models import RefillCountdown, CallLog

import scheduler


def _db():
    return SessionLocal()


@patch("scheduler.httpx.post")
def test_refill_reminder_fires_once_per_cycle(mock_post, client):
    auth = register(client, email="refill@test.com")
    client.patch("/api/v1/users/me", headers=auth, json={"push_token": "ExponentPushToken[refill]"})
    # Fill 40 days ago, 30-day supply, 7-day lead time -> hunt window opened 3 days ago
    last_fill = (date.today() - timedelta(days=40)).isoformat()
    client.put(
        "/api/v1/users/me/refill-countdown", headers=auth,
        json={
            "medication_name": "Vyvanse", "last_fill_date": last_fill,
            "days_supply": 30, "lead_time_days": 7,
        },
    )

    db = _db()
    scheduler.run_refill_reminders(db)
    assert mock_post.called
    body = mock_post.call_args.kwargs["json"]
    assert body[0]["to"] == "ExponentPushToken[refill]"
    assert "Vyvanse" in body[0]["body"]

    mock_post.reset_mock()
    scheduler.run_refill_reminders(db)
    assert not mock_post.called  # already notified for this cycle
    db.close()


@patch("scheduler.httpx.post")
def test_refill_reminder_not_due_yet(mock_post, client):
    auth = register(client, email="refill2@test.com")
    client.patch("/api/v1/users/me", headers=auth, json={"push_token": "ExponentPushToken[refill2]"})
    client.put(
        "/api/v1/users/me/refill-countdown", headers=auth,
        json={
            "medication_name": "Vyvanse", "last_fill_date": date.today().isoformat(),
            "days_supply": 30, "lead_time_days": 7,
        },
    )

    db = _db()
    scheduler.run_refill_reminders(db)
    assert not mock_post.called
    db.close()


@patch("scheduler.httpx.post")
def test_checkback_reminder_fires_once(mock_post, client):
    auth = register(client, email="checkback@test.com")
    client.patch("/api/v1/users/me", headers=auth, json={"push_token": "ExponentPushToken[checkback]"})
    p = make_pharmacy(client, auth, name="Checkback Pharmacy")
    call = client.post(
        "/api/v1/calls/", headers=auth,
        json={"pharmacy_id": p["id"], "status": "check_back"},
    ).json()
    client.patch(
        f"/api/v1/calls/{call['id']}", headers=auth,
        json={"expected_restock_date": date.today().isoformat()},
    )

    db = _db()
    scheduler.run_checkback_reminders(db)
    assert mock_post.called
    body = mock_post.call_args.kwargs["json"]
    assert body[0]["to"] == "ExponentPushToken[checkback]"
    assert "Checkback Pharmacy" in body[0]["body"]

    mock_post.reset_mock()
    scheduler.run_checkback_reminders(db)
    assert not mock_post.called
    db.close()


@patch("scheduler.httpx.post")
def test_checkback_reminder_not_due_yet(mock_post, client):
    auth = register(client, email="checkback2@test.com")
    client.patch("/api/v1/users/me", headers=auth, json={"push_token": "ExponentPushToken[checkback2]"})
    p = make_pharmacy(client, auth, name="Future Pharmacy")
    call = client.post(
        "/api/v1/calls/", headers=auth,
        json={"pharmacy_id": p["id"], "status": "check_back"},
    ).json()
    client.patch(
        f"/api/v1/calls/{call['id']}", headers=auth,
        json={"expected_restock_date": (date.today() + timedelta(days=5)).isoformat()},
    )

    db = _db()
    scheduler.run_checkback_reminders(db)
    assert not mock_post.called
    db.close()


def _fake_fda_response(availabilities):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"results": [{"availability": a, "related_info": f"info: {a}"} for a in availabilities]}
    resp.raise_for_status = lambda: None
    return resp


@patch("scheduler.httpx.get")
def test_fda_ingestion_classifies_unavailable_as_worst(mock_get, client):
    auth = register(client, email="fda@test.com")
    client.post(
        "/api/v1/users/tracked-medications", headers=auth,
        json={"medication_name": "Adderall", "strength": "20mg"},
    )
    mock_get.return_value = _fake_fda_response(["Available", "Limited Availability", "Unavailable"])

    db = _db()
    scheduler.run_fda_shortage_ingestion(db)
    db.close()

    r = client.get("/api/v1/availability/shortage-status?medication_name=Adderall", headers=auth)
    assert r.status_code == 200
    assert r.json()["status"] == "unavailable"


@patch("scheduler.httpx.get")
def test_fda_ingestion_all_available(mock_get, client):
    auth = register(client, email="fda2@test.com")
    client.post(
        "/api/v1/users/tracked-medications", headers=auth,
        json={"medication_name": "Concerta", "strength": "36mg"},
    )
    mock_get.return_value = _fake_fda_response(["Available", "Available"])

    db = _db()
    scheduler.run_fda_shortage_ingestion(db)
    db.close()

    r = client.get("/api/v1/availability/shortage-status?medication_name=Concerta", headers=auth)
    assert r.json()["status"] == "available"


def test_shortage_status_missing_returns_null(client, auth):
    r = client.get("/api/v1/availability/shortage-status?medication_name=NeverHeardOfIt", headers=auth)
    assert r.status_code == 200
    assert r.json() is None


@patch("scheduler.httpx.get")
def test_fda_ingestion_handles_404_gracefully(mock_get, client):
    auth = register(client, email="fda3@test.com")
    client.post(
        "/api/v1/users/tracked-medications", headers=auth,
        json={"medication_name": "SomeObscureBrand", "strength": "10mg"},
    )
    resp = MagicMock()
    resp.status_code = 404
    mock_get.return_value = resp

    db = _db()
    scheduler.run_fda_shortage_ingestion(db)  # should not raise
    db.close()

    r = client.get("/api/v1/availability/shortage-status?medication_name=SomeObscureBrand", headers=auth)
    assert r.json() is None
