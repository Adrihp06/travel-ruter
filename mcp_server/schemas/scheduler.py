"""
Schemas for smart scheduling tools.
"""

from typing import Optional, List, Dict, Any
from datetime import date, time
from pydantic import BaseModel, Field


class SchedulerConstraints(BaseModel):
    """Constraints for the smart scheduler."""

    max_food_per_day: int = Field(
        default=2,
        description="Maximum food/restaurant POIs per day",
        ge=1,
        le=4,
    )
    max_hours_per_day: int = Field(
        default=8,
        description="Maximum activity hours per day",
        ge=4,
        le=12,
    )
    max_travel_minutes_in_cluster: int = Field(
        default=15,
        description="Maximum travel time within a cluster (minutes)",
        ge=5,
        le=60,
    )


class POIInput(BaseModel):
    """POI data for scheduling."""

    id: int = Field(..., description="POI ID")
    name: str = Field(..., description="POI name")
    category: str = Field(..., description="POI category")
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    dwell_time: int = Field(
        default=60,
        description="Expected time at POI in minutes",
    )
    is_anchored: bool = Field(
        default=False,
        description="Whether POI is time-anchored",
    )
    anchored_time: Optional[str] = Field(
        default=None,
        description="Anchored time (HH:MM)",
    )
    scheduled_date: Optional[str] = Field(
        default=None,
        description="Pre-scheduled date (YYYY-MM-DD)",
    )


class DayInput(BaseModel):
    """Day data for scheduling."""

    date: str = Field(..., description="Date (YYYY-MM-DD)")
    day_number: int = Field(..., description="Day number in trip")


class AccommodationInput(BaseModel):
    """Accommodation data for scheduling optimization."""

    day_number: int = Field(..., description="Day number")
    name: str = Field(..., description="Accommodation name")
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)


class GenerateSmartScheduleInput(BaseModel):
    """Input schema for generate_smart_schedule tool."""

    pois: List[POIInput] = Field(
        ...,
        description="List of POIs to schedule",
    )
    days: List[DayInput] = Field(
        ...,
        description="Available days for scheduling",
    )
    constraints: Optional[SchedulerConstraints] = Field(
        default=None,
        description="Scheduling constraints (defaults applied if not provided)",
    )
    accommodations: Optional[List[AccommodationInput]] = Field(
        default=None,
        description="Accommodations by day for proximity optimization",
    )
    transport_profile: str = Field(
        default="foot-walking",
        description="Transport mode: foot-walking, cycling-regular, driving-car",
    )

    # Optional pre-computed travel matrix
    travel_matrix: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Pre-computed travel matrix from get_travel_matrix",
    )


class POIAssignment(BaseModel):
    """Assignment of a POI to a day."""

    poi_id: int = Field(..., description="POI ID")
    poi_name: str = Field(..., description="POI name")
    scheduled_date: str = Field(..., description="Assigned date (YYYY-MM-DD)")
    day_order: int = Field(..., description="Order within the day (0-indexed)")
    is_anchored: bool = Field(default=False)
    anchored_time: Optional[str] = Field(default=None)


class DaySummary(BaseModel):
    """Summary of a scheduled day."""

    date: str = Field(..., description="Date (YYYY-MM-DD)")
    day_number: int = Field(..., description="Day number")
    poi_count: int = Field(..., description="Number of POIs")
    anchored_count: int = Field(default=0, description="Number of anchored POIs")
    dwell_time_hours: float = Field(..., description="Total activity hours")
    travel_time_minutes: int = Field(..., description="Total travel time")
    total_time_hours: float = Field(..., description="Total hours (activity + travel)")
    food_count: int = Field(..., description="Number of food POIs")
    accommodation: Optional[str] = Field(default=None, description="Accommodation name")

    # Warnings
    warnings: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Day-specific warnings",
    )


class ScheduleWarning(BaseModel):
    """Warning about the schedule."""

    day_number: int = Field(..., description="Affected day")
    type: str = Field(
        ...,
        description="Warning type: time_exceeded, time_near_limit, food_exceeded, overloaded, no_accommodation",
    )
    severity: str = Field(..., description="Severity: error, warning, info")
    message: str = Field(..., description="Human-readable message")


class ScheduleStats(BaseModel):
    """Statistics about the generated schedule."""

    total_pois: int = Field(..., description="Total POIs to schedule")
    distributed_pois: int = Field(..., description="Successfully scheduled POIs")
    anchored_count: int = Field(..., description="Number of anchored POIs")
    avg_hours_per_day: float = Field(..., description="Average hours per day")
    days_used: int = Field(..., description="Number of days with POIs")


class SmartScheduleResult(BaseModel):
    """Schema for smart schedule generation result."""

    success: bool = Field(..., description="Whether scheduling succeeded")
    message: str = Field(..., description="Summary message")

    # Assignments
    assignments: List[POIAssignment] = Field(
        ...,
        description="List of POI-to-day assignments",
    )

    # Day summaries for preview
    day_summaries: List[DaySummary] = Field(
        ...,
        description="Summary of each day's schedule",
    )

    # Statistics
    stats: ScheduleStats = Field(..., description="Schedule statistics")

    # Warnings
    warnings: List[ScheduleWarning] = Field(
        default_factory=list,
        description="Schedule warnings and recommendations",
    )

    # Constraints used
    constraints_applied: Dict[str, Any] = Field(
        ...,
        description="Constraints that were applied",
    )
