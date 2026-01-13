from datetime import date, datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator


class TripBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Trip name")
    description: Optional[str] = Field(None, description="Trip description")
    start_date: date = Field(..., description="Trip start date")
    end_date: date = Field(..., description="Trip end date")
    total_budget: Optional[Decimal] = Field(None, description="Total trip budget", ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Currency code (ISO 4217)")
    status: str = Field(default="planning", max_length=50, description="Trip status (planning, booked, completed, cancelled)")

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
    description: Optional[str] = Field(None, description="Trip description")
    start_date: Optional[date] = Field(None, description="Trip start date")
    end_date: Optional[date] = Field(None, description="Trip end date")
    total_budget: Optional[Decimal] = Field(None, description="Total trip budget", ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3, description="Currency code (ISO 4217)")
    status: Optional[str] = Field(None, max_length=50, description="Trip status")

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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
