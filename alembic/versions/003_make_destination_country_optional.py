"""make_destination_country_optional

Revision ID: 003_country_optional
Revises: 002_add_cover_image
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_country_optional'
down_revision = '002_add_cover_image'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('destinations', 'country',
                    existing_type=sa.String(length=255),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('destinations', 'country',
                    existing_type=sa.String(length=255),
                    nullable=False)
