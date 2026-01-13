from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Destination
from app.schemas import WeatherResponse
from app.services.weather_service import WeatherService

router = APIRouter()


@router.get("/destinations/{id}/weather", response_model=WeatherResponse)
async def get_destination_weather(
    id: int,
    month: Optional[int] = Query(
        None,
        ge=1,
        le=12,
        description="Month number (1-12). If not provided, uses the arrival month of the destination."
    ),
    db: AsyncSession = Depends(get_db)
):
    """
    Get weather information for a destination.

    Returns average historical temperature for the travel month.
    Uses OpenMeteo API with caching to minimize API calls.
    """
    # Fetch destination
    result = await db.execute(select(Destination).where(Destination.id == id))
    destination = result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {id} not found"
        )

    # Check if destination has coordinates
    if destination.latitude is None or destination.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Destination does not have coordinates set"
        )

    # Use provided month or fall back to arrival month
    target_month = month if month is not None else destination.arrival_date.month
    month_name = WeatherService.get_month_name(target_month)

    # Fetch weather data from OpenMeteo
    avg_temp = await WeatherService.get_average_temperature(
        latitude=destination.latitude,
        longitude=destination.longitude,
        month=target_month
    )

    # Build display text
    display_text = None
    if avg_temp is not None:
        display_text = f"Average temp in {month_name}: {avg_temp}°C"

    return WeatherResponse(
        destination_id=destination.id,
        city_name=destination.city_name,
        month=target_month,
        month_name=month_name,
        average_temperature=avg_temp,
        temperature_unit="°C",
        display_text=display_text
    )
