"""report flags, hidden contributors, report contributor link, apple refresh token

Revision ID: c3a91e5d7f20
Revises: fa6a9bca27a5
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3a91e5d7f20'
down_revision: Union[str, Sequence[str], None] = 'fa6a9bca27a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('apple_refresh_token', sa.String(), nullable=True))

    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.add_column(sa.Column('contributor_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('hidden_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_foreign_key('fk_reports_contributor', 'users', ['contributor_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_availability_reports_contributor_id', ['contributor_id'])
        batch_op.create_index('ix_availability_reports_hidden_at', ['hidden_at'])

    op.create_table(
        'report_flags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('availability_reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('report_id', 'reporter_id', name='uq_report_flag_once'),
    )
    op.create_index('ix_report_flags_id', 'report_flags', ['id'])
    op.create_index('ix_report_flags_report_id', 'report_flags', ['report_id'])
    op.create_index('ix_report_flags_reporter_id', 'report_flags', ['reporter_id'])

    op.create_table(
        'hidden_contributors',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contributor_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'contributor_id', name='uq_hidden_contributor_once'),
    )
    op.create_index('ix_hidden_contributors_id', 'hidden_contributors', ['id'])
    op.create_index('ix_hidden_contributors_user_id', 'hidden_contributors', ['user_id'])
    op.create_index('ix_hidden_contributors_contributor_id', 'hidden_contributors', ['contributor_id'])


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('apple_refresh_token')
    op.drop_table('hidden_contributors')
    op.drop_table('report_flags')
    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.drop_index('ix_availability_reports_hidden_at')
        batch_op.drop_index('ix_availability_reports_contributor_id')
        batch_op.drop_constraint('fk_reports_contributor', type_='foreignkey')
        batch_op.drop_column('hidden_at')
        batch_op.drop_column('contributor_id')
