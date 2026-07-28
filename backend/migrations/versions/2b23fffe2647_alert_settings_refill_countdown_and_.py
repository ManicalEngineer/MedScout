"""alert_settings, refill_countdown medication_name, and tracked_medications

Revision ID: 2b23fffe2647
Revises: 1997d5549d18
Create Date: 2026-07-28 08:00:00.000000

Moves medication profiles on-device: AlertSettings and RefillCountdown gain
their own medication_name (and strength, for AlertSettings) instead of
joining medication_profiles, and a new user-less tracked_medications table
replaces medication_profiles as the source for FDA shortage ingestion.
medication_profiles itself is left in place for now (dropped in a later
migration once mobile has shipped and stopped calling its endpoints).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b23fffe2647'
down_revision: Union[str, Sequence[str], None] = '1997d5549d18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('alert_settings') as batch_op:
        batch_op.add_column(sa.Column('medication_name', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('strength', sa.String(), nullable=True))

    # Backfill from each user's active medication profile so existing alert
    # subscribers keep matching without re-entering anything.
    # NOTE: `is_active` (not `is_active = 1`) — Postgres booleans don't
    # compare against integer literals, unlike SQLite's lenient 0/1 storage.
    op.execute("""
        UPDATE alert_settings
        SET medication_name = (
            SELECT mp.medication_name FROM medication_profiles mp
            WHERE mp.user_id = alert_settings.user_id AND mp.is_active
            ORDER BY mp.id LIMIT 1
        ),
        strength = (
            SELECT mp.strength FROM medication_profiles mp
            WHERE mp.user_id = alert_settings.user_id AND mp.is_active
            ORDER BY mp.id LIMIT 1
        )
    """)

    op.create_table(
        'tracked_medications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('medication_name', sa.String(), nullable=False),
        sa.Column('strength', sa.String(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tracked_medications_medication_name'), 'tracked_medications', ['medication_name'])

    # Seed from existing profiles so shortage coverage doesn't regress.
    op.execute("""
        INSERT INTO tracked_medications (medication_name, strength, last_seen_at)
        SELECT DISTINCT medication_name, strength, CURRENT_TIMESTAMP
        FROM medication_profiles
        WHERE is_active
    """)

    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.add_column(sa.Column('medication_name', sa.String(), nullable=True))

    op.execute("""
        UPDATE refill_countdowns
        SET medication_name = (
            SELECT mp.medication_name FROM medication_profiles mp
            WHERE mp.id = refill_countdowns.medication_profile_id
        )
    """)
    # Any orphaned countdown (profile already gone) gets a placeholder rather
    # than blocking the NOT NULL below — these are pre-existing dead rows.
    op.execute("UPDATE refill_countdowns SET medication_name = 'Unknown' WHERE medication_name IS NULL")

    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.alter_column('medication_name', existing_type=sa.String(), nullable=False)
        batch_op.drop_constraint('uq_refill_countdown_profile', type_='unique')
        batch_op.drop_column('medication_profile_id')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('refill_countdowns') as batch_op:
        batch_op.add_column(sa.Column('medication_profile_id', sa.Integer(), nullable=True))
        batch_op.create_unique_constraint('uq_refill_countdown_profile', ['medication_profile_id'])
        batch_op.drop_column('medication_name')

    op.drop_index(op.f('ix_tracked_medications_medication_name'), table_name='tracked_medications')
    op.drop_table('tracked_medications')

    with op.batch_alter_table('alert_settings') as batch_op:
        batch_op.drop_column('strength')
        batch_op.drop_column('medication_name')
