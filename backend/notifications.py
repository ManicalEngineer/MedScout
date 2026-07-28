"""Restock push notifications — notifies users with a saved pharmacy near a
new in-stock community report, matching the medication/strength on their
alert settings (kept in sync with the on-device active profile).
"""
from datetime import datetime, timezone
from math import radians, cos, sin, asin, sqrt
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from models import AlertSettings, AvailabilityReport, CallStatus, Pharmacy, User

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_BATCH_SIZE = 100


def _haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * R * asin(sqrt(a))


def _in_quiet_hours(settings: AlertSettings) -> bool:
    # No per-user timezone is stored, so this uses server-local hour as a
    # best-effort approximation rather than the user's actual local time.
    hour = datetime.now(timezone.utc).astimezone().hour
    start, end = settings.quiet_hours_start, settings.quiet_hours_end
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end  # wraps past midnight, e.g. 22 -> 8


def _matching_recipients(report: AvailabilityReport, db: Session, exclude_user_id: Optional[int]) -> list[str]:
    """Users whose saved pharmacy is near this report and whose alert-settings
    medication/strength matches, excluding the contributor (if known) and
    anyone without alerts enabled, a push token, or currently in quiet hours."""
    if report.status != CallStatus.in_stock or report.latitude is None or report.longitude is None:
        return []

    q = db.query(User).join(AlertSettings).filter(
        AlertSettings.enabled.is_(True),
        User.push_token.isnot(None),
    )
    if exclude_user_id is not None:
        q = q.filter(User.id != exclude_user_id)

    tokens = []
    for user in q.all():
        settings = user.alert_settings
        if not settings or _in_quiet_hours(settings):
            continue
        if not settings.medication_name or not settings.strength:
            continue
        if settings.medication_name.lower() not in report.medication_name.lower() and \
                report.medication_name.lower() not in settings.medication_name.lower():
            continue
        if settings.strength.lower() != report.strength.lower():
            continue

        nearby = db.query(Pharmacy).filter(
            Pharmacy.user_id == user.id,
            Pharmacy.latitude.isnot(None),
            Pharmacy.longitude.isnot(None),
        ).all()
        if any(
            _haversine_mi(p.latitude, p.longitude, report.latitude, report.longitude) <= settings.radius_miles
            for p in nearby
        ):
            tokens.append(user.push_token)

    return tokens


def notify_restock(report: AvailabilityReport, db: Session, exclude_user_id: Optional[int] = None) -> None:
    """Best-effort — never raises, since a notification failure shouldn't
    break the report submission it's attached to."""
    try:
        tokens = _matching_recipients(report, db, exclude_user_id)
        if not tokens:
            return
        title = "Back in stock nearby"
        body = f"{report.medication_name} {report.strength} was just reported in stock near you."
        for i in range(0, len(tokens), EXPO_PUSH_BATCH_SIZE):
            batch = tokens[i:i + EXPO_PUSH_BATCH_SIZE]
            messages = [{"to": t, "title": title, "body": body, "data": {"type": "restock"}} for t in batch]
            httpx.post(EXPO_PUSH_URL, json=messages, timeout=10)
    except Exception:
        pass
