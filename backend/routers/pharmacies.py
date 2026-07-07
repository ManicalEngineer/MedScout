from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from math import radians, cos, sin, asin, sqrt, exp
import os
import httpx

from database import get_db
from models import Pharmacy, AvailabilityReport, CallStatus, MedicationProfile
from routers.auth import get_current_user
from models import User
from timeutil import utcnow, ensure_utc, UTC_MIN

router = APIRouter()

COMMUNITY_REPORT_WINDOW_DAYS = 90  # only count reports from the last 90 days
PROXIMITY_MATCH_KM = 0.5           # max distance to consider two pharmacy records the same location


# --- Schemas ---

class PharmacyCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zip_code: Optional[str] = None
    sort_order: int = 0


class PharmacyUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zip_code: Optional[str] = None
    is_vaulted: Optional[bool] = None
    sort_order: Optional[int] = None


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2
    return 2 * R * asin(sqrt(a))


def _haversine_mi(lat1, lon1, lat2, lon2) -> float:
    return _haversine_km(lat1, lon1, lat2, lon2) * 0.621371


def _community_stats(
    pharmacy: Pharmacy,
    medication_name: str,
    strength: str,
    db: Session,
) -> dict:
    """
    Query AvailabilityReport across all users for this pharmacy + medication.

    Matching strategy (in priority order):
      1. lat/lng proximity within PROXIMITY_MATCH_KM (most reliable)
      2. name (case-insensitive) + zip_code match

    Returns fill_rate, report_count, and a per-week breakdown for the Insights card.
    """
    cutoff = utcnow() - timedelta(days=COMMUNITY_REPORT_WINDOW_DAYS)

    q = db.query(AvailabilityReport).filter(
        AvailabilityReport.reported_at >= cutoff,
        func.lower(AvailabilityReport.medication_name).contains(medication_name.lower()),
        func.lower(AvailabilityReport.strength).contains(strength.lower()),
    )

    # Prefer coordinate match; fall back to name+zip
    if pharmacy.latitude and pharmacy.longitude:
        candidates = q.filter(
            AvailabilityReport.latitude.isnot(None),
            AvailabilityReport.longitude.isnot(None),
        ).all()
        reports = [
            r for r in candidates
            if _haversine_km(pharmacy.latitude, pharmacy.longitude, r.latitude, r.longitude)
            <= PROXIMITY_MATCH_KM
        ]
        # Also include name+zip matches that lack coordinates
        if pharmacy.zip_code:
            no_coord = q.filter(
                AvailabilityReport.latitude.is_(None),
                func.lower(AvailabilityReport.pharmacy_name).contains(pharmacy.name.lower()),
                AvailabilityReport.zip_code == pharmacy.zip_code,
            ).all()
            seen_ids = {r.id for r in reports}
            reports += [r for r in no_coord if r.id not in seen_ids]
    elif pharmacy.zip_code:
        reports = q.filter(
            func.lower(AvailabilityReport.pharmacy_name).contains(pharmacy.name.lower()),
            AvailabilityReport.zip_code == pharmacy.zip_code,
        ).all()
    else:
        reports = []

    if not reports:
        return {
            "community_fill_rate": None, "community_report_count": 0,
            "weekly_fill_rates": [], "last_report_at": None, "reliability_score": 0.0,
        }

    now = utcnow()
    total = len(reports)
    in_stock = sum(1 for r in reports if r.status == CallStatus.in_stock)
    fill_rate = round(in_stock / total, 2)

    # Most recent report timestamp
    last_report_at = max(ensure_utc(r.reported_at) for r in reports)

    # Reliability score: exponential decay on age so fresh data always dominates.
    # decay=0.1/hr → 24h-old report weighs 9% of a fresh one; 48h weighs <1%.
    # Report count is a tiebreaker within the same freshness tier.
    hours_old = (now - last_report_at).total_seconds() / 3600
    reliability_score = round(total * exp(-0.1 * hours_old), 4)

    # Weekly breakdown for "had stock X of last 4 weeks" insight
    weekly = []
    for week_offset in range(4):
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)
        week_reports = [r for r in reports if week_start <= ensure_utc(r.reported_at) <= week_end]
        had_stock = any(r.status == CallStatus.in_stock for r in week_reports)
        weekly.append({"week_offset": week_offset + 1, "had_stock": had_stock, "report_count": len(week_reports)})

    weeks_with_stock = sum(1 for w in weekly if w["had_stock"] and w["report_count"] > 0)
    weeks_with_data = sum(1 for w in weekly if w["report_count"] > 0)

    return {
        "community_fill_rate": fill_rate,
        "community_report_count": total,
        "weekly_fill_rates": weekly,
        "last_report_at": last_report_at.isoformat(),
        "reliability_score": reliability_score,
        "insight": (
            f"Had stock {weeks_with_stock} of the last {weeks_with_data} weeks"
            if weeks_with_data > 0 else None
        ),
    }


def _pharmacy_response(
    p: Pharmacy,
    community: dict,
    user_lat=None,
    user_lng=None,
) -> dict:
    last = p.last_call
    distance_miles = None
    if user_lat and user_lng and p.latitude and p.longitude:
        distance_miles = round(_haversine_mi(user_lat, user_lng, p.latitude, p.longitude), 1)
    return {
        "id": p.id,
        "name": p.name,
        "phone": p.phone,
        "address": p.address,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "zip_code": p.zip_code,
        "is_vaulted": p.is_vaulted,
        "sort_order": p.sort_order,
        "last_call_status": last.status.value if last else None,
        "last_call_date": last.called_at if last else None,
        "distance_miles": distance_miles,
        "community_fill_rate": community["community_fill_rate"],
        "community_report_count": community["community_report_count"],
        "weekly_fill_rates": community["weekly_fill_rates"],
        "last_report_at": community.get("last_report_at"),
        "reliability_score": community.get("reliability_score", 0.0),
        "insight": community.get("insight"),
    }


# --- Routes ---

@router.get("/")
def list_pharmacies(
    sort_by: str = Query("manual", description="manual | proximity | last_called | community_fill_rate"),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    medication_name: Optional[str] = Query(None, description="Filter community reports by medication"),
    strength: Optional[str] = Query(None, description="Filter community reports by strength"),
    profile_id: Optional[int] = Query(None, description="Pull medication/strength from a saved profile"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve medication name + strength for community lookup
    med_name = medication_name or ""
    med_strength = strength or ""

    if profile_id:
        profile = db.query(MedicationProfile).filter(
            MedicationProfile.id == profile_id,
            MedicationProfile.user_id == current_user.id,
            MedicationProfile.is_active == True,
        ).first()
        if profile:
            med_name = profile.medication_name
            med_strength = profile.strength
    elif not med_name:
        # Auto-resolve from first active profile
        active = next((p for p in current_user.medication_profiles if p.is_active), None)
        if active:
            med_name = active.medication_name
            med_strength = active.strength

    pharmacies = current_user.pharmacies
    items = []
    for p in pharmacies:
        community = (
            _community_stats(p, med_name, med_strength, db)
            if med_name else
            {"community_fill_rate": None, "community_report_count": 0, "weekly_fill_rates": [], "last_report_at": None, "reliability_score": 0.0, "insight": None}
        )
        items.append(_pharmacy_response(p, community, lat, lng))

    if sort_by == "proximity":
        if lat is None or lng is None:
            raise HTTPException(status_code=400, detail="lat and lng required for proximity sort")
        items.sort(key=lambda p: p["distance_miles"] if p["distance_miles"] is not None else 9999)
    elif sort_by == "last_called":
        items.sort(key=lambda p: ensure_utc(p["last_call_date"]) or UTC_MIN, reverse=True)
    elif sort_by == "community_fill_rate":
        items.sort(
            key=lambda p: p["community_fill_rate"] if p["community_fill_rate"] is not None else -1,
            reverse=True,
        )
    else:
        items.sort(key=lambda p: p["sort_order"])

    return items


@router.post("/", status_code=201)
def create_pharmacy(
    body: PharmacyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pharmacy = Pharmacy(**body.model_dump(), user_id=current_user.id)
    db.add(pharmacy)
    db.commit()
    db.refresh(pharmacy)
    empty_community = {"community_fill_rate": None, "community_report_count": 0, "weekly_fill_rates": [], "last_report_at": None, "reliability_score": 0.0, "insight": None}
    return _pharmacy_response(pharmacy, empty_community)


@router.get("/nearby")
def nearby_pharmacies(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_meters: int = Query(8000),
    current_user: User = Depends(get_current_user),
):
    """Return candidate pharmacies near the given coordinates via Google Places."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail={"code": "no_places_key", "message": "Pharmacy discovery not configured."})

    resp = httpx.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        params={"location": f"{lat},{lng}", "radius": radius_meters, "type": "pharmacy", "key": api_key},
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Places API error")

    results = resp.json().get("results", [])
    already_saved = {p.name.lower() for p in current_user.pharmacies}

    candidates = []
    for r in results:
        loc = r.get("geometry", {}).get("location", {})
        candidates.append({
            "place_id": r["place_id"],
            "name": r.get("name", ""),
            "address": r.get("vicinity", ""),
            "latitude": loc.get("lat"),
            "longitude": loc.get("lng"),
            "distance_miles": round(
                _haversine_mi(lat, lng, loc["lat"], loc["lng"]), 1
            ) if loc.get("lat") and loc.get("lng") else None,
            "already_saved": r.get("name", "").lower() in already_saved,
        })

    candidates.sort(key=lambda c: c["distance_miles"] or 9999)
    return candidates


class AddFromPlaceBody(BaseModel):
    place_id: str
    is_vaulted: bool = False


@router.post("/from-place", status_code=201)
def add_pharmacy_from_place(
    body: AddFromPlaceBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch full details from Google Places and create a pharmacy record."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail={"code": "no_places_key"})

    resp = httpx.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        params={
            "place_id": body.place_id,
            "fields": "name,formatted_phone_number,formatted_address,geometry,address_components",
            "key": api_key,
        },
        timeout=10,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Places API error")

    result = resp.json().get("result", {})
    loc = result.get("geometry", {}).get("location", {})

    zip_code = None
    for component in result.get("address_components", []):
        if "postal_code" in component.get("types", []):
            zip_code = component["short_name"]
            break

    phone = result.get("formatted_phone_number", "")
    if not phone:
        raise HTTPException(status_code=422, detail="No phone number found for this pharmacy.")

    pharmacy = Pharmacy(
        user_id=current_user.id,
        name=result.get("name", ""),
        phone=phone,
        address=result.get("formatted_address", ""),
        latitude=loc.get("lat"),
        longitude=loc.get("lng"),
        zip_code=zip_code,
        is_vaulted=body.is_vaulted,
    )
    db.add(pharmacy)
    db.commit()
    db.refresh(pharmacy)
    empty_community = {"community_fill_rate": None, "community_report_count": 0, "weekly_fill_rates": [], "last_report_at": None, "reliability_score": 0.0, "insight": None}
    return _pharmacy_response(pharmacy, empty_community)


@router.patch("/{pharmacy_id}")
def update_pharmacy(
    pharmacy_id: int,
    body: PharmacyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pharmacy = db.query(Pharmacy).filter(
        Pharmacy.id == pharmacy_id, Pharmacy.user_id == current_user.id
    ).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(pharmacy, field, value)
    db.commit()
    db.refresh(pharmacy)
    empty_community = {"community_fill_rate": None, "community_report_count": 0, "weekly_fill_rates": [], "last_report_at": None, "reliability_score": 0.0, "insight": None}
    return _pharmacy_response(pharmacy, empty_community)


@router.delete("/{pharmacy_id}", status_code=204)
def delete_pharmacy(
    pharmacy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pharmacy = db.query(Pharmacy).filter(
        Pharmacy.id == pharmacy_id, Pharmacy.user_id == current_user.id
    ).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    db.delete(pharmacy)
    db.commit()


@router.post("/{pharmacy_id}/vault", status_code=200)
def toggle_vault(
    pharmacy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pharmacy = db.query(Pharmacy).filter(
        Pharmacy.id == pharmacy_id, Pharmacy.user_id == current_user.id
    ).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    pharmacy.is_vaulted = not pharmacy.is_vaulted
    db.commit()
    return {"is_vaulted": pharmacy.is_vaulted}
