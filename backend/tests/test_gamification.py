"""record_contribution(): per-user counters, badge credits and their daily cap,
the anonymous area tally, ZIP → named area, and GET /availability/area-stats."""
from datetime import timedelta

import pytest

import gamification
from areas import Area, area_for_zip
from conftest import make_pharmacy, register
from database import SessionLocal
from models import ReportStatsDaily, User
from test_availability import submit_report
from timeutil import utcnow


@pytest.fixture
def no_throttle(monkeypatch):
    import routers.availability as av
    monkeypatch.setattr(av, "REPORT_MIN_INTERVAL_SECONDS", 0)


@pytest.fixture
def loops_calls(monkeypatch):
    calls = []
    monkeypatch.setattr(gamification, "send_first_report_event", lambda email: calls.append(("first", email)))
    monkeypatch.setattr(
        gamification, "send_contributor_milestone_event",
        lambda email, n: calls.append(("milestone", email, n)),
    )
    return calls


def _user(email="user@test.com"):
    with SessionLocal() as db:
        u = db.query(User).filter_by(email=email).one()
        db.expunge(u)
        return u


def _tally():
    with SessionLocal() as db:
        return {(r.channel, r.zip_code): r.count for r in db.query(ReportStatsDaily).all()}


def _call(client, headers, pharmacy_id, **extra):
    body = {"pharmacy_id": pharmacy_id, "status": "in_stock",
            "medication_name": "Adderall XR", "strength": "20mg"}
    body.update(extra)
    return client.post("/api/v1/calls/", headers=headers, json=body)


def test_manual_report_counts_once_and_tallies_area(client, auth):
    assert submit_report(client, auth).status_code == 201
    u = _user()
    assert u.contribution_count == 1
    assert u.badge_credits == 1
    assert u.contributions_today == 1
    assert u.last_contribution_at is not None
    assert _tally() == {("manual", "90210"): 1}


def test_report_without_zip_tallies_under_blank_zip(client, auth):
    submit_report(client, auth, zip_code=None)
    assert _tally() == {("manual", ""): 1}


def test_contributed_call_tallies_under_call_channel(client, auth):
    p = make_pharmacy(client, auth, zip_code="12203")
    assert _call(client, auth, p["id"], contribute_to_community=True).status_code == 201
    assert _user().contribution_count == 1
    assert _tally() == {("call", "12203"): 1}


def test_non_contributing_paths_count_nothing(client, auth):
    p = make_pharmacy(client, auth)
    vault = make_pharmacy(client, auth, name="Vault")
    client.post(f"/api/v1/pharmacies/{vault['id']}/vault", headers=auth)
    _call(client, auth, p["id"])  # not opted in
    _call(client, auth, p["id"], contribute_to_community=True, medication_name=None)
    _call(client, auth, vault["id"], contribute_to_community=True)
    assert _user().contribution_count == 0
    assert _tally() == {}


def test_patch_toggle_counts_once(client, auth):
    p = make_pharmacy(client, auth)
    call = _call(client, auth, p["id"]).json()
    for _ in range(2):
        r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth, json={"contribute_to_community": True})
        assert r.status_code == 200
    assert _user().contribution_count == 1
    assert _tally() == {("call", "90210"): 1}


def test_daily_cap_limits_badge_credits_only(client, auth, no_throttle):
    cap = gamification.DAILY_BADGE_CAP
    for _ in range(cap + 2):
        assert submit_report(client, auth).status_code == 201
    u = _user()
    assert u.badge_credits == cap
    assert u.contribution_count == cap + 2
    assert u.contributions_today == cap + 2
    assert _tally() == {("manual", "90210"): cap + 2}


def test_daily_cap_resets_next_day(client, auth, no_throttle):
    for _ in range(gamification.DAILY_BADGE_CAP + 1):
        submit_report(client, auth)
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="user@test.com").one()
        u.contribution_day = u.contribution_day - timedelta(days=1)
        db.commit()
    submit_report(client, auth)
    u = _user()
    assert u.badge_credits == gamification.DAILY_BADGE_CAP + 1
    assert u.contribution_count == gamification.DAILY_BADGE_CAP + 2
    assert u.contributions_today == 1


def test_rolled_back_transaction_changes_nothing(client, auth):
    from models import AvailabilityReport, ReportSource, CallStatus
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="user@test.com").one()
        report = AvailabilityReport(pharmacy_name="X", zip_code="90210", medication_name="m",
                                    strength="s", status=CallStatus.in_stock, source=ReportSource.community)
        db.add(report)
        gamification.record_contribution(db, u, report, gamification.CHANNEL_MANUAL)
        db.rollback()
    assert _user().contribution_count == 0
    assert _user().badge_credits == 0
    assert _tally() == {}


def test_loops_events_first_and_milestone_only(client, auth, no_throttle, loops_calls, monkeypatch):
    monkeypatch.setattr(gamification, "CONTRIBUTOR_MILESTONE_THRESHOLD", 2)
    for _ in range(3):
        submit_report(client, auth)
    assert loops_calls == [("first", "user@test.com"), ("milestone", "user@test.com", 2)]


def test_milestone_counts_reports_past_the_badge_cap(client, auth, no_throttle, loops_calls, monkeypatch):
    cap = gamification.DAILY_BADGE_CAP
    monkeypatch.setattr(gamification, "CONTRIBUTOR_MILESTONE_THRESHOLD", cap + 2)
    for _ in range(cap + 3):
        submit_report(client, auth)
    assert [c for c in loops_calls if c[0] == "milestone"] == [("milestone", "user@test.com", cap + 2)]


def test_hidden_report_leaves_area_tally(client, auth, auth2):
    rid = submit_report(client, auth2).json()["id"]
    others = [auth, register(client, "u3@test.com"), register(client, "u4@test.com")]
    for h in others:
        submit_report(client, h, zip_code="10001")
    assert _tally()[("manual", "90210")] == 1
    for h in others:
        client.post(f"/api/v1/availability/reports/{rid}/flag", headers=h, json={"reason": "spam"})
    assert _tally()[("manual", "90210")] == 0
    assert _tally()[("manual", "10001")] == 3


def _seed(zip_code, count, days_ago=0, channel="manual"):
    area = area_for_zip(zip_code)
    with SessionLocal() as db:
        db.add(ReportStatsDaily(day=utcnow().date() - timedelta(days=days_ago), channel=channel,
                                zip_code=zip_code, area_code=area.code if area else "", count=count))
        db.commit()


def test_zip_to_named_area():
    albany = area_for_zip("12203")
    assert albany == Area("m10580", "Albany-Schenectady-Troy, NY")
    assert area_for_zip("12866") == albany          # Saratoga Springs: same metro, other prefix
    assert area_for_zip("12201") == albany          # PO-box ZIP: falls back on its 122 prefix
    assert area_for_zip("12932") == Area("c36031", "Essex County, NY")  # outside any metro
    assert area_for_zip("06902").name == "Bridgeport-Stamford-Danbury, CT"  # legacy CT county
    assert area_for_zip("00000") is None
    assert area_for_zip(None) is None and area_for_zip("1220") is None


def test_report_is_tallied_under_its_metro(client, auth):
    submit_report(client, auth, zip_code="12866")
    with SessionLocal() as db:
        assert [(r.zip_code, r.area_code) for r in db.query(ReportStatsDaily)] == [("12866", "m10580")]


def test_area_stats_sums_the_metro_and_windows(client, auth):
    _seed("12203", 300)
    _seed("12866", 150, channel="call")    # Saratoga Springs, same metro
    _seed("12210", 50, days_ago=45)        # same metro, outside 30 days
    _seed("12932", 999)                    # Essex County: not in the metro
    r = client.get("/api/v1/availability/area-stats?zip_code=12208", headers=auth)
    assert r.status_code == 200
    assert r.json() == {
        "area_code": "m10580",
        "area_name": "Albany-Schenectady-Troy, NY",
        "last_30_days": {"count": 450, "fewer_than": None},
        "all_time": {"count": 500, "fewer_than": None},
    }
    essex = client.get("/api/v1/availability/area-stats?zip_code=12932", headers=auth).json()
    assert essex["area_name"] == "Essex County, NY"
    assert essex["all_time"]["count"] == 999


def test_area_stats_hides_small_counts(client, auth):
    _seed("90210", gamification.AREA_MIN_REPORTED - 1)
    body = client.get("/api/v1/availability/area-stats?zip_code=90210", headers=auth).json()
    assert body["area_name"] == "Los Angeles-Long Beach-Anaheim, CA"
    assert body["all_time"] == {"count": None, "fewer_than": gamification.AREA_MIN_REPORTED}


def test_area_stats_unknown_zip(client, auth):
    body = client.get("/api/v1/availability/area-stats?zip_code=00000", headers=auth).json()
    assert body == {"area_code": None, "area_name": None, "last_30_days": None, "all_time": None}


def test_area_stats_validates_and_requires_auth(client, auth):
    assert client.get("/api/v1/availability/area-stats?zip_code=122", headers=auth).status_code == 422
    assert client.get("/api/v1/availability/area-stats?zip_code=12203").status_code in (401, 403)


def test_area_tally_holds_no_identity():
    cols = set(ReportStatsDaily.__table__.columns.keys())
    assert cols == {"id", "day", "channel", "zip_code", "area_code", "count"}
