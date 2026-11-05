"""Key function for the shared rate limiter."""
from datetime import timedelta
from types import SimpleNamespace

from jose import jwt

from rate_limit import ip_key_func, user_or_ip_key_func
from routers.auth import ALGORITHM, SECRET_KEY
from timeutil import utcnow


def req(host="1.2.3.4", headers=None):
    return SimpleNamespace(
        client=SimpleNamespace(host=host) if host is not None else None,
        headers={k.lower(): v for k, v in (headers or {}).items()},
    )


def token(sub=7, exp_delta=timedelta(hours=1), secret=SECRET_KEY):
    return jwt.encode({"sub": str(sub), "ver": 0, "exp": utcnow() + exp_delta}, secret, algorithm=ALGORITHM)


def test_ipv4_full_address():
    assert user_or_ip_key_func(req("203.0.113.9")) == "ip:203.0.113.9"
    assert user_or_ip_key_func(req("203.0.113.9")) != user_or_ip_key_func(req("203.0.113.10"))


def test_ipv6_same_64_collapses():
    a = user_or_ip_key_func(req("2600:1700:abcd:1234::1"))
    b = user_or_ip_key_func(req("2600:1700:abcd:1234:ffff:eeee:dddd:cccc"))
    assert a == b == "ip6:2600:1700:abcd:1234::/64"


def test_ipv6_different_64_separate():
    assert user_or_ip_key_func(req("2600:1700:abcd:1234::1")) != user_or_ip_key_func(req("2600:1700:abcd:1235::1"))


def test_ipv4_mapped_ipv6_treated_as_ipv4():
    assert user_or_ip_key_func(req("::ffff:203.0.113.9")) == "ip:203.0.113.9"


def test_kinds_cannot_collide():
    keys = {user_or_ip_key_func(req("1.2.3.4", {"Authorization": f"Bearer {token(1)}"})),
            user_or_ip_key_func(req("1.2.3.4")),
            user_or_ip_key_func(req("2600::1"))}
    assert len(keys) == 3
    assert user_or_ip_key_func(req("1.2.3.4", {"Authorization": f"Bearer {token(1)}"})) == "user:1"


def test_authenticated_keys_on_user_not_ip():
    h = {"Authorization": f"Bearer {token(42)}"}
    assert user_or_ip_key_func(req("1.1.1.1", h)) == user_or_ip_key_func(req("9.9.9.9", h)) == "user:42"


def test_spoofed_forwarding_headers_ignored():
    spoof = {"X-Forwarded-For": "8.8.8.8", "CF-Connecting-IP": "8.8.4.4", "X-Real-IP": "9.9.9.9"}
    assert user_or_ip_key_func(req("203.0.113.9", spoof)) == "ip:203.0.113.9"


def test_invalid_expired_or_wrong_signature_token_falls_back_to_ip():
    for t in ("garbage", token(5, timedelta(hours=-1)), token(5, secret="another-secret-key-entirely-0000000")):
        assert user_or_ip_key_func(req("1.2.3.4", {"Authorization": f"Bearer {t}"})) == "ip:1.2.3.4"


def test_unsigned_alg_none_token_rejected():
    import base64, json
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
    forged = f"{b({'alg': 'none', 'typ': 'JWT'})}.{b({'sub': '1'})}."
    assert user_or_ip_key_func(req("1.2.3.4", {"Authorization": f"Bearer {forged}"})) == "ip:1.2.3.4"


def test_non_bearer_scheme_ignored():
    assert user_or_ip_key_func(req("1.2.3.4", {"Authorization": f"Basic {token(3)}"})) == "ip:1.2.3.4"


def test_ip_key_func_ignores_token():
    h = {"Authorization": f"Bearer {token(42)}"}
    assert ip_key_func(req("1.2.3.4", h)) == "ip:1.2.3.4"


def test_missing_client():
    assert user_or_ip_key_func(req(None)) == "ip:unknown"
