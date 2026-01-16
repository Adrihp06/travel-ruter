"""add_trip_cover_image

Revision ID: 002_add_cover_image
Revises: 66e15a93eece
Create Date: 2026-01-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_cover_image'
down_revision = '66e15a93eece'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('cover_image', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('trips', 'cover_image')
