from fastapi import APIRouter

from app.api.content.notes import router as notes_router
from app.api.content.documents import router as documents_router
from app.api.content.comments import router as comments_router

router = APIRouter()
router.include_router(notes_router, tags=["notes"])
router.include_router(documents_router, tags=["documents"])
router.include_router(comments_router, tags=["comments"])
