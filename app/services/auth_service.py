import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError or ExpiredSignatureError."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def get_or_create_user(
    db: AsyncSession,
    *,
    email: str,
    name: Optional[str],
    avatar_url: Optional[str],
    oauth_provider: str,
    oauth_id: str,
) -> User:
    """Get existing user by oauth_provider+oauth_id or create new one.

    Raises ValueError if email already exists with a different provider.
    Updates name/avatar on re-login.
    """
    # Check for existing user by provider + id
    stmt = select(User).where(
        User.oauth_provider == oauth_provider,
        User.oauth_id == oauth_id,
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        # Update profile on re-login
        user.name = name or user.name
        user.avatar_url = avatar_url or user.avatar_url
        await db.flush()
        await db.refresh(user)
        return user

    # Check for duplicate email with different provider
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError(
            f"Email {email} already registered with provider {existing.oauth_provider}"
        )

    # Create new user
    user = User(
        email=email,
        name=name,
        avatar_url=avatar_url,
        oauth_provider=oauth_provider,
        oauth_id=oauth_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
