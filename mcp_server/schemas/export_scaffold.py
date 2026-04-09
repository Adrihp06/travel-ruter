"""
Pydantic schemas for the scaffold_export_documents MCP tool.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class ScaffoldedDocument(BaseModel):
    """A single scaffolded export document."""

    note_id: int = Field(..., description="ID of the created/updated export_draft note")
    title: str = Field(..., description="Document title")
    destination_id: Optional[int] = Field(
        default=None, description="Destination ID (null for trip overview)"
    )
    action: str = Field(..., description="'created' or 'updated' or 'skipped'")
    content_length: int = Field(
        default=0, description="Length of the generated markdown content"
    )


class ScaffoldExportOutput(BaseModel):
    """Output from scaffold_export_documents."""

    success: bool = Field(..., description="Whether the operation succeeded")
    message: str = Field(..., description="Human-readable summary")
    documents: List[ScaffoldedDocument] = Field(
        default_factory=list, description="List of scaffolded documents"
    )
    total_created: int = Field(default=0, description="Number of documents created")
    total_updated: int = Field(default=0, description="Number of documents updated")
    total_skipped: int = Field(default=0, description="Number of documents skipped (had content)")
