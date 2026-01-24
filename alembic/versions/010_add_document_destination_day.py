"""Add destination_id and day_number to documents

Revision ID: 010_add_document_destination_day
Revises: 008_add_trip_origin_return
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_document_destination_day'
down_revision = '008_add_trip_origin_return'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add destination_id column
    op.add_column(
        'documents',
        sa.Column(
            'destination_id',
            sa.Integer(),
            sa.ForeignKey('destinations.id', ondelete='SET NULL'),
            nullable=True,
            comment='Destination this document belongs to'
        )
    )

    # Add day_number column
    op.add_column(
        'documents',
        sa.Column(
            'day_number',
            sa.Integer(),
            nullable=True,
            comment='Day number within destination (1-indexed)'
        )
    )

    # Create index for destination_id
    op.create_index(
        'ix_documents_destination_id',
        'documents',
        ['destination_id']
    )

    # Create composite index for destination_id and day_number
    op.create_index(
        'ix_documents_destination_day',
        'documents',
        ['destination_id', 'day_number']
    )

    # Add constraint: if day_number is set, destination_id must be set
    op.create_check_constraint(
        'day_requires_destination',
        'documents',
        '(day_number IS NULL) OR (destination_id IS NOT NULL)'
    )

    # Add constraint: day_number must be positive
    op.create_check_constraint(
        'day_number_positive',
        'documents',
        '(day_number IS NULL) OR (day_number > 0)'
    )


def downgrade() -> None:
    # Drop constraints
    op.drop_constraint('day_number_positive', 'documents', type_='check')
    op.drop_constraint('day_requires_destination', 'documents', type_='check')

    # Drop indexes
    op.drop_index('ix_documents_destination_day', table_name='documents')
    op.drop_index('ix_documents_destination_id', table_name='documents')

    # Drop columns
    op.drop_column('documents', 'day_number')
    op.drop_column('documents', 'destination_id')
