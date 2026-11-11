"""badges, monthly streaks and per-ZIP founding slots

Revision ID: f3b8d1e6a274
Revises: e4c1a8b2d905
Create Date: 2026-11-10 20:00:00.000000

Backfill for users who contributed before this shipped:
- Founding Contributor: every existing contributor gets it. They are by
  definition the earliest, but which ZIPs they reported in was never linked to
  them, so the badge is awarded without taking a ZIP's slot, and
  founding_checked is set so they don't also claim one later.
- Volume badges from badge_credits; Made the Call from their own contributed
  call logs.
- Streak: only the month of last_contribution_at is known, so the streak starts
  at 1 in that month.
Badges are dated the day the migration runs.
"""
from datetime import date, datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3b8d1e6a274"
down_revision: Union[str, Sequence[str], None] = "e4c1a8b2d905"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mirrors gamification.BADGES at the time of writing; a migration must not
# change meaning if the code's thresholds change later.
VOLUME_THRESHOLDS = {"first_report": 1, "pup": 10, "tracker": 50, "bloodhound": 250}


def upgrade() -> None:
    op.create_table(
        "user_badges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("badge_key", sa.String(length=40), nullable=False),
        sa.Column("awarded_on", sa.Date(), nullable=False),
        sa.UniqueConstraint("user_id", "badge_key", name="uq_user_badge_once"),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])
    op.create_table(
        "founding_slots",
        sa.Column("zip_code", sa.String(length=5), primary_key=True),
        sa.Column("claimed", sa.Integer(), nullable=False, server_default="0"),
    )
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("current_streak_months", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("longest_streak_months", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("last_streak_month", sa.Date(), nullable=True))
        batch.add_column(sa.Column("founding_checked", sa.Boolean(), nullable=False, server_default=sa.false()))

    bind = op.get_bind()
    today = datetime.now(timezone.utc).date()
    users = bind.execute(sa.text(
        "SELECT id, badge_credits, last_contribution_at FROM users WHERE contribution_count > 0"
    )).all()
    callers = {uid for (uid,) in bind.execute(sa.text(
        "SELECT DISTINCT user_id FROM call_logs WHERE contributed_to_community "
        "AND medication_name IS NOT NULL AND medication_name <> ''"
    ))}

    users_t = sa.table(
        "users", sa.column("id", sa.Integer), sa.column("founding_checked", sa.Boolean),
        sa.column("current_streak_months", sa.Integer), sa.column("longest_streak_months", sa.Integer),
        sa.column("last_streak_month", sa.Date),
    )
    badges_t = sa.table(
        "user_badges", sa.column("user_id", sa.Integer), sa.column("badge_key", sa.String),
        sa.column("awarded_on", sa.Date),
    )
    badge_rows = []
    for uid, credits, last_at in users:
        values = {"founding_checked": True}
        if last_at is not None:
            if isinstance(last_at, str):  # SQLite returns timestamps as text
                last_at = datetime.fromisoformat(last_at)
            if last_at.tzinfo is not None:
                last_at = last_at.astimezone(timezone.utc)
            values.update(current_streak_months=1, longest_streak_months=1,
                          last_streak_month=date(last_at.year, last_at.month, 1))
        bind.execute(users_t.update().where(users_t.c.id == uid).values(**values))

        keys = ["founding_contributor"]
        keys += [k for k, need in VOLUME_THRESHOLDS.items() if (credits or 0) >= need]
        if uid in callers:
            keys.append("made_the_call")
        badge_rows += [{"user_id": uid, "badge_key": k, "awarded_on": today} for k in keys]
    if badge_rows:
        op.bulk_insert(badges_t, badge_rows)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("founding_checked")
        batch.drop_column("last_streak_month")
        batch.drop_column("longest_streak_months")
        batch.drop_column("current_streak_months")
    op.drop_table("founding_slots")
    op.drop_index("ix_user_badges_user_id", table_name="user_badges")
    op.drop_table("user_badges")
