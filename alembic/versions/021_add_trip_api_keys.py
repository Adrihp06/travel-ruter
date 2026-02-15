"""Add trip API keys table

Revision ID: 021_add_trip_api_keys
Revises: 020_add_notifications
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "021_add_trip_api_keys"
down_revision = "020_add_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "trip_api_keys",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service_name", sa.String(100), nullable=False),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("added_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("trip_id", "service_name", name="uq_trip_api_key_service"),
    )


def downgrade():
    op.drop_table("trip_api_keys")
