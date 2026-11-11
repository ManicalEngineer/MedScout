"""ZIP → named area, from data/zip_areas.csv (built by scripts/build_zip_areas.py
from Census Bureau files).

An area is a metropolitan/micropolitan statistical area ("Albany-Schenectady-
Troy, NY", code "m10580") or, for a ZIP outside any, its county ("Essex County,
NY", code "c36031"). ZIPs missing from the Census file (PO-box-only ZIPs and the
like) fall back to the area most ZIPs sharing their first three digits are in.
"""
import csv
import os
from functools import lru_cache
from typing import NamedTuple, Optional

_PATH = os.path.join(os.path.dirname(__file__), "data", "zip_areas.csv")


class Area(NamedTuple):
    code: str
    name: str


@lru_cache(maxsize=1)
def _table() -> tuple[dict[str, Area], dict[str, str]]:
    by_key: dict[str, Area] = {}
    names: dict[str, str] = {}
    with open(_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            area = Area(row["area_code"], row["area_name"])
            by_key[row["key"]] = area
            names[area.code] = area.name
    return by_key, names


def area_for_zip(zip_code: Optional[str]) -> Optional[Area]:
    if not zip_code or len(zip_code) != 5 or not zip_code.isdigit():
        return None
    by_key, _ = _table()
    return by_key.get(zip_code) or by_key.get(zip_code[:3])


def area_name(code: str) -> Optional[str]:
    return _table()[1].get(code)
