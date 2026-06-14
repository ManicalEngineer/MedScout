from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, timedelta, datetime

from database import get_db
from models import User, MedicationProfile, RefillCountdown, AlertSettings, SubscriptionTier
from routers.auth import get_current_user

router = APIRouter()


# --- Schemas ---

class UserResponse(BaseModel):
    id: int
    email: str
    caregiver_mode: bool
    subscription_tier: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    caregiver_mode: Optional[bool] = None
    push_token: Optional[str] = None


class MedicationProfileCreate(BaseModel):
    medication_name: str
    strength: str
    formulation: Optional[str] = None
    is_child_profile: bool = False
    child_name: Optional[str] = None


class MedicationProfileResponse(MedicationProfileCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class RefillCountdownUpdate(BaseModel):
    last_fill_date: Optional[date] = None
    days_supply: Optional[int] = None
    lead_time_days: Optional[int] = None
    push_notifications_enabled: Optional[bool] = None


class AlertSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    radius_miles: Optional[int] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None


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
        "medication_profile_id": rc.medication_profile_id,
        "last_fill_date": rc.last_fill_date,
        "days_supply": rc.days_supply,
        "lead_time_days": rc.lead_time_days,
        "push_notifications_enabled": rc.push_notifications_enabled,
        "days_remaining": days_remaining,
        "run_out_date": run_out_date,
        "hunt_start_date": hunt_start_date,
    }


def _effective_tier(user: User) -> str:
    """Downgrade contributor tier if contribution lapsed > 30 days."""
    if (
        user.subscription_tier == SubscriptionTier.contributor
        and user.last_contribution_at is not None
        and (datetime.utcnow() - user.last_contribution_at.replace(tzinfo=None)) > timedelta(days=30)
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


@router.get("/me/medication-profiles", response_model=list[MedicationProfileResponse])
def list_medication_profiles(current_user: User = Depends(get_current_user)):
    return [p for p in current_user.medication_profiles if p.is_active]


@router.post("/me/medication-profiles", response_model=MedicationProfileResponse, status_code=201)
def create_medication_profile(
    body: MedicationProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = MedicationProfile(**body.model_dump(), user_id=current_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/me/medication-profiles/{profile_id}", status_code=204)
def delete_medication_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(MedicationProfile).filter(
        MedicationProfile.id == profile_id,
        MedicationProfile.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.is_active = False
    db.commit()


@router.get("/me/medication-profiles/{profile_id}/refill-countdown")
def get_refill_countdown(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(MedicationProfile).filter(
        MedicationProfile.id == profile_id,
        MedicationProfile.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    rc = db.query(RefillCountdown).filter(RefillCountdown.medication_profile_id == profile_id).first()
    if not rc:
        rc = RefillCountdown(user_id=current_user.id, medication_profile_id=profile_id)
        db.add(rc)
        db.commit()
        db.refresh(rc)
    return _countdown_response(rc)


@router.put("/me/medication-profiles/{profile_id}/refill-countdown")
def update_refill_countdown(
    profile_id: int,
    body: RefillCountdownUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(MedicationProfile).filter(
        MedicationProfile.id == profile_id,
        MedicationProfile.user_id == current_user.id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    rc = db.query(RefillCountdown).filter(RefillCountdown.medication_profile_id == profile_id).first()
    if not rc:
        rc = RefillCountdown(user_id=current_user.id, medication_profile_id=profile_id)
        db.add(rc)

    for field, value in body.model_dump(exclude_none=True).items():
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
    settings = db.query(AlertSettings).filter(AlertSettings.user_id == current_user.id).first()
    if not settings:
        settings = AlertSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/me/alert-settings")
def update_alert_settings(
    body: AlertSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = db.query(AlertSettings).filter(AlertSettings.user_id == current_user.id).first()
    if not settings:
        settings = AlertSettings(user_id=current_user.id)
        db.add(settings)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
