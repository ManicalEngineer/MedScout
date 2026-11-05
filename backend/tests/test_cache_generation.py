"""clear() invalidates in-flight loads."""
import threading
import time

import caches
from cache_util import TTLCache


def _slow_loader(gate, value, entered=None):
    def loader():
        if entered:
            entered.set()
        gate.wait(5)
        return value, None
    return loader


def test_load_started_before_clear_is_not_stored():
    c = TTLCache("t", maxsize=5, ttl=100)
    gate, entered, out = threading.Event(), threading.Event(), []
    t = threading.Thread(target=lambda: out.append(c.get_or_load("k", _slow_loader(gate, "stale", entered))))
    t.start()
    assert entered.wait(3)
    c.clear()
    gate.set()
    t.join()
    assert out == ["stale"]                                   # the caller itself still gets its answer
    assert c.stats()["size"] == 0                             # but it is not kept
    assert c.get_or_load("k", lambda: ("fresh", None)) == "fresh"


def test_callers_after_clear_do_not_join_the_old_flight():
    c = TTLCache("t", maxsize=5, ttl=100)
    gate, entered = threading.Event(), threading.Event()
    old = []
    t = threading.Thread(target=lambda: old.append(c.get_or_load("k", _slow_loader(gate, "stale", entered))))
    t.start()
    assert entered.wait(3)
    c.clear()
    t0 = time.monotonic()
    assert c.get_or_load("k", lambda: ("fresh", None)) == "fresh"   # did not wait for the old load
    assert time.monotonic() - t0 < 1
    gate.set()
    t.join()
    assert c.get_or_load("k", lambda: ("other", None)) == "fresh"    # the fresh value survived the old leader finishing


def test_old_leader_finishing_does_not_remove_a_newer_flight():
    c = TTLCache("t", maxsize=5, ttl=100)
    gate_old, entered_old = threading.Event(), threading.Event()
    gate_new, entered_new = threading.Event(), threading.Event()
    t_old = threading.Thread(target=lambda: c.get_or_load("k", _slow_loader(gate_old, "stale", entered_old)))
    t_old.start()
    assert entered_old.wait(3)
    c.clear()
    got = []
    t_new = threading.Thread(target=lambda: got.append(c.get_or_load("k", _slow_loader(gate_new, "fresh", entered_new))))
    t_new.start()
    assert entered_new.wait(3)
    gate_old.set()
    t_old.join()                                              # old leader finishes while the new flight is open
    calls = []
    joiner = threading.Thread(target=lambda: got.append(c.get_or_load("k", lambda: calls.append(1) or ("dup", None))))
    joiner.start()
    time.sleep(0.2)
    gate_new.set()
    t_new.join()
    joiner.join()
    assert calls == [] and got == ["fresh", "fresh"]          # the joiner still coalesced onto the new flight


def test_waiter_already_on_old_flight_still_gets_its_result():
    c = TTLCache("t", maxsize=5, ttl=100)
    gate, entered, got = threading.Event(), threading.Event(), []
    t1 = threading.Thread(target=lambda: got.append(c.get_or_load("k", _slow_loader(gate, "v", entered))))
    t1.start()
    assert entered.wait(3)
    t2 = threading.Thread(target=lambda: got.append(c.get_or_load("k", lambda: ("direct", None))))
    t2.start()
    time.sleep(0.2)
    c.clear()
    gate.set()
    t1.join()
    t2.join()
    assert got == ["v", "v"]


def test_clear_all_resets_every_shared_cache_generation():
    for cache in (caches.shortage_cache, caches.heatmap_cache, caches.map_community_cache):
        gate, entered = threading.Event(), threading.Event()
        t = threading.Thread(target=lambda c=cache: c.get_or_load("x", _slow_loader(gate, "stale", entered)))
        t.start()
        assert entered.wait(3)
        caches.clear_all()
        gate.set()
        t.join()
        assert cache.stats()["size"] == 0
