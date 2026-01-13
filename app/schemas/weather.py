from typing import Optional
from pydantic import BaseModel, Field


class WeatherResponse(BaseModel):
    """Response schema for weather data."""

    destination_id: int = Field(..., description="Destination ID")
    city_name: str = Field(..., description="City name")
    month: int = Field(..., ge=1, le=12, description="Month number (1-12)")
    month_name: str = Field(..., description="Month name (e.g., 'July')")
    average_temperature: Optional[float] = Field(
        None, description="Average temperature in Celsius"
    )
    temperature_unit: str = Field(default="°C", description="Temperature unit")
    display_text: Optional[str] = Field(
        None, description="Formatted display text (e.g., 'Average temp in July: 25°C')"
    )
