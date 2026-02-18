"""Add origin/return segment persistence to travel_segments

Revision ID: 026_add_origin_return_segments
Revises: 025_add_conversations
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa

revision = "026_add_origin_return_segments"
down_revision = "025_add_conversations"
branch_labels = None
depends_on = None


def upgrade():
    # Add trip_id column (nullable - will be backfilled)
    op.add_column(
        "travel_segments",
        sa.Column(
            "trip_id",
            sa.Integer(),
            sa.ForeignKey("trips.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
    )

    # Add segment_type to distinguish inter-destination vs origin/return
    op.add_column(
        "travel_segments",
        sa.Column(
            "segment_type",
            sa.String(20),
            nullable=False,
            server_default="inter_destination",
        ),
    )

    # Add from/to coordinate columns for origin/return segments
    # (which don't link to destination records)
    op.add_column(
        "travel_segments",
        sa.Column("from_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "travel_segments",
        sa.Column("from_latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "travel_segments",
        sa.Column("from_longitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "travel_segments",
        sa.Column("to_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "travel_segments",
        sa.Column("to_latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "travel_segments",
        sa.Column("to_longitude", sa.Float(), nullable=True),
    )

    # Make destination FKs nullable (origin/return segments don't link to destinations)
    op.alter_column(
        "travel_segments",
        "from_destination_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "travel_segments",
        "to_destination_id",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Backfill trip_id for existing inter-destination segments
    op.execute(
        """
        UPDATE travel_segments ts
        SET trip_id = d.trip_id
        FROM destinations d
        WHERE ts.from_destination_id = d.id
          AND ts.trip_id IS NULL
        """
    )

    # Drop old unique constraint and add new one that accounts for segment_type
    op.drop_constraint(
        "uq_travel_segment_destinations", "travel_segments", type_="unique"
    )
    op.create_unique_constraint(
        "uq_travel_segment_trip_type",
        "travel_segments",
        ["trip_id", "segment_type", "from_destination_id", "to_destination_id"],
    )


def downgrade():
    # Drop new unique constraint
    op.drop_constraint(
        "uq_travel_segment_trip_type", "travel_segments", type_="unique"
    )

    # Delete origin/return segments (they can't satisfy the old constraint)
    op.execute(
        "DELETE FROM travel_segments WHERE segment_type != 'inter_destination'"
    )

    # Restore old unique constraint
    op.create_unique_constraint(
        "uq_travel_segment_destinations",
        "travel_segments",
        ["from_destination_id", "to_destination_id"],
    )

    # Make destination FKs non-nullable again
    op.alter_column(
        "travel_segments",
        "from_destination_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "travel_segments",
        "to_destination_id",
        existing_type=sa.Integer(),
        nullable=False,
    )

    # Drop added columns
    op.drop_column("travel_segments", "to_longitude")
    op.drop_column("travel_segments", "to_latitude")
    op.drop_column("travel_segments", "to_name")
    op.drop_column("travel_segments", "from_longitude")
    op.drop_column("travel_segments", "from_latitude")
    op.drop_column("travel_segments", "from_name")
    op.drop_column("travel_segments", "segment_type")
    op.drop_index(op.f("ix_travel_segments_trip_id"), table_name="travel_segments")
    op.drop_column("travel_segments", "trip_id")
