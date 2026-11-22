"""GET /admin/zip-breakdown: key-gated, raw per-ZIP signups and reports."""
from datetime import timedelta

from database import SessionLocal
from models import (
    AvailabilityReport, CallLog, CallStatus, Pharmacy, ReportSource, ReportStatsDaily, User,
)
from timeutil import utcnow

URL = "/api/v1/admin/zip-breakdown"
KEY = {"X-Admin-Key": "s3cret"}


def _report(zip_code, status, when, source=ReportSource.community):
    return AvailabilityReport(
        pharmacy_name="P", zip_code=zip_code, medication_name="Adderall", strength="10mg",
        status=status, source=source, reported_at=when,
    )


def _seed():
    now = utcnow()
    today = now.date()
    with SessionLocal() as db:
        # u1: calls the 12207 pharmacy most -> 12207, most_called_pharmacy.
        u1 = User(email="secret-one@test.com")
        # u2: saved pharmacies but no calls -> vaulted one wins -> 10027, saved_pharmacy.
        u2 = User(email="secret-two@test.com")
        # u3: no pharmacy -> no_zip. u4: chosen pharmacy has no ZIP -> no_zip.
        u3 = User(email="secret-three@test.com")
        u4 = User(email="secret-four@test.com", created_at=now - timedelta(days=60))
        db.add_all([u1, u2, u3, u4])
        db.flush()
        p1a = Pharmacy(user_id=u1.id, name="A", phone="1", zip_code="12207")
        p1b = Pharmacy(user_id=u1.id, name="B", phone="2", zip_code="10027", is_vaulted=True)
        p2a = Pharmacy(user_id=u2.id, name="C", phone="3", zip_code="29483", sort_order=0)
        p2b = Pharmacy(user_id=u2.id, name="D", phone="4", zip_code="10027", is_vaulted=True, sort_order=5)
        p4 = Pharmacy(user_id=u4.id, name="E", phone="5", zip_code=None)
        db.add_all([p1a, p1b, p2a, p2b, p4])
        db.flush()
        db.add_all([
            CallLog(user_id=u1.id, pharmacy_id=p1a.id),
            CallLog(user_id=u1.id, pharmacy_id=p1a.id),
            CallLog(user_id=u1.id, pharmacy_id=p1b.id),
        ])
        db.add_all([
            ReportStatsDaily(day=today, channel="call", zip_code="12207", area_code="m10580", count=2),
            ReportStatsDaily(day=today, channel="manual", zip_code="12207", area_code="m10580", count=1),
            ReportStatsDaily(day=today - timedelta(days=40), channel="backfill", zip_code="12207",
                             area_code="m10580", count=4),
            ReportStatsDaily(day=today, channel="call", zip_code="", area_code="", count=1),
        ])
        db.add_all([
            _report("12207", CallStatus.in_stock, now - timedelta(hours=1)),
            _report("12207", CallStatus.out_of_stock, now - timedelta(hours=2)),
            _report("12207", CallStatus.check_back, now - timedelta(hours=3)),
            _report("12207", CallStatus.in_stock, now - timedelta(days=40)),
            _report(None, CallStatus.unknown, now - timedelta(hours=5)),
            # Seeded shortage data is not a community report.
            _report("12207", CallStatus.in_stock, now, source=ReportSource.fda),
        ])
        db.commit()


def test_requires_admin_key(client, auth, monkeypatch):
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    assert client.get(URL, headers=KEY).status_code == 404
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    assert client.get(URL).status_code == 401
    assert client.get(URL, headers=auth).status_code == 401
    assert client.get(URL + "?days=0", headers=KEY).status_code == 422


def test_all_time_breakdown(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    _seed()
    r = client.get(URL, headers=KEY)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["days"] is None and d["since"] is None

    by_zip = {z["zip_code"]: z for z in d["zips"]}
    assert set(by_zip) == {"12207", "10027"}

    alb = by_zip["12207"]
    assert alb["area_name"] == "Albany-Schenectady-Troy, NY"
    assert alb["signups"] == 1
    assert alb["signups_basis"] == {"most_called_pharmacy": 1, "saved_pharmacy": 0}
    # No small-number suppression: a raw 1 comes back as 1.
    assert alb["reports_total"] == 7
    assert alb["reports_by_channel"] == {"call": 2, "community": 1, "backfill": 4}
    assert (alb["reports_in_stock"], alb["reports_out_of_stock"],
            alb["reports_check_back"], alb["reports_unknown"]) == (2, 1, 1, 0)
    assert alb["last_report_at"] is not None

    nyc = by_zip["10027"]
    assert nyc["area_name"] == "New York-Newark-Jersey City, NY-NJ"
    assert nyc["signups"] == 1
    assert nyc["signups_basis"] == {"most_called_pharmacy": 0, "saved_pharmacy": 1}
    assert nyc["reports_total"] == 0 and nyc["last_report_at"] is None

    nz = d["no_zip"]
    assert "zip_code" not in nz
    assert nz["signups"] == 2  # u3 (no pharmacy) + u4 (pharmacy without ZIP)
    assert nz["signups_basis"] == {"most_called_pharmacy": 0, "saved_pharmacy": 1, "no_pharmacy": 1}
    assert nz["reports_total"] == 1 and nz["reports_by_channel"]["call"] == 1
    assert nz["reports_unknown"] == 1

    s = d["summary"]
    assert s["signups"] == 4
    assert s["reports_total"] == 8
    assert s["reports_by_channel"] == {"call": 3, "community": 1, "backfill": 4}
    assert (s["reports_in_stock"], s["reports_out_of_stock"],
            s["reports_check_back"], s["reports_unknown"]) == (2, 1, 1, 1)
    assert s["zip_count"] == 2
    assert s["last_report_at"] == alb["last_report_at"]

    # Never any user identifiers.
    assert "secret-" not in r.text and "@test.com" not in r.text
    for z in d["zips"] + [d["no_zip"], d["summary"]]:
        assert not {"id", "user_id", "user_ids", "email", "name", "nickname"} & set(z)


def test_days_window(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    _seed()
    d = client.get(URL + "?days=30", headers=KEY).json()
    assert d["days"] == 30
    alb = {z["zip_code"]: z for z in d["zips"]}["12207"]
    assert alb["reports_total"] == 3  # 40-day-old backfill bucket excluded
    assert alb["reports_by_channel"]["backfill"] == 0
    assert alb["reports_in_stock"] == 1  # 40-day-old report excluded
    # u4 signed up 60 days ago, so it drops out of the window.
    assert d["summary"]["signups"] == 3
    assert d["no_zip"]["signups_basis"] == {"most_called_pharmacy": 0, "saved_pharmacy": 0, "no_pharmacy": 1}
