"""
Schemas for note management tool.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class NoteOperation(str, Enum):
    """Available operations for manage_note tool."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"


class NoteResult(BaseModel):
    """Schema for a managed note result."""

    id: int = Field(..., description="Note ID")
    trip_id: int = Field(..., description="Parent trip ID")
    destination_id: Optional[int] = Field(default=None, description="Destination ID")
    poi_id: Optional[int] = Field(default=None, description="Linked POI ID")
    day_number: Optional[int] = Field(default=None, description="Day number (1-indexed)")
    title: str = Field(..., description="Note title")
    content: Optional[str] = Field(default=None, description="Note content")
    note_type: str = Field(default="general", description="Note type")
    is_pinned: bool = Field(default=False, description="Whether note is pinned")
    tags: Optional[List[str]] = Field(default=None, description="Custom tags")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last update timestamp")


class ManageNoteOutput(BaseModel):
    """Output schema for manage_note tool."""

    operation: str = Field(..., description="Operation performed")
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    note: Optional[NoteResult] = Field(
        default=None,
        description="Note data (for create, read, update)",
    )
    notes: Optional[List[NoteResult]] = Field(
        default=None,
        description="List of notes (for list operation)",
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total count for list operation",
    )
