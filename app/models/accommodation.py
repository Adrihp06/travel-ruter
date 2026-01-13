from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Date, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.models.base import BaseModel


class Accommodation(BaseModel):
    __tablename__ = "accommodations"

    destination_id = Column(Integer, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(100), nullable=False, index=True, comment="hotel, hostel, airbnb, etc.")
    address = Column(String(500), nullable=True)
    coordinates = Column(Geometry('POINT', srid=4326), nullable=True)

    # Booking details
    check_in_date = Column(Date, nullable=False, index=True)
    check_out_date = Column(Date, nullable=False, index=True)
    booking_reference = Column(String(255), nullable=True)
    booking_url = Column(String(1000), nullable=True)

    # Cost
    total_cost = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    is_paid = Column(Boolean, nullable=False, default=False)

    # Details
    description = Column(Text, nullable=True)
    contact_info = Column(JSON, nullable=True, comment="Phone, email, etc.")
    amenities = Column(JSON, nullable=True, comment="Array of amenities")
    files = Column(JSON, nullable=True, comment="Array of file URLs/metadata (photos, confirmations)")

    # Rating
    rating = Column(Numeric(2, 1), nullable=True, comment="Rating out of 5.0")
    review = Column(Text, nullable=True)

    # Relationships
    destination = relationship("Destination", back_populates="accommodations")

    def __repr__(self):
        return f"<Accommodation(id={self.id}, name='{self.name}', type='{self.type}', check_in={self.check_in_date})>"
