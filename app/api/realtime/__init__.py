from fastapi import APIRouter

from app.api.realtime.conversations import router as conversations_router
from app.api.realtime.websocket import router as websocket_router

router = APIRouter()
router.include_router(conversations_router, tags=["conversations"])
router.include_router(websocket_router, tags=["websocket"])
