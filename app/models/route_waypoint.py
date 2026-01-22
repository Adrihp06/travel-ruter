from sqlalchemy import Column, String, Integer, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class RouteWaypoint(BaseModel):
    __tablename__ = "route_waypoints"

    travel_segment_id = Column(
        Integer,
        ForeignKey("travel_segments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name = Column(String(255), nullable=True, comment="Optional user label for waypoint")
    latitude = Column(Float, nullable=False, comment="Waypoint latitude")
    longitude = Column(Float, nullable=False, comment="Waypoint longitude")
    order_index = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Order within segment (0-indexed)"
    )

    # Relationship
    travel_segment = relationship(
        "TravelSegment",
        backref="waypoints"
    )

    def __repr__(self):
        return (
            f"<RouteWaypoint(id={self.id}, "
            f"segment_id={self.travel_segment_id}, "
            f"name='{self.name}', "
            f"order={self.order_index})>"
        )
