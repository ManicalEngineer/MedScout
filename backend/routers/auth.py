from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, EmailStr
import os

from database import get_db
from models import User, SubscriptionTier

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# --- Schemas ---

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    caregiver_mode: bool = False


class OAuthRequest(BaseModel):
    provider: str          # "apple" or "google"
    id_token: str
    email: Optional[str] = None
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


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exc
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exc
    return user


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_token(user.id),
        user_id=user.id,
        caregiver_mode=user.caregiver_mode,
        subscription_tier=user.subscription_tier.value,
    )


# --- Routes ---

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
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


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(user)


@router.post("/oauth", response_model=TokenResponse)
def oauth_login(body: OAuthRequest, db: Session = Depends(get_db)):
    """
    Exchange an Apple or Google id_token for a MedScout session token.
    Token verification against Apple/Google JWKS is stubbed — integrate
    apple-auth or google-auth-library in production.
    """
    # TODO: verify id_token with provider's JWKS endpoint
    # For now, trust the sub claim extracted client-side (dev only)
    sub_field = "apple_sub" if body.provider == "apple" else "google_sub"

    # Try to find by OAuth sub first, then by email
    user = None
    if body.email:
        user = db.query(User).filter(User.email == body.email).first()

    if user:
        setattr(user, sub_field, body.id_token)  # store sub for future lookups
    else:
        if not body.email:
            raise HTTPException(status_code=400, detail="Email required for first-time OAuth sign-in")
        user = User(
            email=body.email,
            caregiver_mode=body.caregiver_mode,
            **{sub_field: body.id_token},
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return _token_response(user)
