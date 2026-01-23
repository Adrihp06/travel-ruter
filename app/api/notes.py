import os
import uuid
import aiofiles
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models import Trip, Destination, Note
from app.services.note_service import NoteService
from app.schemas.note import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteListResponse,
    NotesByDayResponse,
    GroupedNotesResponse,
    NoteTypeEnum,
    NoteSearchRequest,
    NoteSearchResponse,
    NoteExportRequest,
)

router = APIRouter()


# ==================== Trip-level Note Endpoints ====================

@router.post("/trips/{trip_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    trip_id: int,
    note_data: NoteCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new note for a trip"""
    # Ensure trip_id in path matches body
    if note_data.trip_id != trip_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="trip_id in path does not match trip_id in body"
        )

    try:
        note = await NoteService.create_note(db, note_data)
        return note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/trips/{trip_id}/notes", response_model=NoteListResponse)
async def list_trip_notes(
    trip_id: int,
    destination_id: Optional[int] = Query(None, description="Filter by destination"),
    day_number: Optional[int] = Query(None, ge=1, description="Filter by day number"),
    poi_id: Optional[int] = Query(None, description="Filter by POI"),
    note_type: Optional[NoteTypeEnum] = Query(None, description="Filter by note type"),
    is_pinned: Optional[bool] = Query(None, description="Filter by pinned status"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of items to return"),
    db: AsyncSession = Depends(get_db)
):
    """List all notes for a trip with optional filtering"""
    # Verify trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Validate day_number requires destination_id
    if day_number is not None and destination_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_number filter requires destination_id to be set"
        )

    notes = await NoteService.get_notes_by_trip(
        db,
        trip_id=trip_id,
        destination_id=destination_id,
        day_number=day_number,
        poi_id=poi_id,
        note_type=note_type.value if note_type else None,
        is_pinned=is_pinned,
        skip=skip,
        limit=limit
    )

    return NoteListResponse(notes=notes, count=len(notes))


@router.get("/trips/{trip_id}/notes/grouped", response_model=GroupedNotesResponse)
async def list_trip_notes_grouped(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all notes for a trip, grouped by destination"""
    try:
        return await NoteService.get_notes_grouped_by_destination(db, trip_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/trips/{trip_id}/notes/stats")
async def get_trip_note_stats(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get statistics about notes for a trip"""
    # Verify trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    return await NoteService.get_note_stats(db, trip_id)


@router.post("/trips/{trip_id}/notes/search", response_model=NoteSearchResponse)
async def search_trip_notes(
    trip_id: int,
    search_request: NoteSearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Search notes within a trip"""
    # Verify trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    notes = await NoteService.search_notes(
        db,
        query=search_request.query,
        trip_id=trip_id,
        destination_id=search_request.destination_id,
        note_type=search_request.note_type.value if search_request.note_type else None,
        tags=search_request.tags
    )

    return NoteSearchResponse(
        notes=notes,
        count=len(notes),
        query=search_request.query
    )


@router.get("/trips/{trip_id}/notes/export/markdown")
async def export_trip_notes_markdown(
    trip_id: int,
    note_ids: Optional[str] = Query(None, description="Comma-separated note IDs to export"),
    db: AsyncSession = Depends(get_db)
):
    """Export notes to markdown format"""
    # Verify trip exists
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )

    # Parse note_ids if provided
    parsed_note_ids = None
    if note_ids:
        try:
            parsed_note_ids = [int(id.strip()) for id in note_ids.split(',')]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid note_ids format. Use comma-separated integers."
            )

    markdown_content = await NoteService.export_notes_to_markdown(db, trip_id, parsed_note_ids)

    # Generate filename
    safe_trip_name = "".join(c for c in trip.name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"{safe_trip_name}_journal_{datetime.utcnow().strftime('%Y%m%d')}.md"

    return PlainTextResponse(
        content=markdown_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# ==================== Destination-level Note Endpoints ====================

@router.get("/destinations/{destination_id}/notes", response_model=NoteListResponse)
async def list_destination_notes(
    destination_id: int,
    day_number: Optional[int] = Query(None, ge=1, description="Filter by day number"),
    note_type: Optional[NoteTypeEnum] = Query(None, description="Filter by note type"),
    db: AsyncSession = Depends(get_db)
):
    """List all notes for a destination"""
    # Verify destination exists
    result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = result.scalar_one_or_none()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    notes = await NoteService.get_notes_by_trip(
        db,
        trip_id=destination.trip_id,
        destination_id=destination_id,
        day_number=day_number,
        note_type=note_type.value if note_type else None
    )

    return NoteListResponse(notes=notes, count=len(notes))


@router.get("/destinations/{destination_id}/notes/by-day", response_model=NotesByDayResponse)
async def list_destination_notes_by_day(
    destination_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all notes for a destination, grouped by day"""
    # Verify destination exists
    result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = result.scalar_one_or_none()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    return await NoteService.get_notes_by_day(db, destination_id)


# ==================== Individual Note Endpoints ====================

@router.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a note by ID"""
    note = await NoteService.get_note(db, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with id {note_id} not found"
        )
    return note


@router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a note"""
    try:
        note = await NoteService.update_note(db, note_id, note_data)
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Note with id {note_id} not found"
            )
        return note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a note"""
    deleted = await NoteService.delete_note(db, note_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with id {note_id} not found"
        )
    return None


@router.post("/notes/{note_id}/toggle-pin", response_model=NoteResponse)
async def toggle_note_pin(
    note_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Toggle the pinned status of a note"""
    note = await NoteService.toggle_pin(db, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with id {note_id} not found"
        )
    return note


# ==================== Media Endpoints ====================

@router.post("/notes/{note_id}/media", response_model=NoteResponse)
async def upload_note_media(
    note_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a media file to a note"""
    # Validate file type
    if file.content_type not in NoteService.ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: images, video, audio"
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > NoteService.MAX_MEDIA_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {NoteService.MAX_MEDIA_SIZE // (1024 * 1024)}MB"
        )

    try:
        note = await NoteService.add_media_to_note(
            db,
            note_id,
            content,
            file.filename,
            file.content_type
        )
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Note with id {note_id} not found"
            )
        return note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/notes/{note_id}/media/{filename}", response_model=NoteResponse)
async def delete_note_media(
    note_id: int,
    filename: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove a media file from a note"""
    try:
        note = await NoteService.remove_media_from_note(db, note_id, filename)
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Note with id {note_id} not found"
            )
        return note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/notes/{note_id}/media/{filename}")
async def get_note_media(
    note_id: int,
    filename: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a media file from a note"""
    note = await NoteService.get_note(db, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with id {note_id} not found"
        )

    # Find the media file
    media_file = None
    if note.media_files:
        for media in note.media_files:
            if media.get('filename') == filename:
                media_file = media
                break

    if not media_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media file {filename} not found in note"
        )

    file_path = media_file.get('file_path')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media file not found on disk"
        )

    return FileResponse(
        path=file_path,
        media_type=media_file.get('mime_type', 'application/octet-stream'),
        filename=media_file.get('original_filename', filename)
    )
