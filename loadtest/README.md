# Load test

**Test tooling only. Nothing in `loadtest/` is part of the backend deploy.** The deploy copies `backend/` to `/opt/medscout/backend`; this directory is never rsynced, imported by the app, or run by systemd. It exists to exercise the API from a developer machine (or a disposable staging copy).

Never point this at production. `k6-mix.js` refuses `getmedscout.com` unless `ALLOW_PROD=1`, and `BASE_URL` has no default.

## Run it locally (production-shaped: one Uvicorn worker, Postgres)

```bash
# 1. a throwaway local database
createdb medscout_loadtest
export DATABASE_URL=postgresql://$USER@localhost/medscout_loadtest

# 2. schema + server (local_server.py refuses non-local databases, blanks the
#    Loops / Google Places / Sentry / Apple keys, and disables the scheduler)
cd backend && source .venv/bin/activate && alembic upgrade head
LOADTEST_DISABLE_LIMITER=1 python ../loadtest/local_server.py      # http://127.0.0.1:8001

# 3. in another terminal
BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
```

Run it twice:

1. **Limiter off** (`LOADTEST_DISABLE_LIMITER=1`): measures raw capacity, latency, DB pool behaviour.
2. **Limiter on** (omit the variable): one load generator is one IP, so this shows how fast the per-IP buckets exhaust. Expect `rate_limited` to fail. That is the same mechanism that would hit real users if the server sees one IP for all of them. Use `POOL_SIZE=8` here, since registration is limited to 10/hour per IP.

Watch while it runs: `psql -c "select state, count(*) from pg_stat_activity where datname='medscout_loadtest' group by 1"` (idle-in-transaction count versus the 15-connection pool), and Uvicorn CPU.

## Mix

About 3 signup sessions/s plus 3 returning sessions/s at peak (about 30 requests/s total):

| Session | Calls |
|---|---|
| New user | register, me, 2x create pharmacy, scripts, browse x2, create call, 50% report |
| Returning user | login, refresh, me, browse x2, call list, 30% report, 30% call |
| browse | pharmacies list, availability map, shortage-status |

`INCLUDE_NEARBY=1` adds `/pharmacies/nearby` (Google Places, billed) and is only meaningful against a target that has a real key.

## Thresholds

p95 < 800 ms overall (register and login < 1500 ms), p99 < 2 s, failures < 1%, `rate_limited` < 1%, zero 5xx, zero dropped iterations. A dropped iteration means the server could not keep up with the arrival rate.
