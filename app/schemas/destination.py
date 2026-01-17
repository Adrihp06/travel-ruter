from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DestinationBase(BaseModel):
    city_name: str = Field(..., min_length=1, max_length=255, description="City name")
    country: Optional[str] = Field(None, max_length=255, description="Country")
    arrival_date: date = Field(..., description="Arrival date")
    departure_date: date = Field(..., description="Departure date")
    notes: Optional[str] = Field(None, description="Additional notes")
    order_index: int = Field(default=0, description="Order of destination in trip")

    # Additional fields for destination details
    name: Optional[str] = Field(None, description="Destination name")
    description: Optional[str] = Field(None, description="Destination description")
    address: Optional[str] = Field(None, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")


class DestinationCreate(DestinationBase):
    trip_id: int = Field(..., description="Trip ID")


class DestinationUpdate(BaseModel):
    city_name: Optional[str] = Field(None, min_length=1, max_length=255, description="City name")
    country: Optional[str] = Field(None, min_length=1, max_length=255, description="Country")
    arrival_date: Optional[date] = Field(None, description="Arrival date")
    departure_date: Optional[date] = Field(None, description="Departure date")
    notes: Optional[str] = Field(None, description="Additional notes")
    order_index: Optional[int] = Field(None, description="Order of destination in trip")
    name: Optional[str] = Field(None, description="Destination name")
    description: Optional[str] = Field(None, description="Destination description")
    address: Optional[str] = Field(None, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")


class DestinationResponse(DestinationBase):
    id: int
    trip_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
