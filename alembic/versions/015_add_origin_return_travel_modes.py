"""Add travel mode columns for origin and return segments

This migration adds origin_travel_mode and return_travel_mode columns
to the trips table to support different transport modes for
airport-to-first-destination and last-destination-to-airport routes.

Revision ID: 015_origin_return_modes
Revises: 014_add_perf_indexes
Create Date: 2026-02-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015_origin_return_modes'
down_revision = '014_add_perf_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add origin_travel_mode column with default 'plane'
    op.add_column(
        'trips',
        sa.Column(
            'origin_travel_mode',
            sa.String(20),
            nullable=False,
            server_default='plane',
            comment='Travel mode from origin to first destination (plane, car, train, bus, walk, bike, ferry)'
        )
    )

    # Add return_travel_mode column with default 'plane'
    op.add_column(
        'trips',
        sa.Column(
            'return_travel_mode',
            sa.String(20),
            nullable=False,
            server_default='plane',
            comment='Travel mode from last destination to return point (plane, car, train, bus, walk, bike, ferry)'
        )
    )


def downgrade() -> None:
    op.drop_column('trips', 'return_travel_mode')
    op.drop_column('trips', 'origin_travel_mode')
