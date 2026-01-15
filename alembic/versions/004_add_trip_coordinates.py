"""Add latitude and longitude fields to trips table

Revision ID: 004_add_trip_coordinates
Revises: 003_add_trip_location
Create Date: 2026-01-15 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_trip_coordinates'
down_revision: Union[str, None] = '003_add_trip_location'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add latitude and longitude columns to trips table
    op.add_column('trips', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    # Remove latitude and longitude columns from trips table
    op.drop_column('trips', 'longitude')
    op.drop_column('trips', 'latitude')
