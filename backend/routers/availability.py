from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta
from math import radians, cos, sin, asin, sqrt

from database import get_db
from models import AvailabilityReport, CallLog, CallStatus, ReportSource, ShortageStatus, User, SubscriptionTier
from routers.auth import get_current_user
from rate_limit import limiter
from timeutil import utcnow, ensure_utc
from notifications import notify_restock

router = APIRouter()


# --- Schemas ---

REPORT_MIN_INTERVAL_SECONDS = 60  # per-account gap between reports (anti-poisoning)


class ReportCreate(BaseModel):
    pharmacy_name: str = Field(min_length=1, max_length=200)
    pharmacy_address: Optional[str] = Field(None, max_length=300)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    zip_code: Optional[str] = Field(None, pattern=r"^\d{5}$")
    medication_name: str = Field(min_length=1, max_length=120)
    strength: str = Field(min_length=1, max_length=60)
    status: CallStatus


def _trust_level(reported_at: datetime) -> str:
    age = utcnow() - ensure_utc(reported_at)
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
        "reported_at": ensure_utc(r.reported_at),
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
        "medication_name": c.medication_name or "",
        "strength": c.strength or "",
        "status": c.status.value,
        "source": "my_logs",
        "reported_at": ensure_utc(c.called_at),
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
        age = utcnow() - ensure_utc(user.last_contribution_at)
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
    sources: Optional[str] = Query(
        None,
        description="Comma-separated subset of: my_logs, community, fda, ashp. Defaults to community+fda+ashp.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _promote_contributor(current_user, db)
    is_contributor = (
        current_user.subscription_tier in (SubscriptionTier.contributor, SubscriptionTier.premium)
    )

    selected = {s.strip() for s in sources.split(",") if s.strip()} if sources else {"community", "fda", "ashp"}
    results = []
    contributed_report_ids = set()

    if "my_logs" in selected:
        cutoff = utcnow() - timedelta(hours=48)
        q = db.query(CallLog).filter(
            CallLog.user_id == current_user.id,
            CallLog.called_at >= cutoff,
        )
        my_calls = q.order_by(desc(CallLog.called_at)).all()
        results += [_call_as_report(c) for c in my_calls]
        # A contributed call already appears once via its CallLog above — exclude
        # the AvailabilityReport it spawned so it isn't shown a second time below.
        contributed_report_ids = {c.contributed_report_id for c in my_calls if c.contributed_report_id}

    # Give-to-get: other people's reports are the core value here, so they're
    # the thing withheld from non-contributors (mirrors /heatmap's gate).
    # A user's own logs above are unaffected — that's their private data.
    requested_community = selected & {"community", "fda", "ashp"}
    community_locked = bool(requested_community) and not is_contributor
    report_sources = requested_community if is_contributor else set()
    if report_sources:
        cutoff = utcnow() - timedelta(hours=48)
        q = db.query(AvailabilityReport).filter(
            AvailabilityReport.reported_at >= cutoff,
            AvailabilityReport.source.in_(report_sources),
        )
        if medication_name:
            q = q.filter(AvailabilityReport.medication_name.icontains(medication_name, autoescape=True))
        if strength:
            q = q.filter(AvailabilityReport.strength.icontains(strength, autoescape=True))
        if zip_code:
            q = q.filter(AvailabilityReport.zip_code == zip_code)
        if contributed_report_ids:
            q = q.filter(AvailabilityReport.id.notin_(contributed_report_ids))
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

    return {
        "reports": sorted(results, key=lambda r: r["reported_at"], reverse=True),
        "community_locked": community_locked,
    }


@router.post("/report", status_code=201)
@limiter.limit("30/hour")
def submit_report(
    request: Request,
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Per-account throttle on top of the per-IP limit. Reports are stored
    # anonymously, so last_contribution_at is the only per-user signal we keep.
    if current_user.last_contribution_at:
        since_last = utcnow() - ensure_utc(current_user.last_contribution_at)
        if since_last < timedelta(seconds=REPORT_MIN_INTERVAL_SECONDS):
            raise HTTPException(
                status_code=429,
                detail="You're reporting too quickly — try again in a minute.",
            )

    report = AvailabilityReport(
        source=ReportSource.community,
        **body.model_dump(),
    )
    db.add(report)
    current_user.last_contribution_at = utcnow()
    # Auto-promote contributor tier
    if current_user.subscription_tier == SubscriptionTier.free:
        current_user.subscription_tier = SubscriptionTier.contributor
    db.commit()
    db.refresh(report)
    notify_restock(report, db, exclude_user_id=current_user.id)
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

    cutoff = utcnow() - timedelta(days=30)
    q = db.query(AvailabilityReport).filter(AvailabilityReport.reported_at >= cutoff)
    if medication_name:
        q = q.filter(AvailabilityReport.medication_name.icontains(medication_name, autoescape=True))
    if strength:
        q = q.filter(AvailabilityReport.strength.icontains(strength, autoescape=True))

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


@router.get("/shortage-status")
def get_shortage_status(
    medication_name: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """National shortage status for a medication brand, ingested daily from
    openFDA. Not pharmacy-specific — see ShortageStatus model docstring."""
    row = db.query(ShortageStatus).filter(
        ShortageStatus.medication_name == medication_name
    ).first()
    if not row:
        return None
    return {
        "medication_name": row.medication_name,
        "status": row.status,
        "detail": row.detail,
        "source": row.source,
        "updated_at": ensure_utc(row.updated_at),
    }
