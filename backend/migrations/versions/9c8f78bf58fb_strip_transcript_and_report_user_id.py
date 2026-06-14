"""strip_transcript_and_report_user_id

Revision ID: 9c8f78bf58fb
Revises: 0ae20ec49814
Create Date: 2026-06-09 21:42:14.397755

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c8f78bf58fb'
down_revision: Union[str, Sequence[str], None] = '0ae20ec49814'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.drop_column('user_id')

    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.drop_column('transcript')
        batch_op.drop_column('ai_summary')
        batch_op.drop_column('extracted_strength')
        batch_op.drop_column('extracted_restock_date')
        batch_op.drop_column('notes')
        batch_op.drop_column('duration_seconds')


def downgrade() -> None:
    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.add_column(sa.Column('duration_seconds', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column('extracted_restock_date', sa.DATE(), nullable=True))
        batch_op.add_column(sa.Column('extracted_strength', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('ai_summary', sa.VARCHAR(), nullable=True))
        batch_op.add_column(sa.Column('transcript', sa.TEXT(), nullable=True))

    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.INTEGER(), nullable=True))
