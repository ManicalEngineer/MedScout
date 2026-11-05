"""Process-wide caches for reads that are identical for every user.

Never put anything user-specific in here (saved pharmacies, call logs, flagged
reports, tier). Handlers apply their per-user filtering after the lookup.
Per-process: a restart empties them, and with one Uvicorn worker there is one copy.
"""
from cache_util import TTLCache

# Daily openFDA data; the scheduler job clears it after it updates.
shortage_cache = TTLCache("shortage_status", maxsize=500, ttl=600)
# 30-day aggregate by zip.
heatmap_cache = TTLCache("heatmap", maxsize=200, ttl=300)
# Newest community reports for a (sources, medication, strength, zip) query.
map_community_cache = TTLCache("map_community", maxsize=300, ttl=45)


def clear_all() -> None:
    for c in (shortage_cache, heatmap_cache, map_community_cache):
        c.clear()
