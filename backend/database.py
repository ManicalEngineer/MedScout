import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./adhd_buddy.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
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
