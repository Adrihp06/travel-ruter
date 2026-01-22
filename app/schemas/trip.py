from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.schemas.destination import DestinationResponse


class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Trip name")
    location: Optional[str] = Field(None, max_length=255, description="Trip location")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Location latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Location longitude")
    description: Optional[str] = Field(None, description="Trip description")
    cover_image: Optional[str] = Field(None, max_length=500, description="Cover image URL")
    start_date: date = Field(..., description="Trip start date")
    end_date: date = Field(..., description="Trip end date")
    total_budget: Optional[Decimal] = Field(None, description="Total trip budget", ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Currency code (ISO 4217)")
    status: str = Field(default="planning", max_length=50, description="Trip status (planning, booked, completed, cancelled)")
    tags: Optional[List[str]] = Field(default_factory=list, description="Trip tags/categories")

    # Origin point (departure airport/location)
    origin_name: Optional[str] = Field(None, max_length=255, description="Origin location name (e.g., home airport)")
    origin_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Origin latitude")
    origin_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Origin longitude")

    # Return point (arrival airport/location) - defaults to origin if not specified
    return_name: Optional[str] = Field(None, max_length=255, description="Return location name (defaults to origin if not set)")
    return_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Return latitude")
    return_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Return longitude")

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: date, info) -> date:
        """Validate that end_date is not before start_date"""
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be on or after start_date")
        return v


class TripCreate(TripBase):
    """Schema for creating a new trip"""
    pass


class TripUpdate(BaseModel):
    """Schema for updating a trip - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Trip name")
    location: Optional[str] = Field(None, max_length=255, description="Trip location")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Location latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Location longitude")
    description: Optional[str] = Field(None, description="Trip description")
    cover_image: Optional[str] = Field(None, max_length=500, description="Cover image URL")
    start_date: Optional[date] = Field(None, description="Trip start date")
    end_date: Optional[date] = Field(None, description="Trip end date")
    total_budget: Optional[Decimal] = Field(None, description="Total trip budget", ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3, description="Currency code (ISO 4217)")
    status: Optional[str] = Field(None, max_length=50, description="Trip status")
    tags: Optional[List[str]] = Field(None, description="Trip tags/categories")

    # Origin point (departure airport/location)
    origin_name: Optional[str] = Field(None, max_length=255, description="Origin location name")
    origin_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Origin latitude")
    origin_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Origin longitude")

    # Return point (arrival airport/location)
    return_name: Optional[str] = Field(None, max_length=255, description="Return location name")
    return_latitude: Optional[float] = Field(None, ge=-90, le=90, description="Return latitude")
    return_longitude: Optional[float] = Field(None, ge=-180, le=180, description="Return longitude")

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: Optional[date], info) -> Optional[date]:
        """Validate that end_date is not before start_date"""
        if v is not None and "start_date" in info.data and info.data["start_date"] is not None:
            if v < info.data["start_date"]:
                raise ValueError("end_date must be on or after start_date")
        return v


class TripResponse(TripBase):
    """Schema for trip response - includes computed fields"""
    id: int
    nights: int = Field(..., description="Number of nights (automatically calculated)")
    tags: Optional[List[str]] = Field(default_factory=list, description="Trip tags/categories")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TripWithDestinationsResponse(TripResponse):
    """Schema for trip response with destinations included"""
    destinations: List[DestinationResponse] = Field(default_factory=list, description="List of destinations in this trip")


class BudgetSummary(BaseModel):
    """Schema for budget summary response"""
    total_budget: Optional[Decimal] = Field(None, description="Total trip budget set by user")
    estimated_total: Decimal = Field(..., description="Sum of all estimated costs from POIs")
    actual_total: Decimal = Field(..., description="Sum of all actual costs spent")
    currency: str = Field(default="USD", description="Currency code")
    remaining_budget: Optional[Decimal] = Field(None, description="Remaining budget (total_budget - actual_total)")
    budget_percentage: Optional[float] = Field(None, description="Percentage of budget spent (0-100)")

    model_config = ConfigDict(from_attributes=True)


class POIStats(BaseModel):
    """Schema for POI statistics response"""
    total_pois: int = Field(..., description="Total number of POIs in the trip")
    scheduled_pois: int = Field(..., description="Number of POIs that have been scheduled")

    model_config = ConfigDict(from_attributes=True)


class CoverImageUploadResponse(BaseModel):
    """Schema for cover image upload response"""
    url: str = Field(..., description="URL to access the uploaded cover image")
    filename: str = Field(..., description="Unique filename of the uploaded image")
