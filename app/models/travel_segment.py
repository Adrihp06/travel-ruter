from sqlalchemy import Column, String, Integer, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
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

    def __repr__(self):
        return (
            f"<TravelSegment(id={self.id}, "
            f"from={self.from_destination_id}, "
            f"to={self.to_destination_id}, "
            f"mode='{self.travel_mode}')>"
        )
