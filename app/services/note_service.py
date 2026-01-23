import os
import uuid
import json
import aiofiles
from typing import List, Optional, Dict, Any
from datetime import datetime
from collections import defaultdict
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.note import Note, NoteType
from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.schemas.note import (
    NoteCreate,
    NoteUpdate,
    NotesByDayResponse,
    NotesByDestinationResponse,
    GroupedNotesResponse,
    NoteResponse,
)
from app.core.config import settings


class NoteService:
    """Service for Note CRUD operations and related functionality"""

    # Allowed media file types
    ALLOWED_MEDIA_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
    ]
    MAX_MEDIA_SIZE = 50 * 1024 * 1024  # 50MB

    @staticmethod
    async def create_note(db: AsyncSession, note_data: NoteCreate) -> Note:
        """Create a new note"""
        # Verify trip exists
        trip_result = await db.execute(select(Trip).where(Trip.id == note_data.trip_id))
        trip = trip_result.scalar_one_or_none()
        if not trip:
            raise ValueError(f"Trip with id {note_data.trip_id} not found")

        # Verify destination exists and belongs to trip if provided
        if note_data.destination_id:
            dest_result = await db.execute(
                select(Destination).where(
                    and_(
                        Destination.id == note_data.destination_id,
                        Destination.trip_id == note_data.trip_id
                    )
                )
            )
            destination = dest_result.scalar_one_or_none()
            if not destination:
                raise ValueError(f"Destination with id {note_data.destination_id} not found in trip {note_data.trip_id}")

        # Verify POI exists and belongs to destination if provided
        if note_data.poi_id:
            poi_result = await db.execute(
                select(POI).where(
                    and_(
                        POI.id == note_data.poi_id,
                        POI.destination_id == note_data.destination_id
                    )
                )
            )
            poi = poi_result.scalar_one_or_none()
            if not poi:
                raise ValueError(f"POI with id {note_data.poi_id} not found in destination {note_data.destination_id}")

        # Auto-determine note_type if not explicitly set
        note_dict = note_data.model_dump()
        if note_dict.get('note_type') == NoteType.GENERAL.value:
            if note_data.poi_id:
                note_dict['note_type'] = NoteType.POI.value
            elif note_data.day_number:
                note_dict['note_type'] = NoteType.DAY.value
            elif note_data.destination_id:
                note_dict['note_type'] = NoteType.DESTINATION.value

        note = Note(**note_dict)
        db.add(note)
        await db.flush()
        await db.refresh(note)
        return note

    @staticmethod
    async def get_note(db: AsyncSession, note_id: int) -> Optional[Note]:
        """Get a note by ID"""
        result = await db.execute(select(Note).where(Note.id == note_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_notes_by_trip(
        db: AsyncSession,
        trip_id: int,
        destination_id: Optional[int] = None,
        day_number: Optional[int] = None,
        poi_id: Optional[int] = None,
        note_type: Optional[str] = None,
        is_pinned: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Note]:
        """Get notes for a trip with optional filtering"""
        query = select(Note).where(Note.trip_id == trip_id)

        if destination_id is not None:
            query = query.where(Note.destination_id == destination_id)

        if day_number is not None:
            query = query.where(Note.day_number == day_number)

        if poi_id is not None:
            query = query.where(Note.poi_id == poi_id)

        if note_type is not None:
            query = query.where(Note.note_type == note_type)

        if is_pinned is not None:
            query = query.where(Note.is_pinned == is_pinned)

        # Order: pinned first, then by created_at desc
        query = query.order_by(
            Note.is_pinned.desc(),
            Note.created_at.desc()
        ).offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_notes_grouped_by_destination(
        db: AsyncSession,
        trip_id: int
    ) -> GroupedNotesResponse:
        """Get all notes for a trip grouped by destination"""
        # Verify trip exists
        trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_result.scalar_one_or_none()
        if not trip:
            raise ValueError(f"Trip with id {trip_id} not found")

        # Get all notes for the trip
        note_result = await db.execute(
            select(Note)
            .where(Note.trip_id == trip_id)
            .order_by(
                Note.is_pinned.desc(),
                Note.destination_id.asc().nullsfirst(),
                Note.day_number.asc().nullsfirst(),
                Note.created_at.desc()
            )
        )
        notes = note_result.scalars().all()

        # Get all destinations for the trip
        dest_result = await db.execute(
            select(Destination)
            .where(Destination.trip_id == trip_id)
            .order_by(Destination.order_index.asc())
        )
        destinations = {d.id: d for d in dest_result.scalars().all()}

        # Group notes
        trip_level_notes = []
        pinned_notes = []
        notes_by_destination = defaultdict(list)

        for note in notes:
            if note.is_pinned:
                pinned_notes.append(note)
            if note.destination_id is None:
                trip_level_notes.append(note)
            else:
                notes_by_destination[note.destination_id].append(note)

        # Build response
        by_destination = []
        for dest_id, dest in destinations.items():
            dest_notes = notes_by_destination.get(dest_id, [])
            by_destination.append(NotesByDestinationResponse(
                destination_id=dest_id,
                destination_name=dest.city_name,
                notes=dest_notes,
                count=len(dest_notes)
            ))

        return GroupedNotesResponse(
            trip_level=trip_level_notes,
            pinned=pinned_notes,
            by_destination=by_destination,
            total_count=len(notes)
        )

    @staticmethod
    async def get_notes_by_day(
        db: AsyncSession,
        destination_id: int
    ) -> NotesByDayResponse:
        """Get notes for a destination grouped by day"""
        # Get all notes for the destination
        note_result = await db.execute(
            select(Note)
            .where(Note.destination_id == destination_id)
            .order_by(
                Note.is_pinned.desc(),
                Note.day_number.asc().nullsfirst(),
                Note.created_at.desc()
            )
        )
        notes = note_result.scalars().all()

        # Group notes by day
        general_notes = []
        notes_by_day = defaultdict(list)

        for note in notes:
            if note.day_number is None:
                general_notes.append(note)
            else:
                notes_by_day[note.day_number].append(note)

        return NotesByDayResponse(
            general=general_notes,
            by_day=dict(notes_by_day),
            total_count=len(notes)
        )

    @staticmethod
    async def update_note(
        db: AsyncSession,
        note_id: int,
        note_data: NoteUpdate
    ) -> Optional[Note]:
        """Update a note"""
        note = await NoteService.get_note(db, note_id)
        if not note:
            return None

        # Update only provided fields
        update_data = note_data.model_dump(exclude_unset=True)

        # Validate destination_id if being updated
        if 'destination_id' in update_data and update_data['destination_id'] is not None:
            dest_result = await db.execute(
                select(Destination).where(
                    and_(
                        Destination.id == update_data['destination_id'],
                        Destination.trip_id == note.trip_id
                    )
                )
            )
            destination = dest_result.scalar_one_or_none()
            if not destination:
                raise ValueError(f"Destination with id {update_data['destination_id']} not found in trip")

        # Validate day_number requires destination_id
        new_day_number = update_data.get('day_number')
        effective_destination_id = update_data.get('destination_id', note.destination_id)
        if new_day_number is not None and effective_destination_id is None:
            raise ValueError("day_number requires destination_id to be set")

        # Validate poi_id if being updated
        if 'poi_id' in update_data and update_data['poi_id'] is not None:
            poi_result = await db.execute(
                select(POI).where(
                    and_(
                        POI.id == update_data['poi_id'],
                        POI.destination_id == effective_destination_id
                    )
                )
            )
            poi = poi_result.scalar_one_or_none()
            if not poi:
                raise ValueError(f"POI with id {update_data['poi_id']} not found in destination")

        for field, value in update_data.items():
            if field == 'note_type' and value:
                setattr(note, field, value.value if hasattr(value, 'value') else value)
            else:
                setattr(note, field, value)

        await db.flush()
        await db.refresh(note)
        return note

    @staticmethod
    async def delete_note(db: AsyncSession, note_id: int) -> bool:
        """Delete a note and its associated media files"""
        note = await NoteService.get_note(db, note_id)
        if not note:
            return False

        # Delete associated media files from disk
        if note.media_files:
            for media in note.media_files:
                file_path = media.get('file_path')
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass  # Continue even if file deletion fails

        await db.delete(note)
        await db.flush()
        return True

    @staticmethod
    async def toggle_pin(db: AsyncSession, note_id: int) -> Optional[Note]:
        """Toggle the pinned status of a note"""
        note = await NoteService.get_note(db, note_id)
        if not note:
            return None

        note.is_pinned = not note.is_pinned
        await db.flush()
        await db.refresh(note)
        return note

    @staticmethod
    async def search_notes(
        db: AsyncSession,
        query: str,
        trip_id: Optional[int] = None,
        destination_id: Optional[int] = None,
        note_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Note]:
        """Search notes by title and content"""
        search_query = select(Note)

        # Text search on title and content (case-insensitive)
        search_pattern = f"%{query}%"
        search_query = search_query.where(
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern)
            )
        )

        if trip_id is not None:
            search_query = search_query.where(Note.trip_id == trip_id)

        if destination_id is not None:
            search_query = search_query.where(Note.destination_id == destination_id)

        if note_type is not None:
            search_query = search_query.where(Note.note_type == note_type)

        if tags:
            # Filter notes that have any of the specified tags
            search_query = search_query.where(Note.tags.overlap(tags))

        search_query = search_query.order_by(
            Note.is_pinned.desc(),
            Note.updated_at.desc()
        ).limit(limit)

        result = await db.execute(search_query)
        return list(result.scalars().all())

    @staticmethod
    async def add_media_to_note(
        db: AsyncSession,
        note_id: int,
        file_content: bytes,
        original_filename: str,
        mime_type: str
    ) -> Optional[Note]:
        """Add a media file to a note"""
        note = await NoteService.get_note(db, note_id)
        if not note:
            return None

        # Validate file type
        if mime_type not in NoteService.ALLOWED_MEDIA_TYPES:
            raise ValueError(f"File type {mime_type} not allowed")

        # Validate file size
        if len(file_content) > NoteService.MAX_MEDIA_SIZE:
            raise ValueError(f"File size exceeds maximum allowed size of {NoteService.MAX_MEDIA_SIZE // (1024 * 1024)}MB")

        # Generate unique filename
        ext = os.path.splitext(original_filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{ext}"

        # Create directory structure
        upload_dir = os.path.join(settings.DOCUMENTS_UPLOAD_PATH, "notes", str(note.trip_id), str(note_id))
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, unique_filename)

        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)

        # Add to media_files
        media_entry = {
            'filename': unique_filename,
            'original_filename': original_filename,
            'file_path': file_path,
            'file_size': len(file_content),
            'mime_type': mime_type,
            'uploaded_at': datetime.utcnow().isoformat()
        }

        current_media = note.media_files or []
        current_media.append(media_entry)
        note.media_files = current_media

        await db.flush()
        await db.refresh(note)
        return note

    @staticmethod
    async def remove_media_from_note(
        db: AsyncSession,
        note_id: int,
        filename: str
    ) -> Optional[Note]:
        """Remove a media file from a note"""
        note = await NoteService.get_note(db, note_id)
        if not note or not note.media_files:
            return None

        # Find and remove the media entry
        updated_media = []
        file_to_delete = None

        for media in note.media_files:
            if media.get('filename') == filename:
                file_to_delete = media.get('file_path')
            else:
                updated_media.append(media)

        if file_to_delete is None:
            raise ValueError(f"Media file {filename} not found in note")

        # Delete file from disk
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)

        note.media_files = updated_media
        await db.flush()
        await db.refresh(note)
        return note

    @staticmethod
    async def export_notes_to_markdown(
        db: AsyncSession,
        trip_id: int,
        note_ids: Optional[List[int]] = None
    ) -> str:
        """Export notes to markdown format"""
        query = select(Note).where(Note.trip_id == trip_id)

        if note_ids:
            query = query.where(Note.id.in_(note_ids))

        query = query.order_by(
            Note.destination_id.asc().nullsfirst(),
            Note.day_number.asc().nullsfirst(),
            Note.created_at.asc()
        )

        result = await db.execute(query)
        notes = result.scalars().all()

        # Get trip info
        trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
        trip = trip_result.scalar_one_or_none()

        # Get destinations
        dest_result = await db.execute(
            select(Destination).where(Destination.trip_id == trip_id)
        )
        destinations = {d.id: d for d in dest_result.scalars().all()}

        # Build markdown
        md_lines = []
        md_lines.append(f"# Travel Journal: {trip.name if trip else 'Unknown Trip'}")
        md_lines.append("")
        md_lines.append(f"*Exported on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}*")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")

        current_destination = None
        current_day = None

        for note in notes:
            # Add destination header if changed
            if note.destination_id != current_destination:
                current_destination = note.destination_id
                current_day = None
                if current_destination and current_destination in destinations:
                    dest = destinations[current_destination]
                    md_lines.append(f"## {dest.city_name}, {dest.country}")
                    md_lines.append("")
                elif current_destination is None:
                    md_lines.append("## General Notes")
                    md_lines.append("")

            # Add day header if changed
            if note.day_number != current_day:
                current_day = note.day_number
                if current_day:
                    md_lines.append(f"### Day {current_day}")
                    md_lines.append("")

            # Add note
            md_lines.append(f"#### {note.title}")
            md_lines.append(f"*{note.created_at.strftime('%Y-%m-%d %H:%M')}*")

            # Add tags
            if note.tags:
                md_lines.append(f"Tags: {', '.join(note.tags)}")

            # Add mood/weather
            meta = []
            if note.mood:
                meta.append(f"Mood: {note.mood}")
            if note.weather:
                meta.append(f"Weather: {note.weather}")
            if meta:
                md_lines.append(' | '.join(meta))

            md_lines.append("")

            # Add content
            if note.content:
                md_lines.append(note.content)
                md_lines.append("")

            # Add location if present
            if note.location_name:
                md_lines.append(f"📍 {note.location_name}")
                md_lines.append("")

            md_lines.append("---")
            md_lines.append("")

        return '\n'.join(md_lines)

    @staticmethod
    async def get_note_stats(db: AsyncSession, trip_id: int) -> Dict[str, Any]:
        """Get statistics about notes for a trip"""
        result = await db.execute(
            select(
                func.count(Note.id).label('total_notes'),
                func.count(Note.id).filter(Note.is_pinned == True).label('pinned_notes'),
                func.count(Note.id).filter(Note.destination_id.is_(None)).label('trip_level_notes'),
                func.count(Note.id).filter(Note.poi_id.isnot(None)).label('poi_notes'),
            )
            .where(Note.trip_id == trip_id)
        )
        row = result.one()

        return {
            'total_notes': row.total_notes,
            'pinned_notes': row.pinned_notes,
            'trip_level_notes': row.trip_level_notes,
            'poi_notes': row.poi_notes
        }
