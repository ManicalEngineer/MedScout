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
