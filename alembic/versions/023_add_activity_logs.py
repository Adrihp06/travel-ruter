"""Add activity logs table

Revision ID: 023_add_activity_logs
Revises: 022_add_poi_votes
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "023_add_activity_logs"
down_revision = "022_add_poi_votes"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("entity_name", sa.String(255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_activity_logs_trip_created", "activity_logs", ["trip_id", "created_at"])
    op.create_index("ix_activity_logs_trip_entity", "activity_logs", ["trip_id", "entity_type"])


def downgrade():
    op.drop_index("ix_activity_logs_trip_entity", table_name="activity_logs")
    op.drop_index("ix_activity_logs_trip_created", table_name="activity_logs")
    op.drop_table("activity_logs")
