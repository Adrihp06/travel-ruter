"""Add comments table

Revision ID: 024_add_comments
Revises: 023_add_activity_logs
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "024_add_comments"
down_revision = "023_add_activity_logs"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_comments_entity", "comments", ["entity_type", "entity_id"])
    op.create_index("ix_comments_trip", "comments", ["trip_id"])
    op.create_index("ix_comments_parent", "comments", ["parent_id"])


def downgrade():
    op.drop_index("ix_comments_parent", table_name="comments")
    op.drop_index("ix_comments_trip", table_name="comments")
    op.drop_index("ix_comments_entity", table_name="comments")
    op.drop_table("comments")
