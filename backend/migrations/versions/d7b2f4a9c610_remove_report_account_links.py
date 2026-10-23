"""remove every link between community reports and accounts

Drops availability_reports.contributor_id, hidden_contributors, and
call_logs.contributed_report_id so no row ties a community report to the
account (or private call log) that produced it. Data in those columns is
discarded; the downgrade restores empty columns only.

Revision ID: d7b2f4a9c610
Revises: c3a91e5d7f20
Create Date: 2026-10-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7b2f4a9c610'
down_revision: Union[str, Sequence[str], None] = 'c3a91e5d7f20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('hidden_contributors')

    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.drop_index('ix_availability_reports_contributor_id')
        batch_op.drop_constraint('fk_reports_contributor', type_='foreignkey')
        batch_op.drop_column('contributor_id')

    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.drop_constraint('fk_call_logs_contributed_report_id', type_='foreignkey')
        batch_op.drop_column('contributed_report_id')


def downgrade() -> None:
    with op.batch_alter_table('call_logs') as batch_op:
        batch_op.add_column(sa.Column('contributed_report_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_call_logs_contributed_report_id', 'availability_reports', ['contributed_report_id'], ['id']
        )

    with op.batch_alter_table('availability_reports') as batch_op:
        batch_op.add_column(sa.Column('contributor_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_reports_contributor', 'users', ['contributor_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_availability_reports_contributor_id', ['contributor_id'])

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
