"""token_version_and_report_geo_indexes

Revision ID: b7d41c2f8a03
Revises: 9c8f78bf58fb
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d41c2f8a03'
down_revision: Union[str, Sequence[str], None] = '9c8f78bf58fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('token_version', sa.Integer(), nullable=False, server_default='0')
        )

    op.create_index('ix_availability_reports_latitude', 'availability_reports', ['latitude'])
    op.create_index('ix_availability_reports_longitude', 'availability_reports', ['longitude'])


def downgrade() -> None:
    op.drop_index('ix_availability_reports_longitude', table_name='availability_reports')
    op.drop_index('ix_availability_reports_latitude', table_name='availability_reports')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('token_version')
