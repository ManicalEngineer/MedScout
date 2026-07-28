"""per-medication alert subscriptions

Revision ID: fbed5783c864
Revises: 7c9d2e4f1a6b
Create Date: 2026-07-29

Restock alerts move from a single account-wide medication_name/strength on
alert_settings (opt-out by default) to a proper subscription table: one row
per user per medication they've explicitly opted into alerts for. Existence
of a row is the subscription; there's no separate enabled flag.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "fbed5783c864"
down_revision: Union[str, Sequence[str], None] = "7c9d2e4f1a6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medication_alert_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("medication_name", sa.String(), nullable=False),
        sa.Column("strength", sa.String(), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "medication_name", "strength", name="uq_alert_sub_user_med"),
    )

    # Backfill: anyone who had alerts on for a medication under the old
    # single-slot model keeps their subscription, grandfathered in as
    # already-consented (they already opted in once). NOTE: bare `enabled`,
    # not `enabled = 1` — Postgres booleans don't compare against integer
    # literals like SQLite's lenient storage does.
    op.execute("""
        INSERT INTO medication_alert_subscriptions (user_id, medication_name, strength, consented_at)
        SELECT user_id, medication_name, strength, updated_at
        FROM alert_settings
        WHERE enabled AND medication_name IS NOT NULL AND strength IS NOT NULL
    """)

    with op.batch_alter_table("alert_settings") as batch_op:
        batch_op.drop_column("medication_name")
        batch_op.drop_column("strength")
        batch_op.drop_column("enabled")


def downgrade() -> None:
    raise RuntimeError(
        "medication_alert_subscriptions supports multiple subscriptions per "
        "user and can't be losslessly collapsed back into a single "
        "medication_name/strength column pair; restore from a database "
        "backup instead"
    )
