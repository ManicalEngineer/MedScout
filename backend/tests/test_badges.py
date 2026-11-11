"""Badges, monthly streaks, per-ZIP founding slots, and GET /users/me/progress."""
from datetime import timedelta

import pytest

import gamification
from conftest import make_pharmacy, register
from database import SessionLocal
from models import FoundingSlots, User, UserBadge
from test_availability import submit_report
from test_gamification import _call, loops_calls, no_throttle  # noqa: F401 (fixtures)
from timeutil import utcnow


def _keys(resp):
    return [b["key"] for b in resp.json()["new_badges"]]


def _badges(email="user@test.com"):
    with SessionLocal() as db:
        u = db.query(User).filter_by(email=email).one()
        return {b.badge_key for b in u.badges}


def _set(email="user@test.com", **fields):
    with SessionLocal() as db:
        u = db.query(User).filter_by(email=email).one()
        for k, v in fields.items():
            setattr(u, k, v)
        db.commit()


def _user(email="user@test.com"):
    with SessionLocal() as db:
        u = db.query(User).filter_by(email=email).one()
        db.expunge(u)
        return u


def _this_month():
    return utcnow().date().replace(day=1)


def _months_ago(n):
    d = _this_month()
    for _ in range(n):
        d = (d - timedelta(days=1)).replace(day=1)
    return d


# --- first report, founding, no double awards ---

def test_first_report_earns_first_report_and_founding(client, auth):
    r = submit_report(client, auth)
    assert r.status_code == 201
    assert _keys(r) == ["founding_contributor", "first_report"]
    assert r.json()["new_badges"][0]["name"] == "Founding Contributor"
    assert r.json()["new_badges"][0]["awarded_on"] == utcnow().date().isoformat()


def test_badges_are_awarded_once(client, auth, no_throttle):
    submit_report(client, auth)
    assert _keys(submit_report(client, auth)) == []
    with SessionLocal() as db:
        assert db.query(UserBadge).count() == 2


def test_founding_slots_run_out_per_zip(client, monkeypatch):
    monkeypatch.setattr(gamification, "FOUNDING_SLOTS_PER_ZIP", 2)
    users = [register(client, f"f{i}@test.com") for i in range(3)]
    got = ["founding_contributor" in _keys(submit_report(client, h, zip_code="12203")) for h in users]
    assert got == [True, True, False]
    other = register(client, "other@test.com")
    assert "founding_contributor" in _keys(submit_report(client, other, zip_code="12866"))
    with SessionLocal() as db:
        assert {s.zip_code: s.claimed for s in db.query(FoundingSlots)} == {"12203": 2, "12866": 1}


def test_one_founding_try_per_user(client, monkeypatch, no_throttle):
    monkeypatch.setattr(gamification, "FOUNDING_SLOTS_PER_ZIP", 1)
    first = register(client, "first@test.com")
    submit_report(client, first, zip_code="12203")
    late = register(client, "late@test.com")
    assert "founding_contributor" not in _keys(submit_report(client, late, zip_code="12203"))
    # A ZIP with free slots later doesn't give the late user a second try.
    assert "founding_contributor" not in _keys(submit_report(client, late, zip_code="90210"))


def test_founding_waits_for_a_report_with_a_zip(client, auth, no_throttle):
    assert "founding_contributor" not in _keys(submit_report(client, auth, zip_code=None))
    assert not _user().founding_checked
    assert _keys(submit_report(client, auth, zip_code="12203")) == ["founding_contributor"]


# --- channel and volume badges ---

def test_made_the_call_from_a_contributed_call(client, auth):
    p = make_pharmacy(client, auth)
    r = _call(client, auth, p["id"], contribute_to_community=True)
    assert r.status_code == 201
    assert "made_the_call" in _keys(r)


def test_manual_report_never_earns_made_the_call(client, auth):
    assert "made_the_call" not in _keys(submit_report(client, auth))


def test_non_contributing_call_returns_no_badges(client, auth):
    p = make_pharmacy(client, auth)
    assert _call(client, auth, p["id"]).json()["new_badges"] == []


def test_patch_toggle_returns_new_badges(client, auth):
    p = make_pharmacy(client, auth)
    call = _call(client, auth, p["id"]).json()
    r = client.patch(f"/api/v1/calls/{call['id']}", headers=auth, json={"contribute_to_community": True})
    assert "made_the_call" in _keys(r)


def test_pup_at_ten_badge_credits(client, auth, no_throttle):
    _set(badge_credits=8)
    assert "pup" not in _keys(submit_report(client, auth))
    assert "pup" in _keys(submit_report(client, auth))


def test_reports_past_the_daily_cap_do_not_earn_volume_badges(client, auth, no_throttle):
    _set(badge_credits=9, contribution_day=utcnow().date(), contributions_today=gamification.DAILY_BADGE_CAP)
    assert "pup" not in _keys(submit_report(client, auth))
    assert _user().badge_credits == 9


# --- monthly streaks ---

def test_streak_starts_at_one(client, auth):
    submit_report(client, auth)
    u = _user()
    assert (u.current_streak_months, u.longest_streak_months, u.last_streak_month) == (1, 1, _this_month())


def test_streak_same_month_does_not_grow(client, auth, no_throttle):
    submit_report(client, auth)
    submit_report(client, auth)
    assert _user().current_streak_months == 1


def test_streak_grows_from_last_month_and_earns_steady_nose(client, auth):
    _set(current_streak_months=2, longest_streak_months=2, last_streak_month=_months_ago(1))
    r = submit_report(client, auth)
    assert "steady_nose_3" in _keys(r)
    assert _user().current_streak_months == 3


def test_streak_resets_after_a_missed_month(client, auth):
    _set(current_streak_months=5, longest_streak_months=5, last_streak_month=_months_ago(2))
    submit_report(client, auth)
    u = _user()
    assert (u.current_streak_months, u.longest_streak_months) == (1, 5)


def test_year_one_needs_a_year_old_account(client, auth):
    _set(created_at=utcnow() - timedelta(days=gamification.YEAR_ONE_ACCOUNT_DAYS - 1))
    assert "year_one" not in _keys(submit_report(client, auth))
    other = register(client, "old@test.com")
    _set("old@test.com", created_at=utcnow() - timedelta(days=gamification.YEAR_ONE_ACCOUNT_DAYS))
    assert "year_one" in _keys(submit_report(client, other))


# --- Loops, progress, deletion, privacy ---

def test_badge_earned_loops_events(client, auth, loops_calls, monkeypatch):
    events = []
    monkeypatch.setattr(gamification, "send_badge_earned_event", lambda email, key: events.append(key))
    submit_report(client, auth)
    assert events == ["founding_contributor", "first_report"]


def test_progress_for_a_new_user(client, auth):
    body = client.get("/api/v1/users/me/progress", headers=auth).json()
    assert body["contribution_count"] == 0
    assert body["streak"] == {"current_months": 0, "longest_months": 0, "reported_this_month": False}
    assert [b["key"] for b in body["badges"]] == [b.key for b in gamification.BADGES]
    assert not any(b["earned"] for b in body["badges"])
    assert body["next_badge"]["key"] == "first_report"
    assert body["next_badge"]["remaining"] == 1


def test_progress_after_reporting(client, auth):
    submit_report(client, auth)
    body = client.get("/api/v1/users/me/progress", headers=auth).json()
    earned = {b["key"]: b["awarded_on"] for b in body["badges"] if b["earned"]}
    assert set(earned) == {"founding_contributor", "first_report"}
    assert body["streak"] == {"current_months": 1, "longest_months": 1, "reported_this_month": True}
    assert body["next_badge"]["key"] == "pup"
    assert body["next_badge"]["remaining"] == 9


def test_progress_streak_survives_until_end_of_next_month_then_shows_zero(client, auth):
    _set(current_streak_months=4, longest_streak_months=4, last_streak_month=_months_ago(1))
    s = client.get("/api/v1/users/me/progress", headers=auth).json()["streak"]
    assert (s["current_months"], s["reported_this_month"]) == (4, False)
    _set(last_streak_month=_months_ago(2))
    s = client.get("/api/v1/users/me/progress", headers=auth).json()["streak"]
    assert (s["current_months"], s["longest_months"]) == (0, 4)


def test_progress_requires_auth(client):
    assert client.get("/api/v1/users/me/progress").status_code in (401, 403)


def test_deleting_the_account_deletes_its_badges(client, auth):
    submit_report(client, auth)
    r = client.request("DELETE", "/api/v1/users/me", headers=auth, json={"password": "password123"})
    assert r.status_code == 204, r.text
    with SessionLocal() as db:
        assert db.query(UserBadge).count() == 0


def test_badge_tables_hold_no_report_link():
    assert set(UserBadge.__table__.columns.keys()) == {"id", "user_id", "badge_key", "awarded_on"}
    assert set(FoundingSlots.__table__.columns.keys()) == {"zip_code", "claimed"}
