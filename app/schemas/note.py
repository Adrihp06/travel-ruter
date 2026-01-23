from datetime import datetime
from typing import Optional, List, Any, Dict
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, model_validator


class NoteTypeEnum(str, Enum):
    GENERAL = "general"
    DESTINATION = "destination"
    DAY = "day"
    POI = "poi"


class MediaFile(BaseModel):
    """Schema for media file metadata"""
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    uploaded_at: Optional[datetime] = None


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Note title")
    content: Optional[str] = Field(None, description="Rich text content (HTML or JSON)")
    note_type: NoteTypeEnum = Field(
        default=NoteTypeEnum.GENERAL,
        description="Type of note (general, destination, day, poi)"
    )

    # Organization
    is_pinned: bool = Field(default=False, description="Whether the note is pinned")
    is_private: bool = Field(default=True, description="For future collaborative features")

    # Location tagging
    location_lat: Optional[float] = Field(None, description="Latitude for location tagging")
    location_lng: Optional[float] = Field(None, description="Longitude for location tagging")
    location_name: Optional[str] = Field(None, max_length=255, description="Location name")

    # Mood/weather tags
    mood: Optional[str] = Field(None, max_length=50, description="Mood tag")
    weather: Optional[str] = Field(None, max_length=50, description="Weather tag")
    tags: Optional[List[str]] = Field(default=[], description="Custom tags for categorization")


class NoteCreate(NoteBase):
    trip_id: int = Field(..., description="Trip ID (required)")
    destination_id: Optional[int] = Field(None, description="Destination ID")
    day_number: Optional[int] = Field(None, ge=1, description="Day number within destination (1-indexed)")
    poi_id: Optional[int] = Field(None, description="POI ID to link note to")

    @model_validator(mode='after')
    def validate_relationships(self) -> 'NoteCreate':
        # If day_number is set, destination_id must be set
        if self.day_number is not None and self.destination_id is None:
            raise ValueError("day_number requires destination_id to be set")
        # If poi_id is set, destination_id should be set
        if self.poi_id is not None and self.destination_id is None:
            raise ValueError("poi_id requires destination_id to be set")
        return self


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="Note title")
    content: Optional[str] = Field(None, description="Rich text content")
    note_type: Optional[NoteTypeEnum] = Field(None, description="Type of note")

    # Relationship updates
    destination_id: Optional[int] = Field(None, description="Destination ID")
    day_number: Optional[int] = Field(None, ge=1, description="Day number within destination")
    poi_id: Optional[int] = Field(None, description="POI ID")

    # Organization
    is_pinned: Optional[bool] = Field(None, description="Whether the note is pinned")
    is_private: Optional[bool] = Field(None, description="Privacy setting")

    # Location tagging
    location_lat: Optional[float] = Field(None, description="Latitude")
    location_lng: Optional[float] = Field(None, description="Longitude")
    location_name: Optional[str] = Field(None, max_length=255, description="Location name")

    # Mood/weather tags
    mood: Optional[str] = Field(None, max_length=50, description="Mood tag")
    weather: Optional[str] = Field(None, max_length=50, description="Weather tag")
    tags: Optional[List[str]] = Field(None, description="Custom tags")


class NoteResponse(NoteBase):
    id: int
    trip_id: int
    destination_id: Optional[int] = None
    day_number: Optional[int] = None
    poi_id: Optional[int] = None
    media_files: Optional[List[Dict[str, Any]]] = Field(default=[], description="Media attachments")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoteListResponse(BaseModel):
    notes: List[NoteResponse]
    count: int


class NotesByDayResponse(BaseModel):
    """Notes grouped by day within a destination"""
    general: List[NoteResponse] = Field(default_factory=list, description="Notes not assigned to a specific day")
    by_day: Dict[int, List[NoteResponse]] = Field(default_factory=dict, description="Notes grouped by day number")
    total_count: int


class NotesByDestinationResponse(BaseModel):
    """Notes grouped by destination"""
    destination_id: int
    destination_name: str
    notes: List[NoteResponse]
    count: int


class GroupedNotesResponse(BaseModel):
    """All trip notes grouped by destination and optionally by day"""
    trip_level: List[NoteResponse] = Field(default_factory=list, description="Notes at trip level (no destination)")
    pinned: List[NoteResponse] = Field(default_factory=list, description="Pinned notes")
    by_destination: List[NotesByDestinationResponse] = Field(default_factory=list)
    total_count: int


class NoteSearchRequest(BaseModel):
    """Search parameters for notes"""
    query: str = Field(..., min_length=1, description="Search query")
    trip_id: Optional[int] = Field(None, description="Filter by trip")
    destination_id: Optional[int] = Field(None, description="Filter by destination")
    note_type: Optional[NoteTypeEnum] = Field(None, description="Filter by note type")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")


class NoteSearchResponse(BaseModel):
    """Search results for notes"""
    notes: List[NoteResponse]
    count: int
    query: str


class NoteExportRequest(BaseModel):
    """Export request parameters"""
    format: str = Field(..., pattern="^(pdf|markdown|md)$", description="Export format (pdf or markdown)")
    note_ids: Optional[List[int]] = Field(None, description="Specific note IDs to export (optional)")
    include_media: bool = Field(default=False, description="Include media files in export")


class NoteExportResponse(BaseModel):
    """Export result"""
    filename: str
    file_path: str
    format: str
    note_count: int
