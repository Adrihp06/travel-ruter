from sqlalchemy import Column, String, Numeric, Date, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Trip(BaseModel):
    __tablename__ = "trips"

    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    total_budget = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(String(50), nullable=False, default="planning", index=True)

    # Relationships
    destinations = relationship("Destination", back_populates="trip", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Trip(id={self.id}, name='{self.name}', start_date={self.start_date}, end_date={self.end_date})>"
