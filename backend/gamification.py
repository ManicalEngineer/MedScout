"""The one place contribution counters change.

Every path that turns a user's input into a community AvailabilityReport calls
record_contribution() in the same transaction as the report insert. It updates:

  last_contribution_at  every contribution; drives give-to-get access
  contribution_count    every contribution, uncapped; the true per-user total
                        (Loops milestone event)
  badge_credits         at most DAILY_BADGE_CAP a day; drives volume badges
  monthly streak        consecutive UTC calendar months with a contribution
  user_badges           any badges the contribution just earned
  founding_slots        per-ZIP count of Founding Contributor badges handed out
  report_stats_daily    the anonymous per-area tally (every report)

Privacy rule: nothing here links a user to a report, pharmacy, medication or
place. Per-user state is counts and dates only; the per-area tally has no user.
The report's ZIP is read to bump the area tally and to claim a founding slot;
it is never stored on the user. Every badge rule below is computed from the
user's own counters and dates, plus the channel of the contribution in hand.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from loops import (
    CONTRIBUTOR_MILESTONE_THRESHOLD,
    send_badge_earned_event,
    send_contributor_milestone_event,
    send_first_report_event,
)
from areas import Area, area_for_zip
from models import (
    AvailabilityReport, FoundingSlots, ReportStatsDaily, SubscriptionTier, User, UserBadge,
)
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

# The first this-many users to contribute with a given ZIP become Founding
# Contributors. A user gets one try: their first contribution that has a ZIP.
FOUNDING_SLOTS_PER_ZIP = 250

YEAR_ONE_ACCOUNT_DAYS = 365
QUIET_HERO_CREDITS = 25


@dataclass(frozen=True)
class Badge:
    key: str
    name: str
    description: str
    # Volume badges: badge_credits needed. Streak badges: months needed.
    credits: Optional[int] = None
    streak_months: Optional[int] = None


# Display order. Keys are stored in user_badges — never rename one.
BADGES: tuple[Badge, ...] = (
    Badge("founding_contributor", "Founding Contributor",
          f"One of the first {FOUNDING_SLOTS_PER_ZIP} people to report in your ZIP code."),
    Badge("first_report", "First Report", "Shared your first pharmacy check.", credits=1),
    Badge("made_the_call", "Made the Call", "Shared the result of a call you made through MedScout."),
    Badge("pup", "Pup", "10 reports shared.", credits=10),
    Badge("tracker", "Tracker", "50 reports shared.", credits=50),
    Badge("bloodhound", "Bloodhound", "250 reports shared.", credits=250),
    Badge("quiet_hero", "Quiet Hero", "25 reports shared without ever needing a nickname."),
    Badge("steady_nose_3", "Steady Nose", "Reported 3 months in a row.", streak_months=3),
    Badge("steady_nose_6", "Steady Nose II", "Reported 6 months in a row.", streak_months=6),
    Badge("steady_nose_12", "Steady Nose III", "Reported 12 months in a row.", streak_months=12),
    Badge("year_one", "Year One", "Still reporting a year after joining."),
)
BADGES_BY_KEY = {b.key: b for b in BADGES}
VOLUME_BADGES = tuple(b for b in BADGES if b.credits)


@dataclass
class ContributionResult:
    was_first: bool
    earned_badge_credit: bool  # False once today's DAILY_BADGE_CAP is used up
    contribution_count: int
    new_badges: list[str] = field(default_factory=list)


def _month(d: date) -> date:
    return d.replace(day=1)


def _previous_month(d: date) -> date:
    return _month(_month(d) - timedelta(days=1))


def current_streak(user: User, today: Optional[date] = None) -> int:
    """The streak as it stands today. It survives until the end of the month
    after the last contribution, so a streak isn't lost on the 1st."""
    today = today or _utc_day(utcnow())
    if user.last_streak_month in (_month(today), _previous_month(today)):
        return user.current_streak_months or 0
    return 0


def _advance_streak(user: User, today: date) -> None:
    month = _month(today)
    if user.last_streak_month == month:
        return
    if user.last_streak_month == _previous_month(today):
        user.current_streak_months = (user.current_streak_months or 0) + 1
    else:
        user.current_streak_months = 1
    user.last_streak_month = month
    user.longest_streak_months = max(user.longest_streak_months or 0, user.current_streak_months)


def _insert(db: Session):
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:  # pragma: no cover — only Postgres (prod) and SQLite (dev/tests) are used
        raise RuntimeError(f"unsupported dialect {dialect}")
    return insert


def _claim_founding_slot(db: Session, zip_code: str) -> bool:
    """Take one of zip_code's founding slots if any are left. One atomic
    statement, so two concurrent claims can't both take the last slot."""
    insert = _insert(db)
    stmt = (
        insert(FoundingSlots)
        .values(zip_code=zip_code, claimed=1)
        .on_conflict_do_update(
            index_elements=["zip_code"],
            set_={"claimed": FoundingSlots.claimed + 1},
            where=FoundingSlots.claimed < FOUNDING_SLOTS_PER_ZIP,
        )
        .returning(FoundingSlots.claimed)
    )
    return db.execute(stmt).first() is not None


def _eligible_badges(user: User, channel: Optional[str], today: date, founding: bool) -> set[str]:
    keys = set()
    if founding:
        keys.add("founding_contributor")
    if channel == CHANNEL_CALL:
        keys.add("made_the_call")
    credits = user.badge_credits or 0
    streak = current_streak(user, today)
    for b in BADGES:
        if b.credits and credits >= b.credits:
            keys.add(b.key)
        if b.streak_months and streak >= b.streak_months:
            keys.add(b.key)
    if credits >= QUIET_HERO_CREDITS and not user.nickname:
        keys.add("quiet_hero")  # awarded while anonymous; kept if a nickname is set later
    if user.created_at and today - _utc_day(user.created_at) >= timedelta(days=YEAR_ONE_ACCOUNT_DAYS):
        keys.add("year_one")  # checked at contribution time, so they're still reporting
    return keys


def _award(db: Session, user: User, keys: set[str], today: date) -> list[str]:
    """Insert badges the user doesn't have yet; returns the new keys in display
    order. ON CONFLICT DO NOTHING, so a concurrent request can't double-award."""
    have = {k for (k,) in db.query(UserBadge.badge_key).filter(UserBadge.user_id == user.id)}
    new = [b.key for b in BADGES if b.key in keys and b.key not in have]
    insert = _insert(db)
    for key in new:
        db.execute(
            insert(UserBadge)
            .values(user_id=user.id, badge_key=key, awarded_on=today)
            .on_conflict_do_nothing(index_elements=["user_id", "badge_key"])
        )
    return new


def _utc_day(ts: datetime) -> date:
    return ensure_utc(ts).astimezone(timezone.utc).date()


def _bump_area_tally(db: Session, day: date, channel: str, zip_code: str, delta: int) -> None:
    """Add delta to one (day, channel, zip) bucket, creating it if needed.
    A single INSERT ... ON CONFLICT, so concurrent reports can't lose counts."""
    area = area_for_zip(zip_code)
    values = {"day": day, "channel": channel, "zip_code": zip_code,
              "area_code": area.code if area else "", "count": delta}
    stmt = _insert(db)(ReportStatsDaily).values(**values)
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

    _advance_streak(user, today)

    founding = False
    if not user.founding_checked and report.zip_code:
        user.founding_checked = True
        founding = _claim_founding_slot(db, report.zip_code)

    _bump_area_tally(db, today, channel, report.zip_code or "", 1)
    db.flush()  # user.id must be set before badges reference it
    new_badges = _award(db, user, _eligible_badges(user, channel, today, founding), today)

    return ContributionResult(
        was_first=was_first, earned_badge_credit=earned,
        contribution_count=user.contribution_count, new_badges=new_badges,
    )


def send_contribution_events(user: User, result: ContributionResult) -> None:
    """Loops events for a contribution. Call only after the commit succeeded."""
    if result.was_first:
        send_first_report_event(user.email)
    if result.contribution_count == CONTRIBUTOR_MILESTONE_THRESHOLD:
        send_contributor_milestone_event(user.email, result.contribution_count)
    if not user.gamification_enabled:
        return  # someone who hid badges shouldn't get badge emails
    for key in result.new_badges:
        send_badge_earned_event(user.email, key)


def visible_new_badges(user: User, result: Optional[ContributionResult]) -> list[dict]:
    """new_badges for an API response: empty when the user has hidden badges
    (they are still awarded, and appear if the user turns badges back on)."""
    if not result or not user.gamification_enabled:
        return []
    today = _utc_day(utcnow())
    return [badge_payload(k, today) for k in result.new_badges]


def badge_payload(key: str, awarded_on: Optional[date] = None) -> dict:
    b = BADGES_BY_KEY[key]
    return {"key": b.key, "name": b.name, "description": b.description,
            "awarded_on": awarded_on.isoformat() if awarded_on else None}


def progress(db: Session, user: User) -> dict:
    """Everything the Profile screen needs: totals, streak, every badge (earned
    or not) and the next volume badge."""
    today = _utc_day(utcnow())
    earned = {k: d for k, d in db.query(UserBadge.badge_key, UserBadge.awarded_on)
              .filter(UserBadge.user_id == user.id)}
    credits = user.badge_credits or 0
    nxt = next((b for b in VOLUME_BADGES if b.key not in earned and credits < b.credits), None)
    streak = current_streak(user, today)
    return {
        "gamification_enabled": bool(user.gamification_enabled),
        "nickname": user.nickname,
        "contribution_count": user.contribution_count or 0,
        "badge_credits": credits,
        "streak": {
            "current_months": streak,
            "longest_months": user.longest_streak_months or 0,
            "reported_this_month": user.last_streak_month == _month(today),
        },
        "badges": [
            {**badge_payload(b.key, earned.get(b.key)), "earned": b.key in earned}
            for b in BADGES
        ],
        "next_badge": (
            {**badge_payload(nxt.key), "remaining": nxt.credits - credits} if nxt else None
        ),
    }


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
