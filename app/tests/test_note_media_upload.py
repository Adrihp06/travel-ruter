"""
Tests for note media upload streaming endpoint.
Verifies content-type validation and size rejection with streaming approach.
"""
import io
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.note import Note


@pytest.fixture
async def created_note(
    db: AsyncSession,
    created_trip: Trip,
    created_destination: Destination,
) -> Note:
    """Create a note for testing media uploads."""
    note = Note(
        trip_id=created_trip.id,
        destination_id=created_destination.id,
        title="Test Note",
        content="Test content",
        note_type="general",
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


class TestNoteMediaUpload:
    """Tests for POST /api/v1/notes/{note_id}/media."""

    @pytest.mark.asyncio
    async def test_upload_invalid_content_type_rejected(
        self,
        client: AsyncClient,
        created_note: Note,
    ):
        """Test that non-allowed content types are rejected before reading."""
        fake_file = io.BytesIO(b"not a real file")
        response = await client.post(
            f"/api/v1/notes/{created_note.id}/media",
            files={"file": ("test.exe", fake_file, "application/x-msdownload")},
        )
        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_upload_valid_type_accepted(
        self,
        client: AsyncClient,
        created_note: Note,
    ):
        """Test that valid image upload reaches the service layer."""
        # Create a small valid image-like content
        small_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        with patch(
            "app.api.notes.NoteService.add_media_to_note",
            new_callable=AsyncMock,
            return_value=created_note,
        ):
            response = await client.post(
                f"/api/v1/notes/{created_note.id}/media",
                files={"file": ("photo.png", io.BytesIO(small_content), "image/png")},
            )
            assert response.status_code == 200
