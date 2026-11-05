"""Shared rate limiter — lives in its own module so routers and main.py
can both import it without a circular import."""
import ipaddress
import os

from jose import JWTError, jwt
from slowapi import Limiter

_ALGORITHM = "HS256"  # must match routers/auth.py


def _client_ip_key(request) -> str:
    """Key on the client address, prefixed by kind so keys can't collide.

    Reads only request.client.host. Uvicorn has already replaced it with the
    real client IP from the trusted proxy (127.0.0.1); X-Forwarded-For and
    CF-Connecting-IP are deliberately never read here because a caller can
    send them. IPv6 collapses to its /64: carrier phones rotate addresses
    inside one /64, so the full address would give them a fresh bucket each time.
    """
    host = request.client.host if request.client else ""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return f"ip:{host or 'unknown'}"
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return f"ip:{ip.ipv4_mapped}"
        net = ipaddress.ip_network(f"{ip}/64", strict=False)
        return f"ip6:{net}"
    return f"ip:{ip}"


def _user_id_from_token(request):
    """User id from a verified bearer token, or None. The signature and expiry
    are checked; an unverified claim is never trusted."""
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        return None
    try:
        payload = jwt.decode(token.strip(), secret, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError):
        return None


def ip_key_func(request) -> str:
    """For unauthenticated routes (register/login/oauth): always the IP key, so
    holding a token can't buy extra buckets there."""
    return _client_ip_key(request)


def user_or_ip_key_func(request) -> str:
    """Default key: the verified user id, else the client IP."""
    uid = _user_id_from_token(request)
    if uid is not None:
        return f"user:{uid}"
    return _client_ip_key(request)


limiter = Limiter(key_func=user_or_ip_key_func)
