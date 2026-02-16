from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.conversation_service import ConversationService
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationSummary,
    ConversationListResponse,
)

router = APIRouter()


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    trip_id: Optional[int] = Query(None, description="Filter by trip"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's conversations (summaries only)."""
    conversations = await ConversationService.list_conversations(
        db, current_user.id, trip_id=trip_id, skip=skip, limit=limit
    )
    count = await ConversationService.count_conversations(
        db, current_user.id, trip_id=trip_id
    )
    return ConversationListResponse(
        conversations=[ConversationSummary.model_validate(c) for c in conversations],
        count=count,
    )


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new conversation."""
    conversation = await ConversationService.create_conversation(
        db, current_user.id, data
    )
    return conversation


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a full conversation (including JSONB blobs)."""
    conversation = await ConversationService.get_conversation(
        db, conversation_id, current_user.id
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a conversation (partial update)."""
    conversation = await ConversationService.update_conversation(
        db, conversation_id, current_user.id, data
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a conversation."""
    deleted = await ConversationService.delete_conversation(
        db, conversation_id, current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return None
