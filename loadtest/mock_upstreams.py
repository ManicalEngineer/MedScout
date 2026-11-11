#!/usr/bin/env python3
"""Local stand-in for the third-party services the API calls: Google Places
(Nearby Search, Place Details), Google Geocoding, and the Expo push endpoint.

    python loadtest/mock_upstreams.py            # http://127.0.0.1:8002

Binds to loopback only and uses nothing but the standard library. The responses
carry the extra fields real Google returns (ratings, opening hours, photos,
plus codes, reviews...) so you can check that the app drops them.

Environment (all optional):

  MOCK_PORT              8002
  MOCK_LATENCY_MS        80      base latency added to every request
  MOCK_SLOW_START        -       seconds after this process started when the slow window opens
  MOCK_SLOW_SECONDS      0       how long the slow window lasts
  MOCK_SLOW_LATENCY_MS   4000    latency during the slow window
  MOCK_FAILURE_RATE      0       0..1 fraction of requests that fail (HTTP 500, a Google error
                                 status, a garbage body, or a dropped connection)
  MOCK_TRICKLE           0       1 = Google responses arrive one byte every MOCK_TRICKLE_INTERVAL_MS
  MOCK_TRICKLE_INTERVAL_MS 500

Everything except the port can also be changed while it runs (k6 uses this to open the slow
window at an exact moment):

  GET /__control/slow?latency_ms=4000&seconds=90      open a slow window starting now
  GET /__control/set?failure_rate=0.3&trickle=1&latency_ms=100
  GET /__control/reset                                 back to the environment's settings, zero counters
  GET /__stats                                         JSON request counts

Request counts per endpoint are logged to stderr every 10 s and again at exit.
"""
import hashlib
import json
import os
import random
import signal
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

STARTED = time.monotonic()


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.reset()

    def reset(self):
        with self.lock:
            self.latency_ms = _f("MOCK_LATENCY_MS", 80)
            self.slow_latency_ms = _f("MOCK_SLOW_LATENCY_MS", 4000)
            start = os.environ.get("MOCK_SLOW_START")
            self.slow_from = (STARTED + float(start)) if start else None
            self.slow_until = (self.slow_from + _f("MOCK_SLOW_SECONDS", 0)) if start else None
            self.failure_rate = _f("MOCK_FAILURE_RATE", 0)
            self.trickle = os.environ.get("MOCK_TRICKLE", "0") == "1"
            self.trickle_interval = _f("MOCK_TRICKLE_INTERVAL_MS", 500) / 1000
            self.counts: dict = {}
            self.in_flight = 0
            self.max_in_flight = 0
            self.slow_hits = 0

    def bump(self, key: str, n: int = 1):
        with self.lock:
            self.counts[key] = self.counts.get(key, 0) + n

    def latency_now(self) -> float:
        now = time.monotonic()
        with self.lock:
            if self.slow_from is not None and self.slow_from <= now < self.slow_until:
                self.slow_hits += 1
                return self.slow_latency_ms / 1000
            return self.latency_ms / 1000

    def snapshot(self) -> dict:
        now = time.monotonic()
        with self.lock:
            window = None
            if self.slow_from is not None:
                window = {"opens_in_s": round(self.slow_from - now, 1), "closes_in_s": round(self.slow_until - now, 1)}
            return {
                "counts": dict(self.counts), "max_in_flight": self.max_in_flight, "slow_hits": self.slow_hits,
                "failure_rate": self.failure_rate, "trickle": self.trickle, "latency_ms": self.latency_ms,
                "slow_window": window, "uptime_s": round(now - STARTED, 1),
            }


STATE = State()


# --- fake payloads -------------------------------------------------------------

STREETS = ["Main St", "Oak Ave", "Colfax Ave", "Broadway", "Federal Blvd", "Elm St", "Pine Rd", "Sheridan Blvd"]
CHAINS = ["Walgreens", "CVS Pharmacy", "Safeway Pharmacy", "King Soopers Pharmacy", "Walmart Pharmacy", "Rite Aid", "Costco Pharmacy", "Local Corner Drug"]
EXTRA_TYPES = ["health", "point_of_interest", "store", "establishment"]


def _h(*parts) -> int:
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12], 16)


def _place(seed: str, i: int, lat: float, lng: float) -> dict:
    h = _h(seed, i)
    plat = round(lat + ((h % 2000) - 1000) / 40000, 6)
    plng = round(lng + (((h // 2000) % 2000) - 1000) / 40000, 6)
    name = f"{CHAINS[h % len(CHAINS)]} #{h % 900 + 100}"
    types = ["pharmacy"] + EXTRA_TYPES
    if i == 5:                                   # Google really does tag some vets as pharmacies
        name, types = f"Paws Veterinary #{h % 90}", ["pharmacy", "veterinary_care"] + EXTRA_TYPES
    return {
        "business_status": "OPERATIONAL",
        "geometry": {
            "location": {"lat": plat, "lng": plng},
            "viewport": {"northeast": {"lat": plat + 0.0005, "lng": plng + 0.0005},
                         "southwest": {"lat": plat - 0.0005, "lng": plng - 0.0005}},
        },
        "icon": "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/pharmacy-71.png",
        "icon_background_color": "#4B96F3",
        "icon_mask_base_uri": "https://maps.gstatic.com/mapfiles/place_api/icons/v2/pharmacy_pinlet",
        "name": name,
        "opening_hours": {"open_now": bool(h % 2)},
        "photos": [{"height": 3024, "width": 4032, "photo_reference": f"mock-photo-{h}",
                    "html_attributions": ['<a href="https://maps.google.com/maps/contrib/0">A Google User</a>']}],
        "place_id": f"mock-{h:012x}",
        "plus_code": {"compound_code": "8H3Q+XX Denver, CO, USA", "global_code": "85FPQ8H3+XX"},
        "price_level": 2,
        "rating": round(3 + (h % 20) / 10, 1),
        "reference": f"mock-ref-{h}",
        "scope": "GOOGLE",
        "types": types,
        "user_ratings_total": h % 900 + 5,
        "vicinity": f"{h % 9000 + 100} {STREETS[h % len(STREETS)]}, Denver",
    }


def nearby_payload(q: dict) -> dict:
    try:
        lat, lng = (float(x) for x in q["location"][0].split(","))
    except (KeyError, ValueError, IndexError):
        return {"results": [], "status": "INVALID_REQUEST", "error_message": "bad location"}
    seed = f"{lat:.4f},{lng:.4f}"
    return {"html_attributions": [], "next_page_token": f"mock-token-{_h(seed)}",
            "results": [_place(seed, i, lat, lng) for i in range(12)], "status": "OK"}


def details_payload(q: dict) -> dict:
    pid = (q.get("place_id") or ["mock-000000000000"])[0]
    h = _h(pid)
    lat, lng = 39.74 + ((h % 2000) - 1000) / 20000, -104.99 + (((h // 2000) % 2000) - 1000) / 20000
    return {"html_attributions": [], "status": "OK", "result": {
        "name": f"{CHAINS[h % len(CHAINS)]} #{h % 900 + 100}",
        "formatted_phone_number": f"(303) 555-{h % 10000:04d}",
        "international_phone_number": f"+1 303-555-{h % 10000:04d}",
        "formatted_address": f"{h % 9000 + 100} {STREETS[h % len(STREETS)]}, Denver, CO 802{h % 90 + 10}, USA",
        "address_components": [
            {"long_name": str(h % 9000 + 100), "short_name": str(h % 9000 + 100), "types": ["street_number"]},
            {"long_name": "Denver", "short_name": "Denver", "types": ["locality", "political"]},
            {"long_name": "Colorado", "short_name": "CO", "types": ["administrative_area_level_1", "political"]},
            {"long_name": f"802{h % 90 + 10}", "short_name": f"802{h % 90 + 10}", "types": ["postal_code"]},
        ],
        "geometry": {"location": {"lat": round(lat, 6), "lng": round(lng, 6)}},
        "opening_hours": {"open_now": True, "weekday_text": ["Monday: 8:00 AM – 9:00 PM"] * 7},
        "rating": 4.1, "user_ratings_total": 321, "website": "https://example.invalid",
        "photos": [{"photo_reference": f"mock-photo-{h}", "height": 1000, "width": 1000}],
        "reviews": [{"author_name": "A Person", "rating": 5, "text": "Quick and friendly.", "time": 1700000000}],
    }}


def geocode_payload(q: dict) -> dict:
    addr = (q.get("address") or [""])[0]
    h = _h(addr)
    lat, lng = 39.6 + (h % 3000) / 10000, -105.1 + ((h // 3000) % 3000) / 10000
    return {"status": "OK", "results": [{
        "formatted_address": f"{addr}, Denver, CO 80202, USA",
        "address_components": [{"long_name": "80202", "short_name": "80202", "types": ["postal_code"]}],
        "geometry": {"location": {"lat": round(lat, 6), "lng": round(lng, 6)}, "location_type": "ROOFTOP"},
        "place_id": f"mock-{h:012x}", "types": ["street_address"],
    }]}


# --- server ----------------------------------------------------------------------

ROUTES = {
    "/google/maps/api/place/nearbysearch/json": ("nearby", nearby_payload),
    "/google/maps/api/place/details/json": ("details", details_payload),
    "/google/maps/api/geocode/json": ("geocode", geocode_payload),
}
FAILURES = ["http500", "over_query_limit", "bad_json", "drop"]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "mock-upstreams"

    def log_message(self, *a):  # request counts are reported separately; keep stderr quiet
        pass

    def _send(self, code: int, body: bytes, trickle: bool = False):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            if trickle:
                for i in range(len(body)):
                    self.wfile.write(body[i:i + 1])
                    self.wfile.flush()
                    time.sleep(STATE.trickle_interval)
            else:
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, code, obj, trickle=False):
        self._send(code, json.dumps(obj).encode(), trickle)

    def _maybe_fail(self, name: str, google: bool) -> bool:
        if STATE.failure_rate <= 0 or random.random() >= STATE.failure_rate:
            return False
        kind = random.choice(FAILURES if google else ["http500", "drop"])
        STATE.bump(f"{name}.injected_failure.{kind}")
        if kind == "drop":
            self.close_connection = True
            try:
                self.connection.close()
            except OSError:
                pass
        elif kind == "http500":
            self._json(500, {"error": "mock upstream failure"})
        elif kind == "bad_json":
            self._send(200, b"<html>not json</html>")
        else:
            self._json(200, {"status": "OVER_QUERY_LIMIT", "results": [],
                             "error_message": "You have exceeded your daily request quota for this API."})
        return True

    def _control(self, path: str, q: dict) -> bool:
        if path == "/__stats":
            self._json(200, STATE.snapshot())
        elif path == "/__control/reset":
            STATE.reset()
            self._json(200, {"ok": True})
        elif path == "/__control/slow":
            now = time.monotonic()
            with STATE.lock:
                STATE.slow_latency_ms = float(q.get("latency_ms", [4000])[0])
                STATE.slow_from = now
                STATE.slow_until = now + float(q.get("seconds", [60])[0])
            _log(f"slow window opened: {q.get('latency_ms', [4000])[0]} ms for {q.get('seconds', [60])[0]} s")
            self._json(200, {"ok": True})
        elif path == "/__control/set":
            with STATE.lock:
                if "failure_rate" in q:
                    STATE.failure_rate = float(q["failure_rate"][0])
                if "trickle" in q:
                    STATE.trickle = q["trickle"][0] == "1"
                if "latency_ms" in q:
                    STATE.latency_ms = float(q["latency_ms"][0])
            self._json(200, STATE.snapshot())
        else:
            return False
        return True

    def _handle(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if self._control(u.path, q):
            return
        with STATE.lock:
            STATE.in_flight += 1
            STATE.max_in_flight = max(STATE.max_in_flight, STATE.in_flight)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            time.sleep(STATE.latency_now())
            if u.path in ROUTES:
                name, fn = ROUTES[u.path]
                STATE.bump(name)
                if self._maybe_fail(name, google=True):
                    return
                if STATE.trickle:
                    STATE.bump(f"{name}.trickled")
                self._json(200, fn(q), trickle=STATE.trickle)
            elif u.path == "/expo/push/send":
                try:
                    msgs = json.loads(raw or b"[]")
                except ValueError:
                    msgs = []
                msgs = msgs if isinstance(msgs, list) else [msgs]
                STATE.bump("expo_push")
                STATE.bump("expo_push.messages", len(msgs))
                if self._maybe_fail("expo_push", google=False):
                    return
                self._json(200, {"data": [{"status": "ok", "id": f"mock-{_h(i, time.time())}"} for i, _ in enumerate(msgs)]})
            else:
                STATE.bump("unknown_path")
                self._json(404, {"error": f"mock has no route for {u.path}"})
        finally:
            with STATE.lock:
                STATE.in_flight -= 1

    do_GET = do_POST = _handle


def _log(msg: str):
    print(f"[mock_upstreams +{time.monotonic() - STARTED:6.1f}s] {msg}", file=sys.stderr, flush=True)


def main():
    host = "127.0.0.1"                       # loopback only, on purpose
    port = int(os.environ.get("MOCK_PORT", "8002"))
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.request_queue_size = 256
    srv = ThreadingHTTPServer((host, port), Handler)

    def report(final=False):
        _log(("FINAL " if final else "") + "counts=" + json.dumps(STATE.snapshot()["counts"], sort_keys=True)
             + f" max_in_flight={STATE.max_in_flight} slow_hits={STATE.slow_hits}")

    def ticker():
        while True:
            time.sleep(10)
            report()

    threading.Thread(target=ticker, daemon=True).start()

    def stop(*_):
        report(final=True)
        threading.Thread(target=srv.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    _log(f"listening on http://{host}:{port}  latency={STATE.latency_ms:.0f}ms failure_rate={STATE.failure_rate} "
         f"trickle={STATE.trickle} slow_window={STATE.snapshot()['slow_window']}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
