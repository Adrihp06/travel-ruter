"""add_trip_tags

Revision ID: 006_add_trip_tags
Revises: 005_poi_scheduling
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision = '006_add_trip_tags'
down_revision = '005_poi_scheduling'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tags column as an array of strings for trip categorization
    op.add_column('trips', sa.Column('tags', ARRAY(sa.String(50)), nullable=True,
                                      server_default='{}',
                                      comment='Trip tags/categories (e.g., business, vacation, adventure)'))


def downgrade() -> None:
    op.drop_column('trips', 'tags')
