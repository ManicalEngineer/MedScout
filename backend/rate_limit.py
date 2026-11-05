"""Shared rate limiter — lives in its own module so routers and main.py
can both import it without a circular import."""
import hashlib
import ipaddress
import logging
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

logger = logging.getLogger(__name__)

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
# Two counters, with deliberately different powers:
#
# * per (email, client key), 10/h: this one BLOCKS. Once a client has failed 10
#   times for an email, that client gets 429 until the window slides, even with
#   the right password. Other clients are unaffected, so an attacker cannot use
#   it to lock the real user out (short of sharing their IP or /64).
# * per email across all clients, 30/h: this one NEVER blocks a login. A correct
#   password always succeeds, whoever has been failing. When the count is over
#   the limit, a WRONG password gets 429 instead of 401 and a warning is logged.
#   That does not slow down guessing (each guess is still checked); it exists so
#   an ongoing distributed attack is visible in the logs and the real user sees
#   a clear message. Throttling the guessing itself is the job of the per-IP
#   limit and Cloudflare.
LOGIN_FAILS_PER_EMAIL_PER_CLIENT = 10   # per hour
LOGIN_FAILS_PER_EMAIL_ALL = 30          # per hour

_guard_storage = MemoryStorage()
_guard = MovingWindowRateLimiter(_guard_storage)
_PAIR_ITEM = RateLimitItemPerHour(LOGIN_FAILS_PER_EMAIL_PER_CLIENT)
_ALL_ITEM = RateLimitItemPerHour(LOGIN_FAILS_PER_EMAIL_ALL)

LOGIN_BLOCKED_MESSAGE = "Too many sign-in attempts. Please wait a while and try again."


def _email_digest(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _wait_seconds(item, ids) -> int:
    reset = _guard.get_window_stats(item, *ids).reset_time
    return max(1, int(math.ceil(reset - time.time())))


def _too_many(wait: int) -> HTTPException:
    return HTTPException(status_code=429, detail=LOGIN_BLOCKED_MESSAGE, headers={"Retry-After": str(wait)})


def check_login_allowed(request, email: str) -> bool:
    """Raise 429 if THIS client has too many recent failures for this email.
    Returns True if the email-wide counter is over its limit (informational:
    the caller must still verify the password, and must not block on it)."""
    digest = _email_digest(email)
    pair_ids = ("login-fail", _client_ip_key(request), digest)
    if not _guard.test(_PAIR_ITEM, *pair_ids):
        raise _too_many(_wait_seconds(_PAIR_ITEM, pair_ids))
    return not _guard.test(_ALL_ITEM, "login-fail-all", digest)


def fail_login(request, email: str, email_wide_over: bool):
    """Record a failed attempt and raise the response for it: 401, or 429 when
    the email-wide counter was already over its limit."""
    digest = _email_digest(email)
    _guard.hit(_PAIR_ITEM, "login-fail", _client_ip_key(request), digest)
    _guard.hit(_ALL_ITEM, "login-fail-all", digest)
    if email_wide_over:
        logger.warning("login_failures_high email_digest=%s limit=%s/h", digest[:10], LOGIN_FAILS_PER_EMAIL_ALL)
        raise _too_many(_wait_seconds(_ALL_ITEM, ("login-fail-all", digest)))
    raise HTTPException(status_code=401, detail="Invalid email or password")


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
