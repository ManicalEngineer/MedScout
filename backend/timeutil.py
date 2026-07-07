"""Timezone helpers — all backend datetimes are aware UTC.

SQLite hands back naive datetimes and Postgres hands back aware ones;
`ensure_utc` normalizes both so comparisons never mix naive and aware.
"""
from datetime import datetime, timezone
from typing import Optional

UTC_MIN = datetime.min.replace(tzinfo=timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
