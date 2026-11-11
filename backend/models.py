import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float, Text, Enum, ForeignKey, Date,
    Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class SubscriptionTier(str, enum.Enum):
    free = "free"
    contributor = "contributor"
    premium = "premium"


class CallStatus(str, enum.Enum):
    in_stock = "in_stock"
    out_of_stock = "out_of_stock"
    check_back = "check_back"
    unknown = "unknown"


class ReportSource(str, enum.Enum):
    community = "community"
    fda = "fda"
    ashp = "ashp"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # nullable for OAuth users
    apple_sub = Column(String, unique=True, nullable=True, index=True)
    google_sub = Column(String, unique=True, nullable=True, index=True)
    # Apple refresh token, kept only so account deletion can revoke it with Apple.
    apple_refresh_token = Column(String, nullable=True)
    caregiver_mode = Column(Boolean, default=False)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.free)
    # Bumping this invalidates every outstanding JWT for the user
    token_version = Column(Integer, default=0, nullable=False, server_default="0")
    last_contribution_at = Column(DateTime(timezone=True), nullable=True)
    # Count only — no linkage to which reports/pharmacies, so the count itself
    # reveals nothing about report content. Drives the Loops contributor_milestone event.
    contribution_count = Column(Integer, default=0, nullable=False, server_default="0")
    # Badge progress: like contribution_count, but at most DAILY_BADGE_CAP per UTC
    # day count (see gamification.py), so badges can't be farmed by volume.
    badge_credits = Column(Integer, default=0, nullable=False, server_default="0")
    # Today's raw tally, only to apply that cap. No history is kept;
    # last_contribution_at already implies the day.
    contribution_day = Column(Date, nullable=True)
    contributions_today = Column(Integer, default=0, nullable=False, server_default="0")
    # Monthly streak: consecutive UTC calendar months with at least one
    # contribution. Months are stored as their first day; no history is kept.
    current_streak_months = Column(Integer, default=0, nullable=False, server_default="0")
    longest_streak_months = Column(Integer, default=0, nullable=False, server_default="0")
    last_streak_month = Column(Date, nullable=True)
    # True once this user's first contribution with a ZIP has been checked against
    # that ZIP's founding slots, so a user can only ever try for one slot. The
    # ZIP itself is not stored.
    founding_checked = Column(Boolean, default=False, nullable=False, server_default="0")
    # Optional, shown only to the user themself (nicknames.py). Unique ignoring
    # case (index below the class).
    nickname = Column(String(20), nullable=True)
    # False hides badges and streaks in the app; counters keep running because
    # give-to-get depends on them.
    gamification_enabled = Column(Boolean, default=True, nullable=False, server_default="1")
    push_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pharmacies = relationship("Pharmacy", back_populates="user", cascade="all, delete-orphan")
    call_logs = relationship("CallLog", back_populates="user", cascade="all, delete-orphan")
    refill_countdowns = relationship("RefillCountdown", back_populates="user", cascade="all, delete-orphan")
    alert_settings = relationship("AlertSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    alert_subscriptions = relationship("MedicationAlertSubscription", back_populates="user", cascade="all, delete-orphan")
    badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")


Index("uq_users_nickname_lower", func.lower(User.nickname), unique=True)


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    zip_code = Column(String, nullable=True)
    is_vaulted = Column(Boolean, default=False)  # private vault — never synced
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="pharmacies")
    call_logs = relationship("CallLog", back_populates="pharmacy", cascade="all, delete-orphan")

    @property
    def last_call(self):
        if self.call_logs:
            return max(self.call_logs, key=lambda c: c.called_at)
        return None


class CallLog(Base):
    """Record of a single pharmacy call."""
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pharmacy_id = Column(Integer, ForeignKey("pharmacies.id"), nullable=False)
    called_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(CallStatus), default=CallStatus.unknown)
    contributed_to_community = Column(Boolean, default=False)
    medication_name = Column(String, nullable=True)
    strength = Column(String, nullable=True)
    expected_restock_date = Column(Date, nullable=True)
    # Private — never copied into AvailabilityReport by _maybe_contribute()
    notes = Column(String, nullable=True)
    manufacturer = Column(String, nullable=True)
    # Set once a check-back reminder push has fired for this call's
    # expected_restock_date, so the daily job doesn't re-notify every run.
    checkback_reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="call_logs")
    pharmacy = relationship("Pharmacy", back_populates="call_logs")


class RefillCountdown(Base):
    """Per-medication refill countdown. Caregivers get one per child's medication.
    medication_name is client-supplied (the profile itself lives on-device only)."""
    __tablename__ = "refill_countdowns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    medication_name = Column(String, nullable=False)
    last_fill_date = Column(Date, nullable=True)
    days_supply = Column(Integer, default=30)
    lead_time_days = Column(Integer, default=7)
    push_notifications_enabled = Column(Boolean, default=True)
    # Compared against last_fill_date to send the "start hunting" reminder
    # exactly once per refill cycle rather than once per day.
    last_reminder_sent_at = Column(Date, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="refill_countdowns")


class AvailabilityReport(Base):
    """Crowdsourced stock report — the data behind the map."""
    __tablename__ = "availability_reports"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_name = Column(String, nullable=False)
    pharmacy_address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)
    zip_code = Column(String, nullable=True, index=True)
    medication_name = Column(String, nullable=False)
    strength = Column(String, nullable=False)
    status = Column(Enum(CallStatus), nullable=False)
    expected_restock_date = Column(Date, nullable=True)
    source = Column(Enum(ReportSource), default=ReportSource.community)
    reported_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    # Deliberately no user column: a report is not linked to the account that
    # submitted it, and CallLog does not point at the report it spawned either.
    # Set when a report collects REPORT_HIDE_THRESHOLD flags; hidden until reviewed.
    hidden_at = Column(DateTime(timezone=True), nullable=True, index=True)


class ReportFlag(Base):
    """A user flagging a community report. One flag per user per report."""
    __tablename__ = "report_flags"
    __table_args__ = (UniqueConstraint("report_id", "reporter_id", name="uq_report_flag_once"),)

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("availability_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String, nullable=False)  # one of FLAG_REASONS (validated in the router)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ShortageStatus(Base):
    """National shortage status per medication brand, ingested daily from
    openFDA. Distinct from AvailabilityReport: this is not pharmacy-specific —
    it answers 'is this drug in a national shortage', not 'does pharmacy X
    have it'. Surfaced on the Dashboard instead of a generic static banner."""
    __tablename__ = "shortage_status"

    id = Column(Integer, primary_key=True, index=True)
    medication_name = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, nullable=False)  # "available" | "limited" | "unavailable"
    detail = Column(String, nullable=True)
    source = Column(String, default="fda")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AlertSettings(Base):
    """Per-user push notification preferences — radius and quiet hours only.
    These apply across every medication the user has subscribed to alerts
    for (see MedicationAlertSubscription); there's no per-medication radius
    or quiet-hours, that's more granularity than anyone's asked for."""
    __tablename__ = "alert_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    radius_miles = Column(Integer, default=10)
    quiet_hours_start = Column(Integer, default=22)  # hour in 24h, e.g. 22 = 10pm
    quiet_hours_end = Column(Integer, default=8)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="alert_settings")


class MedicationAlertSubscription(Base):
    """Opt-in, per-medication restock alert subscription. Existence of a row
    *is* the subscription — no enabled flag, unsubscribing deletes the row.
    This is the one place a specific medication is tied to a specific
    account server-side; it exists only because push notifications require
    the server to know who to notify for what. consented_at records when the
    user confirmed the in-app disclosure that enabling this links their
    identity to this medication."""
    __tablename__ = "medication_alert_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    medication_name = Column(String, nullable=False)
    strength = Column(String, nullable=False)
    consented_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "medication_name", "strength", name="uq_alert_sub_user_med"),
    )

    user = relationship("User", back_populates="alert_subscriptions")


class TrackedMedication(Base):
    """Anonymous tally of medications tracked locally across all users — no
    user_id, ever. Feeds FDA shortage ingestion so shortage-banner coverage
    isn't limited to users who've enabled restock alerts, without linking
    any medication to an account."""
    __tablename__ = "tracked_medications"

    id = Column(Integer, primary_key=True, index=True)
    medication_name = Column(String, nullable=False, index=True)
    strength = Column(String, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ReportStatsDaily(Base):
    """Anonymous running tally of community reports: one row per UTC day,
    channel and ZIP. No user, no pharmacy, no medication — it can't say who
    reported or what. Feeds area totals ("500 reports in the Albany area") and
    survives any future pruning of old availability_reports rows. Totals are
    reported per named area (metro area or county), not per ZIP.

    channel: "manual" (POST /availability/report), "call" (a contributed
    CallLog) or "backfill" (rows that existed before this table)."""
    __tablename__ = "report_stats_daily"
    __table_args__ = (UniqueConstraint("day", "channel", "zip_code", name="uq_report_stats_bucket"),)

    id = Column(Integer, primary_key=True)
    day = Column(Date, nullable=False, index=True)
    channel = Column(String(16), nullable=False)
    # "" when the report had no ZIP, so the unique constraint still applies.
    zip_code = Column(String(5), nullable=False, server_default="")
    # Named area the ZIP belongs to (areas.py), stored so area totals are a
    # plain sum. "" when the ZIP is missing or unknown.
    area_code = Column(String(8), nullable=False, server_default="", index=True)
    count = Column(Integer, nullable=False, default=0, server_default="0")


class UserBadge(Base):
    """A badge a user has earned. Definitions live in code (gamification.BADGES).
    awarded_on is a date, not a timestamp, so it can't be matched to the exact
    moment of a report."""
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_key", name="uq_user_badge_once"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_key = Column(String(40), nullable=False)
    awarded_on = Column(Date, nullable=False)

    user = relationship("User", back_populates="badges")


class FoundingSlots(Base):
    """How many Founding Contributor badges each ZIP has handed out (cap:
    gamification.FOUNDING_SLOTS_PER_ZIP). A counter per ZIP, nothing about who."""
    __tablename__ = "founding_slots"

    zip_code = Column(String(5), primary_key=True)
    claimed = Column(Integer, nullable=False, default=0, server_default="0")
