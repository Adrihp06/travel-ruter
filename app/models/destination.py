from sqlalchemy import Column, String, Date, Integer, ForeignKey, Text, Index, Float
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.models.base import BaseModel


class Destination(BaseModel):
    __tablename__ = "destinations"

    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    city_name = Column(String(255), nullable=False, index=True)
    country = Column(String(255), nullable=True, index=True)
    arrival_date = Column(Date, nullable=False, index=True)
    departure_date = Column(Date, nullable=False, index=True)
    coordinates = Column(Geometry('POINT', srid=4326), nullable=True)
    notes = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)

    # Additional fields for destination details
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location = Column(Geometry('POINT', srid=4326), nullable=True)

    # Relationships
    trip = relationship("Trip", back_populates="destinations")
    pois = relationship("POI", back_populates="destination", cascade="all, delete-orphan")
    accommodations = relationship("Accommodation", back_populates="destination", cascade="all, delete-orphan")

    # Create composite index for trip_id and order_index
    __table_args__ = (
        Index('ix_destinations_trip_order', 'trip_id', 'order_index'),
    )

    def __repr__(self):
        return f"<Destination(id={self.id}, city_name='{self.city_name}', arrival_date={self.arrival_date})>"
