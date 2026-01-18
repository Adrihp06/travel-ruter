from sqlalchemy import Column, String, Integer, ForeignKey, Float, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from app.models.base import BaseModel


class TravelSegment(BaseModel):
    __tablename__ = "travel_segments"

    from_destination_id = Column(
        Integer,
        ForeignKey("destinations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    to_destination_id = Column(
        Integer,
        ForeignKey("destinations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    travel_mode = Column(
        String(50),
        nullable=False,
        comment="plane, car, train, bus, walk, bike, ferry"
    )
    distance_km = Column(Float, nullable=True, comment="Distance in kilometers")
    duration_minutes = Column(Integer, nullable=True, comment="Duration in minutes")
    geometry = Column(Geometry('LINESTRING', srid=4326), nullable=True)
    is_fallback = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if route is from fallback service (e.g., car route when transit unavailable)"
    )

    # Relationships
    from_destination = relationship(
        "Destination",
        foreign_keys=[from_destination_id],
        backref="outgoing_segments"
    )
    to_destination = relationship(
        "Destination",
        foreign_keys=[to_destination_id],
        backref="incoming_segments"
    )

    __table_args__ = (
        UniqueConstraint(
            'from_destination_id',
            'to_destination_id',
            name='uq_travel_segment_destinations'
        ),
    )

    @property
    def route_geometry(self) -> dict | None:
        """Convert PostGIS geometry to GeoJSON dict for API responses."""
        if self.geometry is not None:
            try:
                shape = to_shape(self.geometry)
                return mapping(shape)
            except Exception:
                return None
        return None

    def __repr__(self):
        return (
            f"<TravelSegment(id={self.id}, "
            f"from={self.from_destination_id}, "
            f"to={self.to_destination_id}, "
            f"mode='{self.travel_mode}')>"
        )
