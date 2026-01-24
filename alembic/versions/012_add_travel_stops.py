"""Add travel_stops table for intermediate stops between destinations

Revision ID: 012_add_travel_stops
Revises: 011_add_notes_table
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012_add_travel_stops'
down_revision = '011_add_notes_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create travel_stops table
    op.create_table(
        'travel_stops',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('travel_segment_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('stop_date', sa.Date(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('arrival_time', sa.String(5), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(
            ['travel_segment_id'],
            ['travel_segments.id'],
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('travel_segment_id', 'order_index', name='uq_travel_stop_order')
    )

    # Create index for fast lookup by travel_segment_id
    op.create_index(
        'ix_travel_stops_travel_segment_id',
        'travel_stops',
        ['travel_segment_id']
    )

    # Create composite index for ordering
    op.create_index(
        'ix_travel_stops_segment_order',
        'travel_stops',
        ['travel_segment_id', 'order_index']
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_travel_stops_segment_order', table_name='travel_stops')
    op.drop_index('ix_travel_stops_travel_segment_id', table_name='travel_stops')

    # Drop table
    op.drop_table('travel_stops')
