"""Add documents table for The Vault feature

Revision ID: 002_add_documents_table
Revises: 001
Create Date: 2026-01-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_documents_table'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        # File information
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False, comment='File size in bytes'),
        sa.Column('mime_type', sa.String(100), nullable=False),
        # Document metadata
        sa.Column('document_type', sa.String(50), nullable=False, server_default='other'),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        # Foreign keys
        sa.Column('poi_id', sa.Integer(), nullable=True),
        sa.Column('trip_id', sa.Integer(), nullable=True),
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['poi_id'], ['pois.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
    )
    # Create indexes
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
    op.create_index(op.f('ix_documents_poi_id'), 'documents', ['poi_id'], unique=False)
    op.create_index(op.f('ix_documents_trip_id'), 'documents', ['trip_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_documents_trip_id'), table_name='documents')
    op.drop_index(op.f('ix_documents_poi_id'), table_name='documents')
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    # Drop table
    op.drop_table('documents')
