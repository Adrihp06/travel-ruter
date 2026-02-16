"""
Schemas for accommodation management tools.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from enum import Enum


class AccommodationOperation(str, Enum):
    """Available operations for manage_accommodation tool."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"


class AccommodationResult(BaseModel):
    """Schema for a managed accommodation result."""

    id: int = Field(..., description="Accommodation ID")
    destination_id: int = Field(..., description="Parent destination ID")
    name: str = Field(..., description="Accommodation name")
    type: str = Field(..., description="Type: hotel, hostel, airbnb, camping, etc.")
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    check_in_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    check_out_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    booking_reference: Optional[str] = None
    booking_url: Optional[str] = None
    total_cost: Optional[float] = None
    currency: str = "USD"
    is_paid: bool = False
    description: Optional[str] = None
    contact_info: Optional[dict] = None
    amenities: Optional[List[str]] = None
    files: Optional[List[Any]] = None
    rating: Optional[float] = None
    review: Optional[str] = None


class ManageAccommodationOutput(BaseModel):
    """Output schema for manage_accommodation tool."""

    operation: str = Field(..., description="Operation performed")
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    accommodation: Optional[AccommodationResult] = Field(
        default=None,
        description="Accommodation data (for create, read, update)",
    )
    accommodations: Optional[List[AccommodationResult]] = Field(
        default=None,
        description="List of accommodations (for list operation)",
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total count for list operation",
    )
