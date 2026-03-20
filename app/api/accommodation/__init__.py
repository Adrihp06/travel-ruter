from fastapi import APIRouter

from app.api.accommodation.accommodations import router as accommodations_router
from app.api.accommodation.hotels import router as hotels_router

router = APIRouter()
router.include_router(accommodations_router, tags=["accommodations"])
router.include_router(hotels_router, tags=["hotels"])
