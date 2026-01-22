from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RouteWaypointBase(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Optional user label for waypoint")
    latitude: float = Field(..., ge=-90, le=90, description="Waypoint latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Waypoint longitude")


class RouteWaypointCreate(RouteWaypointBase):
    order_index: Optional[int] = Field(None, ge=0, description="Order within segment (auto-assigned if not provided)")


class RouteWaypointUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255, description="Optional user label for waypoint")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Waypoint latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Waypoint longitude")


class RouteWaypointResponse(RouteWaypointBase):
    id: int
    travel_segment_id: int
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RouteWaypointReorderItem(BaseModel):
    id: int = Field(..., description="Waypoint ID")
    order_index: int = Field(..., ge=0, description="New order index")


class RouteWaypointReorderRequest(BaseModel):
    waypoints: list[RouteWaypointReorderItem] = Field(..., description="List of waypoints with new order indices")


class SegmentWaypointsResponse(BaseModel):
    waypoints: list[RouteWaypointResponse]
