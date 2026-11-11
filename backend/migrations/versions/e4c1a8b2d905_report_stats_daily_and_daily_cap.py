"""report_stats_daily area tally + per-user badge credits with a daily cap

Revision ID: e4c1a8b2d905
Revises: d7b2f4a9c610
Create Date: 2026-11-10 19:00:00.000000

Backfills report_stats_daily from the community reports that already exist and
aren't hidden, under channel "backfill" (the original channel isn't recorded on
a report), with each row's named area from areas.py. Days are UTC.

Existing users start with badge_credits = contribution_count: their history
predates the daily cap, so it isn't applied retroactively.
"""
from datetime import date
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from areas import area_for_zip


revision: str = "e4c1a8b2d905"
down_revision: Union[str, Sequence[str], None] = "d7b2f4a9c610"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_stats_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("zip_code", sa.String(length=5), nullable=False, server_default=""),
        sa.Column("area_code", sa.String(length=8), nullable=False, server_default=""),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("day", "channel", "zip_code", name="uq_report_stats_bucket"),
    )
    op.create_index("ix_report_stats_daily_day", "report_stats_daily", ["day"])
    op.create_index("ix_report_stats_daily_area_code", "report_stats_daily", ["area_code"])

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("badge_credits", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("contribution_day", sa.Date(), nullable=True))
        batch.add_column(
            sa.Column("contributions_today", sa.Integer(), nullable=False, server_default="0")
        )

    op.execute("UPDATE users SET badge_credits = contribution_count")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        day_expr = "(reported_at AT TIME ZONE 'UTC')::date"
    else:
        day_expr = "date(reported_at)"
    buckets = bind.execute(sa.text(
        f"""
        SELECT {day_expr} AS day, COALESCE(zip_code, '') AS zip_code, COUNT(*) AS n
        FROM availability_reports
        WHERE source = 'community' AND hidden_at IS NULL AND reported_at IS NOT NULL
        GROUP BY {day_expr}, COALESCE(zip_code, '')
        """
    )).all()
    stats = sa.table(
        "report_stats_daily",
        sa.column("day", sa.Date), sa.column("channel", sa.String),
        sa.column("zip_code", sa.String), sa.column("area_code", sa.String),
        sa.column("count", sa.Integer),
    )
    rows = []
    for day, zip_code, n in buckets:
        if isinstance(day, str):  # SQLite returns date() as text
            day = date.fromisoformat(day)
        area = area_for_zip(zip_code)
        rows.append({"day": day, "channel": "backfill", "zip_code": zip_code,
                     "area_code": area.code if area else "", "count": n})
    if rows:
        op.bulk_insert(stats, rows)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("contributions_today")
        batch.drop_column("contribution_day")
        batch.drop_column("badge_credits")
    op.drop_index("ix_report_stats_daily_area_code", table_name="report_stats_daily")
    op.drop_index("ix_report_stats_daily_day", table_name="report_stats_daily")
    op.drop_table("report_stats_daily")
