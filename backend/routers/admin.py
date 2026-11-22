"""Operator-only endpoints. Authenticated by a shared secret in the X-Admin-Key
header (ADMIN_API_KEY), not by a user account. If ADMIN_API_KEY is unset the
routes answer 404, so they don't exist on an instance that hasn't opted in.

Everything here reads aggregates only (report_stats_daily). Nothing joins a
user to a report, and areas with fewer than AREA_MIN_REPORTED reports are shown
as "fewer than N", same as the in-app area-stats.

Exception: /zip-breakdown returns raw per-ZIP counts with no suppression, since
it's for the operator only. It still returns no user identifiers, and it counts
signups and reports separately (no user is joined to a report)."""
import hmac
import os
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from areas import area_for_zip
from database import get_db
from gamification import AREA_MIN_REPORTED, _utc_day, present_count
from models import AvailabilityReport, CallLog, Pharmacy, ReportSource, ReportStatsDaily, User
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


# --- /zip-breakdown -----------------------------------------------------------

NO_ZIP = "no_zip"
# report_stats_daily channel -> name in the response. "manual" is a report
# submitted straight from the app (POST /availability/report).
_CHANNEL_NAMES = {"call": "call", "manual": "community", "backfill": "backfill"}
_STATUSES = ("in_stock", "out_of_stock", "check_back", "unknown")
# Users have no home ZIP column, so a user's ZIP is taken from their pharmacies.
BASIS_MOST_CALLED = "most_called_pharmacy"  # the saved pharmacy they've called most
BASIS_SAVED = "saved_pharmacy"  # no calls yet: the top pharmacy in their saved list


def _zip5(z: Optional[str]) -> Optional[str]:
    z = (z or "").strip()[:5]
    return z if len(z) == 5 and z.isdigit() else None


def _empty_zip_row(zip_code: str) -> dict:
    a = None if zip_code == NO_ZIP else area_for_zip(zip_code)
    return {
        "zip_code": None if zip_code == NO_ZIP else zip_code,
        "area_code": a.code if a else None,
        "area_name": a.name if a else None,
        "signups": 0,
        "signups_basis": {BASIS_MOST_CALLED: 0, BASIS_SAVED: 0},
        "reports_total": 0,
        "reports_by_channel": {"call": 0, "community": 0, "backfill": 0},
        "reports_in_stock": 0,
        "reports_out_of_stock": 0,
        "reports_check_back": 0,
        "reports_unknown": 0,
        "last_report_at": None,
    }


def _signup_zips(db: Session, created_after: Optional[datetime]) -> dict[str, dict[str, int]]:
    """{zip or NO_ZIP: {basis: n}} for users created after created_after.
    Each user lands in exactly one bucket. Only counts leave this function."""
    calls = (
        db.query(CallLog.pharmacy_id, func.count(CallLog.id).label("n"))
        .group_by(CallLog.pharmacy_id).subquery()
    )
    q = (
        db.query(Pharmacy.user_id, Pharmacy.zip_code, Pharmacy.is_vaulted, Pharmacy.sort_order,
                 Pharmacy.id, func.coalesce(calls.c.n, 0))
        .join(User, User.id == Pharmacy.user_id)
        .outerjoin(calls, calls.c.pharmacy_id == Pharmacy.id)
    )
    if created_after is not None:
        q = q.filter(User.created_at >= created_after)
    best: dict[int, tuple] = {}
    for user_id, zip_code, vaulted, sort_order, pid, n in q.all():
        # Most calls first; then vaulted, then list order, then oldest.
        rank = (-int(n), not vaulted, sort_order or 0, pid)
        if user_id not in best or rank < best[user_id][0]:
            best[user_id] = (rank, zip_code, int(n))

    out: dict[str, dict[str, int]] = {}
    for _, zip_code, n in best.values():
        key = _zip5(zip_code) or NO_ZIP
        basis = BASIS_MOST_CALLED if n > 0 else BASIS_SAVED
        bucket = out.setdefault(key, {BASIS_MOST_CALLED: 0, BASIS_SAVED: 0, "none": 0})
        bucket[basis] += 1

    users = db.query(func.count(User.id))
    if created_after is not None:
        users = users.filter(User.created_at >= created_after)
    without_pharmacy = int(users.scalar() or 0) - len(best)
    if without_pharmacy:
        out.setdefault(NO_ZIP, {BASIS_MOST_CALLED: 0, BASIS_SAVED: 0, "none": 0})["none"] += without_pharmacy
    return out


@router.get("/zip-breakdown")
@limiter.limit("30/hour", key_func=ip_key_func)
def zip_breakdown(
    request: Request,
    days: Optional[int] = Query(default=None, ge=1, le=3650,
                                description="Only the last N UTC days, today included. Omit for all time."),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin_key),
):
    """Signups and community reports per ZIP, raw counts (no small-number
    suppression). No user emails, names or IDs.

    - reports_total / reports_by_channel: the report_stats_daily tally, the same
      numbers report-stats sums.
    - reports_in_stock etc. and last_report_at: community rows in
      availability_reports (the tally has no status). These can differ slightly
      from reports_total, e.g. if report rows were ever removed.
    - signups: users have no home ZIP, so each user counts once under the ZIP
      of the pharmacy they've called most (or, with no calls, the top pharmacy
      in their saved list). Users with no pharmacy, or whose chosen pharmacy has
      no ZIP, go in no_zip."""
    today = _utc_day(utcnow())
    first_day = today - timedelta(days=days - 1) if days else None
    since = datetime.combine(first_day, time.min, tzinfo=timezone.utc) if first_day else None

    rows: dict[str, dict] = {}

    def row(z: str) -> dict:
        if z not in rows:
            rows[z] = _empty_zip_row(z)
        return rows[z]

    # Report totals by channel, from the tally.
    tq = db.query(ReportStatsDaily.zip_code, ReportStatsDaily.channel, func.sum(ReportStatsDaily.count))
    if first_day:
        tq = tq.filter(ReportStatsDaily.day >= first_day)
    for zip_code, channel, n in tq.group_by(ReportStatsDaily.zip_code, ReportStatsDaily.channel).all():
        n = int(n or 0)
        if not n:
            continue
        r = row(_zip5(zip_code) or NO_ZIP)
        r["reports_total"] += n
        name = _CHANNEL_NAMES.get(channel, channel)
        r["reports_by_channel"][name] = r["reports_by_channel"].get(name, 0) + n

    # Status split and latest report, from the report rows.
    rq = db.query(
        AvailabilityReport.zip_code, AvailabilityReport.status,
        func.count(AvailabilityReport.id), func.max(AvailabilityReport.reported_at),
    ).filter(AvailabilityReport.source == ReportSource.community)
    if since:
        rq = rq.filter(AvailabilityReport.reported_at >= since)
    for zip_code, status, n, last in rq.group_by(AvailabilityReport.zip_code, AvailabilityReport.status).all():
        r = row(_zip5(zip_code) or NO_ZIP)
        s = status.value if hasattr(status, "value") else str(status)
        key = f"reports_{s}" if s in _STATUSES else "reports_unknown"
        r[key] += int(n)
        if last is not None:
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if r["last_report_at"] is None or last > r["last_report_at"]:
                r["last_report_at"] = last

    # Signups by ZIP.
    no_pharmacy = 0
    for z, counts in _signup_zips(db, since).items():
        r = row(z)
        r["signups"] += counts[BASIS_MOST_CALLED] + counts[BASIS_SAVED] + counts["none"]
        r["signups_basis"][BASIS_MOST_CALLED] += counts[BASIS_MOST_CALLED]
        r["signups_basis"][BASIS_SAVED] += counts[BASIS_SAVED]
        no_pharmacy += counts["none"]

    no_zip = rows.pop(NO_ZIP, None) or _empty_zip_row(NO_ZIP)
    no_zip.pop("zip_code"); no_zip.pop("area_code"); no_zip.pop("area_name")
    no_zip["signups_basis"]["no_pharmacy"] = no_pharmacy

    zips = sorted(rows.values(), key=lambda r: (-r["reports_total"], -r["signups"], r["zip_code"]))

    summary = _empty_zip_row(NO_ZIP)
    for k in ("zip_code", "area_code", "area_name"):
        summary.pop(k)
    summary["signups_basis"]["no_pharmacy"] = 0
    for r in zips + [no_zip]:
        for k in ("signups", "reports_total", "reports_in_stock", "reports_out_of_stock",
                  "reports_check_back", "reports_unknown"):
            summary[k] += r[k]
        for k, v in r["signups_basis"].items():
            summary["signups_basis"][k] = summary["signups_basis"].get(k, 0) + v
        for k, v in r["reports_by_channel"].items():
            summary["reports_by_channel"][k] = summary["reports_by_channel"].get(k, 0) + v
        if r["last_report_at"] and (summary["last_report_at"] is None or r["last_report_at"] > summary["last_report_at"]):
            summary["last_report_at"] = r["last_report_at"]
    summary["zip_count"] = len(zips)

    def iso(r: dict) -> dict:
        if r["last_report_at"] is not None:
            r["last_report_at"] = r["last_report_at"].isoformat()
        return r

    return {
        "as_of": today.isoformat(),
        "days": days,
        "since": first_day.isoformat() if first_day else None,
        "signup_zip_basis": (
            "Users have no stored home ZIP. Each user is counted under the ZIP of their "
            f"most-called saved pharmacy ({BASIS_MOST_CALLED}) or, with no calls, the top "
            f"pharmacy in their saved list ({BASIS_SAVED}). Others are in no_zip."
        ),
        "summary": iso(summary),
        "zips": [iso(r) for r in zips],
        "no_zip": iso(no_zip),
    }
