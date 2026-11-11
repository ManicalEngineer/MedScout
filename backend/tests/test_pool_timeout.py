"""A QueuePool TimeoutError is a 503 with Retry-After, not an unhandled 500."""
import logging

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import database
import main
from conftest import register
from errors import DB_BUSY_MESSAGE


def tiny_pool_sessionmaker():
    eng = create_engine(database.DATABASE_URL, connect_args={"check_same_thread": False},
                        pool_size=1, max_overflow=0, pool_timeout=0.2)
    return eng, sessionmaker(autocommit=False, autoflush=False, bind=eng)


def test_exhausted_pool_gives_503_retry_after_and_a_warning(client, monkeypatch, caplog):
    auth = register(client, "a@test.com")                           # real user + token, normal pool
    eng, Session = tiny_pool_sessionmaker()
    monkeypatch.setattr(database, "SessionLocal", Session)
    hog = eng.connect()                                             # the pool's only connection is in use
    try:
        with caplog.at_level(logging.WARNING, logger="errors"):
            r = client.get("/api/v1/users/me", headers=auth)       # dependency query waits 0.2s, then times out
        assert r.status_code == 503
        assert r.json() == {"detail": DB_BUSY_MESSAGE}
        assert r.headers["Retry-After"] == "5"
        assert any("db_pool_timeout path=/api/v1/users/me" in m for m in caplog.messages)
        # an unauthenticated route that touches the DB is covered the same way
        r2 = client.post("/api/v1/auth/login", data={"username": "a@test.com", "password": "password123"})
        assert r2.status_code == 503 and r2.headers["Retry-After"] == "5"
    finally:
        hog.close()
    # pool free again: same request now succeeds
    assert client.get("/api/v1/users/me", headers=auth).status_code == 200
    eng.dispose()


def test_other_errors_are_not_swallowed_by_the_handler():
    c = TestClient(main.app, raise_server_exceptions=False)

    @main.app.get("/__boom")
    def boom():
        raise RuntimeError("not a pool timeout")

    try:
        assert c.get("/__boom").status_code == 500
    finally:
        main.app.router.routes = [r for r in main.app.router.routes if getattr(r, "path", "") != "/__boom"]
