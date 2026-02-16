import os
from hmac import compare_digest
from typing import Optional

from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, ExpiredSignatureError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import decode_token

_INTERNAL_SERVICE_KEY = os.environ.get("INTERNAL_SERVICE_KEY", "")


class PaginationParams:
    """Reusable pagination dependency for list endpoints."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(50, ge=1, le=200, description="Maximum number of records to return"),
    ):
        self.skip = skip
        self.limit = limit

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require valid JWT and return the User. Raises 401 on any failure.

    Also accepts internal service auth (X-Internal-Key + X-User-Id) for
    trusted orchestrator → backend calls on the Docker network.
    """
    # Check for internal service auth first (orchestrator → backend)
    internal_key = request.headers.get("X-Internal-Key")
    user_id_header = request.headers.get("X-User-Id")
    if internal_key and user_id_header and _INTERNAL_SERVICE_KEY:
        if not compare_digest(internal_key, _INTERNAL_SERVICE_KEY):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service key")
        try:
            uid = int(user_id_header)
            if uid <= 0:
                raise ValueError
        except (ValueError, OverflowError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID")
        stmt = select(User).where(User.id == uid, User.is_active == True)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

    # Normal JWT path
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    stmt = select(User).where(User.id == int(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Return User if valid token provided, None otherwise. Never raises."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
    except (JWTError, ExpiredSignatureError):
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    stmt = select(User).where(User.id == int(user_id), User.is_active == True)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
