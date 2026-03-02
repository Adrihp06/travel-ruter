"""
MCP Access Token API endpoint.

Generates long-lived JWTs with scope="mcp" so users with their own
Claude Pro/Max/Code subscriptions can connect directly to the
Travel Ruter MCP server at travelruter.com/mcp.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/mcp-access", tags=["mcp-access"])

MIN_EXPIRY_DAYS = 1
MAX_EXPIRY_DAYS = 90
DEFAULT_EXPIRY_DAYS = 30


class MCPTokenResponse(BaseModel):
    token: str
    expires_at: str
    connection_url: str
    claude_code_command: str
    claude_desktop_config: dict


@router.post("/token", response_model=MCPTokenResponse)
async def generate_mcp_token(
    expiry_days: int = Query(
        default=DEFAULT_EXPIRY_DAYS,
        ge=MIN_EXPIRY_DAYS,
        le=MAX_EXPIRY_DAYS,
        description="Token validity in days (1-90)",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a long-lived MCP access token.

    This token lets you connect your Claude Desktop or Claude Code
    directly to Travel Ruter's MCP tools, using your own Claude
    subscription for AI inference.
    """
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=expiry_days)

    payload = {
        "sub": str(user.id),
        "scope": "mcp",
        "type": "mcp_access",
        "iat": now,
        "exp": expires,
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    connection_url = "https://travelruter.com/mcp"

    claude_code_cmd = (
        f'claude mcp add --transport http travel-ruter {connection_url} '
        f'--header "Authorization: Bearer {token}"'
    )

    claude_desktop_cfg = {
        "mcpServers": {
            "travel-ruter": {
                "command": "npx",
                "args": [
                    "mcp-remote",
                    connection_url,
                    "--header",
                    f"Authorization: Bearer {token}",
                ],
            }
        }
    }

    return MCPTokenResponse(
        token=token,
        expires_at=expires.isoformat(),
        connection_url=connection_url,
        claude_code_command=claude_code_cmd,
        claude_desktop_config=claude_desktop_cfg,
    )
