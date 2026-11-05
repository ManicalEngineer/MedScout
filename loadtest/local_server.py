#!/usr/bin/env python3
"""Run the MedScout API locally for load testing, shaped like production
(one Uvicorn worker) but with every outbound integration forced off.

    cd backend && source .venv/bin/activate
    DATABASE_URL=postgresql://user:pw@localhost/medscout_loadtest \
        alembic upgrade head
    DATABASE_URL=... python ../loadtest/local_server.py

Set LOADTEST_DISABLE_LIMITER=1 to turn slowapi off. Leave it unset to measure the
limiter itself; k6-mix.js then gives every virtual user its own address (see README).

Outbound calls: nothing can leave this machine. With MOCK_UPSTREAM_BASE=http://127.0.0.1:8002
(see mock_upstreams.py) the app's Google Places/Geocoding and Expo push calls are
redirected to the mock; every other outbound request is refused (isolation.py).
Without it, all outbound requests are refused.

Refuses to start against a non-local database or a non-loopback mock.
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

BACKEND = Path(__file__).resolve().parent.parent / "backend"

db_url = os.environ.get("DATABASE_URL", "")
host = urlparse(db_url).hostname
if not db_url.startswith("sqlite") and host not in ("localhost", "127.0.0.1", "::1"):
    sys.exit(f"refusing to run: DATABASE_URL must be sqlite or a localhost database (got host={host!r})")

# Blank (not unset): main.py calls load_dotenv(), which only fills variables
# that are missing, so an empty value here beats anything in backend/.env.
for var in (
    "LOOPS_API_KEY", "GOOGLE_PLACES_API_KEY", "SENTRY_DSN",
    "APPLE_PRIVATE_KEY", "APPLE_KEY_ID", "APPLE_TEAM_ID",
):
    os.environ[var] = ""
os.environ["ENABLE_SCHEDULER"] = "false"  # the daily jobs call openFDA and Expo push
os.environ.setdefault("SECRET_KEY", "loadtest-only-secret-not-for-production")

# Mock mode: the real Google key stays blank (above). /pharmacies/nearby refuses to
# run without *some* key, so a placeholder that is not a credential is set, and the
# isolation layer below guarantees the request only ever reaches the local mock.
MOCK_BASE = os.environ.get("MOCK_UPSTREAM_BASE", "").strip()
if MOCK_BASE:
    os.environ["GOOGLE_PLACES_API_KEY"] = "mock-key-not-a-credential"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import isolation  # noqa: E402

isolation.install(MOCK_BASE or None)   # exits if MOCK_BASE is not a loopback URL
print(f"outbound: {'Google + Expo -> ' + MOCK_BASE if MOCK_BASE else 'ALL outbound refused'}; everything else refused",
      file=sys.stderr)

os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

if os.environ.get("LOADTEST_DISABLE_LIMITER") == "1":
    from rate_limit import limiter
    limiter.enabled = False
    print("slowapi limiter DISABLED", file=sys.stderr)

if os.environ.get("LOADTEST_DRY_RUN") == "1":   # used by test_local_server.py: report the effective config, don't serve
    import json
    print(json.dumps({k: os.environ.get(k) for k in (
        "LOOPS_API_KEY", "GOOGLE_PLACES_API_KEY", "SENTRY_DSN", "APPLE_PRIVATE_KEY", "APPLE_KEY_ID",
        "APPLE_TEAM_ID", "ENABLE_SCHEDULER", "DATABASE_URL")}))
    sys.exit(0)

import uvicorn  # noqa: E402

# Same proxy handling as production (Uvicorn trusts 127.0.0.1 and takes the client
# address from X-Forwarded-For), so a test client can present a distinct address per
# virtual user by sending that header. See README "What the limiter sees".
uvicorn.run("main:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8001")),
            workers=1, log_level="warning", proxy_headers=True, forwarded_allow_ips="127.0.0.1")
