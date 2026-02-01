"""Remove duplicate location column from destinations table

The destinations table had two separate geometry columns:
- coordinates: POINT(4326)
- location: POINT(4326)

This migration consolidates them by copying any data from location to
coordinates (where coordinates is null) and then dropping the location column.

Revision ID: 013_remove_dup_location
Revises: 012_add_travel_stops
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic.
revision = '013_remove_dup_location'
down_revision = '012_add_travel_stops'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Copy data from location to coordinates where coordinates is null
    op.execute("""
        UPDATE destinations
        SET coordinates = location
        WHERE coordinates IS NULL AND location IS NOT NULL
    """)

    # Drop the duplicate location column
    op.drop_column('destinations', 'location')


def downgrade() -> None:
    # Re-add the location column
    op.add_column(
        'destinations',
        sa.Column('location', Geometry('POINT', srid=4326), nullable=True)
    )

    # Copy data from coordinates to location
    op.execute("UPDATE destinations SET location = coordinates")
