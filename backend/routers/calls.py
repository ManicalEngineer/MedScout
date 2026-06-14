from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import CallLog, CallStatus, Pharmacy, AvailabilityReport, ReportSource, User
from routers.auth import get_current_user

router = APIRouter()


# --- Schemas ---

class CallLogCreate(BaseModel):
    pharmacy_id: int
    status: CallStatus
    contribute_to_community: bool = False


class CallLogUpdate(BaseModel):
    status: Optional[CallStatus] = None
    contribute_to_community: Optional[bool] = None


def _call_response(c: CallLog) -> dict:
    return {
        "id": c.id,
        "pharmacy_id": c.pharmacy_id,
        "pharmacy_name": c.pharmacy.name if c.pharmacy else "",
        "called_at": c.called_at,
        "status": c.status.value,
        "contributed_to_community": c.contributed_to_community,
    }


def _maybe_contribute(call: CallLog, pharmacy: Pharmacy, db: Session, user: User):
    """If user opted in and pharmacy isn't vaulted, add a community AvailabilityReport."""
    if not call.contributed_to_community or pharmacy.is_vaulted:
        return
    report = AvailabilityReport(
        pharmacy_name=pharmacy.name,
        pharmacy_address=pharmacy.address,
        latitude=pharmacy.latitude,
        longitude=pharmacy.longitude,
        zip_code=pharmacy.zip_code,
        medication_name="",
        strength="",
        status=call.status,
        source=ReportSource.community,
    )
    db.add(report)
    user.last_contribution_at = datetime.utcnow()
    # Auto-promote to contributor tier
    if user.subscription_tier == SubscriptionTier.free:
        user.subscription_tier = SubscriptionTier.contributor


# --- Routes ---

@router.get("/")
def list_call_logs(
    pharmacy_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CallLog).filter(CallLog.user_id == current_user.id)
    if pharmacy_id:
        q = q.filter(CallLog.pharmacy_id == pharmacy_id)
    calls = q.order_by(desc(CallLog.called_at)).limit(limit).all()
    return [_call_response(c) for c in calls]


@router.post("/", status_code=201)
def create_call_log(
    body: CallLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pharmacy = db.query(Pharmacy).filter(
        Pharmacy.id == body.pharmacy_id, Pharmacy.user_id == current_user.id
    ).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")

    call = CallLog(
        user_id=current_user.id,
        pharmacy_id=body.pharmacy_id,
        status=body.status,
        contributed_to_community=body.contribute_to_community and not pharmacy.is_vaulted,
    )
    db.add(call)
    db.flush()

    if body.contribute_to_community:
        _maybe_contribute(call, pharmacy, db, current_user)

    db.commit()
    db.refresh(call)
    return _call_response(call)


@router.get("/{call_id}")
def get_call_log(
    call_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    call = db.query(CallLog).filter(
        CallLog.id == call_id, CallLog.user_id == current_user.id
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    return _call_response(call)


@router.patch("/{call_id}")
def update_call_log(
    call_id: int,
    body: CallLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    call = db.query(CallLog).filter(
        CallLog.id == call_id, CallLog.user_id == current_user.id
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "contribute_to_community":
            call.contributed_to_community = value
        else:
            setattr(call, field, value)
    db.commit()
    db.refresh(call)
    return _call_response(call)


@router.delete("/{call_id}", status_code=204)
def delete_call_log(
    call_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    call = db.query(CallLog).filter(
        CallLog.id == call_id, CallLog.user_id == current_user.id
    ).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call log not found")
    db.delete(call)
    db.commit()
