"""Add missing database indexes for common query patterns

This migration adds composite indexes to improve query performance for:
- Accommodation date range queries
- Document filtering by trip/destination and POI/created_at
- Trip filtering by status and start_date
- Note lookups by destination and POI

Revision ID: 014_add_perf_indexes
Revises: 013_remove_dup_location
Create Date: 2026-02-01

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '014_add_perf_indexes'
down_revision = '013_remove_dup_location'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Accommodations - composite index for date range queries
    op.create_index(
        'ix_accommodations_dest_dates',
        'accommodations',
        ['destination_id', 'check_in_date', 'check_out_date']
    )

    # Documents - composite indexes for filtering
    op.create_index(
        'ix_documents_poi_created',
        'documents',
        ['poi_id', 'created_at']
    )
    op.create_index(
        'ix_documents_trip_dest',
        'documents',
        ['trip_id', 'destination_id']
    )

    # Trips - composite index for filtering active trips by status and date
    op.create_index(
        'ix_trips_status_date',
        'trips',
        ['status', 'start_date']
    )

    # Notes - composite index for destination/POI lookups
    op.create_index(
        'ix_notes_dest_poi',
        'notes',
        ['destination_id', 'poi_id']
    )


def downgrade() -> None:
    op.drop_index('ix_notes_dest_poi', table_name='notes')
    op.drop_index('ix_trips_status_date', table_name='trips')
    op.drop_index('ix_documents_trip_dest', table_name='documents')
    op.drop_index('ix_documents_poi_created', table_name='documents')
    op.drop_index('ix_accommodations_dest_dates', table_name='accommodations')
