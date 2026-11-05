"""Shared rate limiter — lives in its own module so routers and main.py
can both import it without a circular import."""
import hashlib
import ipaddress
import math
import os
import time

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from limits import RateLimitItemPerHour
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

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


# --- Per-email login failure guard -------------------------------------------
#
# Counts FAILED logins only, in a sliding window, and answers identically for
# unknown and known emails (unknown emails are counted too), so it reveals
# nothing about which accounts exist.
#
# A cap on the email alone is a lockout lever: anyone can burn a victim's
# allowance with 10 wrong passwords an hour, forever. So the main cap is per
# (email, client key): one source can only exhaust its own allowance. The
# email-wide ceiling is a high backstop against distributed guessing; reaching
# it takes 10x the effort and still ends one hour after the attacker stops.
LOGIN_FAILS_PER_EMAIL_PER_CLIENT = 10   # per hour
LOGIN_FAILS_PER_EMAIL_ALL = 100         # per hour

_guard_storage = MemoryStorage()
_guard = MovingWindowRateLimiter(_guard_storage)
_PAIR_ITEM = RateLimitItemPerHour(LOGIN_FAILS_PER_EMAIL_PER_CLIENT)
_ALL_ITEM = RateLimitItemPerHour(LOGIN_FAILS_PER_EMAIL_ALL)

LOGIN_BLOCKED_MESSAGE = "Too many sign-in attempts. Please wait a while and try again."


def _email_digest(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _login_scopes(request, email: str):
    digest = _email_digest(email)
    return [
        (_PAIR_ITEM, ("login-fail", _client_ip_key(request), digest)),
        (_ALL_ITEM, ("login-fail-all", digest)),
    ]


def check_login_allowed(request, email: str) -> None:
    """Raise 429 if this email has too many recent failures. Does not record."""
    wait = 0
    for item, ids in _login_scopes(request, email):
        if not _guard.test(item, *ids):
            reset = _guard.get_window_stats(item, *ids).reset_time
            wait = max(wait, int(math.ceil(reset - time.time())))
    if wait:
        raise HTTPException(
            status_code=429,
            detail=LOGIN_BLOCKED_MESSAGE,
            headers={"Retry-After": str(max(wait, 1))},
        )


def record_login_failure(request, email: str) -> None:
    for item, ids in _login_scopes(request, email):
        _guard.hit(item, *ids)


def reset_all() -> None:
    """Clear every counter (tests)."""
    limiter.reset()
    _guard_storage.reset()


# --- 429 response ------------------------------------------------------------

def _human_wait(seconds: int) -> str:
    if seconds < 90:
        return f"{max(seconds, 1)} seconds"
    if seconds < 5400:
        return f"{round(seconds / 60)} minutes"
    return f"{round(seconds / 3600)} hours"


def rate_limit_exceeded_handler(request, exc: RateLimitExceeded) -> JSONResponse:
    """429 as {"detail": ...} (what the mobile client reads) with Retry-After.

    Built here rather than with Limiter(headers_enabled=True): that flag makes
    slowapi raise on any limited route that lacks a `response: Response`
    parameter, i.e. a 500 on every successful call.
    """
    retry_after = 60
    try:
        limit, args = request.state.view_rate_limit
        reset = limiter.limiter.get_window_stats(limit, *args).reset_time
        retry_after = max(1, int(math.ceil(reset - time.time())))
    except Exception:
        pass
    return JSONResponse(
        {"detail": f"You're doing that too often. Please wait {_human_wait(retry_after)} and try again."},
        status_code=429,
        headers={"Retry-After": str(retry_after)},
    )
