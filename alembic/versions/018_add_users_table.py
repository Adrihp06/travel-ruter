"""Add users table and user_id to trips

Revision ID: 018_add_users_table
Revises: 017_add_travel_stop_mode_and_route_legs
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "018_add_users_table"
down_revision = "017_stop_mode_route_legs"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("oauth_provider", sa.String(50), nullable=False),
        sa.Column("oauth_id", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    op.create_index(
        "ix_users_oauth_provider_id",
        "users",
        ["oauth_provider", "oauth_id"],
        unique=True,
    )

    op.add_column(
        "trips",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_trips_user_id", "trips", ["user_id"])


def downgrade():
    op.drop_index("ix_trips_user_id", table_name="trips")
    op.drop_column("trips", "user_id")
    op.drop_index("ix_users_oauth_provider_id", table_name="users")
    op.drop_table("users")
