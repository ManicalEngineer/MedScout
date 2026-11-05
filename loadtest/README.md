# Load test

**Test tooling only. Nothing in `loadtest/` is part of the backend deploy.** The deploy copies `backend/` to `/opt/medscout/backend`; this directory is never rsynced, imported by the app, or run by systemd. It exercises the API from a developer machine, or from a disposable copy that has no real integrations.

Never point this at production. `k6-mix.js` refuses `getmedscout.com` (in `BASE_URL` or `HOST_HEADER`) unless `ALLOW_PROD=1`. Production would create thousands of real accounts and call Google (billed), Expo and Loops.

## What is here

| File | Purpose |
|---|---|
| `run_local.sh` | One command: throwaway Postgres 16, mock upstreams, API, k6, then cleanup. |
| `k6-mix.js` | The load script. `SCENARIO=capacity` (default), `limiter`, or `slow_google`. |
| `local_server.py` | Runs the API production-shaped (one Uvicorn worker) with every outbound call kept on this machine. |
| `isolation.py` | What keeps `local_server.py` off the internet (see below). |
| `mock_upstreams.py` | Fake Google Places / Place Details / Geocoding and Expo push, with latency, slow-window, failure and trickle controls. |
| `scrub.sql` | Strips emails, hashes, tokens from a COPY of a production dump. Destructive; read its header. Never run automatically. |
| `test_isolation.py`, `test_local_server.py` | Tests of the safety properties above. |

## Run a scenario on this Mac

```bash
loadtest/run_local.sh capacity      # limiter off: raw capacity
loadtest/run_local.sh limiter       # limiter on, one address per simulated client + one abuser
loadtest/run_local.sh slow_google   # Google goes slow mid-run: guards must trip, API must stay up
```

Needs `k6` (`brew install k6`), the Postgres 16 binaries (`brew install postgresql@16`; or set `PGBIN`), and `backend/.venv`. The script picks free ports, starts everything, runs k6, prints the mock's request counts and the API process's CPU/memory, stops everything, and exits with k6's status (0 = every threshold passed, 99 = one failed). Logs are kept in the directory it prints.

Shorter or different runs: set options in the environment, e.g.

```bash
HOLD=60s loadtest/run_local.sh capacity
PEAK_SIGNUPS_PER_SEC=5 PEAK_RETURNING_PER_SEC=5 loadtest/run_local.sh capacity
DURATION=3m SLOW_AT=45 SLOW_SECONDS=80 loadtest/run_local.sh slow_google
SLOW_LATENCY_MS=8000 loadtest/run_local.sh slow_google           # slower than the 6 s Places deadline
PLACES_MAX_CONCURRENT=2 NEARBY_RPS=6 loadtest/run_local.sh slow_google
MOCK_FAILURE_RATE=0.3 loadtest/run_local.sh slow_google           # Google erroring, not just slow
MOCK_TRICKLE=1 loadtest/run_local.sh slow_google                  # responses dribble in a byte at a time
```

### Doing the steps by hand

```bash
export DATABASE_URL=postgresql://$USER@localhost/medscout_loadtest        # createdb medscout_loadtest first
cd backend && source .venv/bin/activate && alembic upgrade head && cd ..

python loadtest/mock_upstreams.py &                                       # http://127.0.0.1:8002
MOCK_UPSTREAM_BASE=http://127.0.0.1:8002 LOADTEST_DISABLE_LIMITER=1 \
  python loadtest/local_server.py &                                       # http://127.0.0.1:8001; omit LOADTEST_DISABLE_LIMITER to test the limiter

SCENARIO=capacity BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
```

`local_server.py` refuses a non-local `DATABASE_URL` and a non-loopback `MOCK_UPSTREAM_BASE`, blanks `LOOPS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SENTRY_DSN` and the `APPLE_*` settings even if `backend/.env` sets them, and turns the scheduler off. In mock mode it sets a placeholder Google key (`mock-key-not-a-credential`) because `/pharmacies/nearby` will not run with none; the isolation layer guarantees that key can only ever reach the local mock.

## The scenarios

### `capacity` (limiter off)
About 3 signup sessions/s plus 3 returning sessions/s at peak (roughly 50 requests/s, because a session is several requests). Start the server with `LOADTEST_DISABLE_LIMITER=1`.

| Session | Calls |
|---|---|
| New user | register, me, 2x create pharmacy, scripts, browse x2, create call, 50% report |
| Returning user | login, refresh, me, browse x2, call list, 30% report, 30% call |
| browse | pharmacies list, availability map, shortage-status |

Thresholds: p95 < 800 ms and p99 < 2 s overall; register and login p95 < 1.5 s; map and pharmacies p95 < 800 ms; failures < 1%; `rate_limited` < 1%; zero 5xx; zero dropped iterations (a dropped iteration means the server could not keep up with the arrival rate); checks > 99%.

### `limiter` (limiter on, many clients)
The same mix, plus (`ABUSER=1`, default) one abusive client at a fixed address that spams signups and guesses one account's password at `ABUSER_RPS` (3/s). Every legit session presents its own address.

Thresholds: as capacity, except `rate_limited{who:legit}` < 1% (real users are never limited; the expected 60 s per-account report throttle is counted separately as `report_throttled`), and `rate_limited{who:abuser}` > 50% (the abuser is limited). `INCLUDE_NEARBY` defaults to 1 here via `run_local.sh`, so `/pharmacies/nearby` runs against the mock.

### `slow_google` (Google degrades)
Steady `/pharmacies/nearby` at `NEARBY_RPS` (4/s) for `DURATION` (4m). Each request asks for a different map cell from a different user and address, so every one needs its own Google call and no per-user or per-address limit interferes: what is exercised is the Places guards (concurrency cap 8, hourly ceiling, 6 s deadline, 8 s waiter timeout). At `SLOW_AT` seconds the mock's latency jumps to `SLOW_LATENCY_MS` (4 s) for `SLOW_SECONDS` (90 s); k6 triggers it through `MOCK_CONTROL_URL`. Meanwhile `/health` is probed at 2/s and login at 1/s.

Thresholds: `/health` p95 < 1 s; login p95 < 1 s; `nearby_bad` == 0 (nearby answers only 200 or 503, never 500, 429 or anything else); `nearby_503_without_retry_after` == 0; zero 5xx other than nearby's 503; `nearby_503` > 0 (the guards really tripped; if this fails, raise `NEARBY_RPS` or lower `PLACES_MAX_CONCURRENT`: in-flight calls = rate x latency must exceed the cap); failures < 1%; zero dropped iterations. nearby's own latency is deliberately not asserted.

## What the limiter sees as the client address

The app's rate-limit key reads only `request.client.host` (`backend/rate_limit.py`); authenticated routes key on the user id from the token and only fall back to the address.

**Local mode (`local_server.py`).** k6 and the API are on the same machine, so the TCP peer is always `127.0.0.1`. Uvicorn is started like production: `proxy_headers=True`, `forwarded_allow_ips="127.0.0.1"`. Because the peer is trusted, Uvicorn replaces `request.client.host` with the right-most untrusted entry of `X-Forwarded-For`. k6 sets `X-Forwarded-For: 10.a.b.c` per session (`SIM_CLIENTS=1`, automatic for a loopback `BASE_URL`), so each session's anonymous requests are keyed `ip:10.a.b.c`, exactly as if Nginx had passed a distinct real client IP. The abuser is `ip:203.0.113.200`. Authenticated requests key `user:<id>` and the address does not matter. If you set `SIM_CLIENTS=0`, every anonymous request is `ip:127.0.0.1`: one shared bucket (register 60/h, login 10/min), which reproduces the "everyone collapses into one address" failure.

**Remote mode.** Do not expect the header trick to work, and be glad. Behind Nginx (as in `backend/deploy/nginx-medscout.conf`) a client-supplied `X-Forwarded-For` is not trusted: Nginx appends the real connecting address and Uvicorn takes the right-most untrusted entry, which is the address your Mac connects from (or, through Cloudflare with real-IP configured, `CF-Connecting-IP`). So every virtual user shares your Mac's address: anonymous routes (register 60/h, login 10/min) will start returning 429 for everyone after the allowance, while authenticated routes still get one bucket per user. That is correct behaviour, not a bug. For remote runs use `SIM_CLIENTS=0 ABUSER=0` and either a staging copy with the limiter disabled, or accept that anonymous endpoints cannot be load-tested at scale from one address.

## Running from your Mac against a remote host

Only against a **staging copy that has no real integrations** (blank Google/Loops/Sentry/Apple settings, or the mock). A normal server calls real Google with a billed key, and registers real accounts in its database.

Recommended: run the same harness on the droplet itself, on another port and database, and tunnel to it. It exercises the droplet's CPU and Postgres with production-shaped Uvicorn, and the simulated client addresses work because the tunnel arrives from loopback.

```bash
# on the droplet, in a checkout of this branch, with its own throwaway database (never the production one)
python loadtest/mock_upstreams.py &
DATABASE_URL=postgresql://user@localhost/medscout_loadtest MOCK_UPSTREAM_BASE=http://127.0.0.1:8002 \
  LOADTEST_DISABLE_LIMITER=1 PORT=8001 python loadtest/local_server.py &

# on your Mac
ssh -N -L 8001:127.0.0.1:8001 -L 8002:127.0.0.1:8002 you@droplet &
SCENARIO=capacity BASE_URL=http://127.0.0.1:8001 k6 run loadtest/k6-mix.js
SCENARIO=slow_google BASE_URL=http://127.0.0.1:8001 MOCK_CONTROL_URL=http://127.0.0.1:8002 k6 run loadtest/k6-mix.js
```

If you instead have a staging host reachable over HTTPS:

```bash
# by name
SCENARIO=capacity SIM_CLIENTS=0 BASE_URL=https://staging.example.com k6 run loadtest/k6-mix.js

# straight to the server's IP while keeping the right name for TLS and routing (preferred): k6 connects to
# DIRECT_IP but sends SNI and Host for the hostname, so the certificate still validates
SCENARIO=capacity SIM_CLIENTS=0 BASE_URL=https://staging.example.com DIRECT_IP=203.0.113.10 k6 run loadtest/k6-mix.js

# URL is the bare IP, name supplied in the Host header, certificate check skipped
SCENARIO=capacity SIM_CLIENTS=0 BASE_URL=https://203.0.113.10 HOST_HEADER=staging.example.com INSECURE_TLS=1 \
  k6 run loadtest/k6-mix.js          # INSECURE_TLS=1 is the same as k6's --insecure-skip-tls-verify
```

With a bare-IP URL no SNI is sent, so Nginx may answer from its default server block (wrong certificate, or a 404/421 despite the Host header). `DIRECT_IP` avoids that. Skipping TLS verification disables protection against interception; use it only on a network you trust.

`slow_google` needs the mock's control endpoint, so it only makes sense where the mock runs (the tunnel above), not against an arbitrary staging host.

## A realistic database (optional)

`scrub.sql` removes emails, password hashes, push tokens, Apple/Google ids and call notes from a restored COPY of a production dump so the load test runs against realistic table sizes. Read its header first: it is destructive, requires `-v scrub_confirm=yes`, and refuses any database whose name does not contain `loadtest`. It has not been run; test it on a small throwaway database before relying on it.

## The harness's own tests

```bash
cd backend && .venv/bin/python -m pytest ../loadtest/test_isolation.py ../loadtest/test_local_server.py -q
```

## Mock upstream options

Environment variables for `mock_upstreams.py` (all optional): `MOCK_PORT` (8002), `MOCK_LATENCY_MS` (80), `MOCK_SLOW_START` / `MOCK_SLOW_SECONDS` / `MOCK_SLOW_LATENCY_MS` (slow window, seconds after start), `MOCK_FAILURE_RATE` (0..1: HTTP 500, an `OVER_QUERY_LIMIT` status, a garbage body or a dropped connection), `MOCK_TRICKLE=1` with `MOCK_TRICKLE_INTERVAL_MS` (a byte at a time). While running: `/__control/slow`, `/__control/set`, `/__control/reset`, and `/__stats` (request counts per endpoint, also logged every 10 s). The Google responses include the fields the app should drop (ratings, opening hours, photos, plus codes, reviews), and one of the twelve nearby results is a veterinary clinic that the app should filter out.
