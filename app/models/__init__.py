from app.models.base import BaseModel
from app.models.route import Route
from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.models.accommodation import Accommodation
from app.models.document import Document, DocumentType
from app.models.travel_segment import TravelSegment

__all__ = [
    "BaseModel",
    "Route",
    "Trip",
    "Destination",
    "POI",
    "Accommodation",
    "Document",
    "DocumentType",
    "TravelSegment",
]
