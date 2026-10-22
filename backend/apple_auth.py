"""Sign in with Apple token exchange and revocation (App Store 5.1.1(v)).

Apple requires an app that offers Sign in with Apple to revoke the user's
token when they delete their account. Revoking needs a refresh token, which we
get by exchanging the one-time authorization code the app sends at sign-in.

Inactive (every function is a no-op) until APPLE_TEAM_ID, APPLE_KEY_ID and
APPLE_PRIVATE_KEY (the .p8 contents) are set, so local dev and tests are
unaffected. All calls are best-effort: a failure here is logged and never
blocks sign-in or account deletion.
"""
import logging
import os
import time
from typing import Optional

import httpx
from jose import jwt

logger = logging.getLogger(__name__)

APPLE_AUDIENCE = "https://appleid.apple.com"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke"
TIMEOUT = 5


def _config() -> Optional[dict]:
    team_id = os.getenv("APPLE_TEAM_ID", "")
    key_id = os.getenv("APPLE_KEY_ID", "")
    private_key = os.getenv("APPLE_PRIVATE_KEY", "").replace("\\n", "\n")
    client_id = os.getenv("APPLE_CLIENT_ID", "")
    if not (team_id and key_id and private_key and client_id):
        return None
    return {"team_id": team_id, "key_id": key_id, "private_key": private_key, "client_id": client_id}


def is_configured() -> bool:
    return _config() is not None


def _client_secret(cfg: dict) -> str:
    now = int(time.time())
    return jwt.encode(
        {"iss": cfg["team_id"], "iat": now, "exp": now + 300, "aud": APPLE_AUDIENCE, "sub": cfg["client_id"]},
        cfg["private_key"],
        algorithm="ES256",
        headers={"kid": cfg["key_id"]},
    )


def exchange_code_for_refresh_token(authorization_code: str) -> Optional[str]:
    cfg = _config()
    if not cfg or not authorization_code:
        return None
    try:
        resp = httpx.post(
            APPLE_TOKEN_URL,
            data={
                "client_id": cfg["client_id"],
                "client_secret": _client_secret(cfg),
                "code": authorization_code,
                "grant_type": "authorization_code",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json().get("refresh_token")
    except Exception:
        logger.exception("Apple authorization code exchange failed")
        return None


def revoke_refresh_token(refresh_token: str) -> bool:
    cfg = _config()
    if not cfg or not refresh_token:
        return False
    try:
        resp = httpx.post(
            APPLE_REVOKE_URL,
            data={
                "client_id": cfg["client_id"],
                "client_secret": _client_secret(cfg),
                "token": refresh_token,
                "token_type_hint": "refresh_token",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except Exception:
        logger.exception("Apple token revocation failed")
        return False
