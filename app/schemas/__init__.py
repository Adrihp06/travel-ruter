from app.schemas.destination import (
    DestinationCreate,
    DestinationUpdate,
    DestinationResponse,
)
from app.schemas.trip import (
    TripCreate,
    TripUpdate,
    TripResponse,
)
from app.schemas.poi import (
    POICreate,
    POIUpdate,
    POIResponse,
    POIsByCategory,
)
from app.schemas.weather import WeatherResponse
from app.schemas.accommodation import (
    AccommodationCreate,
    AccommodationUpdate,
    AccommodationResponse,
)
from app.schemas.travel_segment import (
    TravelMode,
    TravelSegmentCreate,
    TravelSegmentUpdate,
    TravelSegmentResponse,
    TravelSegmentCalculateRequest,
    TravelSegmentWithDestinations,
    TripTravelSegmentsResponse,
)

__all__ = [
    "DestinationCreate",
    "DestinationUpdate",
    "DestinationResponse",
    "TripCreate",
    "TripUpdate",
    "TripResponse",
    "POICreate",
    "POIUpdate",
    "POIResponse",
    "POIsByCategory",
    "WeatherResponse",
    "AccommodationCreate",
    "AccommodationUpdate",
    "AccommodationResponse",
    "TravelMode",
    "TravelSegmentCreate",
    "TravelSegmentUpdate",
    "TravelSegmentResponse",
    "TravelSegmentCalculateRequest",
    "TravelSegmentWithDestinations",
    "TripTravelSegmentsResponse",
]
