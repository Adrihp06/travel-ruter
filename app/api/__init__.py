from fastapi import APIRouter
from app.api.trips import router as trips_router
from app.api.content import router as content_router
from app.api.accommodation import router as accommodation_router
from app.api.auth import router as auth_router
from app.api.social import router as social_router
from app.api.maps import router as maps_router
from app.api.realtime import router as realtime_router

api_router = APIRouter()

# Include domain routers
api_router.include_router(trips_router)
api_router.include_router(content_router)
api_router.include_router(accommodation_router)
api_router.include_router(auth_router)
api_router.include_router(social_router)
api_router.include_router(maps_router)
api_router.include_router(realtime_router)

__all__ = ["api_router"]
