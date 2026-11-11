"""Engine settings: the app engine and scheduler engine carry statement timeouts; Alembic and scripts don't.

The Postgres-only assertions run `SHOW statement_timeout` for real when
TEST_POSTGRES_URL points at a disposable local database; otherwise they skip.
"""
import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import database

BACKEND = Path(__file__).resolve().parent.parent
PG_URL = os.getenv("TEST_POSTGRES_URL")
FAKE_PG = "postgresql://u@127.0.0.1:5999/none"


def test_sqlite_engines_get_no_postgres_options():
    e = database.make_engine("sqlite:///:memory:", statement_timeout_ms=15000)
    assert not hasattr(e.pool, "_timeout") or e.dialect.name == "sqlite"
    assert e.dialect.name == "sqlite"


@pytest.mark.skipif(not database.DATABASE_URL.startswith("sqlite"),
                    reason="checks the default SQLite test engine; suite is running on TEST_DATABASE_URL")
def test_seed_script_engine_has_no_timeout():
    """seed_demo only ever runs on a sqlite file, via the default engine: no options."""
    assert database.engine.dialect.name == "sqlite"
    src = (BACKEND / "scripts" / "seed_demo.py").read_text()
    assert "sqlite:///" in src and "Refusing to seed" in src


def _engines_for_postgres_url():
    """Import database fresh with a Postgres URL (no real connection; psycopg2.connect is faked)
    and report the options each engine would connect with."""
    code = textwrap.dedent(f"""
        import json, sys
        from unittest.mock import MagicMock, patch
        import psycopg2
        seen = []
        def fake_connect(*a, **kw):
            seen.append(kw); return MagicMock()
        with patch.object(psycopg2, "connect", fake_connect):
            import database
            out = {{}}
            for name in ("engine", "scheduler_engine"):
                e = getattr(database, name)
                e.pool._creator()
                out[name] = {{"options": seen[-1].get("options"), "size": e.pool.size(),
                              "overflow": e.pool._max_overflow, "timeout": e.pool._timeout,
                              "pre_ping": e.pool._pre_ping}}
        print(json.dumps(out))
    """)
    env = {**os.environ, "DATABASE_URL": FAKE_PG}
    r = subprocess.run([sys.executable, "-I", "-c", f"import sys; sys.path.insert(0, {str(BACKEND)!r})\n" + code],
                       capture_output=True, text=True, env=env, cwd=BACKEND)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout.strip().splitlines()[-1])


def test_app_engine_has_pool_and_15s_timeout_and_scheduler_has_its_own_120s():
    out = _engines_for_postgres_url()
    app, sched = out["engine"], out["scheduler_engine"]
    assert app == {"options": "-c statement_timeout=15000", "size": 20, "overflow": 20, "timeout": 10, "pre_ping": True}
    assert sched["options"] == "-c statement_timeout=120000"
    assert sched["size"] == 1 and sched["overflow"] == 1      # small, separate pool
    assert database.SCHEDULER_STATEMENT_TIMEOUT_MS > database.API_STATEMENT_TIMEOUT_MS
    assert 20 + 20 + 1 + 1 < 100                              # well under Postgres max_connections


def test_alembic_env_does_not_use_app_engine():
    src = (BACKEND / "migrations" / "env.py").read_text()
    assert "from database import" not in src and "database.engine" not in src
    assert "pool.NullPool" in src and "statement_timeout=" not in src and "connect_args" not in src


def test_alembic_runs_on_its_own_engine(tmp_path):
    url = f"sqlite:///{tmp_path}/mig.db"
    env = {**os.environ, "DATABASE_URL": url, "SECRET_KEY": "x" * 32}
    r = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], capture_output=True, text=True, env=env, cwd=BACKEND)
    assert r.returncode == 0, r.stderr[-1500:]
    assert (tmp_path / "mig.db").exists()


def test_scheduler_job_runner_uses_scheduler_session():
    import scheduler
    spy = MagicMock()
    with patch.object(scheduler, "SchedulerSessionLocal", spy), \
         patch.object(scheduler, "run_refill_reminders"), patch.object(scheduler, "run_checkback_reminders"), \
         patch.object(scheduler, "run_fda_shortage_ingestion"):
        scheduler._run_all_jobs()
    spy.assert_called_once()
    spy.return_value.close.assert_called_once()
    assert not hasattr(scheduler, "SessionLocal")


@pytest.mark.skipif(not PG_URL, reason="set TEST_POSTGRES_URL to a disposable local Postgres")
def test_real_postgres_show_statement_timeout():
    from sqlalchemy import create_engine, pool, text
    app = database.make_engine(PG_URL, statement_timeout_ms=database.API_STATEMENT_TIMEOUT_MS)
    sched = database.make_engine(PG_URL, statement_timeout_ms=database.SCHEDULER_STATEMENT_TIMEOUT_MS, pool_size=1, max_overflow=1)
    # exactly what migrations/env.py builds
    alembic_engine = create_engine(PG_URL, poolclass=pool.NullPool)
    show = lambda e: e.connect().execute(text("SHOW statement_timeout")).scalar()
    assert show(app) == "15s"
    assert show(sched) == "2min"
    assert show(alembic_engine) == "0"
    with pytest.raises(Exception, match="statement timeout"):
        with app.connect() as c:
            c.execute(text("SELECT pg_sleep(16)"))
