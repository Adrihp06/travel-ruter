from datetime import date, timedelta
from typing import Optional
import httpx

from app.core.http_client import get_http_client

# In-memory cache for weather data
# Key: (lat, lon, month) tuple, Value: (temperature, timestamp)
_weather_cache: dict[tuple[float, float, int], tuple[float, date]] = {}
CACHE_EXPIRY_DAYS = 7


class WeatherService:
    """Service to fetch weather data from OpenMeteo API."""

    OPEN_METEO_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"

    @staticmethod
    def _get_cache_key(latitude: float, longitude: float, month: int) -> tuple[float, float, int]:
        """Generate cache key from coordinates and month (rounded to 2 decimal places)."""
        return (round(latitude, 2), round(longitude, 2), month)

    @staticmethod
    def _is_cache_valid(cached_date: date) -> bool:
        """Check if cached data is still valid."""
        return (date.today() - cached_date).days < CACHE_EXPIRY_DAYS

    @classmethod
    async def get_average_temperature(
        cls,
        latitude: float,
        longitude: float,
        month: int
    ) -> Optional[float]:
        """
        Get average temperature for a specific month at given coordinates.
        Uses historical data from last year to calculate the average.

        Args:
            latitude: Latitude of the location
            longitude: Longitude of the location
            month: Month number (1-12)

        Returns:
            Average temperature in Celsius or None if unavailable
        """
        cache_key = cls._get_cache_key(latitude, longitude, month)

        # Check cache first
        if cache_key in _weather_cache:
            cached_temp, cached_date = _weather_cache[cache_key]
            if cls._is_cache_valid(cached_date):
                return cached_temp

        # Calculate date range for last year's same month
        current_year = date.today().year
        last_year = current_year - 1

        # Get first and last day of the month from last year
        start_date = date(last_year, month, 1)
        if month == 12:
            end_date = date(last_year, 12, 31)
        else:
            end_date = date(last_year, month + 1, 1) - timedelta(days=1)

        try:
            client = await get_http_client()
            response = await client.get(
                cls.OPEN_METEO_BASE_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "daily": "temperature_2m_mean",
                    "timezone": "auto"
                }
            )
            response.raise_for_status()
            data = response.json()

            daily_data = data.get("daily", {})
            temperatures = daily_data.get("temperature_2m_mean", [])

            if not temperatures:
                return None

            # Filter out None values and calculate average
            valid_temps = [t for t in temperatures if t is not None]
            if not valid_temps:
                return None

            avg_temp = sum(valid_temps) / len(valid_temps)
            avg_temp = round(avg_temp, 1)

            # Cache the result
            _weather_cache[cache_key] = (avg_temp, date.today())

            return avg_temp

        except (httpx.HTTPError, KeyError, ValueError):
            return None

    @classmethod
    def get_month_name(cls, month: int) -> str:
        """Get month name from month number."""
        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        return month_names[month - 1] if 1 <= month <= 12 else "Unknown"

    @classmethod
    def clear_cache(cls) -> None:
        """Clear the weather cache."""
        _weather_cache.clear()
