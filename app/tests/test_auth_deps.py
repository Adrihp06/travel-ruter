import pytest
from app.services.auth_service import create_access_token


class TestGetCurrentUser:
    async def test_get_current_user_with_valid_token(self, client, created_user, auth_headers):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == created_user.id
        assert data["email"] == created_user.email

    async def test_get_current_user_with_expired_token(self, client):
        from datetime import datetime, timezone, timedelta
        from jose import jwt
        from app.core.config import settings
        expired_payload = {
            "sub": "999", "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        }
        token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401

    async def test_get_current_user_with_invalid_token(self, client):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer bad-token"})
        assert resp.status_code == 401

    async def test_get_current_user_with_inactive_user(self, client, inactive_user):
        token = create_access_token(inactive_user.id)
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


class TestGetOptionalUser:
    async def test_get_optional_user_with_no_token(self, client, sample_trip_data):
        """Trips endpoint uses get_optional_user, should work without auth."""
        resp = await client.post("/api/v1/trips/", json=sample_trip_data)
        assert resp.status_code == 201

    async def test_get_optional_user_with_valid_token(self, client, created_user, auth_headers, sample_trip_data):
        resp = await client.post("/api/v1/trips/", json=sample_trip_data, headers=auth_headers)
        assert resp.status_code == 201
