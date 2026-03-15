"""
Authentication module for the MCP server HTTP transport.

Provides:
- TravelRuterTokenVerifier: validates Bearer JWTs using the shared SECRET_KEY
- verify_trip_access: checks user has permission to access a trip
- resolve_trip_id: resolves trip_id from an entity via the destination chain
- get_user_id_from_context: extracts user_id from MCP request context
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.fastmcp import Context

from app.api.permissions import ROLE_HIERARCHY
from app.models.trip_member import TripMember
from app.models.trip import Trip
from mcp_server.config import mcp_settings

logger = logging.getLogger(__name__)

# Generic message returned for all auth failures to prevent enumeration
_AUTH_FAILED = "Authentication failed"


class TravelRuterTokenVerifier(TokenVerifier):
    """Validates Bearer JWTs issued by the Travel Ruter backend.

    Decodes the token using the shared SECRET_KEY, verifies the user
    exists and is active in the DB, checks token revocation status,
    then returns an AccessToken with client_id set to the user_id (as string).

    All failure paths return None with the same generic log message
    to prevent information leakage.
    """

    async def verify_token(self, token: str) -> AccessToken | None:
        secret = mcp_settings.JWT_SECRET_KEY
        if not secret:
            logger.error("JWT_SECRET_KEY not configured — rejecting all tokens")
            return None

        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[mcp_settings.JWT_ALGORITHM],
            )
        except (ExpiredSignatureError, JWTError):
            logger.warning(_AUTH_FAILED)
            return None

        # Verify it's an MCP-scoped token
        token_scope = payload.get("scope", "")
        if token_scope != "mcp":
            logger.warning(_AUTH_FAILED)
            return None

        user_id = payload.get("sub")
        if not user_id:
            logger.warning(_AUTH_FAILED)
            return None

        # Verify user exists, is active, and token is not revoked
        from mcp_server.context import get_db_session

        try:
            async with get_db_session() as db:
                # Check user
                from app.models.user import User

                stmt = select(User).where(
                    User.id == int(user_id),
                    User.is_active == True,
                )
                result = await db.execute(stmt)
                user = result.scalar_one_or_none()

                if not user:
                    logger.warning(_AUTH_FAILED)
                    return None

                # Check token revocation
                is_revoked = await self._is_token_revoked(
                    db, payload, int(user_id)
                )
                if is_revoked:
                    logger.warning(_AUTH_FAILED)
                    return None

                logger.info(f"MCP auth: verified user {user_id}")
                return AccessToken(
                    token=token,
                    client_id=str(user_id),
                    scopes=["mcp"],
                    expires_at=payload.get("exp"),
                )
        except Exception:
            logger.error(_AUTH_FAILED)
            return None

    async def _is_token_revoked(
        self,
        db: AsyncSession,
        payload: dict,
        user_id: int,
    ) -> bool:
        """Check if a token has been revoked (by jti or bulk revoke-all).

        Returns True if the token should be rejected.
        """
        from app.models.revoked_token import RevokedToken

        jti = payload.get("jti")

        # If the token has a jti, check direct revocation
        if jti:
            stmt = select(RevokedToken).where(RevokedToken.jti == jti)
            result = await db.execute(stmt)
            if result.scalar_one_or_none():
                return True

        # Check bulk revoke-all markers for this user
        stmt = (
            select(RevokedToken)
            .where(
                RevokedToken.user_id == user_id,
                RevokedToken.jti.like("revoke-all-%"),
            )
            .order_by(RevokedToken.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        marker = result.scalar_one_or_none()

        if marker and marker.revoked_at:
            # Token issued before the revoke-all marker should be rejected
            token_iat = payload.get("iat")
            if token_iat:
                token_issued = datetime.fromtimestamp(token_iat, tz=timezone.utc)
                if token_issued < marker.revoked_at.replace(tzinfo=timezone.utc):
                    return True

        return False


async def verify_trip_access(
    db: AsyncSession,
    trip_id: int,
    user_id: int,
    min_role: str = "viewer",
) -> bool:
    """Check that a user has at least `min_role` on a trip.

    Checks TripMember table first (collaborative trips), then falls back
    to Trip.user_id for legacy ownership.

    Returns True if access is granted, False otherwise.
    """
    min_level = ROLE_HIERARCHY.get(min_role, 0)

    # Check TripMember table (collaborative access)
    stmt = select(TripMember).where(
        TripMember.trip_id == trip_id,
        TripMember.user_id == user_id,
        TripMember.status == "accepted",
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if member:
        user_level = ROLE_HIERARCHY.get(member.role, -1)
        return user_level >= min_level

    # Fallback: check legacy Trip.user_id ownership
    stmt = select(Trip).where(Trip.id == trip_id)
    result = await db.execute(stmt)
    trip = result.scalar_one_or_none()

    if trip and trip.user_id == user_id:
        return True  # Owner has full access

    return False


async def resolve_trip_id(
    db: AsyncSession,
    *,
    destination_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    entity_model=None,
) -> Optional[int]:
    """Resolve the trip_id for an entity that belongs to a destination.

    Handles two patterns:
    - Direct: destination_id -> Destination.trip_id
    - Chained: entity_id (POI/Accommodation) -> entity.destination_id -> Destination.trip_id

    Returns the trip_id if found, None otherwise.
    """
    from app.models import Destination

    if destination_id:
        result = await db.execute(
            select(Destination).where(Destination.id == destination_id)
        )
        dest = result.scalar_one_or_none()
        return dest.trip_id if dest else None

    if entity_id and entity_model:
        result = await db.execute(
            select(entity_model).where(entity_model.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity:
            result = await db.execute(
                select(Destination).where(Destination.id == entity.destination_id)
            )
            dest = result.scalar_one_or_none()
            return dest.trip_id if dest else None

    return None


def get_user_id_from_context(ctx: Context) -> Optional[int]:
    """Extract user_id from MCP request context.

    In HTTP mode, ctx.client_id is set by the TokenVerifier to the user_id.
    In stdio mode (orchestrator), ctx.client_id is None -- return None to
    skip all permission checks (backward compatible).
    """
    client_id = ctx.client_id
    if client_id is None:
        return None
    try:
        return int(client_id)
    except (ValueError, TypeError):
        logger.warning(_AUTH_FAILED)
        return None
