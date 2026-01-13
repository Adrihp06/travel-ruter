from fastapi import APIRouter
from app.api.routes import router as routes_router
from app.api.trips import router as trips_router
from app.api.destinations import router as destinations_router
from app.api.pois import router as pois_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(routes_router, tags=["routes"])
api_router.include_router(trips_router, prefix="/trips", tags=["trips"])
api_router.include_router(destinations_router, tags=["destinations"])
api_router.include_router(pois_router, tags=["pois"])

__all__ = ["api_router"]
