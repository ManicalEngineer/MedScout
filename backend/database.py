import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./adhd_buddy.db")

API_STATEMENT_TIMEOUT_MS = 15_000        # request handlers: fail fast, free the connection
SCHEDULER_STATEMENT_TIMEOUT_MS = 120_000  # daily jobs scan more and are not user-facing


def make_engine(url: str, *, statement_timeout_ms: int | None = None, pool_size: int = 20, max_overflow: int = 20):
    """Engine for `url`. SQLite (dev/tests) gets none of the Postgres options.

    Alembic and one-off scripts deliberately do not use this: migrations must not
    be subject to a statement timeout (see migrations/env.py)."""
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    connect_args = {}
    if statement_timeout_ms is not None:
        connect_args["options"] = f"-c statement_timeout={statement_timeout_ms}"
    return create_engine(
        url,
        connect_args=connect_args,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=10,
        pool_pre_ping=True,
    )


# Postgres max_connections is 100: 40 here + 2 for the scheduler leaves ample
# room for Alembic, pg_dump and psql.
engine = make_engine(DATABASE_URL, statement_timeout_ms=API_STATEMENT_TIMEOUT_MS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Own engine and pool so the longer timeout never rides on a connection that
# later serves an API request.
scheduler_engine = make_engine(
    DATABASE_URL, statement_timeout_ms=SCHEDULER_STATEMENT_TIMEOUT_MS, pool_size=1, max_overflow=1
)
SchedulerSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=scheduler_engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def release_connection(db) -> None:
    """End the session's open transaction so its connection returns to the pool
    before a slow outbound call. Only call with no pending writes: it rolls back.
    ORM objects loaded earlier are expired, so copy what you need first."""
    db.rollback()
