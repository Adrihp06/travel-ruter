"""Add export_draft note type

Revision ID: 027_add_export_draft_note_type
Revises: 026_add_origin_return_segments
Create Date: 2026-02-26
"""
from alembic import op

revision = "027_add_export_draft_note_type"
down_revision = "026_add_origin_return_segments"
branch_labels = None
depends_on = None


def upgrade():
    # note_type is stored as VARCHAR(50), not a PostgreSQL enum type,
    # so no DDL is required to support a new string value.
    pass


def downgrade():
    pass
