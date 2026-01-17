"""add_poi_scheduling_fields

Revision ID: 005_poi_scheduling
Revises: 004_add_travel_segments
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_poi_scheduling'
down_revision = '004_add_travel_segments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add scheduled_date column for daily itinerary scheduling
    op.add_column('pois', sa.Column('scheduled_date', sa.Date(), nullable=True,
                                     comment='Date this POI is scheduled for'))

    # Add day_order column for ordering within a day
    op.add_column('pois', sa.Column('day_order', sa.Integer(), nullable=True,
                                     comment='Order within the scheduled day'))

    # Create index for scheduled_date
    op.create_index('ix_pois_scheduled_date', 'pois', ['scheduled_date'])

    # Create composite index for efficient queries by destination and schedule
    op.create_index('ix_pois_destination_scheduled', 'pois',
                    ['destination_id', 'scheduled_date', 'day_order'])


def downgrade() -> None:
    op.drop_index('ix_pois_destination_scheduled', table_name='pois')
    op.drop_index('ix_pois_scheduled_date', table_name='pois')
    op.drop_column('pois', 'day_order')
    op.drop_column('pois', 'scheduled_date')
