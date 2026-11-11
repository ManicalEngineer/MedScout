"""optional nicknames (unique ignoring case) and a gamification on/off toggle

Revision ID: a91c4e7d2f58
Revises: f3b8d1e6a274
Create Date: 2026-11-10 22:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91c4e7d2f58"
down_revision: Union[str, Sequence[str], None] = "f3b8d1e6a274"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("nickname", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("gamification_enabled", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_index("uq_users_nickname_lower", "users", [sa.text("lower(nickname)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_nickname_lower", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("gamification_enabled")
        batch.drop_column("nickname")
