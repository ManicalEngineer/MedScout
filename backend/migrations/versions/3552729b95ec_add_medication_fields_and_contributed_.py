"""add medication fields and contributed report link to call_logs

Revision ID: 3552729b95ec
Revises: b7d41c2f8a03
Create Date: 2026-07-23 16:48:08.946693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3552729b95ec'
down_revision: Union[str, Sequence[str], None] = 'b7d41c2f8a03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.add_column(sa.Column('medication_name', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('strength', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('contributed_report_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_call_logs_contributed_report_id', 'availability_reports', ['contributed_report_id'], ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.drop_constraint('fk_call_logs_contributed_report_id', type_='foreignkey')
        batch_op.drop_column('contributed_report_id')
        batch_op.drop_column('strength')
        batch_op.drop_column('medication_name')
