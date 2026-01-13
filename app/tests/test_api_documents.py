"""
Integration tests for Documents API endpoints (The Vault).
Tests file upload, download, and document CRUD operations.
"""
import pytest
import os
import io
from unittest.mock import patch, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.models.document import Document


class TestDocumentUpload:
    """Tests for document upload endpoints."""

    @pytest.mark.asyncio
    async def test_upload_poi_document_pdf(
        self,
        client: AsyncClient,
        created_poi: POI,
        sample_pdf_file: str,
        temp_upload_dir: str
    ):
        """Test POST /api/v1/pois/{poi_id}/documents - upload PDF."""
        with patch("app.api.documents.settings") as mock_settings:
            mock_settings.DOCUMENTS_UPLOAD_PATH = temp_upload_dir
            mock_settings.MAX_FILE_SIZE = 50 * 1024 * 1024
            mock_settings.ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg"]

            with open(sample_pdf_file, "rb") as f:
                files = {"file": ("test_document.pdf", f, "application/pdf")}
                data = {
                    "document_type": "ticket",
                    "title": "Flight Ticket",
                    "description": "Round trip to Paris"
                }

                response = await client.post(
                    f"/api/v1/pois/{created_poi.id}/documents",
                    files=files,
                    data=data
                )

        assert response.status_code == 201
        result = response.json()
        assert result["poi_id"] == created_poi.id
        assert result["document_type"] == "ticket"
        assert result["title"] == "Flight Ticket"
        assert result["original_filename"] == "test_document.pdf"
        assert result["mime_type"] == "application/pdf"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_upload_poi_document_image(
        self,
        client: AsyncClient,
        created_poi: POI,
        sample_image_file: str,
        temp_upload_dir: str
    ):
        """Test uploading JPEG image to POI."""
        with patch("app.api.documents.settings") as mock_settings:
            mock_settings.DOCUMENTS_UPLOAD_PATH = temp_upload_dir
            mock_settings.MAX_FILE_SIZE = 50 * 1024 * 1024
            mock_settings.ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg"]

            with open(sample_image_file, "rb") as f:
                files = {"file": ("photo.jpg", f, "image/jpeg")}
                data = {"document_type": "other"}

                response = await client.post(
                    f"/api/v1/pois/{created_poi.id}/documents",
                    files=files,
                    data=data
                )

        assert response.status_code == 201
        result = response.json()
        assert result["mime_type"] == "image/jpeg"

    @pytest.mark.asyncio
    async def test_upload_trip_document(
        self,
        client: AsyncClient,
        created_trip: Trip,
        sample_pdf_file: str,
        temp_upload_dir: str
    ):
        """Test POST /api/v1/trips/{trip_id}/documents - upload to trip."""
        with patch("app.api.documents.settings") as mock_settings:
            mock_settings.DOCUMENTS_UPLOAD_PATH = temp_upload_dir
            mock_settings.MAX_FILE_SIZE = 50 * 1024 * 1024
            mock_settings.ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg"]

            with open(sample_pdf_file, "rb") as f:
                files = {"file": ("itinerary.pdf", f, "application/pdf")}
                data = {
                    "document_type": "confirmation",
                    "title": "Trip Itinerary"
                }

                response = await client.post(
                    f"/api/v1/trips/{created_trip.id}/documents",
                    files=files,
                    data=data
                )

        assert response.status_code == 201
        result = response.json()
        assert result["trip_id"] == created_trip.id
        assert result["poi_id"] is None
        assert result["document_type"] == "confirmation"

    @pytest.mark.asyncio
    async def test_upload_document_poi_not_found(
        self,
        client: AsyncClient,
        sample_pdf_file: str
    ):
        """Test upload to non-existent POI returns 404."""
        with open(sample_pdf_file, "rb") as f:
            files = {"file": ("test.pdf", f, "application/pdf")}

            response = await client.post(
                "/api/v1/pois/99999/documents",
                files=files,
                data={"document_type": "other"}
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_document_trip_not_found(
        self,
        client: AsyncClient,
        sample_pdf_file: str
    ):
        """Test upload to non-existent trip returns 404."""
        with open(sample_pdf_file, "rb") as f:
            files = {"file": ("test.pdf", f, "application/pdf")}

            response = await client.post(
                "/api/v1/trips/99999/documents",
                files=files,
                data={"document_type": "other"}
            )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_document_invalid_type(
        self,
        client: AsyncClient,
        created_poi: POI,
        temp_upload_dir: str
    ):
        """Test uploading unsupported file type fails."""
        with patch("app.api.documents.settings") as mock_settings:
            mock_settings.ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg"]

            # Create a fake text file
            files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}

            response = await client.post(
                f"/api/v1/pois/{created_poi.id}/documents",
                files=files,
                data={"document_type": "other"}
            )

        assert response.status_code == 400
        assert "not allowed" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_upload_document_all_types(
        self,
        client: AsyncClient,
        created_trip: Trip,
        sample_pdf_file: str,
        temp_upload_dir: str
    ):
        """Test uploading documents with all document types."""
        doc_types = ["ticket", "confirmation", "reservation", "receipt", "map", "other"]

        with patch("app.api.documents.settings") as mock_settings:
            mock_settings.DOCUMENTS_UPLOAD_PATH = temp_upload_dir
            mock_settings.MAX_FILE_SIZE = 50 * 1024 * 1024
            mock_settings.ALLOWED_FILE_TYPES = ["application/pdf"]

            for doc_type in doc_types:
                with open(sample_pdf_file, "rb") as f:
                    files = {"file": (f"{doc_type}.pdf", f, "application/pdf")}
                    data = {"document_type": doc_type}

                    response = await client.post(
                        f"/api/v1/trips/{created_trip.id}/documents",
                        files=files,
                        data=data
                    )

                assert response.status_code == 201
                assert response.json()["document_type"] == doc_type


class TestDocumentList:
    """Tests for document listing endpoints."""

    @pytest.mark.asyncio
    async def test_list_poi_documents(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_poi: POI
    ):
        """Test GET /api/v1/pois/{poi_id}/documents - list POI documents."""
        # Create some documents
        doc1 = Document(
            filename="uuid1.pdf",
            original_filename="ticket.pdf",
            file_path="/fake/path/uuid1.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="ticket",
            poi_id=created_poi.id
        )
        doc2 = Document(
            filename="uuid2.pdf",
            original_filename="receipt.pdf",
            file_path="/fake/path/uuid2.pdf",
            file_size=2048,
            mime_type="application/pdf",
            document_type="receipt",
            poi_id=created_poi.id
        )
        db.add(doc1)
        db.add(doc2)
        await db.flush()

        response = await client.get(f"/api/v1/pois/{created_poi.id}/documents")

        assert response.status_code == 200
        result = response.json()
        assert "documents" in result
        assert "count" in result
        assert result["count"] >= 2
        assert len(result["documents"]) >= 2

    @pytest.mark.asyncio
    async def test_list_trip_documents(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test GET /api/v1/trips/{trip_id}/documents - list trip documents."""
        doc = Document(
            filename="uuid.pdf",
            original_filename="itinerary.pdf",
            file_path="/fake/path/uuid.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        response = await client.get(
            f"/api/v1/trips/{created_trip.id}/documents"
        )

        assert response.status_code == 200
        result = response.json()
        assert result["count"] >= 1

    @pytest.mark.asyncio
    async def test_list_documents_poi_not_found(self, client: AsyncClient):
        """Test listing documents for non-existent POI returns 404."""
        response = await client.get("/api/v1/pois/99999/documents")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_documents_trip_not_found(self, client: AsyncClient):
        """Test listing documents for non-existent trip returns 404."""
        response = await client.get("/api/v1/trips/99999/documents")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_documents_empty(
        self,
        client: AsyncClient,
        created_poi: POI
    ):
        """Test listing documents when none exist."""
        response = await client.get(f"/api/v1/pois/{created_poi.id}/documents")

        assert response.status_code == 200
        result = response.json()
        assert result["count"] >= 0
        assert isinstance(result["documents"], list)


class TestDocumentOperations:
    """Tests for individual document operations."""

    @pytest.mark.asyncio
    async def test_get_document_metadata(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test GET /api/v1/documents/{document_id} - get metadata."""
        doc = Document(
            filename="uuid.pdf",
            original_filename="test.pdf",
            file_path="/fake/path/uuid.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="ticket",
            title="Test Document",
            description="Test description",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        response = await client.get(f"/api/v1/documents/{doc.id}")

        assert response.status_code == 200
        result = response.json()
        assert result["id"] == doc.id
        assert result["original_filename"] == "test.pdf"
        assert result["title"] == "Test Document"
        assert result["description"] == "Test description"

    @pytest.mark.asyncio
    async def test_get_document_not_found(self, client: AsyncClient):
        """Test getting non-existent document returns 404."""
        response = await client.get("/api/v1/documents/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_download_document(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip,
        sample_pdf_file: str
    ):
        """Test GET /api/v1/documents/{document_id}/download."""
        doc = Document(
            filename="test.pdf",
            original_filename="download_test.pdf",
            file_path=sample_pdf_file,
            file_size=os.path.getsize(sample_pdf_file),
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        response = await client.get(f"/api/v1/documents/{doc.id}/download")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

    @pytest.mark.asyncio
    async def test_download_document_file_missing(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test downloading when file is missing from disk."""
        doc = Document(
            filename="missing.pdf",
            original_filename="missing.pdf",
            file_path="/nonexistent/path/missing.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        response = await client.get(f"/api/v1/documents/{doc.id}/download")

        assert response.status_code == 404
        assert "not found on disk" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_view_document(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip,
        sample_pdf_file: str
    ):
        """Test GET /api/v1/documents/{document_id}/view - inline view."""
        doc = Document(
            filename="test.pdf",
            original_filename="view_test.pdf",
            file_path=sample_pdf_file,
            file_size=os.path.getsize(sample_pdf_file),
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        response = await client.get(f"/api/v1/documents/{doc.id}/view")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

    @pytest.mark.asyncio
    async def test_update_document_metadata(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test PUT /api/v1/documents/{document_id} - update metadata."""
        doc = Document(
            filename="uuid.pdf",
            original_filename="test.pdf",
            file_path="/fake/path/uuid.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="other",
            title="Original Title",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        update_data = {
            "title": "Updated Title",
            "description": "New description",
            "document_type": "receipt"
        }

        response = await client.put(
            f"/api/v1/documents/{doc.id}",
            json=update_data
        )

        assert response.status_code == 200
        result = response.json()
        assert result["title"] == "Updated Title"
        assert result["description"] == "New description"
        assert result["document_type"] == "receipt"

    @pytest.mark.asyncio
    async def test_update_document_partial(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test partial update of document metadata."""
        doc = Document(
            filename="uuid.pdf",
            original_filename="test.pdf",
            file_path="/fake/path/uuid.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="ticket",
            title="Original",
            description="Original description",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()

        # Only update title
        response = await client.put(
            f"/api/v1/documents/{doc.id}",
            json={"title": "Only Title Changed"}
        )

        assert response.status_code == 200
        result = response.json()
        assert result["title"] == "Only Title Changed"
        assert result["description"] == "Original description"
        assert result["document_type"] == "ticket"

    @pytest.mark.asyncio
    async def test_update_document_not_found(self, client: AsyncClient):
        """Test updating non-existent document returns 404."""
        response = await client.put(
            "/api/v1/documents/99999",
            json={"title": "New Title"}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_document(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip,
        temp_upload_dir: str
    ):
        """Test DELETE /api/v1/documents/{document_id}."""
        # Create a real file to delete
        file_path = os.path.join(temp_upload_dir, "to_delete.pdf")
        with open(file_path, "wb") as f:
            f.write(b"test content")

        doc = Document(
            filename="to_delete.pdf",
            original_filename="to_delete.pdf",
            file_path=file_path,
            file_size=12,
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()
        doc_id = doc.id

        response = await client.delete(f"/api/v1/documents/{doc_id}")

        assert response.status_code == 204

        # Verify document is deleted from database
        get_response = await client.get(f"/api/v1/documents/{doc_id}")
        assert get_response.status_code == 404

        # Verify file is deleted from disk
        assert not os.path.exists(file_path)

    @pytest.mark.asyncio
    async def test_delete_document_file_already_missing(
        self,
        client: AsyncClient,
        db: AsyncSession,
        created_trip: Trip
    ):
        """Test deleting document when file is already missing."""
        doc = Document(
            filename="already_missing.pdf",
            original_filename="missing.pdf",
            file_path="/nonexistent/path/missing.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_type="other",
            trip_id=created_trip.id
        )
        db.add(doc)
        await db.flush()
        doc_id = doc.id

        # Should still succeed (database record deleted)
        response = await client.delete(f"/api/v1/documents/{doc_id}")
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_document_not_found(self, client: AsyncClient):
        """Test deleting non-existent document returns 404."""
        response = await client.delete("/api/v1/documents/99999")
        assert response.status_code == 404
