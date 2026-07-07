"""Shared fixtures — temp-file SQLite DB, fresh tables and rate-limit
counters per test. Env vars are set before any app module is imported."""
import os
import sys
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0000")
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/medscout_test.db"

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

from database import Base, engine
from rate_limit import limiter
import main


@pytest.fixture(autouse=True)
def fresh_state():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    limiter.reset()
    yield


@pytest.fixture
def client():
    return TestClient(main.app)


def register(client, email="user@test.com", password="password123"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def auth(client):
    return register(client)


@pytest.fixture
def auth_with_profile(client, auth):
    r = client.post(
        "/api/v1/users/me/medication-profiles",
        headers=auth,
        json={"medication_name": "Adderall XR", "strength": "20mg"},
    )
    assert r.status_code == 201, r.text
    return auth


def make_pharmacy(client, headers, **overrides):
    body = {
        "name": "Test Pharmacy",
        "phone": "5551234567",
        "zip_code": "90210",
        "latitude": 34.09,
        "longitude": -118.41,
    }
    body.update(overrides)
    r = client.post("/api/v1/pharmacies/", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()
