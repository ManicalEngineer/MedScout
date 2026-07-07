import time
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt
import httpx
from pydantic import BaseModel, EmailStr, Field
import os

from database import get_db
from models import User, SubscriptionTier
from rate_limit import limiter
from timeutil import utcnow

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change-me-in-production":
    raise RuntimeError(
        "SECRET_KEY is not set. Generate one with `openssl rand -hex 32` and put it in backend/.env"
    )
ALGORITHM = "HS256"
# 7 days; the app slides the session by calling /auth/refresh on launch
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

OAUTH_PROVIDERS = {
    "google": {
        "jwks_url": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": {"https://accounts.google.com", "accounts.google.com"},
        "audience_env": "GOOGLE_OAUTH_CLIENT_ID",
        "sub_field": "google_sub",
    },
    "apple": {
        "jwks_url": "https://appleid.apple.com/auth/keys",
        "issuers": {"https://appleid.apple.com"},
        "audience_env": "APPLE_CLIENT_ID",  # the app's bundle ID for native Sign in with Apple
        "sub_field": "apple_sub",
    },
}

JWKS_CACHE_TTL_SECONDS = 3600
_jwks_cache: dict[str, tuple[float, dict]] = {}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# --- Schemas ---

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    caregiver_mode: bool = False


class OAuthRequest(BaseModel):
    provider: str          # "apple" or "google"
    id_token: str
    caregiver_mode: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    caregiver_mode: bool
    subscription_tier: str


# --- Helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user: User) -> str:
    expire = utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user.id), "ver": user.token_version or 0, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        token_version = int(payload.get("ver"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exc
    user = db.query(User).filter(User.id == user_id).first()
    if not user or token_version != (user.token_version or 0):
        raise credentials_exc
    return user


def _get_jwks(jwks_url: str, force_refresh: bool = False) -> dict:
    cached = _jwks_cache.get(jwks_url)
    if cached and not force_refresh and time.monotonic() - cached[0] < JWKS_CACHE_TTL_SECONDS:
        return cached[1]
    try:
        resp = httpx.get(jwks_url, timeout=10)
        resp.raise_for_status()
    except httpx.HTTPError:
        if cached:
            return cached[1]
        raise HTTPException(status_code=503, detail="Could not reach identity provider")
    jwks = resp.json()
    _jwks_cache[jwks_url] = (time.monotonic(), jwks)
    return jwks


def _verify_oauth_id_token(provider: str, id_token: str) -> dict:
    """Verify an Apple/Google id_token (signature, issuer, audience) and return its claims."""
    config = OAUTH_PROVIDERS.get(provider)
    if not config:
        raise HTTPException(status_code=400, detail="provider must be 'apple' or 'google'")

    audience = os.getenv(config["audience_env"], "")
    if not audience:
        raise HTTPException(
            status_code=503,
            detail=f"{provider} sign-in not configured (set {config['audience_env']})",
        )

    invalid = HTTPException(status_code=401, detail="Invalid identity token")
    try:
        kid = jwt.get_unverified_header(id_token).get("kid")
    except JWTError:
        raise invalid

    jwks = _get_jwks(config["jwks_url"])
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        # Provider may have rotated keys since we cached — refresh once
        jwks = _get_jwks(config["jwks_url"], force_refresh=True)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if key is None:
        raise invalid

    try:
        claims = jwt.decode(id_token, key, algorithms=["RS256"], audience=audience)
    except JWTError:
        raise invalid

    if claims.get("iss") not in config["issuers"]:
        raise invalid
    if not claims.get("sub"):
        raise invalid
    return claims


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_token(user),
        user_id=user.id,
        caregiver_mode=user.caregiver_mode,
        subscription_tier=user.subscription_tier.value,
    )


# --- Routes ---

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        caregiver_mode=body.caregiver_mode,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


# Verifying against this when the email doesn't exist keeps login timing
# constant, so response time can't be used to probe which emails are registered.
_DUMMY_HASH = hash_password("dummy-timing-equalizer")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not user.hashed_password:
        verify_password(form.password, _DUMMY_HASH)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/hour")
def refresh_token(request: Request, current_user: User = Depends(get_current_user)):
    """Exchange a valid (unexpired, unrevoked) token for a fresh one."""
    return _token_response(current_user)


@router.post("/logout-all", status_code=204)
def logout_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invalidate every outstanding session for this account."""
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()


@router.post("/oauth", response_model=TokenResponse)
@limiter.limit("10/minute")
def oauth_login(request: Request, body: OAuthRequest, db: Session = Depends(get_db)):
    """
    Exchange a verified Apple or Google id_token for a MedScout session token.
    Identity comes exclusively from the verified token claims — the client
    cannot choose which account it signs into.
    """
    claims = _verify_oauth_id_token(body.provider, body.id_token)
    sub_field = OAUTH_PROVIDERS[body.provider]["sub_field"]
    sub = claims["sub"]
    email = claims.get("email")
    # Google sends a bool; Apple sends the string "true"
    email_verified = claims.get("email_verified") in (True, "true")

    user = db.query(User).filter(getattr(User, sub_field) == sub).first()

    if not user and email and email_verified:
        # Link this provider to an existing password/other-provider account
        user = db.query(User).filter(User.email == email).first()
        if user:
            setattr(user, sub_field, sub)

    if not user:
        if not email or not email_verified:
            raise HTTPException(
                status_code=400,
                detail="A verified email is required for first-time OAuth sign-in",
            )
        user = User(
            email=email,
            caregiver_mode=body.caregiver_mode,
            **{sub_field: sub},
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return _token_response(user)
