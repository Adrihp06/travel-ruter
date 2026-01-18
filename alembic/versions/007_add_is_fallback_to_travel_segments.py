"""Add is_fallback column to travel_segments

Revision ID: 007_add_is_fallback
Revises: 006_add_trip_tags
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_is_fallback'
down_revision = '006_add_trip_tags'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'travel_segments',
        sa.Column(
            'is_fallback',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='True if route is from fallback service (e.g., car route when transit unavailable)'
        )
    )


def downgrade() -> None:
    op.drop_column('travel_segments', 'is_fallback')
