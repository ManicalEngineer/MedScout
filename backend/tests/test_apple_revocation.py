"""Sign in with Apple token exchange + revocation on account deletion."""
import apple_auth
from routers import auth as auth_router
from database import SessionLocal
from models import User


def _apple_login(client, monkeypatch, code="auth-code"):
    monkeypatch.setattr(
        auth_router, "_verify_oauth_id_token",
        lambda provider, token: {"sub": "apple-sub-1", "email": "apple@test.com", "email_verified": "true"},
    )
    body = {"provider": "apple", "id_token": "x"}
    if code:
        body["authorization_code"] = code
    r = client.post("/api/v1/auth/oauth", json=body)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_code_is_exchanged_and_token_revoked_on_delete(client, monkeypatch):
    revoked = []
    monkeypatch.setattr(apple_auth, "exchange_code_for_refresh_token", lambda c: f"refresh-for-{c}")
    monkeypatch.setattr(apple_auth, "revoke_refresh_token", lambda t: revoked.append(t) or True)
    headers = _apple_login(client, monkeypatch)
    db = SessionLocal()
    assert db.query(User).filter_by(email="apple@test.com").one().apple_refresh_token == "refresh-for-auth-code"
    db.close()
    r = client.request("DELETE", "/api/v1/users/me", headers=headers, json={})
    assert r.status_code == 204
    assert revoked == ["refresh-for-auth-code"]


def test_delete_still_succeeds_when_revocation_fails(client, monkeypatch):
    monkeypatch.setattr(apple_auth, "exchange_code_for_refresh_token", lambda c: "tok")
    monkeypatch.setattr(apple_auth, "revoke_refresh_token", lambda t: False)
    headers = _apple_login(client, monkeypatch)
    assert client.request("DELETE", "/api/v1/users/me", headers=headers, json={}).status_code == 204


def test_no_code_means_no_token_and_no_revoke_call(client, monkeypatch):
    revoked = []
    monkeypatch.setattr(apple_auth, "revoke_refresh_token", lambda t: revoked.append(t) or True)
    headers = _apple_login(client, monkeypatch, code=None)
    assert client.request("DELETE", "/api/v1/users/me", headers=headers, json={}).status_code == 204
    assert revoked == []


def test_inactive_without_apple_key_config(monkeypatch):
    for k in ("APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"):
        monkeypatch.delenv(k, raising=False)
    assert apple_auth.is_configured() is False
    assert apple_auth.exchange_code_for_refresh_token("c") is None
    assert apple_auth.revoke_refresh_token("t") is False


def test_requests_to_apple_are_correctly_formed(monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    from jose import jwt
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption()).decode()
    pub = key.public_key().public_bytes(serialization.Encoding.PEM,
                                        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv("APPLE_TEAM_ID", "TEAM123456")
    monkeypatch.setenv("APPLE_KEY_ID", "KEY1234567")
    monkeypatch.setenv("APPLE_PRIVATE_KEY", pem.replace("\n", "\\n"))  # single-line env form
    monkeypatch.setenv("APPLE_CLIENT_ID", "com.medscout.app")
    calls = []

    class Resp:
        def __init__(self, data): self._d = data
        def raise_for_status(self): pass
        def json(self): return self._d

    def fake_post(url, data=None, timeout=None):
        calls.append((url, data))
        return Resp({"refresh_token": "r1"})

    monkeypatch.setattr(apple_auth.httpx, "post", fake_post)
    assert apple_auth.exchange_code_for_refresh_token("code1") == "r1"
    assert apple_auth.revoke_refresh_token("r1") is True
    (turl, tdata), (rurl, rdata) = calls
    assert turl == apple_auth.APPLE_TOKEN_URL and tdata["grant_type"] == "authorization_code" and tdata["code"] == "code1"
    assert rurl == apple_auth.APPLE_REVOKE_URL and rdata["token"] == "r1" and rdata["token_type_hint"] == "refresh_token"
    claims = jwt.decode(rdata["client_secret"], pub, algorithms=["ES256"], audience="https://appleid.apple.com")
    assert claims["iss"] == "TEAM123456" and claims["sub"] == "com.medscout.app"
    assert jwt.get_unverified_header(rdata["client_secret"])["kid"] == "KEY1234567"
