from sqlalchemy import Column, String, Integer, ForeignKey, Text, BigInteger, Index, CheckConstraint
from sqlalchemy.orm import relationship, validates
import enum
from app.models.base import BaseModel


class DocumentType(str, enum.Enum):
    TICKET = "ticket"
    CONFIRMATION = "confirmation"
    RESERVATION = "reservation"
    RECEIPT = "receipt"
    MAP = "map"
    OTHER = "other"


class Document(BaseModel):
    __tablename__ = "documents"

    # File information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False, comment="File size in bytes")
    mime_type = Column(String(100), nullable=False)

    # Document metadata
    document_type = Column(String(50), nullable=False, default=DocumentType.OTHER.value)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # Relationships - documents can be linked to POIs or Trips
    poi_id = Column(Integer, ForeignKey("pois.id", ondelete="CASCADE"), nullable=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id", ondelete="CASCADE"), nullable=True, index=True)

    # Destination and day organization
    destination_id = Column(
        Integer,
        ForeignKey("destinations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Destination this document belongs to"
    )
    day_number = Column(
        Integer,
        nullable=True,
        comment="Day number within destination (1-indexed)"
    )

    # Relationships
    poi = relationship("POI", backref="documents")
    trip = relationship("Trip", backref="documents")
    destination = relationship("Destination", backref="documents")

    # Constraints
    __table_args__ = (
        # If day_number is set, destination_id must also be set
        CheckConstraint(
            "(day_number IS NULL) OR (destination_id IS NOT NULL)",
            name="day_requires_destination"
        ),
        # day_number must be positive
        CheckConstraint(
            "(day_number IS NULL) OR (day_number > 0)",
            name="day_number_positive"
        ),
        Index('ix_documents_destination_day', 'destination_id', 'day_number'),
    )

    @validates('day_number')
    def validate_day_number(self, key, value):
        if value is not None and value < 1:
            raise ValueError("day_number must be 1 or greater")
        return value


    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', type='{self.document_type}')>"
