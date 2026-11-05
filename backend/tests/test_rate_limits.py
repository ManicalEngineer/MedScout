"""Limits, login failure guard, and the 429 response shape."""
from conftest import register

LOGIN = "/api/v1/auth/login"


def bad_login(client, email, headers=None):
    return client.post(LOGIN, data={"username": email, "password": "wrong-wrong"}, headers=headers or {})


def test_register_allows_60_per_hour_per_ip(client):
    codes = [client.post("/api/v1/auth/register", json={"email": f"u{i}@test.com", "password": "password123"}).status_code
             for i in range(62)]
    assert codes[:60] == [201] * 60
    assert codes[60:] == [429, 429]


def test_429_shape_has_detail_and_retry_after(client):
    r = None
    for _ in range(12):
        r = client.post(LOGIN, data={"username": "nobody@test.com", "password": "x" * 10})
        if r.status_code == 429:
            break
    assert r.status_code == 429
    assert set(r.json()) == {"detail"}
    assert r.json()["detail"]
    assert int(r.headers["Retry-After"]) >= 1


def test_per_minute_ip_limit_returns_slowapi_429_with_retry_after(client):
    # 10/min per IP is hit before the per-email failure guard (distinct emails)
    for i in range(10):
        assert bad_login(client, f"x{i}@test.com").status_code == 401
    r = bad_login(client, "x11@test.com")
    assert r.status_code == 429
    assert "too often" in r.json()["detail"]
    assert 1 <= int(r.headers["Retry-After"]) <= 60


def test_email_guard_blocks_after_10_failures_same_client(client):
    import rate_limit
    for _ in range(10):
        rate_limit.limiter.reset()           # keep the per-minute IP limit out of the way
        assert bad_login(client, "victim@test.com").status_code == 401
    rate_limit.limiter.reset()
    r = bad_login(client, "victim@test.com")
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_email_guard_is_case_and_whitespace_insensitive(client):
    import rate_limit
    for i in range(10):
        rate_limit.limiter.reset()
        bad_login(client, ["A@Test.com", "a@test.com", " a@test.com"][i % 3])
    rate_limit.limiter.reset()
    assert bad_login(client, "a@TEST.com").status_code == 429


def test_guard_answers_same_for_known_and_unknown_email(client):
    import rate_limit
    register(client, "real@test.com")
    outcomes = []
    for email in ("real@test.com", "ghost@test.com"):
        seq = []
        for _ in range(12):
            rate_limit.limiter.reset()
            r = bad_login(client, email)
            seq.append((r.status_code, r.json()["detail"] if r.status_code == 429 else None))
        outcomes.append(seq)
    assert outcomes[0] == outcomes[1]


def test_attacker_cannot_lock_out_victim_from_another_client(client):
    import rate_limit
    register(client, "victim@test.com", "correct-horse-1")
    for _ in range(11):
        rate_limit.limiter.reset()
        bad_login(client, "victim@test.com")      # attacker, testclient address
    rate_limit.limiter.reset()
    assert bad_login(client, "victim@test.com").status_code == 429
    # Victim signs in from a different address: the pair bucket is theirs alone.
    import rate_limit as rl
    orig = rl._client_ip_key
    rl._client_ip_key = lambda request: "ip:198.51.100.7"
    try:
        r = client.post(LOGIN, data={"username": "victim@test.com", "password": "correct-horse-1"})
    finally:
        rl._client_ip_key = orig
    assert r.status_code == 200


def test_successful_login_not_counted(client):
    register(client, "ok@test.com", "correct-horse-1")
    import rate_limit
    for _ in range(15):
        rate_limit.limiter.reset()
        assert client.post(LOGIN, data={"username": "ok@test.com", "password": "correct-horse-1"}).status_code == 200


def test_authenticated_limit_is_per_user_not_per_ip(client):
    """Two users from the same address have separate buckets on a keyed route."""
    h1, h2 = register(client, "u1@test.com"), register(client, "u2@test.com")
    body = {"name": "P", "phone": "5551234567", "zip_code": "90210", "latitude": 34.09, "longitude": -118.41}
    c1 = [client.post("/api/v1/pharmacies/", headers=h1, json=body).status_code for _ in range(61)]
    assert c1[:60] == [201] * 60 and c1[60] == 429
    assert client.post("/api/v1/pharmacies/", headers=h2, json=body).status_code == 201
