"""Add trip collaboration (trip_members table)

Revision ID: 019_add_trip_collaboration
Revises: 018_add_users_table
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "019_add_trip_collaboration"
down_revision = "018_add_users_table"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "trip_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="viewer"),
        sa.Column("invited_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_trip_member"),
    )

    op.create_index("ix_trip_members_user_id", "trip_members", ["user_id"])
    op.create_index("ix_trip_members_trip_user", "trip_members", ["trip_id", "user_id"])
    op.create_index("ix_trip_members_user_status", "trip_members", ["user_id", "status"])


def downgrade():
    op.drop_index("ix_trip_members_user_status", table_name="trip_members")
    op.drop_index("ix_trip_members_trip_user", table_name="trip_members")
    op.drop_index("ix_trip_members_user_id", table_name="trip_members")
    op.drop_table("trip_members")
