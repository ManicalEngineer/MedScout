from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, timedelta, datetime

from database import get_db
from models import (
    User, RefillCountdown, AlertSettings, MedicationAlertSubscription,
    TrackedMedication, SubscriptionTier,
)
from rate_limit import limiter
from routers.auth import get_current_user, verify_password
from timeutil import utcnow, ensure_utc

router = APIRouter()


# --- Schemas ---

class UserResponse(BaseModel):
    id: int
    email: str
    caregiver_mode: bool
    subscription_tier: str
    has_password: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    caregiver_mode: Optional[bool] = None
    push_token: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    # Required only for password accounts — OAuth-only accounts have nothing
    # to check, the current session token is proof enough.
    password: Optional[str] = None


class RefillCountdownUpdate(BaseModel):
    medication_name: str
    last_fill_date: Optional[date] = None
    days_supply: Optional[int] = None
    lead_time_days: Optional[int] = None
    push_notifications_enabled: Optional[bool] = None


class AlertSettingsUpdate(BaseModel):
    radius_miles: Optional[int] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None


class TrackedMedicationCreate(BaseModel):
    """Anonymous — no user reference is stored. Auth is required only to
    apply the same per-account rate limit as other write endpoints."""
    medication_name: str
    strength: str


class AlertSubscriptionCreate(BaseModel):
    """The client shows the identity-linking disclosure before calling this
    — the endpoint itself doesn't need a separate consent step."""
    medication_name: str
    strength: str


# --- Helpers ---

def _countdown_response(rc: RefillCountdown) -> dict:
    days_remaining = run_out_date = hunt_start_date = None
    if rc.last_fill_date:
        run_out = rc.last_fill_date + timedelta(days=rc.days_supply)
        hunt_start = run_out - timedelta(days=rc.lead_time_days)
        days_remaining = (run_out - date.today()).days
        run_out_date = run_out
        hunt_start_date = hunt_start
    return {
        "medication_name": rc.medication_name,
        "last_fill_date": rc.last_fill_date,
        "days_supply": rc.days_supply,
        "lead_time_days": rc.lead_time_days,
        "push_notifications_enabled": rc.push_notifications_enabled,
        "days_remaining": days_remaining,
        "run_out_date": run_out_date,
        "hunt_start_date": hunt_start_date,
    }


def _get_or_create_alert_settings(user: User, db: Session) -> AlertSettings:
    settings = db.query(AlertSettings).filter(AlertSettings.user_id == user.id).first()
    if not settings:
        settings = AlertSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _effective_tier(user: User) -> str:
    """Downgrade contributor tier if contribution lapsed > 30 days."""
    if (
        user.subscription_tier == SubscriptionTier.contributor
        and user.last_contribution_at is not None
        and (utcnow() - ensure_utc(user.last_contribution_at)) > timedelta(days=30)
    ):
        return SubscriptionTier.free.value
    return user.subscription_tier.value


# --- Routes ---

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "caregiver_mode": current_user.caregiver_mode,
        "subscription_tier": _effective_tier(current_user),
        "has_password": current_user.hashed_password is not None,
    }


@router.patch("/me")
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.caregiver_mode is not None:
        current_user.caregiver_mode = body.caregiver_mode
    if body.push_token is not None:
        current_user.push_token = body.push_token
    db.commit()
    return {"id": current_user.id, "caregiver_mode": current_user.caregiver_mode}


@router.get("/me/refill-countdown")
def get_refill_countdown(
    medication_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc = db.query(RefillCountdown).filter(
        RefillCountdown.user_id == current_user.id,
        RefillCountdown.medication_name == medication_name,
    ).first()
    if not rc:
        rc = RefillCountdown(user_id=current_user.id, medication_name=medication_name)
        db.add(rc)
        db.commit()
        db.refresh(rc)
    return _countdown_response(rc)


@router.put("/me/refill-countdown")
def update_refill_countdown(
    body: RefillCountdownUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rc = db.query(RefillCountdown).filter(
        RefillCountdown.user_id == current_user.id,
        RefillCountdown.medication_name == body.medication_name,
    ).first()
    if not rc:
        rc = RefillCountdown(user_id=current_user.id, medication_name=body.medication_name)
        db.add(rc)

    for field, value in body.model_dump(exclude={"medication_name"}, exclude_none=True).items():
        setattr(rc, field, value)

    db.commit()
    db.refresh(rc)
    return _countdown_response(rc)


@router.get("/me/refill-countdowns")
def list_refill_countdowns(
    current_user: User = Depends(get_current_user),
):
    """Returns all refill countdowns — useful for the Dashboard to find the most urgent."""
    return [_countdown_response(rc) for rc in current_user.refill_countdowns]


@router.get("/me/alert-settings")
def get_alert_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create_alert_settings(current_user, db)


@router.put("/me/alert-settings")
def update_alert_settings(
    body: AlertSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = _get_or_create_alert_settings(current_user, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/me/alert-subscriptions")
def list_alert_subscriptions(
    current_user: User = Depends(get_current_user),
):
    return current_user.alert_subscriptions


@router.post("/me/alert-subscriptions", status_code=201)
def subscribe_to_alerts(
    body: AlertSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Opt in to restock alerts for one medication. Idempotent — resubscribing
    to one already active just returns it rather than erroring."""
    existing = db.query(MedicationAlertSubscription).filter(
        MedicationAlertSubscription.user_id == current_user.id,
        MedicationAlertSubscription.medication_name == body.medication_name,
        MedicationAlertSubscription.strength == body.strength,
    ).first()
    if existing:
        return existing

    _get_or_create_alert_settings(current_user, db)
    sub = MedicationAlertSubscription(
        user_id=current_user.id,
        medication_name=body.medication_name,
        strength=body.strength,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/me/alert-subscriptions", status_code=204)
def unsubscribe_from_alerts(
    body: AlertSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(MedicationAlertSubscription).filter(
        MedicationAlertSubscription.user_id == current_user.id,
        MedicationAlertSubscription.medication_name == body.medication_name,
        MedicationAlertSubscription.strength == body.strength,
    ).delete()
    db.commit()


@router.post("/tracked-medications", status_code=204)
@limiter.limit("30/hour")
def track_medication(
    request: Request,
    body: TrackedMedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anonymous upsert feeding FDA shortage ingestion — auth is required only
    for rate-limiting; the stored row carries no reference back to the user."""
    row = db.query(TrackedMedication).filter(
        TrackedMedication.medication_name == body.medication_name,
        TrackedMedication.strength == body.strength,
    ).first()
    if not row:
        row = TrackedMedication(medication_name=body.medication_name, strength=body.strength)
        db.add(row)
    else:
        row.last_seen_at = utcnow()
    db.commit()


@router.delete("/me", status_code=204)
def delete_me(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently deletes the account and everything attached to it (pharmacies,
    call logs, refill countdowns, alert settings) via the User model's cascade
    relationships. Medication profiles live on-device only and aren't touched
    by this at all. Any AvailabilityReport this user contributed stays —
    those are already anonymous (no user_id column) by design, so there's
    nothing of theirs left to remove from them.
    """
    if current_user.hashed_password:
        if not body.password or not verify_password(body.password, current_user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect password")
    db.delete(current_user)
    db.commit()
