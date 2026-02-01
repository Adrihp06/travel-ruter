from sqlalchemy import Column, String, Integer, ForeignKey, Text, Boolean, Float, Index, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import ARRAY, JSON
import enum
from app.models.base import BaseModel


class NoteType(str, enum.Enum):
    GENERAL = "general"
    DESTINATION = "destination"
    DAY = "day"
    POI = "poi"


class Note(BaseModel):
    __tablename__ = "notes"

    # Core fields
    title = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=True, comment="Rich text content (HTML or JSON)")
    note_type = Column(String(50), nullable=False, default=NoteType.GENERAL.value, index=True)

    # Relationships - notes can be linked at different levels
    trip_id = Column(
        Integer,
        ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    destination_id = Column(
        Integer,
        ForeignKey("destinations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Destination this note belongs to (optional)"
    )
    day_number = Column(
        Integer,
        nullable=True,
        comment="Day number within destination (1-indexed)"
    )
    poi_id = Column(
        Integer,
        ForeignKey("pois.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="POI this note is linked to (optional)"
    )

    # Organization and display
    is_pinned = Column(Boolean, nullable=False, default=False, index=True)
    is_private = Column(Boolean, nullable=False, default=True, comment="For future collaborative features")

    # Location tagging (optional)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    location_name = Column(String(255), nullable=True)

    # Mood/weather tags and general tags
    mood = Column(String(50), nullable=True, comment="Mood tag (happy, tired, excited, etc.)")
    weather = Column(String(50), nullable=True, comment="Weather tag (sunny, rainy, cloudy, etc.)")
    tags = Column(ARRAY(String(50)), nullable=True, default=[], comment="Custom tags for categorization")

    # Media attachments (stored as JSON array of file paths/metadata)
    media_files = Column(JSON, nullable=True, default=[], comment="Array of media file paths and metadata")

    # Relationships
    trip = relationship("Trip", backref="trip_notes")
    destination = relationship("Destination", backref="destination_notes")
    poi = relationship("POI", backref="poi_notes")

    # Constraints
    __table_args__ = (
        # If day_number is set, destination_id must also be set
        CheckConstraint(
            "(day_number IS NULL) OR (destination_id IS NOT NULL)",
            name="note_day_requires_destination"
        ),
        # day_number must be positive
        CheckConstraint(
            "(day_number IS NULL) OR (day_number > 0)",
            name="note_day_number_positive"
        ),
        # If poi_id is set, destination_id should also be set (POIs belong to destinations)
        CheckConstraint(
            "(poi_id IS NULL) OR (destination_id IS NOT NULL)",
            name="note_poi_requires_destination"
        ),
        Index('ix_notes_trip_destination', 'trip_id', 'destination_id'),
        Index('ix_notes_destination_day', 'destination_id', 'day_number'),
        Index('ix_notes_trip_pinned', 'trip_id', 'is_pinned'),
        Index('ix_notes_dest_poi', 'destination_id', 'poi_id'),
    )

    @validates('day_number')
    def validate_day_number(self, key, value):
        if value is not None and value < 1:
            raise ValueError("day_number must be 1 or greater")
        return value

    @validates('note_type')
    def validate_note_type(self, key, value):
        if value and value not in [e.value for e in NoteType]:
            raise ValueError(f"Invalid note_type: {value}")
        return value

    def __repr__(self):
        return f"<Note(id={self.id}, title='{self.title}', type='{self.note_type}')>"
