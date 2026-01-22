"""Add route_waypoints table

Revision ID: 008_add_route_waypoints
Revises: 007_add_is_fallback
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_route_waypoints'
down_revision = '007_add_is_fallback'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'route_waypoints',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column(
            'travel_segment_id',
            sa.Integer(),
            sa.ForeignKey('travel_segments.id', ondelete='CASCADE'),
            nullable=False,
            index=True
        ),
        sa.Column('name', sa.String(255), nullable=True, comment='Optional user label for waypoint'),
        sa.Column('latitude', sa.Float(), nullable=False, comment='Waypoint latitude'),
        sa.Column('longitude', sa.Float(), nullable=False, comment='Waypoint longitude'),
        sa.Column('order_index', sa.Integer(), nullable=False, default=0, comment='Order within segment (0-indexed)'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create composite index for efficient ordering queries
    op.create_index(
        'ix_route_waypoints_segment_order',
        'route_waypoints',
        ['travel_segment_id', 'order_index']
    )


def downgrade() -> None:
    op.drop_index('ix_route_waypoints_segment_order', table_name='route_waypoints')
    op.drop_table('route_waypoints')
