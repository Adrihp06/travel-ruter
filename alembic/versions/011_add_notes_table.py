"""Add notes table for travel journal feature

Revision ID: 011_add_notes_table
Revises: 010_add_document_destination_day
Create Date: 2026-01-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSON


# revision identifiers, used by Alembic.
revision = '011_add_notes_table'
down_revision = '010_add_document_destination_day'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notes table
    op.create_table(
        'notes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),

        # Core fields
        sa.Column('title', sa.String(255), nullable=False, index=True),
        sa.Column('content', sa.Text(), nullable=True, comment='Rich text content (HTML or JSON)'),
        sa.Column('note_type', sa.String(50), nullable=False, default='general', index=True),

        # Relationships
        sa.Column('trip_id', sa.Integer(), sa.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('destination_id', sa.Integer(), sa.ForeignKey('destinations.id', ondelete='CASCADE'), nullable=True, index=True, comment='Destination this note belongs to (optional)'),
        sa.Column('day_number', sa.Integer(), nullable=True, comment='Day number within destination (1-indexed)'),
        sa.Column('poi_id', sa.Integer(), sa.ForeignKey('pois.id', ondelete='CASCADE'), nullable=True, index=True, comment='POI this note is linked to (optional)'),

        # Organization and display
        sa.Column('is_pinned', sa.Boolean(), nullable=False, default=False, index=True),
        sa.Column('is_private', sa.Boolean(), nullable=False, default=True, comment='For future collaborative features'),

        # Location tagging
        sa.Column('location_lat', sa.Float(), nullable=True),
        sa.Column('location_lng', sa.Float(), nullable=True),
        sa.Column('location_name', sa.String(255), nullable=True),

        # Mood/weather tags
        sa.Column('mood', sa.String(50), nullable=True, comment='Mood tag (happy, tired, excited, etc.)'),
        sa.Column('weather', sa.String(50), nullable=True, comment='Weather tag (sunny, rainy, cloudy, etc.)'),
        sa.Column('tags', ARRAY(sa.String(50)), nullable=True, default=[], comment='Custom tags for categorization'),

        # Media attachments
        sa.Column('media_files', JSON, nullable=True, default=[], comment='Array of media file paths and metadata'),
    )

    # Create composite indexes
    op.create_index('ix_notes_trip_destination', 'notes', ['trip_id', 'destination_id'])
    op.create_index('ix_notes_destination_day', 'notes', ['destination_id', 'day_number'])
    op.create_index('ix_notes_trip_pinned', 'notes', ['trip_id', 'is_pinned'])

    # Add constraints
    op.create_check_constraint(
        'note_day_requires_destination',
        'notes',
        '(day_number IS NULL) OR (destination_id IS NOT NULL)'
    )
    op.create_check_constraint(
        'note_day_number_positive',
        'notes',
        '(day_number IS NULL) OR (day_number > 0)'
    )
    op.create_check_constraint(
        'note_poi_requires_destination',
        'notes',
        '(poi_id IS NULL) OR (destination_id IS NOT NULL)'
    )


def downgrade() -> None:
    # Drop constraints
    op.drop_constraint('note_poi_requires_destination', 'notes', type_='check')
    op.drop_constraint('note_day_number_positive', 'notes', type_='check')
    op.drop_constraint('note_day_requires_destination', 'notes', type_='check')

    # Drop indexes
    op.drop_index('ix_notes_trip_pinned', table_name='notes')
    op.drop_index('ix_notes_destination_day', table_name='notes')
    op.drop_index('ix_notes_trip_destination', table_name='notes')

    # Drop table
    op.drop_table('notes')
