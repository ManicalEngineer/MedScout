from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from math import radians, cos, sin, asin, sqrt

from database import get_db
from models import AvailabilityReport, CallLog, CallStatus, ReportSource, User, SubscriptionTier
from routers.auth import get_current_user

router = APIRouter()


# --- Schemas ---

class ReportCreate(BaseModel):
    pharmacy_name: str
    pharmacy_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zip_code: Optional[str] = None
    medication_name: str
    strength: str
    status: CallStatus


def _trust_level(reported_at: datetime) -> str:
    age = datetime.utcnow() - reported_at.replace(tzinfo=None)
    if age < timedelta(hours=2):
        return "fresh"
    if age < timedelta(hours=24):
        return "aging"
    return "stale"


def _report_response(r: AvailabilityReport) -> dict:
    return {
        "id": r.id,
        "pharmacy_name": r.pharmacy_name,
        "pharmacy_address": r.pharmacy_address,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "zip_code": r.zip_code,
        "medication_name": r.medication_name,
        "strength": r.strength,
        "status": r.status.value,
        "source": r.source.value,
        "reported_at": r.reported_at,
        "trust_level": _trust_level(r.reported_at),
    }


def _call_as_report(c: CallLog) -> dict:
    """Convert a user's own CallLog into the same shape as an AvailabilityReport."""
    p = c.pharmacy
    return {
        "id": c.id,
        "pharmacy_name": p.name if p else "",
        "pharmacy_address": p.address if p else None,
        "latitude": p.latitude if p else None,
        "longitude": p.longitude if p else None,
        "zip_code": p.zip_code if p else None,
        "medication_name": c.extracted_strength or "",
        "strength": c.extracted_strength or "",
        "status": c.status.value,
        "source": "my_logs",
        "reported_at": c.called_at,
        "trust_level": _trust_level(c.called_at),
    }


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2
    return 2 * R * asin(sqrt(a))


def _promote_contributor(user: User, db: Session):
    """Auto-promote to contributor; auto-downgrade if lapsed > 30 days."""
    if user.last_contribution_at:
        age = datetime.utcnow() - user.last_contribution_at.replace(tzinfo=None)
        if age < timedelta(days=30) and user.subscription_tier == SubscriptionTier.free:
            user.subscription_tier = SubscriptionTier.contributor
        elif age >= timedelta(days=30) and user.subscription_tier == SubscriptionTier.contributor:
            user.subscription_tier = SubscriptionTier.free
    db.commit()


# --- Routes ---

@router.get("/map")
def get_map_reports(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_miles: float = Query(25),
    zip_code: Optional[str] = Query(None),
    medication_name: Optional[str] = Query(None),
    strength: Optional[str] = Query(None),
    source: Optional[str] = Query(None, description="community | fda | ashp | my_logs — omit for community+official"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []

    if source == "my_logs" or source is None:
        # Include user's own call logs
        cutoff = datetime.utcnow() - timedelta(hours=48)
        q = db.query(CallLog).filter(
            CallLog.user_id == current_user.id,
            CallLog.called_at >= cutoff,
        )
        if strength:
            q = q.filter(CallLog.extracted_strength.ilike(f"%{strength}%"))
        my_calls = q.order_by(desc(CallLog.called_at)).all()
        if source == "my_logs":
            results = [_call_as_report(c) for c in my_calls]
        else:
            results += [_call_as_report(c) for c in my_calls]

    if source != "my_logs":
        # Community + official reports
        cutoff = datetime.utcnow() - timedelta(hours=48)
        q = db.query(AvailabilityReport).filter(AvailabilityReport.reported_at >= cutoff)
        if medication_name:
            q = q.filter(AvailabilityReport.medication_name.ilike(f"%{medication_name}%"))
        if strength:
            q = q.filter(AvailabilityReport.strength.ilike(f"%{strength}%"))
        if source in ("community", "fda", "ashp"):
            q = q.filter(AvailabilityReport.source == source)
        if zip_code:
            q = q.filter(AvailabilityReport.zip_code == zip_code)
        community_reports = q.order_by(desc(AvailabilityReport.reported_at)).limit(500).all()
        results += [_report_response(r) for r in community_reports]

    # Filter by radius if coordinates provided
    if lat is not None and lng is not None:
        radius_km = radius_miles * 1.60934
        results = [
            r for r in results
            if r["latitude"] and r["longitude"]
            and _haversine_km(lat, lng, r["latitude"], r["longitude"]) <= radius_km
        ]

    return sorted(results, key=lambda r: r["reported_at"], reverse=True)


@router.post("/report", status_code=201)
def submit_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = AvailabilityReport(
        source=ReportSource.community,
        **body.model_dump(),
    )
    db.add(report)
    current_user.last_contribution_at = datetime.utcnow()
    # Auto-promote contributor tier
    if current_user.subscription_tier == SubscriptionTier.free:
        current_user.subscription_tier = SubscriptionTier.contributor
    db.commit()
    db.refresh(report)
    return _report_response(report)


@router.get("/heatmap")
def get_heatmap(
    medication_name: Optional[str] = Query(None),
    strength: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Give-to-get: blurred for non-contributors."""
    _promote_contributor(current_user, db)

    is_contributor = (
        current_user.subscription_tier in (SubscriptionTier.contributor, SubscriptionTier.premium)
    )
    if not is_contributor:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "contribute_required",
                "message": "Submit your fill status to unlock the regional map — takes 10 seconds.",
            },
        )

    cutoff = datetime.utcnow() - timedelta(days=30)
    q = db.query(AvailabilityReport).filter(AvailabilityReport.reported_at >= cutoff)
    if medication_name:
        q = q.filter(AvailabilityReport.medication_name.ilike(f"%{medication_name}%"))
    if strength:
        q = q.filter(AvailabilityReport.strength.ilike(f"%{strength}%"))

    from collections import defaultdict
    zip_data = defaultdict(lambda: {"total": 0, "in_stock": 0})
    for r in q.all():
        if not r.zip_code:
            continue
        zip_data[r.zip_code]["total"] += 1
        if r.status == CallStatus.in_stock:
            zip_data[r.zip_code]["in_stock"] += 1

    return sorted([
        {
            "zip_code": z,
            "total_reports": d["total"],
            "in_stock_count": d["in_stock"],
            "fill_rate": round(d["in_stock"] / d["total"], 2) if d["total"] else 0,
        }
        for z, d in zip_data.items()
    ], key=lambda x: x["fill_rate"], reverse=True)
