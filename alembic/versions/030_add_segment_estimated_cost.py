"""Add estimated_cost to travel segments.

Revision ID: 030_add_segment_estimated_cost
Revises: 029_add_gist_spatial_indexes
Create Date: 2026-06-07
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '030_add_segment_estimated_cost'
down_revision = '029_add_gist_spatial_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('travel_segments', sa.Column(
        'estimated_cost', sa.Float(), nullable=True,
        comment='Estimated cost for this travel segment'
    ))
    op.add_column('travel_segments', sa.Column(
        'cost_currency', sa.String(length=3), nullable=True,
        comment='Currency for estimated_cost (e.g., EUR, USD)'
    ))


def downgrade() -> None:
    op.drop_column('travel_segments', 'cost_currency')
    op.drop_column('travel_segments', 'estimated_cost')
