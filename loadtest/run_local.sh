#!/usr/bin/env bash
# Run one load-test scenario end to end on this machine, then clean up everything it started:
#   a throwaway Postgres 16, the mock Google/Expo server, local_server.py, and k6.
#
#   loadtest/run_local.sh capacity|limiter|slow_google
#
# Any k6-mix.js option (HOLD, PEAK_SIGNUPS_PER_SEC, NEARBY_RPS, ...) and any mock option
# (MOCK_LATENCY_MS, MOCK_FAILURE_RATE, MOCK_TRICKLE, ...) set in the environment is passed through.
# Also: PLACES_MAX_CONCURRENT / PLACES_MAX_CALLS_PER_HOUR / PLACES_CACHE_TTL_SECONDS reach the app.
# Test tooling only; never touches production or any real service.
set -euo pipefail

SCENARIO="${1:-}"
case "$SCENARIO" in capacity|limiter|slow_google) ;; *) echo "usage: $0 capacity|limiter|slow_google" >&2; exit 2;; esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"
[ -x "$PY" ] || { echo "backend/.venv not found: create it and pip install -r backend/requirements.txt" >&2; exit 1; }
command -v k6 >/dev/null || { echo "k6 not installed (brew install k6)" >&2; exit 1; }

PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || echo /opt/homebrew/opt/postgresql@16/bin/pg_ctl)")}"
[ -x "$PGBIN/pg_ctl" ] || { echo "Postgres binaries not found (set PGBIN)" >&2; exit 1; }

free_port() { "$PY" -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1])"; }
PGPORT="${PGPORT:-$(free_port)}"; APIPORT="${APIPORT:-$(free_port)}"; MOCKPORT="${MOCKPORT:-$(free_port)}"
OUT="${OUT:-$(mktemp -d /tmp/medscout-loadtest.XXXXXX)}"
PGDATA="$OUT/pgdata"; SOCK="$(mktemp -d /tmp/ltpg.XXXXXX)"
PIDS=()

cleanup() {
  set +e
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill -INT "$p" 2>/dev/null; done
  sleep 1
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done
  "$PGBIN/pg_ctl" -D "$PGDATA" stop -m fast >/dev/null 2>&1
  rm -rf "$PGDATA" "$SOCK"
  echo "logs kept in $OUT"
}
trap cleanup EXIT

echo "== throwaway Postgres on 127.0.0.1:$PGPORT"
"$PGBIN/initdb" -D "$PGDATA" -U loadtest --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c max_connections=100 -c unix_socket_directories=$SOCK" -l "$OUT/postgres.log" -w start >/dev/null
"$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U loadtest medscout_loadtest
export DATABASE_URL="postgresql://loadtest@127.0.0.1:$PGPORT/medscout_loadtest"
(cd "$ROOT/backend" && SECRET_KEY=loadtest-only "$PY" -m alembic upgrade head >"$OUT/alembic.log" 2>&1)

echo "== mock Google/Expo on 127.0.0.1:$MOCKPORT"
MOCK_PORT="$MOCKPORT" "$PY" "$ROOT/loadtest/mock_upstreams.py" 2>"$OUT/mock.log" &
PIDS+=($!)

echo "== API (local_server.py) on 127.0.0.1:$APIPORT, scenario=$SCENARIO"
if [ "$SCENARIO" = "capacity" ]; then export LOADTEST_DISABLE_LIMITER=1; else unset LOADTEST_DISABLE_LIMITER; fi
MOCK_UPSTREAM_BASE="http://127.0.0.1:$MOCKPORT" PORT="$APIPORT" "$PY" "$ROOT/loadtest/local_server.py" 2>"$OUT/server.log" &
SERVER=$!; PIDS+=($SERVER)
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$APIPORT/health" >/dev/null && break; sleep 0.5; done
curl -sf "http://127.0.0.1:$APIPORT/health" >/dev/null || { echo "API did not start; see $OUT/server.log" >&2; exit 1; }

( while kill -0 "$SERVER" 2>/dev/null; do echo "$(date +%s) $(ps -o %cpu=,rss= -p "$SERVER" | tr -s ' ')" >> "$OUT/samples.txt"; sleep 2; done ) &
PIDS+=($!)

echo "== k6 ($SCENARIO)"
set +e
SCENARIO="$SCENARIO" BASE_URL="http://127.0.0.1:$APIPORT" MOCK_CONTROL_URL="http://127.0.0.1:$MOCKPORT" \
  INCLUDE_NEARBY="${INCLUDE_NEARBY:-$([ "$SCENARIO" = limiter ] && echo 1 || echo 0)}" \
  k6 run --quiet "$ROOT/loadtest/k6-mix.js" 2>&1 | tee "$OUT/k6.out"
K6_STATUS=${PIPESTATUS[0]}
set -e

echo "== mock upstream counts:"; curl -s "http://127.0.0.1:$MOCKPORT/__stats" || true; echo
if [ -s "$OUT/samples.txt" ]; then
  awk '{c+=$2; if($2>m)m=$2; if($3>r)r=$3; n++} END{printf "== API process: samples=%d avg_cpu=%.0f%% (100%% = one core) max_cpu=%.0f%% max_rss=%.0f MB\n", n, c/n, m, r/1024}' "$OUT/samples.txt"
fi
grep -E "isolation|places_guard|db_pool|Traceback" "$OUT/server.log" | sort | uniq -c | head -10 || true
echo "k6 exit status: $K6_STATUS (0 = every threshold passed, 99 = a threshold failed)"
exit "$K6_STATUS"
