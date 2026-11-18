"""One-time repair: re-geocode pharmacies that have an address but no location,
copy the location onto their community reports, and move those reports' area
tally out of the no-ZIP bucket.

Background: from (at least) 2026-11-11 to 2026-11-18 the Google key wasn't
allowed to call the Geocoding API, so every manually added pharmacy saved with
null ZIP/latitude/longitude, and so did the reports made from calls to it.

Usage (from backend/, venv active, DATABASE_URL and GOOGLE_PLACES_API_KEY set):
  python scripts/repair_null_locations.py                  # dry run (default): writes nothing
  python scripts/repair_null_locations.py --apply          # one transaction + undo file
  python scripts/repair_null_locations.py --rollback var/repair-<ts>.json

Rules:
  * Only the pharmacy's own address string is geocoded. Never the name; a
    pharmacy with no address is never touched.
  * A result is used only if Google says OK, it is not a partial match and it
    has a ZIP (_geocode_address enforces this). If the address text ends in a
    ZIP, the geocoded ZIP must equal it, or the row is skipped.
  * Reports carry no pharmacy_id, so a report is linked by exact pharmacy name
    and address, and only if it is a community report that still has no location.
  * --apply re-checks every row is still unlocated inside the transaction, so a
    location someone set in the meantime is never overwritten.
  * Nothing is deleted.
"""
import argparse
import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from sqlalchemy import func, or_, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from areas import area_for_zip  # noqa: E402
from database import SessionLocal  # noqa: E402
from gamification import _bump_area_tally, _utc_day, move_area_tally  # noqa: E402
from models import AvailabilityReport, Pharmacy, ReportSource, ReportStatsDaily  # noqa: E402
from routers.pharmacies import _geocode_address  # noqa: E402
from timeutil import utcnow  # noqa: E402

TRAILING_ZIP = re.compile(r"(\d{5})(?:-\d{4})?\s*$")
UNDO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "var")


def _unlocated(model):
    return or_(model.zip_code.is_(None), model.zip_code == "",
               model.latitude.is_(None), model.longitude.is_(None))


def _candidates(db: Session):
    return (
        db.query(Pharmacy)
        .filter(Pharmacy.address.isnot(None), func.trim(Pharmacy.address) != "", _unlocated(Pharmacy))
        .order_by(Pharmacy.id)
        .all()
    )


def _linked_reports(db: Session, p: Pharmacy):
    return (
        db.query(AvailabilityReport)
        .filter(
            AvailabilityReport.source == ReportSource.community,
            AvailabilityReport.pharmacy_name == p.name,
            AvailabilityReport.pharmacy_address == p.address,
            _unlocated(AvailabilityReport),
        )
        .order_by(AvailabilityReport.id)
        .all()
    )


def _loc(obj) -> dict:
    return {"zip_code": obj.zip_code, "latitude": obj.latitude, "longitude": obj.longitude}


def build_plan(db: Session, geocode=_geocode_address) -> list[dict]:
    """One entry per candidate pharmacy: what would change and why. Reads only."""
    plan = []
    seen_reports: set[int] = set()
    for p in _candidates(db):
        entry = {"pharmacy_id": p.id, "name": p.name, "address": p.address,
                 "before": _loc(p), "after": None, "area": None, "action": "skip",
                 "reason": None, "reports": []}
        g = geocode(p.address)
        if not g:
            entry["reason"] = "geocode failed (see log line for Google status)"
        else:
            m = TRAILING_ZIP.search(p.address.strip())
            if m and m.group(1) != g["zip_code"]:
                entry["reason"] = f"ZIP mismatch: address says {m.group(1)}, Google says {g['zip_code']}"
            else:
                area = area_for_zip(g["zip_code"])
                entry.update(action="update", after=g, area=(area.code, area.name) if area else None)
        for r in _linked_reports(db, p):
            if r.id in seen_reports:
                continue  # same name+address as an earlier pharmacy: same address string, same result
            seen_reports.add(r.id)
            entry["reports"].append({
                "report_id": r.id, "reported_at": r.reported_at.isoformat() if r.reported_at else None,
                "hidden": r.hidden_at is not None, "before": _loc(r),
            })
        plan.append(entry)
    return plan


def print_plan(plan: list[dict]) -> None:
    for e in plan:
        print(f"pharmacy {e['pharmacy_id']}: {e['name']!r} | {e['address']!r}")
        b = e["before"]
        print(f"  before: zip={b['zip_code']} lat={b['latitude']} lng={b['longitude']}")
        if e["action"] == "update":
            a = e["after"]
            area = f"{e['area'][0]} {e['area'][1]}" if e["area"] else "(no named area)"
            print(f"  after:  zip={a['zip_code']} lat={a['latitude']} lng={a['longitude']} area={area}")
        else:
            print(f"  SKIP: {e['reason']}")
        for r in e["reports"]:
            move = "tally: '' -> " + e["after"]["zip_code"] if e["action"] == "update" and not r["hidden"] else "tally: unchanged"
            print(f"    report {r['report_id']} ({r['reported_at']}){' [hidden]' if r['hidden'] else ''}: "
                  f"{'gets same location' if e['action'] == 'update' else 'unchanged'}; {move}")
    n_up = sum(e["action"] == "update" for e in plan)
    n_rep = sum(len(e["reports"]) for e in plan if e["action"] == "update")
    print(f"\n{len(plan)} candidate pharmacies: {n_up} to update, {len(plan) - n_up} skipped; "
          f"{n_rep} linked reports to update.")


def _tally_snapshot(db: Session) -> list[tuple]:
    return [(str(r.day), r.channel, r.zip_code, r.area_code, r.count)
            for r in db.query(ReportStatsDaily).filter(
                or_(ReportStatsDaily.zip_code == "", ReportStatsDaily.area_code == "")
            ).order_by(ReportStatsDaily.day, ReportStatsDaily.channel)]


def apply_plan(db: Session, plan: list[dict]) -> dict:
    """Write the plan in the caller's transaction. Returns the undo record.
    Does not commit."""
    undo = {"applied_at": utcnow().isoformat(), "pharmacies": [], "reports": [], "tally": []}
    for e in plan:
        if e["action"] != "update":
            continue
        p = db.query(Pharmacy).filter(Pharmacy.id == e["pharmacy_id"]).with_for_update().first()
        if not p or _loc(p) != e["before"] or p.address != e["address"]:
            print(f"pharmacy {e['pharmacy_id']}: changed since the plan was built, left alone")
            continue
        a = e["after"]
        p.zip_code, p.latitude, p.longitude = a["zip_code"], a["latitude"], a["longitude"]
        undo["pharmacies"].append({"id": p.id, "before": e["before"], "after": a})
        for rr in e["reports"]:
            r = db.query(AvailabilityReport).filter(AvailabilityReport.id == rr["report_id"]).with_for_update().first()
            if not r or _loc(r) != rr["before"]:
                print(f"report {rr['report_id']}: changed since the plan was built, left alone")
                continue
            r.zip_code, r.latitude, r.longitude = a["zip_code"], a["latitude"], a["longitude"]
            undo["reports"].append({"id": r.id, "before": rr["before"], "after": a})
            channel = move_area_tally(db, r, a["zip_code"])
            if channel:
                undo["tally"].append({"day": _utc_day(r.reported_at).isoformat(),
                                      "channel": channel, "to_zip": a["zip_code"]})
    db.flush()
    return undo


def rollback(db: Session, undo: dict) -> None:
    """Undo an --apply. Restores only rows still holding the values the repair
    wrote; anything edited since is reported and left alone. Does not commit."""
    for model, key in ((Pharmacy, "pharmacies"), (AvailabilityReport, "reports")):
        for u in undo[key]:
            row = db.query(model).filter(model.id == u["id"]).with_for_update().first()
            if not row or _loc(row) != u["after"]:
                print(f"{key[:-1]} {u['id']}: changed since the repair, left alone")
                continue
            b = u["before"]
            row.zip_code, row.latitude, row.longitude = b["zip_code"], b["latitude"], b["longitude"]
    for t in undo["tally"]:
        day = date.fromisoformat(t["day"])
        row = db.query(ReportStatsDaily).filter(
            ReportStatsDaily.day == day, ReportStatsDaily.channel == t["channel"],
            ReportStatsDaily.zip_code == t["to_zip"], ReportStatsDaily.count > 0,
        ).with_for_update().first()
        if not row:
            print(f"tally {t}: target bucket empty, left alone")
            continue
        row.count -= 1
        db.flush()
        _bump_area_tally(db, day, t["channel"], "", 1)
    db.flush()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="write the changes (one transaction)")
    mode.add_argument("--rollback", metavar="UNDO_JSON", help="undo a previous --apply")
    args = ap.parse_args(argv)

    with SessionLocal() as db:
        if args.rollback:
            with open(args.rollback) as f:
                undo = json.load(f)
            print("tally before:", _tally_snapshot(db))
            rollback(db, undo)
            db.commit()
            print("tally after: ", _tally_snapshot(db))
            print("rolled back.")
            return 0

        if not args.apply and db.bind.dialect.name == "postgresql":
            db.execute(text("SET TRANSACTION READ ONLY"))
        plan = build_plan(db)
        print_plan(plan)
        print("\nno-ZIP / no-area tally buckets now:", _tally_snapshot(db))
        if not args.apply:
            print("\nDRY RUN: nothing written. Re-run with --apply to write.")
            db.rollback()
            return 0

        undo = apply_plan(db, plan)
        print("no-ZIP / no-area tally buckets after (uncommitted):", _tally_snapshot(db))
        db.commit()
        os.makedirs(UNDO_DIR, exist_ok=True)
        path = os.path.join(UNDO_DIR, f"repair-{utcnow().strftime('%Y%m%dT%H%M%SZ')}.json")
        try:
            with open(path, "w") as f:
                json.dump(undo, f, indent=2)
            print(f"\nAPPLIED. Undo file: {path}")
        except OSError as e:
            print(f"\nAPPLIED, but the undo file couldn't be written ({e}). Save this:\n{json.dumps(undo)}")
        print("Map/heatmap caches in the running API expire on their own short TTL.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
