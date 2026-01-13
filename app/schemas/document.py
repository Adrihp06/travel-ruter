from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


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


class DocumentUpdate(BaseModel):
    document_type: Optional[DocumentTypeEnum] = Field(None, description="Type of document")
    title: Optional[str] = Field(None, max_length=255, description="Document title")
    description: Optional[str] = Field(None, description="Document description")


class DocumentResponse(DocumentBase):
    id: int
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    poi_id: Optional[int] = None
    trip_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    count: int
