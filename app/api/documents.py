import os
import uuid
import aiofiles
from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.models import POI, Trip, Document, Destination
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUpdate,
    DocumentTypeEnum,
    DocumentsByDayResponse,
    DocumentsByDestinationResponse,
    GroupedDocumentsResponse,
)

router = APIRouter()

CHUNK_SIZE = 8192  # 8KB chunks for streaming


def validate_file(file: UploadFile) -> None:
    """Validate file type and size"""
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: PDF, JPG"
        )


async def save_file(file: UploadFile, poi_id: Optional[int] = None, trip_id: Optional[int] = None) -> tuple[str, str]:
    """Save uploaded file to disk and return (filename, file_path)"""
    # Quick rejection using Content-Length header if available
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

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

    # Stream file to disk while validating size (rejects early without loading entire file)
    total_size = 0
    async with aiofiles.open(file_path, 'wb') as out_file:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > settings.MAX_FILE_SIZE:
                # Clean up partial file
                await out_file.close()
                os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024 * 1024)}MB"
                )
            await out_file.write(chunk)

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
    destination_id: Optional[int] = Form(default=None),
    day_number: Optional[int] = Form(default=None),
    db: AsyncSession = Depends(get_db)
):
    """Upload a document and link it to a Trip, optionally to a destination and day"""
    # Verify Trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Validate destination belongs to trip if provided
    if destination_id is not None:
        dest_result = await db.execute(
            select(Destination).where(
                and_(Destination.id == destination_id, Destination.trip_id == trip_id)
            )
        )
        destination = dest_result.scalar_one_or_none()
        if not destination:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Destination with id {destination_id} not found in trip {trip_id}"
            )

    # Validate day_number requires destination_id
    if day_number is not None and destination_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_number requires destination_id to be set"
        )

    # Validate day_number is positive
    if day_number is not None and day_number < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_number must be 1 or greater"
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
        destination_id=destination_id,
        day_number=day_number,
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
    destination_id: Optional[int] = Query(None, description="Filter by destination"),
    day: Optional[int] = Query(None, ge=1, description="Filter by day number (requires destination_id)"),
    document_type: Optional[DocumentTypeEnum] = Query(None, description="Filter by document type"),
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a specific Trip with optional filtering"""
    # Verify Trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Build query with filters
    query = select(Document).where(Document.trip_id == trip_id)

    if destination_id is not None:
        query = query.where(Document.destination_id == destination_id)

    if day is not None:
        if destination_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day filter requires destination_id to be set"
            )
        query = query.where(Document.day_number == day)

    if document_type is not None:
        query = query.where(Document.document_type == document_type.value)

    # Order by destination, day, then created_at
    query = query.order_by(
        Document.destination_id.asc().nullsfirst(),
        Document.day_number.asc().nullsfirst(),
        Document.created_at.desc()
    )

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(documents=documents, count=len(documents))


@router.get("/trips/{trip_id}/documents/grouped", response_model=GroupedDocumentsResponse)
async def list_trip_documents_grouped(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a trip, grouped by destination"""
    # Verify Trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()

    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Get all documents for the trip
    doc_result = await db.execute(
        select(Document)
        .where(Document.trip_id == trip_id)
        .order_by(Document.destination_id.asc().nullsfirst(), Document.day_number.asc().nullsfirst(), Document.created_at.desc())
    )
    documents = doc_result.scalars().all()

    # Get all destinations for the trip (for names)
    dest_result = await db.execute(
        select(Destination)
        .where(Destination.trip_id == trip_id)
        .order_by(Destination.order_index.asc())
    )
    destinations = {d.id: d for d in dest_result.scalars().all()}

    # Group documents
    trip_level_docs = []
    docs_by_destination = defaultdict(list)

    for doc in documents:
        if doc.destination_id is None:
            trip_level_docs.append(doc)
        else:
            docs_by_destination[doc.destination_id].append(doc)

    # Build response
    by_destination = []
    for dest_id, dest in destinations.items():
        dest_docs = docs_by_destination.get(dest_id, [])
        by_destination.append(DocumentsByDestinationResponse(
            destination_id=dest_id,
            destination_name=dest.city_name,
            documents=dest_docs,
            count=len(dest_docs)
        ))

    return GroupedDocumentsResponse(
        trip_level=trip_level_docs,
        by_destination=by_destination,
        total_count=len(documents)
    )


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
    """Update document metadata including destination and day assignment"""
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

    # Validate destination_id if being updated
    new_destination_id = update_data.get('destination_id')
    new_day_number = update_data.get('day_number')

    # If destination_id is being set, verify it belongs to the document's trip
    if new_destination_id is not None and db_document.trip_id:
        dest_result = await db.execute(
            select(Destination).where(
                and_(Destination.id == new_destination_id, Destination.trip_id == db_document.trip_id)
            )
        )
        destination = dest_result.scalar_one_or_none()
        if not destination:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Destination with id {new_destination_id} not found in document's trip"
            )

    # Validate day_number requires destination_id
    # Get the effective destination_id (new value or existing)
    effective_destination_id = new_destination_id if 'destination_id' in update_data else db_document.destination_id
    if new_day_number is not None and effective_destination_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_number requires destination_id to be set"
        )

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


@router.get("/destinations/{destination_id}/documents", response_model=DocumentListResponse)
async def list_destination_documents(
    destination_id: int,
    day: Optional[int] = Query(None, ge=1, description="Filter by day number"),
    document_type: Optional[DocumentTypeEnum] = Query(None, description="Filter by document type"),
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a specific destination with optional day filtering"""
    # Verify Destination exists
    result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Build query with filters
    query = select(Document).where(Document.destination_id == destination_id)

    if day is not None:
        query = query.where(Document.day_number == day)

    if document_type is not None:
        query = query.where(Document.document_type == document_type.value)

    # Order by day, then created_at
    query = query.order_by(
        Document.day_number.asc().nullsfirst(),
        Document.created_at.desc()
    )

    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(documents=documents, count=len(documents))


@router.get("/destinations/{destination_id}/documents/by-day", response_model=DocumentsByDayResponse)
async def list_destination_documents_by_day(
    destination_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all documents for a destination, grouped by day"""
    # Verify Destination exists
    result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Get all documents for the destination
    doc_result = await db.execute(
        select(Document)
        .where(Document.destination_id == destination_id)
        .order_by(Document.day_number.asc().nullsfirst(), Document.created_at.desc())
    )
    documents = doc_result.scalars().all()

    # Group documents by day
    general_docs = []
    docs_by_day = defaultdict(list)

    for doc in documents:
        if doc.day_number is None:
            general_docs.append(doc)
        else:
            docs_by_day[doc.day_number].append(doc)

    return DocumentsByDayResponse(
        general=general_docs,
        by_day=dict(docs_by_day),
        total_count=len(documents)
    )
