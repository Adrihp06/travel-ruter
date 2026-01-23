from fastapi import APIRouter
from app.api.routes import router as routes_router
from app.api.trips import router as trips_router
from app.api.destinations import router as destinations_router
from app.api.pois import router as pois_router
from app.api.weather import router as weather_router
from app.api.documents import router as documents_router
from app.api.accommodations import router as accommodations_router
from app.api.geocoding import router as geocoding_router
from app.api.travel_segments import router as travel_segments_router
from app.api.route_waypoints import router as route_waypoints_router
from app.api.notes import router as notes_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(routes_router, tags=["routes"])
api_router.include_router(trips_router, prefix="/trips", tags=["trips"])
api_router.include_router(destinations_router, tags=["destinations"])
api_router.include_router(pois_router, tags=["pois"])
api_router.include_router(weather_router, tags=["weather"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(accommodations_router, tags=["accommodations"])
api_router.include_router(geocoding_router, prefix="/geocoding", tags=["geocoding"])
api_router.include_router(travel_segments_router, tags=["travel-segments"])
api_router.include_router(route_waypoints_router, tags=["route-waypoints"])
api_router.include_router(notes_router, tags=["notes"])

__all__ = ["api_router"]
