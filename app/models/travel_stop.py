"""Travel Stop model for intermediate stops between destinations."""
from sqlalchemy import Column, String, Integer, ForeignKey, Float, Text, Date
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class TravelStop(BaseModel):
    """
    Represents a planned stop/waypoint during travel between destinations.

    Unlike RouteWaypoint (used for route geometry), TravelStop represents
    actual planned stops where travelers spend time (e.g., stopping in
    Matsumoto for lunch while traveling from Takayama to Magome-juku).
    """
    __tablename__ = "travel_stops"

    # Link to the travel segment this stop is part of
    travel_segment_id = Column(
        Integer,
        ForeignKey("travel_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The travel segment this stop belongs to"
    )

    # Stop details
    name = Column(
        String(255),
        nullable=False,
        comment="Name of the stop location"
    )
    description = Column(
        Text,
        nullable=True,
        comment="Notes or description about the stop"
    )

    # Location
    latitude = Column(
        Float,
        nullable=False,
        comment="Stop latitude coordinate"
    )
    longitude = Column(
        Float,
        nullable=False,
        comment="Stop longitude coordinate"
    )
    address = Column(
        String(500),
        nullable=True,
        comment="Full address of the stop"
    )

    # Timing
    stop_date = Column(
        Date,
        nullable=True,
        comment="Date of the stop (for multi-day trips)"
    )
    duration_minutes = Column(
        Integer,
        nullable=False,
        default=60,
        comment="Estimated time to spend at this stop (in minutes)"
    )
    arrival_time = Column(
        String(5),
        nullable=True,
        comment="Planned arrival time (HH:MM format)"
    )

    # Transport mode for reaching this stop (null = inherit from segment)
    travel_mode = Column(
        String(50),
        nullable=True,
        comment="Transport mode to reach this stop (null = inherit from segment)"
    )

    # Ordering within the segment
    order_index = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Order within the travel segment (0-indexed)"
    )

    # Relationships
    travel_segment = relationship(
        "TravelSegment",
        backref="stops"
    )

    def __repr__(self):
        return (
            f"<TravelStop(id={self.id}, "
            f"name='{self.name}', "
            f"segment_id={self.travel_segment_id}, "
            f"duration={self.duration_minutes}min)>"
        )

    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "travel_segment_id": self.travel_segment_id,
            "name": self.name,
            "description": self.description,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "address": self.address,
            "stop_date": self.stop_date.isoformat() if self.stop_date else None,
            "duration_minutes": self.duration_minutes,
            "arrival_time": self.arrival_time,
            "travel_mode": self.travel_mode,
            "order_index": self.order_index,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
