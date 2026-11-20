"""scripts/repair_null_locations.py: dry run, apply, skips, rollback."""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))

import repair_null_locations as repair  # noqa: E402
from database import SessionLocal  # noqa: E402
from models import (  # noqa: E402
    AvailabilityReport, CallStatus, Pharmacy, ReportSource, ReportStatsDaily, User,
)

DAY = datetime(2026, 11, 18, 12, 31, tzinfo=timezone.utc)
GEO = {
    "1585 Central Ave, Summerville, SC 29483": {"latitude": 33.02, "longitude": -80.17, "zip_code": "29483"},
    "600 N. US Highway 45, Libertyville, Illinois": {"latitude": 42.29, "longitude": -87.95, "zip_code": "60048"},
    "1 Wrong Zip St, Albany, NY 12207": {"latitude": 1.0, "longitude": 2.0, "zip_code": "99999"},
}


def fake_geocode(address):
    return GEO.get(address)


def _seed():
    with SessionLocal() as db:
        u = User(email="r@test.com", hashed_password="x")
        db.add(u)
        db.flush()

        def ph(name, address, **kw):
            p = Pharmacy(user_id=u.id, name=name, phone="5551234567", address=address, **kw)
            db.add(p)
            return p

        ph("Publix", "1585 Central Ave, Summerville, SC 29483")
        ph("Advocate RX", "600 N. US Highway 45, Libertyville, Illinois")
        ph("Mismatch", "1 Wrong Zip St, Albany, NY 12207")
        ph("Undeliverable", "nowhere at all")
        ph("Nameonly", None)
        ph("Located", "2 Main St", zip_code="90210", latitude=34.0, longitude=-118.0)
        db.add(AvailabilityReport(
            pharmacy_name="Publix", pharmacy_address="1585 Central Ave, Summerville, SC 29483",
            medication_name="Adderall XR", strength="20mg", status=CallStatus.out_of_stock,
            source=ReportSource.community, reported_at=DAY,
        ))
        # same name, different address: must not be touched
        db.add(AvailabilityReport(
            pharmacy_name="Publix", pharmacy_address="elsewhere",
            medication_name="Adderall XR", strength="20mg", status=CallStatus.out_of_stock,
            source=ReportSource.community, reported_at=DAY,
        ))
        db.add(ReportStatsDaily(day=DAY.date(), channel="call", zip_code="", area_code="", count=2))
        db.commit()


def _state():
    with SessionLocal() as db:
        ph = {p.name: (p.zip_code, p.latitude, p.longitude) for p in db.query(Pharmacy)}
        reps = {(r.pharmacy_address): (r.zip_code, r.latitude) for r in db.query(AvailabilityReport)}
        tally = sorted((r.channel, r.zip_code, r.area_code, r.count) for r in db.query(ReportStatsDaily))
    return ph, reps, tally


def test_dry_run_writes_nothing():
    _seed()
    before = _state()
    with SessionLocal() as db:
        plan = repair.build_plan(db, geocode=fake_geocode)
        db.rollback()
    assert _state() == before
    by_name = {e["name"]: e for e in plan}
    assert set(by_name) == {"Publix", "Advocate RX", "Mismatch", "Undeliverable"}  # no-address and located excluded
    assert by_name["Publix"]["action"] == "update"
    assert [r["report_id"] for r in by_name["Publix"]["reports"]] == [1]
    assert by_name["Publix"]["area"][0] == "m16700"
    assert by_name["Mismatch"]["action"] == "skip" and "ZIP mismatch" in by_name["Mismatch"]["reason"]
    assert by_name["Undeliverable"]["action"] == "skip"


def test_apply_and_rollback():
    _seed()
    before = _state()
    with SessionLocal() as db:
        plan = repair.build_plan(db, geocode=fake_geocode)
        undo = repair.apply_plan(db, plan)
        db.commit()

    ph, reps, tally = _state()
    assert ph["Publix"] == ("29483", 33.02, -80.17)
    assert ph["Advocate RX"] == ("60048", 42.29, -87.95)
    assert ph["Mismatch"] == (None, None, None)
    assert ph["Nameonly"] == (None, None, None)
    assert ph["Located"] == ("90210", 34.0, -118.0)
    assert reps["1585 Central Ave, Summerville, SC 29483"] == ("29483", 33.02)
    assert reps["elsewhere"] == (None, None)
    assert tally == [("call", "", "", 1), ("call", "29483", "m16700", 1)]
    assert len(undo["pharmacies"]) == 2 and len(undo["reports"]) == 1
    assert undo["tally"] == [{"day": "2026-11-18", "channel": "call", "to_zip": "29483"}]

    # running again finds nothing new to do for the repaired rows
    with SessionLocal() as db:
        names = {e["name"] for e in repair.build_plan(db, geocode=fake_geocode)}
    assert "Publix" not in names and "Advocate RX" not in names

    with SessionLocal() as db:
        repair.rollback(db, undo)
        db.commit()
    ph, reps, tally = _state()
    assert (ph, reps) == before[:2]
    assert [t for t in tally if t[3]] == [("call", "", "", 2)]


def test_apply_leaves_rows_edited_after_the_plan():
    _seed()
    with SessionLocal() as db:
        plan = repair.build_plan(db, geocode=fake_geocode)
    with SessionLocal() as db:
        p = db.query(Pharmacy).filter(Pharmacy.name == "Publix").one()
        p.zip_code, p.latitude, p.longitude = "29485", 33.0, -80.0
        db.commit()
    with SessionLocal() as db:
        repair.apply_plan(db, plan)
        db.commit()
    ph, reps, _ = _state()
    assert ph["Publix"] == ("29485", 33.0, -80.0)
    assert reps["1585 Central Ave, Summerville, SC 29483"] == (None, None)
