"""Seed a fictional demo account for App Store screenshots.

DEV ONLY. Refuses to run unless DATABASE_URL points at a local sqlite file whose
name contains "demo", so it can never touch the dev or production database.

    cd backend
    DATABASE_URL=sqlite:///./demo.db DEMO_PASSWORD='...' .venv/bin/python scripts/seed_demo.py

Pharmacy names are generic and fictional. Coordinates are around Albany, NY.
"""
import os
import sys
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()  # does not override DATABASE_URL already set in the environment
DB_URL = os.getenv("DATABASE_URL", "")
if not (DB_URL.startswith("sqlite:///") and "demo" in DB_URL.lower()):
    sys.exit("Refusing to seed: DATABASE_URL must be a local sqlite file with 'demo' in its name.")
PASSWORD = os.getenv("DEMO_PASSWORD")
if not PASSWORD:
    sys.exit("Set DEMO_PASSWORD (not stored in the repo).")

from database import Base, SessionLocal, engine  # noqa: E402
from models import (  # noqa: E402
    AvailabilityReport, CallLog, CallStatus, MedicationAlertSubscription, Pharmacy,
    RefillCountdown, ReportSource, SubscriptionTier, User,
)
from routers.auth import hash_password  # noqa: E402
from timeutil import utcnow  # noqa: E402

EMAIL = os.getenv("DEMO_EMAIL", "demo.reviewer@example.com")
MED, STRENGTH = "Concerta", "36mg"
MED2, STRENGTH2 = "Strattera", "40mg"

# name, address, zip, lat, lng, phone
PHARMACIES = [
    ("Main St Pharmacy", "112 Main St, Albany, NY", "12207", 42.6512, -73.7525, "(518) 555-0101"),
    ("Lark Street Drug", "240 Lark St, Albany, NY", "12210", 42.6575, -73.7690, "(518) 555-0102"),
    ("Western Ave Pharmacy", "880 Western Ave, Albany, NY", "12203", 42.6838, -73.8081, "(518) 555-0103"),
    ("Delaware Ave Pharmacy", "310 Delaware Ave, Albany, NY", "12209", 42.6375, -73.7745, "(518) 555-0104"),
    ("Central Ave Drug", "1450 Central Ave, Albany, NY", "12205", 42.7125, -73.8362, "(518) 555-0105"),
    ("Madison Ave Pharmacy", "605 Madison Ave, Albany, NY", "12208", 42.6531, -73.7790, "(518) 555-0106"),
    ("Pine Hills Pharmacy", "1010 New Scotland Ave, Albany, NY", "12208", 42.6455, -73.7915, "(518) 555-0107"),
    ("Washington Ave Rx", "1120 Washington Ave, Albany, NY", "12206", 42.6679, -73.7871, "(518) 555-0108"),
]

IS, OOS, CB = CallStatus.in_stock, CallStatus.out_of_stock, CallStatus.check_back

# (pharmacy index, status, hours ago, restock days from today, note) for the user's own calls
CALLS = [
    (0, OOS, 2, None, "Out until the next delivery"),
    (1, IS, 5, None, "Have 30 and 90 count"),
    (2, CB, 27, 7, "Next truck Thursday, call after 10am"),
    (3, OOS, 50, None, None),
    (4, IS, 74, None, "Needs prescriber on file"),
    (5, OOS, 98, None, None),
    (6, CB, 140, 7, "Expecting a shipment Thursday"),
]

# (pharmacy index, status, hours ago) community reports within the last 48h
REPORTS = [
    (0, OOS, 1), (1, IS, 2), (2, IS, 4), (3, OOS, 6), (4, CB, 8), (5, IS, 11),
    (6, OOS, 15), (7, IS, 19), (1, IS, 26), (2, OOS, 31), (7, CB, 40), (3, IS, 44),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == EMAIL).first():
            sys.exit(f"{EMAIL} already exists in this demo DB; delete demo.db to reseed.")
        now = utcnow()
        user = User(
            email=EMAIL,
            hashed_password=hash_password(PASSWORD),
            subscription_tier=SubscriptionTier.contributor,
            last_contribution_at=now - timedelta(hours=2),
            contribution_count=3,
        )
        db.add(user)
        db.flush()

        # A second fictional account that "submitted" the community reports, so
        # report/hide-contributor can be exercised.
        neighbor = User(email="demo.neighbor@example.com", hashed_password=hash_password(PASSWORD),
                        subscription_tier=SubscriptionTier.contributor)
        db.add(neighbor)
        db.flush()

        pharmacies = []
        for i, (name, addr, zc, lat, lng, phone) in enumerate(PHARMACIES):
            p = Pharmacy(user_id=user.id, name=name, address=addr, zip_code=zc,
                         latitude=lat, longitude=lng, phone=phone, sort_order=i)
            db.add(p)
            pharmacies.append(p)
        db.flush()

        for idx, status, hours, restock_days, note in CALLS:
            db.add(CallLog(
                user_id=user.id, pharmacy_id=pharmacies[idx].id, status=status,
                called_at=now - timedelta(hours=hours), created_at=now - timedelta(hours=hours),
                medication_name=MED, strength=STRENGTH, notes=note,
                expected_restock_date=(now + timedelta(days=restock_days)).date() if restock_days else None,
            ))

        # ~6 days left: filled 24 days ago on a 30-day supply
        db.add(RefillCountdown(
            user_id=user.id, medication_name=MED,
            last_fill_date=(now - timedelta(days=24)).date(), days_supply=30, lead_time_days=7,
        ))
        db.add(RefillCountdown(
            user_id=user.id, medication_name=MED2,
            last_fill_date=(now - timedelta(days=12)).date(), days_supply=30, lead_time_days=7,
        ))
        db.add(MedicationAlertSubscription(user_id=user.id, medication_name=MED, strength=STRENGTH))

        for idx, status, hours in REPORTS:
            name, addr, zc, lat, lng, _ = PHARMACIES[idx]
            db.add(AvailabilityReport(
                pharmacy_name=name, pharmacy_address=addr, zip_code=zc, latitude=lat, longitude=lng,
                medication_name=MED, strength=STRENGTH, status=status, source=ReportSource.community,
                reported_at=now - timedelta(hours=hours), contributor_id=neighbor.id,
                expected_restock_date=(now + timedelta(days=7)).date() if status == CB else None,
            ))
        db.commit()
        print(f"Seeded {EMAIL}: {len(PHARMACIES)} pharmacies, {len(CALLS)} calls, {len(REPORTS)} community reports.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
