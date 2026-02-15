"""Add POI votes table

Revision ID: 022_add_poi_votes
Revises: 021_add_trip_api_keys
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa

revision = "022_add_poi_votes"
down_revision = "021_add_trip_api_keys"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "poi_votes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("poi_id", sa.Integer(), sa.ForeignKey("pois.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vote_type", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("poi_id", "user_id", name="uq_poi_vote_user"),
    )


def downgrade():
    op.drop_table("poi_votes")
