"""The one place contribution counters change.

Every path that turns a user's input into a community AvailabilityReport calls
record_contribution() in the same transaction as the report insert. It updates:

  last_contribution_at  every contribution; drives give-to-get access
  contribution_count    every contribution, uncapped; the true per-user total
                        (Loops milestone event)
  badge_credits         at most DAILY_BADGE_CAP a day; drives badges
  report_stats_daily    the anonymous per-area tally (every report)

Privacy rule: nothing here links a user to a report, pharmacy, medication or
place. Per-user state is counts and dates only; the per-area tally has no user.
The report's ZIP is read to bump the area tally and is not stored on the user.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from loops import (
    CONTRIBUTOR_MILESTONE_THRESHOLD,
    send_contributor_milestone_event,
    send_first_report_event,
)
from areas import Area, area_for_zip
from models import AvailabilityReport, ReportStatsDaily, SubscriptionTier, User
from timeutil import ensure_utc, utcnow

# Contributions past this many in one UTC day still count everywhere else
# (access, contribution_count, area totals) but earn no badge credit, so badges
# can't be farmed by volume.
DAILY_BADGE_CAP = 10

# Area totals below this are reported as "fewer than" rather than an exact
# number, so a small area's count can't point back to one person.
AREA_MIN_REPORTED = 10

CHANNEL_MANUAL = "manual"
CHANNEL_CALL = "call"


@dataclass
class ContributionResult:
    was_first: bool
    earned_badge_credit: bool  # False once today's DAILY_BADGE_CAP is used up
    contribution_count: int


def _utc_day(ts: datetime) -> date:
    return ensure_utc(ts).astimezone(timezone.utc).date()


def _bump_area_tally(db: Session, day: date, channel: str, zip_code: str, delta: int) -> None:
    """Add delta to one (day, channel, zip) bucket, creating it if needed.
    A single INSERT ... ON CONFLICT, so concurrent reports can't lose counts."""
    area = area_for_zip(zip_code)
    values = {"day": day, "channel": channel, "zip_code": zip_code,
              "area_code": area.code if area else "", "count": delta}
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:  # pragma: no cover — only Postgres (prod) and SQLite (dev/tests) are used
        raise RuntimeError(f"unsupported dialect {dialect}")
    stmt = insert(ReportStatsDaily).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["day", "channel", "zip_code"],
        set_={"count": ReportStatsDaily.count + delta},
    )
    db.execute(stmt)


def record_contribution(
    db: Session, user: User, report: AvailabilityReport, channel: str
) -> ContributionResult:
    """Call after db.add(report), before db.commit(). Does not commit."""
    now = utcnow()
    today = _utc_day(now)
    was_first = user.last_contribution_at is None

    user.last_contribution_at = now
    if user.subscription_tier == SubscriptionTier.free:
        user.subscription_tier = SubscriptionTier.contributor

    if user.contribution_day != today:
        user.contribution_day = today
        user.contributions_today = 0
    earned = (user.contributions_today or 0) < DAILY_BADGE_CAP
    user.contributions_today = (user.contributions_today or 0) + 1
    user.contribution_count = (user.contribution_count or 0) + 1
    if earned:
        user.badge_credits = (user.badge_credits or 0) + 1

    _bump_area_tally(db, today, channel, report.zip_code or "", 1)

    return ContributionResult(
        was_first=was_first, earned_badge_credit=earned, contribution_count=user.contribution_count
    )


def send_contribution_events(user: User, result: ContributionResult) -> None:
    """Loops events for a contribution. Call only after the commit succeeded."""
    if result.was_first:
        send_first_report_event(user.email)
    if result.contribution_count == CONTRIBUTOR_MILESTONE_THRESHOLD:
        send_contributor_milestone_event(user.email, result.contribution_count)


def remove_from_area_tally(db: Session, report: AvailabilityReport) -> None:
    """A report hidden by flags stops counting toward its area. The bucket is
    found from the report's own day and ZIP; its channel isn't recorded on the
    report, so the decrement goes to whichever bucket for that day and ZIP still
    has a count. Does not commit."""
    if report.reported_at is None:
        return
    day = _utc_day(report.reported_at)
    row = (
        db.query(ReportStatsDaily)
        .filter(
            ReportStatsDaily.day == day,
            ReportStatsDaily.zip_code == (report.zip_code or ""),
            ReportStatsDaily.count > 0,
        )
        .order_by(ReportStatsDaily.channel)
        .with_for_update()
        .first()
    )
    if row:
        row.count -= 1


def area_counts(db: Session, area: Area, days: Optional[int] = None) -> int:
    """Total community reports in `area`, over the last `days` UTC days (today
    included), or all time when days is None."""
    q = db.query(func.coalesce(func.sum(ReportStatsDaily.count), 0)).filter(
        ReportStatsDaily.area_code == area.code
    )
    if days is not None:
        q = q.filter(ReportStatsDaily.day > _utc_day(utcnow()) - timedelta(days=days))
    return int(q.scalar() or 0)


def present_count(n: int) -> dict:
    """{'count': n} when n is large enough to show, else {'count': None,
    'fewer_than': AREA_MIN_REPORTED}."""
    if n >= AREA_MIN_REPORTED:
        return {"count": n, "fewer_than": None}
    return {"count": None, "fewer_than": AREA_MIN_REPORTED}
