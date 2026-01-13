import os
import uuid
import aiofiles
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models import POI, Trip, Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUpdate,
    DocumentTypeEnum,
)

router = APIRouter()


def validate_file(file: UploadFile) -> None:
    """Validate file type and size"""
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: PDF, JPG"
        )


async def save_file(file: UploadFile, poi_id: Optional[int] = None, trip_id: Optional[int] = None) -> tuple[str, str]:
    """Save uploaded file to disk and return (filename, file_path)"""
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{ext}"

    # Create subdirectory structure
    if poi_id:
        subdir = f"pois/{poi_id}"
    elif trip_id:
        subdir = f"trips/{trip_id}"
    else:
        subdir = "general"

    upload_dir = os.path.join(settings.DOCUMENTS_UPLOAD_PATH, subdir)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, unique_filename)

    # Save file asynchronously
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        await out_file.write(content)

    return unique_filename, file_path


@router.post("/pois/{poi_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_poi_document(
    poi_id: int,
    file: UploadFile = File(...),
    document_type: DocumentTypeEnum = Form(default=DocumentTypeEnum.OTHER),
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db)
):
    """Upload a document and link it to a POI"""
    # Verify POI exists
    result = await db.execute(select(POI).where(POI.id == poi_id))
    poi = result.scalar_one_or_none()

    if not poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {poi_id} not found"
        )

    # Validate file
    validate_file(file)

    # Save file
    filename, file_path = await save_file(file, poi_id=poi_id)

    # Get file size
    file_size = os.path.getsize(file_path)

    # Create document record
    db_document = Document(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        document_type=document_type.value,
        title=title,
        description=description,
        poi_id=poi_id,
    )

    db.add(db_document)
    await db.flush()
    await db.refresh(db_document)

    return db_document


@router.post("/trips/{trip_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_trip_document(
    trip_id: int,
    file: UploadFile = File(...),
    document_type: DocumentTypeEnum = Form(default=DocumentTypeEnum.OTHER),
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    db: AsyncSession = Depends(get_db)
):
    """Upload a document and link it to a Trip"""
    # Verify Trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Validate file
    validate_file(file)

    # Save file
    filename, file_path = await save_file(file, trip_id=trip_id)

    # Get file size
    file_size = os.path.getsize(file_path)

    # Create document record
    db_document = Document(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        document_type=document_type.value,
        title=title,
        description=description,
        trip_id=trip_id,
    )

    db.add(db_document)
    await db.flush()
    await db.refresh(db_document)

    return db_document


@router.get("/pois/{poi_id}/documents", response_model=DocumentListResponse)
async def list_poi_documents(
    poi_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a specific POI"""
    # Verify POI exists
    result = await db.execute(select(POI).where(POI.id == poi_id))
    poi = result.scalar_one_or_none()

    if not poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {poi_id} not found"
        )

    # Get documents
    result = await db.execute(
        select(Document)
        .where(Document.poi_id == poi_id)
        .order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()

    return DocumentListResponse(documents=documents, count=len(documents))


@router.get("/trips/{trip_id}/documents", response_model=DocumentListResponse)
async def list_trip_documents(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a specific Trip"""
    # Verify Trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Get documents
    result = await db.execute(
        select(Document)
        .where(Document.trip_id == trip_id)
        .order_by(Document.created_at.desc())
    )
    documents = result.scalars().all()

    return DocumentListResponse(documents=documents, count=len(documents))


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get document metadata by ID"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {document_id} not found"
        )

    return document


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Download a document file"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {document_id} not found"
        )

    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk"
        )

    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )


@router.get("/documents/{document_id}/view")
async def view_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """View a document file inline (for PDFs and images)"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {document_id} not found"
        )

    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on disk"
        )

    # For inline viewing, don't set Content-Disposition attachment
    return FileResponse(
        path=document.file_path,
        media_type=document.mime_type
    )


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update document metadata"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    db_document = result.scalar_one_or_none()

    if not db_document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {document_id} not found"
        )

    # Update fields
    update_data = document_update.model_dump(exclude_unset=True)
    if 'document_type' in update_data and update_data['document_type']:
        update_data['document_type'] = update_data['document_type'].value

    for field, value in update_data.items():
        setattr(db_document, field, value)

    await db.flush()
    await db.refresh(db_document)

    return db_document


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document (metadata and file)"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    db_document = result.scalar_one_or_none()

    if not db_document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id {document_id} not found"
        )

    # Delete file from disk
    if os.path.exists(db_document.file_path):
        os.remove(db_document.file_path)

    # Delete database record
    await db.delete(db_document)

    return None
