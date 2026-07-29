import os
import time
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
from jose import jwk, jwt

from conftest import register


def test_register_returns_token(client):
    r = client.post("/api/v1/auth/register", json={"email": "a@test.com", "password": "password123"})
    assert r.status_code == 201
    body = r.json()
    assert body["access_token"]
    assert body["subscription_tier"] == "free"


def test_register_duplicate_email(client):
    register(client, "a@test.com")
    r = client.post("/api/v1/auth/register", json={"email": "a@test.com", "password": "password123"})
    assert r.status_code == 409


def test_register_rejects_short_password(client):
    r = client.post("/api/v1/auth/register", json={"email": "a@test.com", "password": "short"})
    assert r.status_code == 422


def test_login_and_me(client):
    register(client, "a@test.com")
    r = client.post("/api/v1/auth/login", data={"username": "a@test.com", "password": "password123"})
    assert r.status_code == 200
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "a@test.com"


def test_login_wrong_password(client):
    register(client, "a@test.com")
    r = client.post("/api/v1/auth/login", data={"username": "a@test.com", "password": "wrongwrong"})
    assert r.status_code == 401


def test_forged_bearer_token_rejected(client):
    r = client.get("/api/v1/users/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_oauth_rejects_unknown_provider(client):
    r = client.post("/api/v1/auth/oauth", json={"provider": "evil", "id_token": "x"})
    assert r.status_code == 400


def test_oauth_rejects_forged_token(client):
    # 503 when the provider audience env isn't configured, 401 when it is —
    # either way a forged token must never mint a session.
    r = client.post("/api/v1/auth/oauth", json={"provider": "google", "id_token": "forged"})
    assert r.status_code in (401, 503)


def _make_id_token(audience, issuer="https://accounts.google.com", include_at_hash=True):
    """Builds a real RS256-signed id_token plus a matching JWKS document, the
    way Google actually issues one (always including at_hash) — used to
    reproduce and guard against the "No access_token provided to compare
    against at_hash claim" bug: we only ever receive the id_token, never the
    access_token, so at_hash verification must be disabled, not attempted."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    kid = "test-key-1"
    public_jwk = jwk.RSAKey(private_key.public_key(), algorithm="RS256").to_dict()
    public_jwk["kid"] = kid
    public_jwk["use"] = "sig"
    jwks = {"keys": [public_jwk]}

    claims = {
        "iss": issuer,
        "aud": audience,
        "sub": "google-user-123",
        "email": "oauthuser@test.com",
        "email_verified": True,
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    if include_at_hash:
        claims["at_hash"] = "does-not-matter-we-never-have-the-access-token"

    private_pem = private_key.private_bytes(
        encoding=Encoding.PEM, format=PrivateFormat.PKCS8, encryption_algorithm=NoEncryption(),
    )
    token = jwt.encode(claims, private_pem, algorithm="RS256", headers={"kid": kid})
    return token, jwks


def test_oauth_google_accepts_token_with_at_hash(client, monkeypatch):
    """Regression test: Google always includes at_hash in id_tokens, but the
    client only ever sends us the id_token (never the paired access_token),
    so there's nothing to verify at_hash against. This must not be treated
    as an invalid token."""
    import routers.auth as auth_module
    auth_module._jwks_cache.clear()

    audience = "test-google-client-id.apps.googleusercontent.com"
    token, jwks = _make_id_token(audience)
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", audience)

    with patch("routers.auth.httpx.get") as mock_get:
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = jwks
        r = client.post("/api/v1/auth/oauth", json={"provider": "google", "id_token": token})

    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


def test_login_rate_limit(client):
    register(client, "a@test.com")
    codes = [
        client.post("/api/v1/auth/login", data={"username": "a@test.com", "password": "nope-nope"}).status_code
        for _ in range(12)
    ]
    assert 429 in codes


def test_refresh_returns_new_valid_token(client):
    headers = register(client, "a@test.com")
    r = client.post("/api/v1/auth/refresh", headers=headers)
    assert r.status_code == 200
    new_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/v1/users/me", headers=new_headers).status_code == 200


def test_logout_all_revokes_existing_tokens(client):
    headers = register(client, "a@test.com")
    assert client.post("/api/v1/auth/logout-all", headers=headers).status_code == 204
    # The old token carries a stale version and must be rejected
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    # Fresh login works and yields a working token
    r = client.post("/api/v1/auth/login", data={"username": "a@test.com", "password": "password123"})
    assert r.status_code == 200
    fresh = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/v1/users/me", headers=fresh).status_code == 200
