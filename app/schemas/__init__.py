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
]
