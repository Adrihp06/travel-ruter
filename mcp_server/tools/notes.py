"""
MCP Tool: manage_note

Provides CRUD operations for travel notes linked to trips, destinations, days, or POIs.
"""

import logging
from typing import Optional, List

from mcp.server.fastmcp import FastMCP

from mcp_server.context import get_db_session
from mcp_server.schemas.notes import (
    NoteOperation,
    NoteResult,
    ManageNoteOutput,
)

logger = logging.getLogger(__name__)


def _note_to_result(note) -> NoteResult:
    """Convert a Note model to NoteResult schema."""
    return NoteResult(
        id=note.id,
        trip_id=note.trip_id,
        destination_id=note.destination_id,
        poi_id=note.poi_id,
        day_number=note.day_number,
        title=note.title,
        content=note.content,
        note_type=note.note_type or "general",
        is_pinned=note.is_pinned or False,
        tags=note.tags,
        created_at=str(note.created_at) if note.created_at else None,
        updated_at=str(note.updated_at) if note.updated_at else None,
    )


def register_tools(server: FastMCP):
    """Register note-related tools with the MCP server."""

    @server.tool()
    async def manage_note(
        operation: str,
        note_id: Optional[int] = None,
        trip_id: Optional[int] = None,
        destination_id: Optional[int] = None,
        poi_id: Optional[int] = None,
        day_number: Optional[int] = None,
        title: Optional[str] = None,
        content: Optional[str] = None,
        note_type: Optional[str] = None,
        is_pinned: Optional[bool] = None,
        tags: Optional[List[str]] = None,
    ) -> dict:
        """
        Full note management - create, read, update, delete, or list travel notes.

        Notes store practical info about POIs, destinations, or days (transport tips,
        opening hours, reminders, etc.).

        OPERATIONS:
            - "create": Add a note (requires: trip_id, title)
            - "read": Get note details (requires: note_id)
            - "update": Modify note (requires: note_id + fields to change)
            - "delete": Remove note (requires: note_id) - CONFIRM WITH USER FIRST!
            - "list": Show notes with filters (requires: trip_id)

        Args:
            operation: create | read | update | delete | list
            note_id: Note ID (required for read, update, delete)
            trip_id: Trip ID (required for create, list)
            destination_id: Link note to a destination (optional)
            poi_id: Link note to a POI (optional, destination_id should also be set)
            day_number: Link note to a specific day (optional, requires destination_id)
            title: Note title (required for create)
            content: Note content text (transport tips, reminders, etc.)
            note_type: general | destination | day | poi (auto-inferred if not set)
            is_pinned: Pin important notes to the top
            tags: Custom tags for categorization (e.g., ["transport", "tip"])

        Returns:
            - create: New note with ID
            - read: Full note details
            - update: Updated note
            - delete: Success confirmation
            - list: Array of notes matching filters

        Example flows:
            - POI tip: manage_note(operation="create", trip_id=1, poi_id=42,
                        destination_id=5, title="Metro L3 to Sagrada Familia",
                        content="Take metro L3 from Passeig de Gracia, exit at Sagrada Familia")
            - Day reminder: manage_note(operation="create", trip_id=1, destination_id=5,
                            day_number=2, title="Book flamenco tickets",
                            content="Book at least 2 days ahead at tablaoflamenco.com")
            - General: manage_note(operation="create", trip_id=1,
                       title="Pack adapter", content="Spain uses type C/F plugs")
        """
        logger.info(f"manage_note called with operation={operation}, note_id={note_id}")

        from sqlalchemy import select
        from app.models import Note, Trip, Destination, POI

        try:
            op = NoteOperation(operation.lower())
        except ValueError:
            return ManageNoteOutput(
                operation=operation,
                success=False,
                message=f"Invalid operation: {operation}. Must be one of: create, read, update, delete, list",
            ).model_dump()

        async with get_db_session() as db:
            try:
                if op == NoteOperation.CREATE:
                    if not trip_id:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="trip_id is required for create operation",
                        ).model_dump()
                    if not title:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="title is required for create operation",
                        ).model_dump()

                    # Verify trip exists
                    trip_result = await db.execute(
                        select(Trip).where(Trip.id == trip_id)
                    )
                    trip = trip_result.scalar_one_or_none()
                    if not trip:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message=f"Trip with ID {trip_id} not found",
                        ).model_dump()

                    # Verify destination exists if provided
                    if destination_id:
                        dest_result = await db.execute(
                            select(Destination).where(Destination.id == destination_id)
                        )
                        if not dest_result.scalar_one_or_none():
                            return ManageNoteOutput(
                                operation=operation, success=False,
                                message=f"Destination with ID {destination_id} not found",
                            ).model_dump()

                    # Verify POI exists if provided
                    if poi_id:
                        poi_result = await db.execute(
                            select(POI).where(POI.id == poi_id)
                        )
                        if not poi_result.scalar_one_or_none():
                            return ManageNoteOutput(
                                operation=operation, success=False,
                                message=f"POI with ID {poi_id} not found",
                            ).model_dump()

                    # Auto-infer note_type if not provided
                    effective_note_type = note_type
                    if not effective_note_type:
                        if poi_id:
                            effective_note_type = "poi"
                        elif day_number:
                            effective_note_type = "day"
                        elif destination_id:
                            effective_note_type = "destination"
                        else:
                            effective_note_type = "general"

                    db_note = Note(
                        trip_id=trip_id,
                        destination_id=destination_id,
                        poi_id=poi_id,
                        day_number=day_number,
                        title=title,
                        content=content,
                        note_type=effective_note_type,
                        is_pinned=is_pinned or False,
                        tags=tags,
                    )

                    db.add(db_note)
                    await db.flush()
                    await db.refresh(db_note)

                    note_result = _note_to_result(db_note)
                    return ManageNoteOutput(
                        operation=operation, success=True,
                        message=f"Note '{title}' created with ID {db_note.id}",
                        note=note_result,
                    ).model_dump()

                elif op == NoteOperation.READ:
                    if not note_id:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="note_id is required for read operation",
                        ).model_dump()

                    result = await db.execute(
                        select(Note).where(Note.id == note_id)
                    )
                    db_note = result.scalar_one_or_none()
                    if not db_note:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message=f"Note with ID {note_id} not found",
                        ).model_dump()

                    note_result = _note_to_result(db_note)
                    return ManageNoteOutput(
                        operation=operation, success=True,
                        message=f"Note '{db_note.title}' retrieved",
                        note=note_result,
                    ).model_dump()

                elif op == NoteOperation.UPDATE:
                    if not note_id:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="note_id is required for update operation",
                        ).model_dump()

                    result = await db.execute(
                        select(Note).where(Note.id == note_id)
                    )
                    db_note = result.scalar_one_or_none()
                    if not db_note:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message=f"Note with ID {note_id} not found",
                        ).model_dump()

                    # Update provided fields
                    if title is not None:
                        db_note.title = title
                    if content is not None:
                        db_note.content = content
                    if note_type is not None:
                        db_note.note_type = note_type
                    if destination_id is not None:
                        db_note.destination_id = destination_id
                    if poi_id is not None:
                        db_note.poi_id = poi_id
                    if day_number is not None:
                        db_note.day_number = day_number
                    if is_pinned is not None:
                        db_note.is_pinned = is_pinned
                    if tags is not None:
                        db_note.tags = tags

                    await db.flush()
                    await db.refresh(db_note)

                    note_result = _note_to_result(db_note)
                    return ManageNoteOutput(
                        operation=operation, success=True,
                        message=f"Note '{db_note.title}' updated",
                        note=note_result,
                    ).model_dump()

                elif op == NoteOperation.DELETE:
                    if not note_id:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="note_id is required for delete operation",
                        ).model_dump()

                    result = await db.execute(
                        select(Note).where(Note.id == note_id)
                    )
                    db_note = result.scalar_one_or_none()
                    if not db_note:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message=f"Note with ID {note_id} not found",
                        ).model_dump()

                    note_title = db_note.title
                    await db.delete(db_note)
                    await db.flush()

                    return ManageNoteOutput(
                        operation=operation, success=True,
                        message=f"Note '{note_title}' deleted successfully",
                    ).model_dump()

                elif op == NoteOperation.LIST:
                    if not trip_id:
                        return ManageNoteOutput(
                            operation=operation, success=False,
                            message="trip_id is required for list operation",
                        ).model_dump()

                    # Build query with filters
                    query = select(Note).where(Note.trip_id == trip_id)

                    if destination_id is not None:
                        query = query.where(Note.destination_id == destination_id)
                    if poi_id is not None:
                        query = query.where(Note.poi_id == poi_id)
                    if day_number is not None:
                        query = query.where(Note.day_number == day_number)
                    if note_type is not None:
                        query = query.where(Note.note_type == note_type)

                    query = query.order_by(
                        Note.is_pinned.desc(),
                        Note.created_at.desc(),
                    )

                    result = await db.execute(query)
                    rows = result.scalars().all()

                    note_results = [_note_to_result(n) for n in rows]

                    return ManageNoteOutput(
                        operation=operation, success=True,
                        message=f"Retrieved {len(note_results)} notes for trip {trip_id}",
                        notes=note_results,
                        total_count=len(note_results),
                    ).model_dump()

            except Exception as e:
                logger.error(f"manage_note failed: {e}")
                return ManageNoteOutput(
                    operation=operation,
                    success=False,
                    message=f"Operation failed: {str(e)}",
                ).model_dump()

    logger.info("Registered note tools: manage_note")
