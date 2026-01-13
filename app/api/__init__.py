from fastapi import APIRouter
from app.api.routes import router as routes_router
from app.api.trips import router as trips_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(routes_router, tags=["routes"])
api_router.include_router(trips_router, prefix="/trips", tags=["trips"])

__all__ = ["api_router"]
