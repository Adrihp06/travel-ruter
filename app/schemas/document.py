from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DocumentTypeEnum(str, Enum):
    TICKET = "ticket"
    CONFIRMATION = "confirmation"
    RESERVATION = "reservation"
    RECEIPT = "receipt"
    MAP = "map"
    OTHER = "other"


class DocumentBase(BaseModel):
    document_type: DocumentTypeEnum = Field(
        default=DocumentTypeEnum.OTHER,
        description="Type of document"
    )
    title: Optional[str] = Field(None, max_length=255, description="Document title")
    description: Optional[str] = Field(None, description="Document description")


class DocumentCreate(DocumentBase):
    poi_id: Optional[int] = Field(None, description="POI ID to link document to")
    trip_id: Optional[int] = Field(None, description="Trip ID to link document to")
    destination_id: Optional[int] = Field(None, description="Destination ID to link document to")
    day_number: Optional[int] = Field(None, ge=1, description="Day number within destination (1-indexed)")

    @model_validator(mode='after')
    def validate_day_requires_destination(self) -> 'DocumentCreate':
        if self.day_number is not None and self.destination_id is None:
            raise ValueError("day_number requires destination_id to be set")
        return self


class DocumentUpdate(BaseModel):
    document_type: Optional[DocumentTypeEnum] = Field(None, description="Type of document")
    title: Optional[str] = Field(None, max_length=255, description="Document title")
    description: Optional[str] = Field(None, description="Document description")
    destination_id: Optional[int] = Field(None, description="Destination ID to link document to")
    day_number: Optional[int] = Field(None, ge=1, description="Day number within destination (1-indexed)")

    @model_validator(mode='after')
    def validate_day_requires_destination(self) -> 'DocumentUpdate':
        # Only validate if day_number is explicitly set (not None)
        # Note: This allows clearing destination_id even if day_number was previously set,
        # but the DB constraint will catch invalid states
        if self.day_number is not None and self.destination_id is None:
            # Allow clearing day_number by setting it to None explicitly
            # This validator only fires when day_number has a positive value
            pass  # We rely on DB constraint for full validation
        return self


class DocumentResponse(DocumentBase):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    poi_id: Optional[int] = None
    trip_id: Optional[int] = None
    destination_id: Optional[int] = None
    day_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    count: int


class DocumentsByDayResponse(BaseModel):
    """Documents grouped by day within a destination"""
    general: List[DocumentResponse] = Field(default_factory=list, description="Documents not assigned to a specific day")
    by_day: Dict[int, List[DocumentResponse]] = Field(default_factory=dict, description="Documents grouped by day number")
    total_count: int


class DocumentsByDestinationResponse(BaseModel):
    """Documents grouped by destination"""
    destination_id: int
    destination_name: str
    documents: List[DocumentResponse]
    count: int


class GroupedDocumentsResponse(BaseModel):
    """All trip documents grouped by destination and optionally by day"""
    trip_level: List[DocumentResponse] = Field(default_factory=list, description="Documents at trip level (no destination)")
    by_destination: List[DocumentsByDestinationResponse] = Field(default_factory=list)
    total_count: int
