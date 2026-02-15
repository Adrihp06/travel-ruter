import pytest
from datetime import timedelta, datetime, timezone
from jose import jwt, ExpiredSignatureError, JWTError
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_or_create_user,
)
from app.core.config import settings
from app.models.user import User


class TestCreateAccessToken:
    def test_create_access_token_returns_valid_jwt(self, created_user):
        token = create_access_token(created_user.id)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == str(created_user.id)
        assert payload["type"] == "access"

    def test_access_token_expires_after_configured_minutes(self, created_user):
        token = create_access_token(created_user.id)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        diff = (exp - iat).total_seconds()
        assert abs(diff - settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) < 5


class TestCreateRefreshToken:
    def test_create_refresh_token_returns_valid_jwt(self, created_user):
        token = create_refresh_token(created_user.id)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == str(created_user.id)
        assert payload["type"] == "refresh"
        assert "jti" in payload

    def test_refresh_token_expires_after_configured_days(self, created_user):
        token = create_refresh_token(created_user.id)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        diff = (exp - iat).total_seconds()
        expected = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        assert abs(diff - expected) < 5


class TestDecodeToken:
    def test_decode_token_returns_payload(self, created_user):
        token = create_access_token(created_user.id)
        payload = decode_token(token)
        assert payload["sub"] == str(created_user.id)

    def test_decode_token_rejects_expired_token(self):
        expired_payload = {
            "sub": "999",
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        with pytest.raises(ExpiredSignatureError):
            decode_token(token)

    def test_decode_token_rejects_invalid_token(self):
        with pytest.raises(JWTError):
            decode_token("not-a-valid-token")


class TestGetOrCreateUser:
    async def test_get_or_create_user_creates_new_user(self, db):
        user = await get_or_create_user(
            db,
            email="new@example.com",
            name="New User",
            avatar_url="https://example.com/avatar.png",
            oauth_provider="google",
            oauth_id="new-oauth-id",
        )
        assert user.id is not None
        assert user.email == "new@example.com"
        assert user.name == "New User"

    async def test_get_or_create_user_returns_existing_user(self, db, created_user):
        user = await get_or_create_user(
            db,
            email=created_user.email,
            name=created_user.name,
            avatar_url=created_user.avatar_url,
            oauth_provider=created_user.oauth_provider,
            oauth_id=created_user.oauth_id,
        )
        assert user.id == created_user.id

    async def test_get_or_create_user_updates_profile_on_login(self, db, created_user):
        user = await get_or_create_user(
            db,
            email=created_user.email,
            name="Updated Name",
            avatar_url="https://example.com/new-avatar.png",
            oauth_provider=created_user.oauth_provider,
            oauth_id=created_user.oauth_id,
        )
        assert user.id == created_user.id
        assert user.name == "Updated Name"
        assert user.avatar_url == "https://example.com/new-avatar.png"

    async def test_get_or_create_user_rejects_duplicate_email_different_provider(self, db, created_user):
        with pytest.raises(ValueError, match="already registered"):
            await get_or_create_user(
                db,
                email=created_user.email,
                name="Different",
                avatar_url=None,
                oauth_provider="github",
                oauth_id="different-id",
            )
