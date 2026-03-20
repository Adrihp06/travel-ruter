from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.maps.google_places import router as google_places_router


@pytest.fixture
async def api_client():
    app = FastAPI()
    app.include_router(google_places_router, prefix="/api/v1/google-places")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


class TestGooglePlacesPhotoEndpoints:
    @pytest.mark.asyncio
    async def test_photo_url_returns_internal_proxy_url(self, api_client):
        with patch(
            "app.api.google_places.GooglePlacesService.get_photo_url",
            return_value="https://maps.googleapis.com/mock-photo",
        ):
            response = await api_client.get(
                "/api/v1/google-places/photo-url",
                params={"photo_reference": "photo-ref-123", "max_width": 512},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["photo_reference"] == "photo-ref-123"
        assert payload["url"] == "http://test/api/v1/google-places/photo?photo_reference=photo-ref-123&max_width=512"

    @pytest.mark.asyncio
    async def test_photo_proxy_streams_google_photo(self, api_client):
        mock_response = MagicMock()
        mock_response.content = b"fake-image-bytes"
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch(
            "app.api.google_places.GooglePlacesService.get_photo_url",
            return_value="https://maps.googleapis.com/mock-photo",
        ), patch(
            "app.api.google_places.get_http_client",
            AsyncMock(return_value=mock_client),
        ):
            response = await api_client.get(
                "/api/v1/google-places/photo",
                params={"photo_reference": "photo-ref-456"},
            )

        assert response.status_code == 200
        assert response.content == b"fake-image-bytes"
        assert response.headers["content-type"] == "image/jpeg"
        assert response.headers["cache-control"] == "public, max-age=86400"
        mock_client.get.assert_awaited_once_with(
            "https://maps.googleapis.com/mock-photo",
            follow_redirects=True,
        )

    @pytest.mark.asyncio
    async def test_place_photos_returns_proxy_urls(self, api_client):
        with patch(
            "app.api.google_places.GooglePlacesService.get_place_details_for_poi",
            AsyncMock(return_value={
                "photos": [
                    {"photo_reference": "ref-a"},
                    {"photo_reference": "ref-b"},
                ]
            }),
        ):
            response = await api_client.get("/api/v1/google-places/place-789/photos")

        assert response.status_code == 200
        payload = response.json()
        assert payload["place_id"] == "place-789"
        assert [photo["photo_reference"] for photo in payload["photos"]] == ["ref-a", "ref-b"]
        assert payload["photos"][0]["url"] == "http://test/api/v1/google-places/photo?photo_reference=ref-a&max_width=400"
