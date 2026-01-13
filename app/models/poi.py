from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, Text, JSON, Index
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.models.base import BaseModel


class POI(BaseModel):
    __tablename__ = "pois"

    destination_id = Column(Integer, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    coordinates = Column(Geometry('POINT', srid=4326), nullable=True)
    address = Column(String(500), nullable=True)

    # Cost and time
    estimated_cost = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    dwell_time = Column(Integer, nullable=True, comment="Estimated dwell time in minutes")

    # User engagement
    likes = Column(Integer, nullable=False, default=0)
    vetoes = Column(Integer, nullable=False, default=0)
    priority = Column(Integer, nullable=False, default=0)

    # Files and metadata
    files = Column(JSON, nullable=True, comment="Array of file URLs/metadata")
    metadata_json = Column(JSON, nullable=True)

    # External references
    external_id = Column(String(255), nullable=True, index=True, comment="ID from external source like Google Places")
    external_source = Column(String(50), nullable=True)

    # Relationships
    destination = relationship("Destination", back_populates="pois")

    # Create composite index for destination_id and category
    __table_args__ = (
        Index('ix_pois_destination_category', 'destination_id', 'category'),
        Index('ix_pois_destination_priority', 'destination_id', 'priority'),
    )

    def __repr__(self):
        return f"<POI(id={self.id}, name='{self.name}', category='{self.category}', likes={self.likes}, vetoes={self.vetoes})>"
