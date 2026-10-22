"""add user contribution_count

Revision ID: fa6a9bca27a5
Revises: fbed5783c864
Create Date: 2026-10-12 09:26:33.180162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa6a9bca27a5'
down_revision: Union[str, Sequence[str], None] = 'fbed5783c864'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('contribution_count', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'contribution_count')
