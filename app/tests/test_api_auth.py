import pytest
from app.services.auth_service import create_access_token, create_refresh_token


class TestAuthMe:
    async def test_auth_me_returns_user_profile(self, client, created_user, auth_headers):
        resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == created_user.email
        assert data["name"] == created_user.name

    async def test_auth_me_rejects_unauthenticated(self, client):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401


class TestRefresh:
    async def test_refresh_issues_new_tokens(self, client, created_user):
        refresh = create_refresh_token(created_user.id)
        client.cookies.set("refresh_token", refresh)
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data

    async def test_refresh_rejects_invalid_cookie(self, client):
        client.cookies.set("refresh_token", "bad-token")
        resp = await client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401


class TestLogout:
    async def test_logout_clears_cookie(self, client):
        resp = await client.post("/api/v1/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out"
