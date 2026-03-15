"""Add GiST spatial indexes for PostGIS geometry columns.

This migration is purely additive — it only creates indexes.
No tables, columns, or data are modified.
Existing data is completely preserved.

Revision ID: 029_add_gist_spatial_indexes
Revises: 028_add_revoked_tokens
Create Date: 2026-03-15
"""
from alembic import op

# revision identifiers
revision = "029_add_gist_spatial_indexes"
down_revision = "028_add_revoked_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GiST indexes for spatial queries — additive only, no data changes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_destinations_coordinates_gist
        ON destinations USING gist(coordinates);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_pois_coordinates_gist
        ON pois USING gist(coordinates);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_accommodations_coordinates_gist
        ON accommodations USING gist(coordinates);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_routes_geometry_gist
        ON routes USING gist(geometry);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_travel_segments_geometry_gist
        ON travel_segments USING gist(geometry);
    """)


def downgrade() -> None:
    # Safe downgrade — only drops indexes, never tables or columns
    op.execute("DROP INDEX IF EXISTS idx_travel_segments_geometry_gist;")
    op.execute("DROP INDEX IF EXISTS idx_routes_geometry_gist;")
    op.execute("DROP INDEX IF EXISTS idx_accommodations_coordinates_gist;")
    op.execute("DROP INDEX IF EXISTS idx_pois_coordinates_gist;")
    op.execute("DROP INDEX IF EXISTS idx_destinations_coordinates_gist;")
