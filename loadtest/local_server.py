#!/usr/bin/env python3
"""Run the MedScout API locally for load testing, shaped like production
(one Uvicorn worker) but with every outbound integration forced off.

    cd backend && source .venv/bin/activate
    DATABASE_URL=postgresql://user:pw@localhost/medscout_loadtest \
        alembic upgrade head
    DATABASE_URL=... python ../loadtest/local_server.py

Set LOADTEST_DISABLE_LIMITER=1 to turn slowapi off (a single load generator is
one IP, so with the limiter on nearly everything past the first few requests
becomes a 429). Leave it unset to measure the limiter itself.

Refuses to start against a non-local database.
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

os.chdir(BACKEND)
sys.path.insert(0, str(BACKEND))

if os.environ.get("LOADTEST_DISABLE_LIMITER") == "1":
    from rate_limit import limiter
    limiter.enabled = False
    print("slowapi limiter DISABLED", file=sys.stderr)

import uvicorn  # noqa: E402

uvicorn.run("main:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8001")),
            workers=1, log_level="warning")
