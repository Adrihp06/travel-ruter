"""add_travel_segments

Revision ID: 004
Revises: 003_make_destination_country_optional
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision = '004_add_travel_segments'
down_revision = '003_make_destination_country_optional'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('travel_segments',
        sa.Column('from_destination_id', sa.Integer(), nullable=False),
        sa.Column('to_destination_id', sa.Integer(), nullable=False),
        sa.Column('travel_mode', sa.String(length=50), nullable=False, comment='plane, car, train, bus, walk, bike, ferry'),
        sa.Column('distance_km', sa.Float(), nullable=True, comment='Distance in kilometers'),
        sa.Column('duration_minutes', sa.Integer(), nullable=True, comment='Duration in minutes'),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='LINESTRING', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['from_destination_id'], ['destinations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['to_destination_id'], ['destinations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('from_destination_id', 'to_destination_id', name='uq_travel_segment_destinations')
    )
    op.create_index(op.f('ix_travel_segments_id'), 'travel_segments', ['id'], unique=False)
    op.create_index(op.f('ix_travel_segments_from_destination_id'), 'travel_segments', ['from_destination_id'], unique=False)
    op.create_index(op.f('ix_travel_segments_to_destination_id'), 'travel_segments', ['to_destination_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_travel_segments_to_destination_id'), table_name='travel_segments')
    op.drop_index(op.f('ix_travel_segments_from_destination_id'), table_name='travel_segments')
    op.drop_index(op.f('ix_travel_segments_id'), table_name='travel_segments')
    op.drop_table('travel_segments')
