"""refill countdown per profile

Revision ID: 0ae20ec49814
Revises: 5fb582ffff19
Create Date: 2026-06-08 22:17:23.085858

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0ae20ec49814'
down_revision: Union[str, Sequence[str], None] = '5fb582ffff19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.alter_column('medication_profile_id', existing_type=sa.INTEGER(), nullable=False)
        batch_op.drop_column('user_id')  # remove old unique constraint carrier; user_id kept as FK only
        batch_op.create_unique_constraint('uq_refill_countdown_profile', ['medication_profile_id'])
    # Re-add user_id as plain FK (non-unique)
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.INTEGER(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.drop_constraint('uq_refill_countdown_profile', type_='unique')
        batch_op.alter_column('medication_profile_id', existing_type=sa.INTEGER(), nullable=True)
