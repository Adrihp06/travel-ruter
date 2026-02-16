"""Add conversations table

Revision ID: 025_add_conversations
Revises: 024_add_comments
Create Date: 2026-02-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "025_add_conversations"
down_revision = "024_add_comments"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(100), nullable=False, server_default="New Conversation"),
        sa.Column("model_id", sa.String(100), nullable=True),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("messages", JSONB(), nullable=False, server_default="[]"),
        sa.Column("backend_history", JSONB(), nullable=True),
        sa.Column("trip_context", JSONB(), nullable=True),
        sa.Column("destination_context", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])
    op.create_index("ix_conversations_trip_id", "conversations", ["trip_id"])
    op.create_index("ix_conversations_user_updated", "conversations", ["user_id", "updated_at"])
    op.create_index("ix_conversations_user_trip", "conversations", ["user_id", "trip_id"])


def downgrade():
    op.drop_index("ix_conversations_user_trip", table_name="conversations")
    op.drop_index("ix_conversations_user_updated", table_name="conversations")
    op.drop_index("ix_conversations_trip_id", table_name="conversations")
    op.drop_index("ix_conversations_user_id", table_name="conversations")
    op.drop_table("conversations")
