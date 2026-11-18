"""Operator-only endpoints. Authenticated by a shared secret in the X-Admin-Key
header (ADMIN_API_KEY), not by a user account. If ADMIN_API_KEY is unset the
routes answer 404, so they don't exist on an instance that hasn't opted in.

Everything here reads aggregates only (report_stats_daily). Nothing joins a
user to a report, and areas with fewer than AREA_MIN_REPORTED reports are shown
as "fewer than N", same as the in-app area-stats."""
import hmac
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from gamification import AREA_MIN_REPORTED, _utc_day, present_count
from models import ReportStatsDaily, User
from rate_limit import ip_key_func, limiter
from timeutil import utcnow

router = APIRouter()

TOP_AREAS = 15
DAILY_DAYS = 14


def require_admin_key(x_admin_key: str = Header(default="")) -> None:
    expected = os.getenv("ADMIN_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=404, detail="Not found")
    if not hmac.compare_digest(x_admin_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid admin key")


def _sum(db: Session, *filters) -> int:
    q = db.query(func.coalesce(func.sum(ReportStatsDaily.count), 0))
    for f in filters:
        q = q.filter(f)
    return int(q.scalar() or 0)


def _unknown_location(db: Session, last30) -> dict:
    """Reports that count toward totals but belong to no named area: either the
    report had no ZIP (e.g. its pharmacy's address couldn't be geocoded) or the
    ZIP isn't in data/zip_areas.csv. Raw counts, like the windows above."""
    unknown = ReportStatsDaily.area_code == ""
    return {
        "all_time": _sum(db, unknown),
        "last_30_days": _sum(db, unknown, last30),
        "no_zip": _sum(db, unknown, ReportStatsDaily.zip_code == ""),
        "zip_outside_named_areas": _sum(db, unknown, ReportStatsDaily.zip_code != ""),
    }


def _signups(db: Session, today) -> dict:
    """Account counts from users.created_at. Aggregates only; the server has no
    record of installs that never register or of the device platform."""
    day = func.date(User.created_at)

    def count(*filters) -> int:
        q = db.query(func.count(User.id))
        for f in filters:
            q = q.filter(f)
        return int(q.scalar() or 0)

    start7 = utcnow() - timedelta(days=7)
    start30 = utcnow() - timedelta(days=30)
    by_day = {
        str(d): int(n)
        for d, n in db.query(day, func.count(User.id))
        .filter(User.created_at >= utcnow() - timedelta(days=DAILY_DAYS)).group_by(day).all()
    }
    return {
        "total": count(),
        "last_7_days": count(User.created_at >= start7),
        "last_30_days": count(User.created_at >= start30),
        "by_sign_in_method": {
            "apple": count(User.apple_sub.isnot(None)),
            "google": count(User.google_sub.isnot(None)),
            "email_password": count(User.hashed_password.isnot(None)),
        },
        "with_push_notifications": count(User.push_token.isnot(None)),
        "with_at_least_one_report": count(User.contribution_count > 0),
        "last_14_days": [
            {"day": (today - timedelta(days=i)).isoformat(),
             "count": by_day.get((today - timedelta(days=i)).isoformat(), 0)}
            for i in range(DAILY_DAYS)
        ],
    }


@router.get("/report-stats")
@limiter.limit("30/hour", key_func=ip_key_func)
def report_stats(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin_key),
):
    """How many community reports exist and where they come from."""
    today = _utc_day(utcnow())
    since = {"last_7_days": today - timedelta(days=7), "last_30_days": today - timedelta(days=30)}
    D = ReportStatsDaily.day

    windows = {"all_time": {"total": _sum(db)}}
    windows["all_time"]["by_channel"] = {
        ch: n for ch, n in db.query(ReportStatsDaily.channel, func.sum(ReportStatsDaily.count))
        .group_by(ReportStatsDaily.channel).all()
    }
    for name, start in since.items():
        windows[name] = {
            "total": _sum(db, D > start),
            "by_channel": {
                ch: int(n) for ch, n in db.query(ReportStatsDaily.channel, func.sum(ReportStatsDaily.count))
                .filter(D > start).group_by(ReportStatsDaily.channel).all()
            },
        }
    windows["all_time"]["by_channel"] = {k: int(v) for k, v in windows["all_time"]["by_channel"].items()}

    # Top named areas. The area_code "" bucket is reports with no/unknown ZIP.
    last30 = D > since["last_30_days"]
    rows = (
        db.query(ReportStatsDaily.area_code, func.sum(ReportStatsDaily.count).label("n"))
        .filter(ReportStatsDaily.area_code != "")
        .group_by(ReportStatsDaily.area_code)
        .order_by(func.sum(ReportStatsDaily.count).desc())
        .limit(TOP_AREAS)
        .all()
    )
    from areas import area_for_zip  # name lookup via a ZIP in the area
    names = {}
    for code, in db.query(ReportStatsDaily.area_code).filter(
        ReportStatsDaily.area_code.in_([r.area_code for r in rows])
    ).distinct():
        z = (
            db.query(ReportStatsDaily.zip_code)
            .filter(ReportStatsDaily.area_code == code, ReportStatsDaily.zip_code != "")
            .first()
        )
        a = area_for_zip(z[0]) if z else None
        names[code] = a.name if a else code
    top_areas = []
    for r in rows:
        n30 = _sum(db, ReportStatsDaily.area_code == r.area_code, last30)
        top_areas.append({
            "area_code": r.area_code,
            "area_name": names.get(r.area_code, r.area_code),
            "all_time": present_count(int(r.n)),
            "last_30_days": present_count(n30),
        })

    daily = {
        d.isoformat(): int(n)
        for d, n in db.query(D, func.sum(ReportStatsDaily.count))
        .filter(D > today - timedelta(days=DAILY_DAYS)).group_by(D).all()
    }
    last_14_days = [
        {"day": (today - timedelta(days=i)).isoformat(),
         "count": daily.get((today - timedelta(days=i)).isoformat(), 0)}
        for i in range(DAILY_DAYS)
    ]

    return {
        "as_of": today.isoformat(),
        "windows": windows,
        "distinct_areas": db.query(func.count(func.distinct(ReportStatsDaily.area_code)))
            .filter(ReportStatsDaily.area_code != "").scalar() or 0,
        "distinct_zips": db.query(func.count(func.distinct(ReportStatsDaily.zip_code)))
            .filter(ReportStatsDaily.zip_code != "").scalar() or 0,
        "top_areas": top_areas,
        "unknown_location": _unknown_location(db, last30),
        "last_14_days": last_14_days,
        "signups": _signups(db, today),
        "note": f"Areas under {AREA_MIN_REPORTED} reports are shown as 'fewer than {AREA_MIN_REPORTED}'.",
    }
