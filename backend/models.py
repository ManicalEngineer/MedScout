import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float, Text, Enum, ForeignKey, Date
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
    caregiver_mode = Column(Boolean, default=False)
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.free)
    last_contribution_at = Column(DateTime(timezone=True), nullable=True)
    push_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    medication_profiles = relationship("MedicationProfile", back_populates="user", cascade="all, delete-orphan")
    pharmacies = relationship("Pharmacy", back_populates="user", cascade="all, delete-orphan")
    call_logs = relationship("CallLog", back_populates="user", cascade="all, delete-orphan")
    refill_countdowns = relationship("RefillCountdown", back_populates="user", cascade="all, delete-orphan")
    alert_settings = relationship("AlertSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class MedicationProfile(Base):
    """User's medication details — auto-fills scripts and reports."""
    __tablename__ = "medication_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    medication_name = Column(String, nullable=False)   # e.g. "Adderall XR"
    strength = Column(String, nullable=False)           # e.g. "20mg"
    formulation = Column(String, nullable=True)         # e.g. "tablet", "capsule"
    is_child_profile = Column(Boolean, default=False)
    child_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="medication_profiles")
    refill_countdown = relationship("RefillCountdown", back_populates="medication_profile", uselist=False)


class Pharmacy(Base):
    """A pharmacy in the user's dialer list."""
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="call_logs")
    pharmacy = relationship("Pharmacy", back_populates="call_logs")


class RefillCountdown(Base):
    """Per-medication-profile refill countdown. Caregivers get one per child profile."""
    __tablename__ = "refill_countdowns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    medication_profile_id = Column(Integer, ForeignKey("medication_profiles.id"), unique=True, nullable=False)
    last_fill_date = Column(Date, nullable=True)
    days_supply = Column(Integer, default=30)
    lead_time_days = Column(Integer, default=7)
    push_notifications_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="refill_countdowns")
    medication_profile = relationship("MedicationProfile", back_populates="refill_countdown")


class AvailabilityReport(Base):
    """Crowdsourced stock report — the data behind the map."""
    __tablename__ = "availability_reports"

    id = Column(Integer, primary_key=True, index=True)
    pharmacy_name = Column(String, nullable=False)
    pharmacy_address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    zip_code = Column(String, nullable=True, index=True)
    medication_name = Column(String, nullable=False)
    strength = Column(String, nullable=False)
    status = Column(Enum(CallStatus), nullable=False)
    source = Column(Enum(ReportSource), default=ReportSource.community)
    reported_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class AlertSettings(Base):
    """Per-user push notification preferences."""
    __tablename__ = "alert_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    enabled = Column(Boolean, default=True)
    radius_miles = Column(Integer, default=10)
    quiet_hours_start = Column(Integer, default=22)  # hour in 24h, e.g. 22 = 10pm
    quiet_hours_end = Column(Integer, default=8)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="alert_settings")
