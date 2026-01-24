"""Pydantic schemas for TravelStop model."""
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TravelStopBase(BaseModel):
    """Base schema for travel stops."""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the stop location")
    description: Optional[str] = Field(None, description="Notes or description about the stop")
    latitude: float = Field(..., ge=-90, le=90, description="Stop latitude coordinate")
    longitude: float = Field(..., ge=-180, le=180, description="Stop longitude coordinate")
    address: Optional[str] = Field(None, max_length=500, description="Full address of the stop")
    stop_date: Optional[date] = Field(None, description="Date of the stop")
    duration_minutes: int = Field(60, ge=0, description="Estimated time at stop (minutes)")
    arrival_time: Optional[str] = Field(
        None,
        pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
        description="Planned arrival time (HH:MM format)"
    )


class TravelStopCreate(TravelStopBase):
    """Schema for creating a travel stop."""
    travel_segment_id: int = Field(..., description="ID of the travel segment this stop belongs to")
    order_index: Optional[int] = Field(None, ge=0, description="Order within segment (auto-assigned if not provided)")


class TravelStopUpdate(BaseModel):
    """Schema for updating a travel stop."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Name of the stop location")
    description: Optional[str] = Field(None, description="Notes or description about the stop")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Stop latitude coordinate")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Stop longitude coordinate")
    address: Optional[str] = Field(None, max_length=500, description="Full address of the stop")
    stop_date: Optional[date] = Field(None, description="Date of the stop")
    duration_minutes: Optional[int] = Field(None, ge=0, description="Estimated time at stop (minutes)")
    arrival_time: Optional[str] = Field(
        None,
        pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
        description="Planned arrival time (HH:MM format)"
    )
    order_index: Optional[int] = Field(None, ge=0, description="Order within segment")


class TravelStopResponse(TravelStopBase):
    """Schema for travel stop API responses."""
    id: int
    travel_segment_id: int
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TravelStopBulkCreate(BaseModel):
    """Schema for creating multiple travel stops at once."""
    travel_segment_id: int = Field(..., description="ID of the travel segment")
    stops: list[TravelStopBase] = Field(..., description="List of stops to create")


class TravelStopReorderRequest(BaseModel):
    """Schema for reordering stops within a segment."""
    stop_ids: list[int] = Field(..., description="Ordered list of stop IDs")
