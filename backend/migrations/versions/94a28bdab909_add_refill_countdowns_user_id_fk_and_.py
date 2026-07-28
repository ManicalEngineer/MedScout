"""add refill_countdowns user_id fk and not null

Revision ID: 94a28bdab909
Revises: 3b6621c306ac
Create Date: 2026-07-24 23:29:33.609934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94a28bdab909'
down_revision: Union[str, Sequence[str], None] = '3b6621c306ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 0ae20ec49814 re-added refill_countdowns.user_id as a plain column but
    # never actually added the FK/NOT NULL its own comment promised — close
    # that gap now that no NULL rows exist to backfill.
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.alter_column('user_id', existing_type=sa.INTEGER(), nullable=False)
        batch_op.create_foreign_key(
            'fk_refill_countdowns_user_id_users', 'users', ['user_id'], ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.drop_constraint('fk_refill_countdowns_user_id_users', type_='foreignkey')
        batch_op.alter_column('user_id', existing_type=sa.INTEGER(), nullable=True)
