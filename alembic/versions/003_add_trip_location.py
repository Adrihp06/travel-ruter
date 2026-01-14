"""Add location field to trips table

Revision ID: 003_add_trip_location
Revises: 002_add_documents_table
Create Date: 2026-01-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_add_trip_location'
down_revision: Union[str, None] = '002_add_documents_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add location column to trips table
    op.add_column('trips', sa.Column('location', sa.String(255), nullable=True))


def downgrade() -> None:
    # Remove location column from trips table
    op.drop_column('trips', 'location')
