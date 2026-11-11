"""End-to-end demonstration of the real limiter key function through the real app.

Run with `pytest -s tests/test_limiter_isolation.py` to see the printed summary.
Each simulated client is its own TestClient with its own source address (the
address Uvicorn would have resolved from the trusted proxy).
"""
from fastapi.testclient import TestClient

import main
from conftest import register

PHARMACY = {"name": "P", "phone": "5551234567", "zip_code": "90210", "latitude": 34.09, "longitude": -118.41}
CREATE = "/api/v1/pharmacies/"      # 60/hour, keyed per user


def client_at(ip):
    return TestClient(main.app, client=(ip, 50000))


def make_user(c, n):
    return register(c, email=f"sim{n}@test.com")


def test_many_users_do_not_interfere_and_one_user_is_limited():
    # 12 users on 12 different IPv4 addresses + 4 on IPv6 addresses, each with its own token.
    sims = [(client_at(f"198.51.100.{i + 1}"), i) for i in range(12)]
    sims += [(client_at(f"2600:1700:{i:x}::{i + 1:x}"), 12 + i) for i in range(4)]
    users = [(c, make_user(c, n)) for c, n in sims]

    heavy_c, heavy_h = users[0]
    codes = [heavy_c.post(CREATE, headers=heavy_h, json=PHARMACY).status_code for _ in range(61)]
    assert codes[:60] == [201] * 60 and codes[60] == 429            # the one heavy user is limited

    others = {}
    for c, h in users[1:]:
        others[id(c)] = [c.post(CREATE, headers=h, json=PHARMACY).status_code for _ in range(20)]
    assert all(v == [201] * 20 for v in others.values())            # nobody else noticed
    print(f"\nheavy user: 60x201 then 429; {len(others)} other users: 20/20 succeeded each")


def test_many_users_behind_one_shared_ip_get_separate_buckets():
    """Carrier NAT: 8 users, one address. Per-IP keys would share 60/hour; per-user keys don't."""
    shared = "203.0.113.50"
    users = []
    for n in range(8):
        c = client_at(shared)
        users.append((c, make_user(c, 100 + n)))
    # register is keyed on IP (60/h) so 8 signups from one address is fine; now 30 writes each = 240 > 60
    results = [c.post(CREATE, headers=h, json=PHARMACY).status_code for c, h in users for _ in range(30)]
    assert results.count(201) == 240 and 429 not in results
    print("\n8 users on one IP made 240 keyed requests with no 429")


def test_anonymous_routes_share_ip_bucket_and_ipv6_collapses_to_64():
    reg = lambda c, i: c.post("/api/v1/auth/register", json={"email": f"anon{i}@test.com", "password": "password123"}).status_code
    a = client_at("192.0.2.10")
    assert [reg(a, i) for i in range(60)] == [201] * 60
    assert reg(a, 999) == 429                                       # 61st from this address
    assert reg(client_at("192.0.2.11"), 1000) == 201                # a neighbour is unaffected

    v6 = lambda host: client_at(host)
    first = v6("2600:abcd:1:2::1")
    assert [reg(first, 2000 + i) for i in range(60)] == [201] * 60
    assert reg(v6("2600:abcd:1:2:ffff::9"), 3000) == 429            # same /64: same bucket (address rotation)
    assert reg(v6("2600:abcd:1:3::1"), 3001) == 201                 # different /64: separate
    print("\nIPv4 and IPv6 anonymous buckets behave as designed")


def test_spoofed_forwarding_headers_cannot_dodge_or_frame_anyone():
    c = client_at("192.0.2.77")
    codes = []
    for i in range(62):
        h = {"X-Forwarded-For": f"10.0.{i}.1", "CF-Connecting-IP": f"10.1.{i}.1"}
        codes.append(c.post("/api/v1/auth/register", headers=h,
                            json={"email": f"spoof{i}@test.com", "password": "password123"}).status_code)
    assert codes[:60] == [201] * 60 and codes[60:] == [429, 429]    # rotating the headers bought nothing
