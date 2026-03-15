"""
MCP Access Token API endpoints.

Generates long-lived JWTs with scope="mcp" so users with their own
Claude Pro/Max/Code subscriptions can connect directly to the
Travel Ruter MCP server at travelruter.com/mcp.

Includes token revocation, listing, and cleanup utilities.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.revoked_token import RevokedToken
from app.models.user import User

router = APIRouter(prefix="/mcp-access", tags=["mcp-access"])

MIN_EXPIRY_DAYS = 1
MAX_EXPIRY_DAYS = 90
DEFAULT_EXPIRY_DAYS = 30


# ---------- Schemas ----------


class MCPTokenResponse(BaseModel):
    token: str
    jti: str
    expires_at: str
    connection_url: str
    claude_code_command: str
    claude_desktop_config: dict


class RevokeTokenRequest(BaseModel):
    token: Optional[str] = None
    jti: Optional[str] = None
    reason: Optional[str] = None


class RevokeAllResponse(BaseModel):
    revoked_count: int
    message: str


class TokenInfo(BaseModel):
    jti: str
    created_at: str
    expires_at: str
    is_active: bool


class TokenListResponse(BaseModel):
    tokens: List[TokenInfo]


class MessageResponse(BaseModel):
    message: str


# ---------- Endpoints ----------


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
    token_jti = str(uuid.uuid4())

    payload = {
        "sub": str(user.id),
        "scope": "mcp",
        "type": "mcp_access",
        "jti": token_jti,
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
        jti=token_jti,
        expires_at=expires.isoformat(),
        connection_url=connection_url,
        claude_code_command=claude_code_cmd,
        claude_desktop_config=claude_desktop_cfg,
    )


@router.post("/revoke", response_model=MessageResponse)
async def revoke_mcp_token(
    body: RevokeTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a specific MCP token by token string or JTI."""
    jti = body.jti
    expires_at = None

    if body.token and not jti:
        # Decode the token to extract jti and expiry
        try:
            payload = jwt.decode(
                body.token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False},  # Allow revoking expired tokens
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token",
            )

        jti = payload.get("jti")
        if not jti:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token does not contain a JTI claim",
            )

        # Verify the token belongs to the current user
        if payload.get("sub") != str(user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot revoke another user's token",
            )

        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)

    if not jti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either 'token' or 'jti'",
        )

    # Check if already revoked
    stmt = select(RevokedToken).where(RevokedToken.jti == jti)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        return MessageResponse(message="Token already revoked")

    # If we don't have expires_at (jti-only revocation), set a far-future expiry
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=MAX_EXPIRY_DAYS)

    revoked = RevokedToken(
        jti=jti,
        user_id=user.id,
        token_type="mcp_access",
        expires_at=expires_at,
        reason=body.reason,
    )
    db.add(revoked)
    await db.flush()

    return MessageResponse(message="Token revoked successfully")


@router.post("/revoke-all", response_model=RevokeAllResponse)
async def revoke_all_mcp_tokens(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all active MCP tokens for the current user.

    This is a bulk operation -- it marks all currently non-revoked MCP
    tokens as revoked by adding entries with a sentinel JTI pattern.
    Since we don't store issued tokens server-side, this adds a
    'revoke-all' marker that the verifier checks against the token's iat.
    """
    now = datetime.now(timezone.utc)

    # Add a special revoke-all marker: any MCP token issued before this
    # timestamp for this user should be rejected.
    marker_jti = f"revoke-all-{user.id}-{int(now.timestamp())}"

    # Check if there's already a recent revoke-all marker
    stmt = select(RevokedToken).where(
        RevokedToken.user_id == user.id,
        RevokedToken.jti.like("revoke-all-%"),
    )
    result = await db.execute(stmt)
    existing_markers = result.scalars().all()

    revoked = RevokedToken(
        jti=marker_jti,
        user_id=user.id,
        token_type="mcp_access",
        expires_at=now + timedelta(days=MAX_EXPIRY_DAYS),
        reason="Bulk revocation of all MCP tokens",
    )
    db.add(revoked)
    await db.flush()

    return RevokeAllResponse(
        revoked_count=1,
        message=f"All MCP tokens issued before {now.isoformat()} have been revoked",
    )


@router.get("/tokens", response_model=TokenListResponse)
async def list_mcp_tokens(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all revoked MCP tokens for the current user.

    Note: Since MCP tokens are stateless JWTs, we can only list tokens
    that have been explicitly revoked. Active tokens exist only as the
    JWT string held by the user.
    """
    now = datetime.now(timezone.utc)

    # Get all revoked tokens for this user (non-expired revocations)
    stmt = (
        select(RevokedToken)
        .where(
            RevokedToken.user_id == user.id,
            RevokedToken.token_type == "mcp_access",
            RevokedToken.expires_at > now,
        )
        .order_by(RevokedToken.created_at.desc())
    )
    result = await db.execute(stmt)
    revoked_tokens = result.scalars().all()

    tokens = []
    for rt in revoked_tokens:
        tokens.append(
            TokenInfo(
                jti=rt.jti,
                created_at=rt.created_at.isoformat() if rt.created_at else "",
                expires_at=rt.expires_at.isoformat() if rt.expires_at else "",
                is_active=False,  # These are revoked
            )
        )

    return TokenListResponse(tokens=tokens)


# ---------- Cleanup utility ----------


async def cleanup_expired_revocations(db: AsyncSession) -> int:
    """Delete revoked token entries whose underlying token has expired.

    Once a token is past its exp, keeping the revocation record is
    unnecessary since the token can never validate again.

    Returns the number of deleted rows.
    """
    now = datetime.now(timezone.utc)
    stmt = delete(RevokedToken).where(RevokedToken.expires_at < now)
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount
