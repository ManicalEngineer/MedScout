"""local_server.py safety properties, checked without starting a server.

    cd backend && .venv/bin/python -m pytest ../loadtest/test_local_server.py -q
"""
import json
import os
import subprocess
import sys
from pathlib import Path

LOCAL = Path(__file__).resolve().parent / "local_server.py"
BACKEND = LOCAL.parent.parent / "backend"
SECRETS = {
    "LOOPS_API_KEY": "real-loops-key", "GOOGLE_PLACES_API_KEY": "AIza-real-google-key", "SENTRY_DSN": "https://k@sentry.io/1",
    "APPLE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----", "APPLE_KEY_ID": "REALKEYID", "APPLE_TEAM_ID": "REALTEAM",
}


def run(**env):
    e = {**os.environ, **SECRETS, "LOADTEST_DRY_RUN": "1", "DATABASE_URL": "sqlite:///./x.db"}
    e.pop("MOCK_UPSTREAM_BASE", None)
    e.update(env)
    return subprocess.run([sys.executable, "-I", str(LOCAL)], capture_output=True, text=True, env=e, cwd=BACKEND)


def test_refuses_non_local_databases():
    for url in ("postgresql://u:p@db.example.com/medscout", "postgresql://u@203.0.113.9/medscout", "postgresql://u@10.0.0.5/x"):
        r = run(DATABASE_URL=url)
        assert r.returncode != 0 and "refusing to run" in (r.stderr + r.stdout), url


def test_accepts_local_databases():
    for url in ("sqlite:///./x.db", "postgresql://u@localhost/x", "postgresql://u@127.0.0.1:5432/x"):
        assert run(DATABASE_URL=url).returncode == 0, url


def test_real_secrets_are_blanked_even_when_set_in_the_environment():
    r = run()
    assert r.returncode == 0, r.stderr
    cfg = json.loads(r.stdout.strip().splitlines()[-1])
    for k in SECRETS:
        assert cfg[k] == "", k
    assert cfg["ENABLE_SCHEDULER"] == "false"
    assert "ALL outbound refused" in r.stderr


def test_mock_mode_uses_a_placeholder_never_the_real_google_key():
    r = run(MOCK_UPSTREAM_BASE="http://127.0.0.1:8002")
    cfg = json.loads(r.stdout.strip().splitlines()[-1])
    assert cfg["GOOGLE_PLACES_API_KEY"] == "mock-key-not-a-credential"
    assert SECRETS["GOOGLE_PLACES_API_KEY"] not in r.stdout + r.stderr
    for k in ("LOOPS_API_KEY", "SENTRY_DSN", "APPLE_PRIVATE_KEY", "APPLE_KEY_ID", "APPLE_TEAM_ID"):
        assert cfg[k] == ""
    assert "Google + Expo -> http://127.0.0.1:8002" in r.stderr


def test_refuses_a_non_loopback_mock():
    r = run(MOCK_UPSTREAM_BASE="http://203.0.113.9:8002")
    assert r.returncode != 0 and "loopback" in (r.stderr + r.stdout)
    r = run(MOCK_UPSTREAM_BASE="https://maps.googleapis.com")
    assert r.returncode != 0
