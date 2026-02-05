"""Add anchor fields to POIs for Smart Scheduler

This migration adds is_anchored and anchored_time columns to the pois table
to support locking POIs to specific times in the Smart Scheduler.

Revision ID: 016_add_poi_anchors
Revises: 015_origin_return_modes
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_poi_anchors'
down_revision = '015_origin_return_modes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_anchored column with default False
    op.add_column(
        'pois',
        sa.Column(
            'is_anchored',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='Whether this POI is anchored to a specific time'
        )
    )

    # Add anchored_time column (nullable, only used when is_anchored is True)
    op.add_column(
        'pois',
        sa.Column(
            'anchored_time',
            sa.Time(),
            nullable=True,
            comment='Time of day when this POI is anchored (HH:MM format)'
        )
    )


def downgrade() -> None:
    op.drop_column('pois', 'anchored_time')
    op.drop_column('pois', 'is_anchored')
