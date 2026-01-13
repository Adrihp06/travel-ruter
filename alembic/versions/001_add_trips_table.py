"""Add trips table

Revision ID: 001_add_trips_table
Revises:
Create Date: 2026-01-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_add_trips_table'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create trips table
    op.create_table(
        'trips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('total_budget', sa.Numeric(10, 2), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('status', sa.String(50), nullable=False, server_default='planning'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_trips_id'), 'trips', ['id'], unique=False)
    op.create_index(op.f('ix_trips_name'), 'trips', ['name'], unique=False)
    op.create_index(op.f('ix_trips_start_date'), 'trips', ['start_date'], unique=False)
    op.create_index(op.f('ix_trips_end_date'), 'trips', ['end_date'], unique=False)
    op.create_index(op.f('ix_trips_status'), 'trips', ['status'], unique=False)


def downgrade() -> None:
    # Drop trips table
    op.drop_index(op.f('ix_trips_status'), table_name='trips')
    op.drop_index(op.f('ix_trips_end_date'), table_name='trips')
    op.drop_index(op.f('ix_trips_start_date'), table_name='trips')
    op.drop_index(op.f('ix_trips_name'), table_name='trips')
    op.drop_index(op.f('ix_trips_id'), table_name='trips')
    op.drop_table('trips')
