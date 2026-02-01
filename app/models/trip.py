from sqlalchemy import Column, String, Numeric, Date, Text, Float, Index
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from app.models.base import BaseModel


class Trip(BaseModel):
    __tablename__ = "trips"

    name = Column(String(255), nullable=False, index=True)
    location = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    total_budget = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(String(50), nullable=False, default="planning", index=True)
    tags = Column(ARRAY(String(50)), nullable=True, default=[])

    # Origin point (departure airport/location)
    origin_name = Column(String(255), nullable=True)
    origin_latitude = Column(Float, nullable=True)
    origin_longitude = Column(Float, nullable=True)

    # Return point (arrival airport/location) - defaults to origin if not specified
    return_name = Column(String(255), nullable=True)
    return_latitude = Column(Float, nullable=True)
    return_longitude = Column(Float, nullable=True)

    # Relationships
    destinations = relationship("Destination", back_populates="trip", cascade="all, delete-orphan")

    # Composite indexes for common query patterns
    __table_args__ = (
        Index('ix_trips_status_date', 'status', 'start_date'),
    )

    @hybrid_property
    def nights(self) -> int:
        """Calculate number of nights automatically from start_date and end_date"""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days
        return 0

    def __repr__(self):
        return f"<Trip(id={self.id}, name='{self.name}', start_date={self.start_date}, end_date={self.end_date})>"
