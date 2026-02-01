"""
Custom exception classes for the Travel Ruter application.

These exceptions provide structured error handling with proper logging support.
"""


class TravelRuterException(Exception):
    """Base exception for all application-specific errors."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ExternalAPIError(TravelRuterException):
    """Raised when an external API call fails."""

    def __init__(self, service: str, message: str, status_code: int | None = None):
        super().__init__(f"{service} API error: {message}")
        self.service = service
        self.status_code = status_code


class GeocodingError(ExternalAPIError):
    """Raised when geocoding operations fail."""

    def __init__(self, provider: str, message: str, status_code: int | None = None):
        super().__init__(f"Geocoding ({provider})", message, status_code)
        self.provider = provider


class WeatherServiceError(ExternalAPIError):
    """Raised when weather service operations fail."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__("Weather", message, status_code)


class RouteCalculationError(TravelRuterException):
    """Raised when route calculation fails."""

    def __init__(self, message: str, segment_id: int | None = None):
        super().__init__(message)
        self.segment_id = segment_id


class DatabaseError(TravelRuterException):
    """Raised for database-related errors."""
    pass


class ValidationError(TravelRuterException):
    """Raised for data validation errors."""
    pass


class GooglePlacesError(ExternalAPIError):
    """Raised when Google Places API operations fail."""

    def __init__(self, message: str, place_id: str | None = None, status_code: int | None = None):
        super().__init__("Google Places", message, status_code)
        self.place_id = place_id
