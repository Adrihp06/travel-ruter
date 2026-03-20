from fastapi import APIRouter

from app.api.maps.geocoding import router as geocoding_router
from app.api.maps.google_places import router as google_places_router
from app.api.maps.weather import router as weather_router

router = APIRouter()
router.include_router(geocoding_router, prefix="/geocoding", tags=["geocoding"])
router.include_router(google_places_router, prefix="/google-places", tags=["google-places"])
router.include_router(weather_router, tags=["weather"])
