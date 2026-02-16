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
from app.api.travel_stops import router as travel_stops_router
from app.api.notes import router as notes_router
from app.api.google_places import router as google_places_router
from app.api.hotels import router as hotels_router
from app.api.auth import router as auth_router
from app.api.collaboration import router as collaboration_router
from app.api.notifications import router as notifications_router
from app.api.api_keys import router as api_keys_router
from app.api.websocket import router as websocket_router
from app.api.comments import router as comments_router
from app.api.activity import router as activity_router
from app.api.conversations import router as conversations_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(routes_router, tags=["routes"])
api_router.include_router(trips_router, prefix="/trips", tags=["trips"])
api_router.include_router(destinations_router, tags=["destinations"])
api_router.include_router(pois_router, tags=["pois"])
api_router.include_router(weather_router, tags=["weather"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(accommodations_router, tags=["accommodations"])
api_router.include_router(hotels_router, tags=["hotels"])
api_router.include_router(geocoding_router, prefix="/geocoding", tags=["geocoding"])
api_router.include_router(travel_segments_router, tags=["travel-segments"])
api_router.include_router(route_waypoints_router, tags=["route-waypoints"])
api_router.include_router(travel_stops_router, tags=["travel-stops"])
api_router.include_router(notes_router, tags=["notes"])
api_router.include_router(google_places_router, prefix="/google-places", tags=["google-places"])
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(collaboration_router, tags=["collaboration"])
api_router.include_router(notifications_router, tags=["notifications"])
api_router.include_router(api_keys_router, tags=["api-keys"])
api_router.include_router(websocket_router, tags=["websocket"])
api_router.include_router(comments_router, tags=["comments"])
api_router.include_router(activity_router, tags=["activity"])
api_router.include_router(conversations_router, tags=["conversations"])

__all__ = ["api_router"]
