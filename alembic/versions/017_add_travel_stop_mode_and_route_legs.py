"""Add travel_mode to travel_stops and route_legs to travel_segments

Revision ID: 017_add_travel_stop_mode_and_route_legs
Revises: 016_add_poi_anchor_fields
Create Date: 2026-02-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_stop_mode_route_legs'
down_revision = '016_add_poi_anchors'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add travel_mode to travel_stops (nullable - null means inherit from segment)
    op.add_column(
        'travel_stops',
        sa.Column(
            'travel_mode',
            sa.String(50),
            nullable=True,
            comment='Transport mode to reach this stop (null = inherit from segment)'
        )
    )

    # Add route_legs JSON column to travel_segments for per-leg route data
    op.add_column(
        'travel_segments',
        sa.Column(
            'route_legs',
            sa.JSON(),
            nullable=True,
            comment='Per-leg route data when stops have different travel modes'
        )
    )


def downgrade() -> None:
    op.drop_column('travel_segments', 'route_legs')
    op.drop_column('travel_stops', 'travel_mode')
