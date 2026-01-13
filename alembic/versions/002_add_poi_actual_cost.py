"""Add actual_cost field to POIs

Revision ID: 002
Revises: 001
Create Date: 2026-01-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pois',
        sa.Column('actual_cost', sa.Numeric(10, 2), nullable=True, comment='Actual cost spent')
    )


def downgrade() -> None:
    op.drop_column('pois', 'actual_cost')
