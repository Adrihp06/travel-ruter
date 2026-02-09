"""
Schemas for trip management tools.
"""

from typing import Optional, List, Dict, Any, Literal
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field
from enum import Enum


class TripOperation(str, Enum):
    """Available operations for manage_trip tool."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LIST = "list"


class TripStatus(str, Enum):
    """Trip status values."""

    PLANNING = "planning"
    ONGOING = "ongoing"
    COMPLETED = "completed"


class ManageTripInput(BaseModel):
    """Input schema for manage_trip tool."""

    operation: TripOperation = Field(
        ...,
        description="Operation to perform: create, read, update, delete, list",
    )
    trip_id: Optional[int] = Field(
        default=None,
        description="Trip ID (required for read, update, delete)",
    )

    # Fields for create/update operations
    name: Optional[str] = Field(
        default=None,
        description="Trip name",
        max_length=200,
    )
    location: Optional[str] = Field(
        default=None,
        description="Primary location/destination",
    )
    latitude: Optional[float] = Field(
        default=None,
        description="Primary location latitude",
        ge=-90,
        le=90,
    )
    longitude: Optional[float] = Field(
        default=None,
        description="Primary location longitude",
        ge=-180,
        le=180,
    )
    description: Optional[str] = Field(
        default=None,
        description="Trip description",
    )
    start_date: Optional[date] = Field(
        default=None,
        description="Trip start date",
    )
    end_date: Optional[date] = Field(
        default=None,
        description="Trip end date",
    )
    total_budget: Optional[Decimal] = Field(
        default=None,
        description="Total budget for the trip",
        ge=0,
    )
    currency: Optional[str] = Field(
        default="EUR",
        description="Budget currency (ISO 4217)",
        max_length=3,
    )
    status: Optional[TripStatus] = Field(
        default=None,
        description="Trip status",
    )
    tags: Optional[List[str]] = Field(
        default=None,
        description="Trip tags for categorization",
    )

    # Origin/Return points
    origin_name: Optional[str] = Field(
        default=None,
        description="Starting point name",
    )
    origin_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    origin_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    return_name: Optional[str] = Field(
        default=None,
        description="Return point name",
    )
    return_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    return_longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    # List operation filters
    skip: int = Field(default=0, description="Number of records to skip", ge=0)
    limit: int = Field(default=100, description="Maximum records to return", ge=1, le=100)


class DestinationSummary(BaseModel):
    """Summary of a trip destination."""

    id: int
    city_name: str
    country: Optional[str] = None
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    poi_count: int = 0


class TripResult(BaseModel):
    """Schema for trip operation result."""

    id: int = Field(..., description="Trip ID")
    name: str = Field(..., description="Trip name")
    location: Optional[str] = Field(default=None, description="Primary location")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_budget: Optional[Decimal] = None
    currency: str = "EUR"
    status: str = "planning"
    tags: List[str] = Field(default_factory=list)

    # Origin/Return
    origin_name: Optional[str] = None
    return_name: Optional[str] = None

    # Summary fields
    duration_days: Optional[int] = Field(
        default=None,
        description="Trip duration in days",
    )
    destinations: List[DestinationSummary] = Field(
        default_factory=list,
        description="List of destinations",
    )
    total_pois: int = Field(default=0, description="Total POIs across all destinations")
    scheduled_pois: int = Field(default=0, description="POIs with scheduled dates")


class ManageTripOutput(BaseModel):
    """Output schema for manage_trip tool."""

    operation: str = Field(..., description="Operation performed")
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    trip: Optional[TripResult] = Field(
        default=None,
        description="Trip data (for create, read, update)",
    )
    trips: Optional[List[TripResult]] = Field(
        default=None,
        description="List of trips (for list operation)",
    )
    total_count: Optional[int] = Field(
        default=None,
        description="Total count for list operation",
    )
