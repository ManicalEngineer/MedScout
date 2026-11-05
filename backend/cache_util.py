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
        self.hits = 0
        self.misses = 0

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

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self.hits = self.misses = 0

    def stats(self) -> dict:
        with self._lock:
            return {"name": self.name, "hits": self.hits, "misses": self.misses, "size": len(self._data)}

    def _count(self, hit: bool) -> None:
        with self._lock:
            if hit:
                self.hits += 1
            else:
                self.misses += 1
            total = self.hits + self.misses
            line = (f"cache name={self.name} result={'hit' if hit else 'miss'} "
                    f"hits={self.hits} misses={self.misses} size={len(self._data)}")
        if not hit or total % SUMMARY_EVERY == 0:
            logger.info(line)

    def get_or_load(self, key, loader):
        """Return the cached value, or call loader() -> (value, ttl) once even
        when many threads ask for the same key at the same moment."""
        hit, value = self._get(key)
        if hit:
            self._count(True)
            return value
        with self._lock:
            entry = self._inflight.setdefault(key, [threading.Lock(), 0])
            entry[1] += 1
        try:
            with entry[0]:
                hit, value = self._get(key)
                if hit:
                    self._count(True)  # another thread loaded it while we waited
                    return value
                self._count(False)
                value, ttl = loader()
                self.set(key, value, ttl)
                return value
        finally:
            with self._lock:
                entry[1] -= 1
                if entry[1] == 0:
                    self._inflight.pop(key, None)
