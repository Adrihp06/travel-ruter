from fastapi import APIRouter

from app.api.social.collaboration import router as collaboration_router
from app.api.social.activity import router as activity_router
from app.api.social.notifications import router as notifications_router

router = APIRouter()
router.include_router(collaboration_router, tags=["collaboration"])
router.include_router(activity_router, tags=["activity"])
router.include_router(notifications_router, tags=["notifications"])
