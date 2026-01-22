"""Add origin and return point columns to trips

Revision ID: 008_add_trip_origin_return
Revises: 007_add_is_fallback
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_trip_origin_return'
down_revision = '007_add_is_fallback'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add origin point columns
    op.add_column(
        'trips',
        sa.Column(
            'origin_name',
            sa.String(255),
            nullable=True,
            comment='Origin location name (e.g., home airport)'
        )
    )
    op.add_column(
        'trips',
        sa.Column(
            'origin_latitude',
            sa.Float(),
            nullable=True,
            comment='Origin latitude coordinate'
        )
    )
    op.add_column(
        'trips',
        sa.Column(
            'origin_longitude',
            sa.Float(),
            nullable=True,
            comment='Origin longitude coordinate'
        )
    )

    # Add return point columns
    op.add_column(
        'trips',
        sa.Column(
            'return_name',
            sa.String(255),
            nullable=True,
            comment='Return location name (defaults to origin if not set)'
        )
    )
    op.add_column(
        'trips',
        sa.Column(
            'return_latitude',
            sa.Float(),
            nullable=True,
            comment='Return latitude coordinate'
        )
    )
    op.add_column(
        'trips',
        sa.Column(
            'return_longitude',
            sa.Float(),
            nullable=True,
            comment='Return longitude coordinate'
        )
    )


def downgrade() -> None:
    op.drop_column('trips', 'return_longitude')
    op.drop_column('trips', 'return_latitude')
    op.drop_column('trips', 'return_name')
    op.drop_column('trips', 'origin_longitude')
    op.drop_column('trips', 'origin_latitude')
    op.drop_column('trips', 'origin_name')
