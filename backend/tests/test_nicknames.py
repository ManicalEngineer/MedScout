"""Optional nicknames, the gamification on/off toggle, and Quiet Hero."""
import pytest

import gamification
import nicknames
from conftest import register
from test_availability import submit_report
from test_badges import _badges, _keys, _set
from test_gamification import no_throttle  # noqa: F401 (fixture)


def _put(client, headers, name):
    return client.put("/api/v1/users/me/nickname", headers=headers, json={"nickname": name})


# --- validation and generator ---

@pytest.mark.parametrize("raw,clean", [
    ("Brave Beagle", "Brave Beagle"),
    ("  Brave   Beagle ", "Brave Beagle"),
    ("rx_runner-7", "rx_runner-7"),
    ("Abc", "Abc"),
    ("A" * 20, "A" * 20),
])
def test_valid_nicknames(raw, clean):
    assert nicknames.validate(raw) == clean


@pytest.mark.parametrize("raw", [
    "ab", "A" * 21, "-dash", "dash-", "a--b", "me@example.com", "Call 5551234567",
    "Brave 12345", "MedScout Team", "the_admin", "Med-Scout", "F u c k", "emoji 🐶",
])
def test_invalid_nicknames(raw):
    with pytest.raises(nicknames.NicknameError):
        nicknames.validate(raw)


def test_suggestions_are_valid_distinct_and_avoid_taken():
    names = nicknames.suggestions(count=5)
    assert len(names) == len(set(names)) == 5
    assert all(nicknames.validate(n) == n for n in names)
    every_plain = [f"{a} {b}" for a in nicknames.ADJECTIVES for b in nicknames.ANIMALS]
    numbered = nicknames.suggestions(taken=every_plain, count=3)
    assert len(numbered) == 3 and all(n.rsplit(" ", 1)[1].isdigit() for n in numbered)


# --- endpoints ---

def test_set_show_and_clear_nickname(client, auth):
    assert _put(client, auth, "  Brave  Beagle ").json() == {"nickname": "Brave Beagle"}
    me = client.get("/api/v1/users/me", headers=auth).json()
    assert me["nickname"] == "Brave Beagle"
    assert me["gamification_enabled"] is True
    assert _put(client, auth, None).json() == {"nickname": None}
    assert client.get("/api/v1/users/me", headers=auth).json()["nickname"] is None


def test_nickname_unique_ignoring_case(client, auth, auth2):
    _put(client, auth, "Brave Beagle")
    r = _put(client, auth2, "brave beagle")
    assert r.status_code == 409
    assert _put(client, auth, "BRAVE BEAGLE").status_code == 200  # renaming your own is fine
    _put(client, auth, None)
    assert _put(client, auth2, "brave beagle").status_code == 200


def test_invalid_nickname_is_422_with_message(client, auth):
    r = _put(client, auth, "me@example.com")
    assert r.status_code == 422
    assert "letters" in r.json()["detail"]


def test_suggestions_endpoint_skips_taken_names(client, auth, auth2, monkeypatch):
    _put(client, auth2, "Calm Otter")
    monkeypatch.setattr(nicknames, "suggestions", lambda count: ["Calm Otter", "Swift Fox", "Kind Owl"])
    r = client.get("/api/v1/users/me/nickname/suggestions", headers=auth)
    assert r.json() == {"suggestions": ["Swift Fox", "Kind Owl"]}


def test_nickname_endpoints_require_auth(client):
    assert client.put("/api/v1/users/me/nickname", json={"nickname": "Abc"}).status_code in (401, 403)
    assert client.get("/api/v1/users/me/nickname/suggestions").status_code in (401, 403)


def test_nickname_never_appears_on_a_report(client, auth):
    _put(client, auth, "Brave Beagle")
    r = submit_report(client, auth)
    assert "Brave Beagle" not in r.text
    assert "Brave Beagle" not in client.get("/api/v1/availability/map", headers=auth).text


# --- gamification toggle ---

def test_hidden_badges_are_still_awarded_but_not_shown_or_emailed(client, auth, monkeypatch):
    events = []
    monkeypatch.setattr(gamification, "send_badge_earned_event", lambda email, key: events.append(key))
    r = client.patch("/api/v1/users/me", headers=auth, json={"gamification_enabled": False})
    assert r.json()["gamification_enabled"] is False
    assert _keys(submit_report(client, auth)) == []
    assert events == []
    assert _badges() == {"founding_contributor", "first_report"}
    progress = client.get("/api/v1/users/me/progress", headers=auth).json()
    assert progress["gamification_enabled"] is False
    assert progress["contribution_count"] == 1


# --- Quiet Hero ---

def test_quiet_hero_for_anonymous_reporters(client, auth):
    _set(badge_credits=gamification.QUIET_HERO_CREDITS - 1)
    assert "quiet_hero" in _keys(submit_report(client, auth))


def test_no_quiet_hero_with_a_nickname(client, auth):
    _put(client, auth, "Brave Beagle")
    _set(badge_credits=gamification.QUIET_HERO_CREDITS - 1)
    assert "quiet_hero" not in _keys(submit_report(client, auth))


def test_quiet_hero_kept_after_setting_a_nickname(client, auth):
    _set(badge_credits=gamification.QUIET_HERO_CREDITS - 1)
    submit_report(client, auth)
    _put(client, auth, "Brave Beagle")
    progress = client.get("/api/v1/users/me/progress", headers=auth).json()
    assert {b["key"] for b in progress["badges"] if b["earned"]} >= {"quiet_hero"}
    assert progress["nickname"] == "Brave Beagle"
