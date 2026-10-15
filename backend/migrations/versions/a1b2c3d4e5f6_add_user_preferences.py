"""add user_preferences table

Revision ID: a1b2c3d4e5f6
Revises: 63e8311473ca
Create Date: 2025-07-11 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '63e8311473ca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_preferences',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('two_fa_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('biometric_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('login_alerts_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notif_verification_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notif_consent_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notif_ai_nudges', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notif_weekly_digest', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('user_preferences')
