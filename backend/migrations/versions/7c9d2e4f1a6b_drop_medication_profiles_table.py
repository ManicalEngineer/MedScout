"""drop obsolete medication_profiles table

Revision ID: 7c9d2e4f1a6b
Revises: 2b23fffe2647
Create Date: 2026-07-28

Medication profiles are now stored on-device. The table is no longer read by
any backend code and is removed after the mobile rollout/adoption decision.
This migration is intentionally forward-only: restoring the table would not
restore its former per-profile data.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "7c9d2e4f1a6b"
down_revision: Union[str, Sequence[str], None] = "2b23fffe2647"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("medication_profiles")


def downgrade() -> None:
    raise RuntimeError(
        "medication_profiles was intentionally dropped; restore from a database backup instead"
    )
