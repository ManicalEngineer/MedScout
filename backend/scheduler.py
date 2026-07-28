"""Daily background jobs. FastAPI has no built-in scheduler — this runs an
in-process APScheduler instance, started from main.py's lifespan. Fine at
beta scale (single server); would need a real job queue if this ever runs
across multiple instances, to avoid double-sending reminders.
"""
import logging
import os
from datetime import date, datetime, timezone

import httpx
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models import CallLog, CallStatus, RefillCountdown, ShortageStatus, TrackedMedication, User
from notifications import EXPO_PUSH_URL, EXPO_PUSH_BATCH_SIZE

logger = logging.getLogger("scheduler")

FDA_SHORTAGE_URL = "https://api.fda.gov/drug/shortages.json"


def _send_push(tokens: list[str], title: str, body: str, data: dict) -> None:
    if not tokens:
        return
    try:
        for i in range(0, len(tokens), EXPO_PUSH_BATCH_SIZE):
            batch = tokens[i:i + EXPO_PUSH_BATCH_SIZE]
            messages = [{"to": t, "title": title, "body": body, "data": data} for t in batch]
            httpx.post(EXPO_PUSH_URL, json=messages, timeout=10)
    except Exception:
        logger.exception("Push send failed")


def run_refill_reminders(db: Session) -> None:
    """Notify once per refill cycle when it's time to start hunting."""
    today = date.today()
    rows = (
        db.query(RefillCountdown)
        .filter(
            RefillCountdown.push_notifications_enabled.is_(True),
            RefillCountdown.last_fill_date.isnot(None),
        )
        .all()
    )
    for rc in rows:
        try:
            run_out = rc.last_fill_date.toordinal() + rc.days_supply
            hunt_start = date.fromordinal(run_out - rc.lead_time_days)
            if today < hunt_start:
                continue
            if rc.last_reminder_sent_at is not None and rc.last_reminder_sent_at >= rc.last_fill_date:
                continue  # already notified for this fill cycle
            user = db.query(User).filter(User.id == rc.user_id).first()
            if not user or not user.push_token:
                continue
            _send_push(
                [user.push_token],
                "Time to start hunting",
                f"Your {rc.medication_name} refill window is open — find a pharmacy with stock.",
                {"type": "refill_reminder", "refill_countdown_id": rc.id},
            )
            rc.last_reminder_sent_at = today
            db.commit()
        except Exception:
            logger.exception("Refill reminder failed for RefillCountdown %s", rc.id)
            db.rollback()


def run_checkback_reminders(db: Session) -> None:
    """Notify once when a check_back call's expected_restock_date arrives."""
    today = date.today()
    rows = (
        db.query(CallLog)
        .filter(
            CallLog.status == CallStatus.check_back,
            CallLog.expected_restock_date.isnot(None),
            CallLog.expected_restock_date <= today,
            CallLog.checkback_reminder_sent_at.is_(None),
        )
        .all()
    )
    for call in rows:
        try:
            user = db.query(User).filter(User.id == call.user_id).first()
            if not user or not user.push_token:
                call.checkback_reminder_sent_at = datetime.now(timezone.utc)
                db.commit()
                continue
            pharmacy_name = call.pharmacy.name if call.pharmacy else "the pharmacy"
            _send_push(
                [user.push_token],
                "Check back today",
                f"{pharmacy_name} said they'd have more by now — worth a call.",
                {"type": "checkback_reminder", "call_id": call.id},
            )
            call.checkback_reminder_sent_at = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            logger.exception("Check-back reminder failed for CallLog %s", call.id)
            db.rollback()


# openFDA's openfda.brand_name field stores the bare brand ("ADDERALL"), not
# the formulation our medication_name carries ("Adderall XR") — strip known
# formulation suffixes before searching, confirmed empirically: searching
# "ADDERALL XR" 404s while "ADDERALL" matches.
_FORMULATION_SUFFIXES = (" XR", " ER", " LA", " CD", " SR", " ODT", " CR", " XL")


def _strip_formulation(name: str) -> str:
    upper = name.upper()
    for suffix in _FORMULATION_SUFFIXES:
        if upper.endswith(suffix):
            return upper[: -len(suffix)]
    return upper


def _classify_availability(results: list[dict]) -> tuple[str, str | None]:
    worst = "available"
    detail = None
    for r in results:
        avail = (r.get("availability") or "").lower()
        if "unavailable" in avail:
            return "unavailable", r.get("related_info") or detail
        if "limited" in avail and worst == "available":
            worst = "limited"
            detail = r.get("related_info") or detail
    return worst, detail


def run_fda_shortage_ingestion(db: Session) -> None:
    """Refresh national shortage status for every medication tracked locally
    by any user (see TrackedMedication — an anonymous tally with no user
    linkage). Best-effort per medication — openFDA returns a 404 (not an
    empty result set) when a brand has no shortage records on file at all,
    which just means 'nothing to report', not an error."""
    names = {
        name for (name,) in db.query(TrackedMedication.medication_name).distinct().all()
        if name
    }
    for name in names:
        try:
            resp = httpx.get(
                FDA_SHORTAGE_URL,
                params={"search": f'openfda.brand_name:"{_strip_formulation(name)}"', "limit": 100},
                timeout=15,
            )
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if not results:
                continue
            status, detail = _classify_availability(results)

            row = db.query(ShortageStatus).filter(ShortageStatus.medication_name == name).first()
            if not row:
                row = ShortageStatus(medication_name=name, source="fda")
                db.add(row)
            row.status = status
            row.detail = detail
            db.commit()
        except Exception:
            logger.exception("FDA shortage ingestion failed for %s", name)
            db.rollback()


def _run_all_jobs() -> None:
    db = SessionLocal()
    try:
        run_refill_reminders(db)
        run_checkback_reminders(db)
        run_fda_shortage_ingestion(db)
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    # This scheduler is in-process, not distributed — if the API is deployed
    # with more than one worker/instance, each would run these jobs
    # independently, sending duplicate push notifications and hitting the FDA
    # API redundantly. Set ENABLE_SCHEDULER=false on every instance except
    # one (or run a dedicated single-instance worker service) if you need to
    # scale the API horizontally before this gets a real distributed lock.
    if os.getenv("ENABLE_SCHEDULER", "true").lower() == "false":
        logger.info("Scheduler disabled via ENABLE_SCHEDULER=false")
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_run_all_jobs, "cron", hour=13, minute=0, id="daily_jobs")
    _scheduler.start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
