from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

from database import get_db
from models import CallLog, CallStatus, Pharmacy, AvailabilityReport, ReportSource, User, SubscriptionTier
from routers.auth import get_current_user
from timeutil import utcnow, ensure_utc
from notifications import notify_restock

router = APIRouter()


# --- Schemas ---

class CallLogCreate(BaseModel):
    pharmacy_id: int
    status: CallStatus
    contribute_to_community: bool = False
    medication_name: Optional[str] = None
    strength: Optional[str] = None
    expected_restock_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=280)
    manufacturer: Optional[str] = None


class CallLogUpdate(BaseModel):
    status: Optional[CallStatus] = None
    contribute_to_community: Optional[bool] = None
    expected_restock_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=280)
    manufacturer: Optional[str] = None


def _call_response(c: CallLog) -> dict:
    return {
        "id": c.id,
        "pharmacy_id": c.pharmacy_id,
        "pharmacy_name": c.pharmacy.name if c.pharmacy else "",
        "called_at": ensure_utc(c.called_at),
        "status": c.status.value,
        "contributed_to_community": c.contributed_to_community,
        "medication_name": c.medication_name or "",
        "strength": c.strength or "",
        "expected_restock_date": c.expected_restock_date,
        "notes": c.notes or "",
        "manufacturer": c.manufacturer or "",
    }


def _resolve_medication(medication_name: Optional[str], strength: Optional[str]) -> tuple[str, str]:
    """Medication profiles live on-device only now — the client must send
    medication_name/strength explicitly; there's no server-side profile to
    fall back to."""
    return medication_name or "", strength or ""


def _maybe_contribute(call: CallLog, pharmacy: Pharmacy, db: Session, user: User,
                      medication_name: str, strength: str) -> Optional[AvailabilityReport]:
    """If user opted in and pharmacy isn't vaulted, add a community AvailabilityReport.
    Returns the new report (not yet committed) so the caller can notify matching
    users for it after the transaction actually commits."""
    if not call.contributed_to_community or pharmacy.is_vaulted:
        return None
    if not medication_name:
        # A report without a medication can never match a community query — skip it
        # rather than reward the contributor tier for unusable data.
        return None
    report = AvailabilityReport(
        pharmacy_name=pharmacy.name,
        pharmacy_address=pharmacy.address,
        latitude=pharmacy.latitude,
        longitude=pharmacy.longitude,
        zip_code=pharmacy.zip_code,
        medication_name=medication_name,
        strength=strength,
        status=call.status,
        expected_restock_date=call.expected_restock_date,
        source=ReportSource.community,
    )
    db.add(report)
    db.flush()
    call.contributed_report_id = report.id
    user.last_contribution_at = utcnow()
    # Auto-promote to contributor tier
    if user.subscription_tier == SubscriptionTier.free:
        user.subscription_tier = SubscriptionTier.contributor
    return report


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

    med_name, med_strength = _resolve_medication(body.medication_name, body.strength)

    call = CallLog(
        user_id=current_user.id,
        pharmacy_id=body.pharmacy_id,
        status=body.status,
        contributed_to_community=body.contribute_to_community and not pharmacy.is_vaulted,
        medication_name=med_name or None,
        strength=med_strength or None,
        expected_restock_date=body.expected_restock_date,
        notes=body.notes,
        manufacturer=body.manufacturer,
    )
    db.add(call)
    db.flush()

    new_report = None
    if body.contribute_to_community:
        new_report = _maybe_contribute(call, pharmacy, db, current_user, med_name, med_strength)

    db.commit()
    db.refresh(call)
    if new_report:
        notify_restock(new_report, db, exclude_user_id=current_user.id)
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

    if body.contribute_to_community is False and call.contributed_to_community:
        # The report is already shared anonymously with the community by this
        # point, so we don't support un-sharing it.
        raise HTTPException(
            status_code=400,
            detail="Community contributions are anonymous and can't be withdrawn.",
        )

    if body.status is not None:
        call.status = body.status
    if body.expected_restock_date is not None:
        call.expected_restock_date = body.expected_restock_date
    if body.notes is not None:
        call.notes = body.notes
    if body.manufacturer is not None:
        call.manufacturer = body.manufacturer

    new_report = None
    if body.contribute_to_community and not call.contributed_to_community:
        call.contributed_to_community = not call.pharmacy.is_vaulted
        new_report = _maybe_contribute(
            call, call.pharmacy, db, current_user, call.medication_name or "", call.strength or ""
        )

    db.commit()
    db.refresh(call)
    if new_report:
        notify_restock(new_report, db, exclude_user_id=current_user.id)
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
