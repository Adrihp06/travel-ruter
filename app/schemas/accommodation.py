from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict, Field, model_validator


class AccommodationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Accommodation name")
    type: str = Field(..., min_length=1, max_length=100, description="Type: hotel, hostel, airbnb, camping, etc.")
    address: Optional[str] = Field(None, max_length=500, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    check_in_date: date = Field(..., description="Check-in date")
    check_out_date: date = Field(..., description="Check-out date")
    booking_reference: Optional[str] = Field(None, max_length=255, description="Booking reference number")
    booking_url: Optional[str] = Field(None, max_length=1000, description="Booking URL")
    total_cost: Optional[float] = Field(None, ge=0, description="Total cost")
    currency: str = Field(default="USD", max_length=3, description="Currency code")
    is_paid: bool = Field(default=False, description="Whether the accommodation is paid")
    description: Optional[str] = Field(None, description="Description")
    contact_info: Optional[dict] = Field(None, description="Contact information (phone, email, etc.)")
    amenities: Optional[List[str]] = Field(None, description="List of amenities")
    files: Optional[List[Any]] = Field(None, description="List of file URLs/metadata")
    rating: Optional[float] = Field(None, ge=0, le=5, description="Rating out of 5.0")
    review: Optional[str] = Field(None, description="Personal review")

    @model_validator(mode='after')
    def check_dates(self) -> 'AccommodationBase':
        if self.check_out_date <= self.check_in_date:
            raise ValueError('check_out_date must be after check_in_date')
        return self


class AccommodationCreate(AccommodationBase):
    destination_id: int = Field(..., description="Destination ID")


class AccommodationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Accommodation name")
    type: Optional[str] = Field(None, min_length=1, max_length=100, description="Type: hotel, hostel, airbnb, camping, etc.")
    address: Optional[str] = Field(None, max_length=500, description="Address")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    check_in_date: Optional[date] = Field(None, description="Check-in date")
    check_out_date: Optional[date] = Field(None, description="Check-out date")
    booking_reference: Optional[str] = Field(None, max_length=255, description="Booking reference number")
    booking_url: Optional[str] = Field(None, max_length=1000, description="Booking URL")
    total_cost: Optional[float] = Field(None, ge=0, description="Total cost")
    currency: Optional[str] = Field(None, max_length=3, description="Currency code")
    is_paid: Optional[bool] = Field(None, description="Whether the accommodation is paid")
    description: Optional[str] = Field(None, description="Description")
    contact_info: Optional[dict] = Field(None, description="Contact information (phone, email, etc.)")
    amenities: Optional[List[str]] = Field(None, description="List of amenities")
    files: Optional[List[Any]] = Field(None, description="List of file URLs/metadata")
    rating: Optional[float] = Field(None, ge=0, le=5, description="Rating out of 5.0")
    review: Optional[str] = Field(None, description="Personal review")


class AccommodationResponse(AccommodationBase):
    id: int
    destination_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
