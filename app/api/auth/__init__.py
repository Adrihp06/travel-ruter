from fastapi import APIRouter

from app.api.auth.auth import router as auth_router
from app.api.auth.api_keys import router as api_keys_router
from app.api.auth.mcp_tokens import router as mcp_tokens_router

router = APIRouter()
router.include_router(auth_router, tags=["auth"])
router.include_router(api_keys_router, tags=["api-keys"])
router.include_router(mcp_tokens_router, tags=["mcp-access"])
