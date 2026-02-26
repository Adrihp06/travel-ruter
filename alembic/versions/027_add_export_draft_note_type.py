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
    op.execute("ALTER TYPE notetype ADD VALUE IF NOT EXISTS 'export_draft'")


def downgrade():
    # PostgreSQL does not support removing enum values easily; this is a no-op
    pass
