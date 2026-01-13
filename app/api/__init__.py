from fastapi import APIRouter
from app.api.routes import router as routes_router

api_router = APIRouter()

# Include all route modules
api_router.include_router(routes_router, tags=["routes"])

__all__ = ["api_router"]
