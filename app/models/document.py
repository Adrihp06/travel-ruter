from sqlalchemy import Column, String, Integer, ForeignKey, Text, BigInteger, Index, Enum
from sqlalchemy.orm import relationship
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

    # Relationships
    poi = relationship("POI", backref="documents")
    trip = relationship("Trip", backref="documents")


    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', type='{self.document_type}')>"
