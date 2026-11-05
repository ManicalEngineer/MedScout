"""Small in-process TTL + LRU cache with single-flight loading.

Per-process only (the API runs one worker); a restart empties it. Counters are
logged to the "medscout.cache" logger, which has its own stderr handler so the
lines reach journald without changing global log levels:

    journalctl -u medscout-backend | grep 'cache name='
"""
import logging
import sys
import threading
import time
from collections import OrderedDict

logger = logging.getLogger("medscout.cache")
if not logger.handlers:
    _h = logging.StreamHandler(sys.stderr)
    _h.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)
    logger.propagate = False

SUMMARY_EVERY = 100  # lookups between summary lines


class TTLCache:
    def __init__(self, name: str, maxsize: int, ttl: float):
        self.name, self.maxsize, self.ttl = name, maxsize, ttl
        self._data: OrderedDict = OrderedDict()  # key -> (expires_at, value)
        self._lock = threading.Lock()
        self._inflight: dict = {}
        self._generation = 0  # bumped by clear(); a load only stores if it started in the current one
        self.hits = 0
        self.misses = 0
        self.coalesced = 0
        self.wait_timeouts = 0

    def _get(self, key):
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return False, None
            if item[0] <= time.monotonic():
                del self._data[key]
                return False, None
            self._data.move_to_end(key)
            return True, item[1]

    def set(self, key, value, ttl: float | None = None) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + (self.ttl if ttl is None else ttl), value)
            self._data.move_to_end(key)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)  # least recently used

    def _set_if_current(self, key, value, ttl, generation) -> None:
        with self._lock:
            if generation != self._generation:
                return  # cleared while loading: this value may predate whatever the clear was for
            self._data[key] = (time.monotonic() + (self.ttl if ttl is None else ttl), value)
            self._data.move_to_end(key)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        """Drop everything, including in-flight loads: a load that started before
        this call will not be stored when it finishes, and callers arriving after
        it start a fresh load instead of joining the old one. (Callers already
        waiting on an old load still receive its result; they asked before.)"""
        with self._lock:
            self._generation += 1
            self._inflight.clear()
            self._data.clear()
            self.hits = self.misses = self.coalesced = self.wait_timeouts = 0

    def stats(self) -> dict:
        with self._lock:
            return {"name": self.name, "hits": self.hits, "misses": self.misses, "coalesced": self.coalesced, "wait_timeouts": self.wait_timeouts, "size": len(self._data)}

    def _count(self, result: str) -> None:
        with self._lock:
            if result == "hit":
                self.hits += 1
            elif result == "miss":
                self.misses += 1
            elif result == "coalesced":
                self.coalesced += 1
            else:
                self.wait_timeouts += 1
            total = self.hits + self.misses + self.coalesced
            line = (f"cache name={self.name} result={result} hits={self.hits} "
                    f"misses={self.misses} coalesced={self.coalesced} wait_timeouts={self.wait_timeouts} size={len(self._data)}")
        if result != "hit" or total % SUMMARY_EVERY == 0:
            logger.info(line)

    def get_or_load(self, key, loader, *, wait_timeout=None, on_timeout="load", on_wait=None):
        """Return the cached value, or call loader() -> (value, ttl) once even
        when many threads ask for the same key at the same moment.

        Concurrent callers for a key being loaded wait for that one call and
        share its result. ttl=None uses the cache default; ttl <= 0 means the
        value is NOT stored: it lives only as long as the callers that were
        waiting on it hold a reference, so with ttl=0 this is pure request
        coalescing and nothing is retained afterwards. A loader exception is
        raised to every waiter and nothing is stored.

        Waiters give up after wait_timeout seconds (None = wait forever): with
        on_timeout="load" they run loader() themselves, unshared and unstored;
        with on_timeout="raise" they get FlightTimeout. on_wait() is called just
        before a waiter blocks, e.g. to hand back a pooled DB connection."""
        hit, value = self._get(key)
        if hit:
            self._count("hit")
            return value
        with self._lock:
            flight = self._inflight.get(key)
            leader = flight is None
            if leader:
                flight = self._inflight[key] = _Flight()
                generation = self._generation
        if not leader:
            if on_wait is not None:
                on_wait()
            if not flight.done.wait(wait_timeout):
                self._count("wait_timeout")
                if on_timeout == "raise":
                    raise FlightTimeout(f"{self.name}: waited {wait_timeout}s for an in-flight load")
                value, _ttl = loader()
                return value
            self._count("coalesced")
            if flight.error is not None:
                raise flight.error
            return flight.value
        try:
            self._count("miss")
            value, ttl = loader()
            if ttl is None or ttl > 0:
                self._set_if_current(key, value, ttl, generation)
            flight.value = value
            return value
        except BaseException as e:
            flight.error = e
            raise
        finally:
            with self._lock:
                if self._inflight.get(key) is flight:  # clear() may have replaced it
                    del self._inflight[key]
            flight.done.set()


class FlightTimeout(Exception):
    """A waiter gave up on an in-flight load."""


class _Flight:
    def __init__(self):
        self.done = threading.Event()
        self.value = None
        self.error = None
