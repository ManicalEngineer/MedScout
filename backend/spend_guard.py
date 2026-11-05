"""Process-wide guards on paid outbound calls (Google Places).

Both are per-process and in-memory; with the single Uvicorn worker that is the
whole API. A restart resets them.
"""
import logging
import os
import threading
import time
from collections import deque

logger = logging.getLogger(__name__)


def env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except ValueError:
        return default


class HourlyCeiling:
    """At most `limit` acquisitions in any rolling hour."""

    def __init__(self, window: float = 3600.0):
        self.window = window
        self._lock = threading.Lock()
        self._stamps: deque = deque()

    def try_acquire(self, limit: int) -> tuple[bool, int]:
        """(True, 0) and the call is counted, or (False, seconds until a slot frees)."""
        now = time.monotonic()
        with self._lock:
            while self._stamps and now - self._stamps[0] >= self.window:
                self._stamps.popleft()
            if len(self._stamps) >= limit:
                wait = (self._stamps[0] + self.window - now) if self._stamps else self.window
                return False, max(1, int(wait) + 1)
            self._stamps.append(now)
            return True, 0

    def count(self) -> int:
        with self._lock:
            now = time.monotonic()
            return sum(1 for t in self._stamps if now - t < self.window)

    def reset(self) -> None:
        with self._lock:
            self._stamps.clear()


class ConcurrencyCap:
    """At most `limit` holders at once. try_acquire never blocks."""

    def __init__(self):
        self._lock = threading.Lock()
        self._in_flight = 0

    def try_acquire(self, limit: int) -> bool:
        with self._lock:
            if self._in_flight >= limit:
                return False
            self._in_flight += 1
            return True

    def release(self) -> None:
        with self._lock:
            self._in_flight = max(0, self._in_flight - 1)

    @property
    def in_flight(self) -> int:
        return self._in_flight

    def reset(self) -> None:
        with self._lock:
            self._in_flight = 0


class TripLog:
    """Warn when a guard trips, at most once a minute per guard (with a count of
    how many requests were refused in between), so a spike doesn't flood the log."""

    def __init__(self, every: float = 60.0):
        self.every = every
        self._lock = threading.Lock()
        self._last: dict = {}
        self._suppressed: dict = {}

    def trip(self, kind: str, detail: str) -> None:
        now = time.monotonic()
        with self._lock:
            last = self._last.get(kind)
            if last is not None and now - last < self.every:
                self._suppressed[kind] = self._suppressed.get(kind, 0) + 1
                return
            skipped = self._suppressed.pop(kind, 0)
            self._last[kind] = now
        logger.warning("places_guard_tripped kind=%s %s refused_since_last_log=%d", kind, detail, skipped)

    def reset(self) -> None:
        with self._lock:
            self._last.clear()
            self._suppressed.clear()


places_ceiling = HourlyCeiling()
places_concurrency = ConcurrencyCap()
trip_log = TripLog()


def reset_all() -> None:
    places_ceiling.reset()
    places_concurrency.reset()
    trip_log.reset()
