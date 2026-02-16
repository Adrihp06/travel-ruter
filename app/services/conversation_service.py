from typing import Optional, List
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.schemas.conversation import ConversationCreate, ConversationUpdate

MAX_BACKEND_HISTORY = 20
MAX_CONVERSATIONS_PER_USER = 100


class ConversationService:
    """Service for Conversation CRUD operations"""

    @staticmethod
    async def create_conversation(
        db: AsyncSession, user_id: int, data: ConversationCreate
    ) -> Conversation:
        # Cap backend_history
        backend_history = data.backend_history
        if backend_history and len(backend_history) > MAX_BACKEND_HISTORY:
            backend_history = backend_history[-MAX_BACKEND_HISTORY:]

        conversation = Conversation(
            user_id=user_id,
            trip_id=data.trip_id,
            title=data.title,
            model_id=data.model_id,
            messages=data.messages or [],
            backend_history=backend_history,
            trip_context=data.trip_context,
            destination_context=data.destination_context,
            message_count=len(data.messages) if data.messages else 0,
        )
        db.add(conversation)
        await db.flush()
        await db.refresh(conversation)

        # Auto-prune old conversations
        await ConversationService._prune_if_needed(db, user_id)

        return conversation

    @staticmethod
    async def get_conversation(
        db: AsyncSession, conversation_id: int, user_id: int
    ) -> Optional[Conversation]:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_conversations(
        db: AsyncSession,
        user_id: int,
        trip_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Conversation]:
        query = select(Conversation).where(Conversation.user_id == user_id)

        if trip_id is not None:
            query = query.where(Conversation.trip_id == trip_id)

        query = query.order_by(Conversation.updated_at.desc()).offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def count_conversations(
        db: AsyncSession,
        user_id: int,
        trip_id: Optional[int] = None,
    ) -> int:
        query = select(func.count(Conversation.id)).where(
            Conversation.user_id == user_id
        )
        if trip_id is not None:
            query = query.where(Conversation.trip_id == trip_id)
        result = await db.execute(query)
        return result.scalar_one()

    @staticmethod
    async def update_conversation(
        db: AsyncSession,
        conversation_id: int,
        user_id: int,
        data: ConversationUpdate,
    ) -> Optional[Conversation]:
        conversation = await ConversationService.get_conversation(
            db, conversation_id, user_id
        )
        if not conversation:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Cap backend_history if provided
        if "backend_history" in update_data and update_data["backend_history"]:
            bh = update_data["backend_history"]
            if len(bh) > MAX_BACKEND_HISTORY:
                update_data["backend_history"] = bh[-MAX_BACKEND_HISTORY:]

        for field, value in update_data.items():
            setattr(conversation, field, value)

        # Recompute message_count from messages
        if "messages" in update_data:
            conversation.message_count = (
                len(update_data["messages"]) if update_data["messages"] else 0
            )

        await db.flush()
        await db.refresh(conversation)
        return conversation

    @staticmethod
    async def delete_conversation(
        db: AsyncSession, conversation_id: int, user_id: int
    ) -> bool:
        conversation = await ConversationService.get_conversation(
            db, conversation_id, user_id
        )
        if not conversation:
            return False
        await db.delete(conversation)
        await db.flush()
        return True

    @staticmethod
    async def _prune_if_needed(db: AsyncSession, user_id: int) -> None:
        count = await ConversationService.count_conversations(db, user_id)
        if count <= MAX_CONVERSATIONS_PER_USER:
            return

        # Find IDs of oldest conversations beyond the limit
        excess = count - MAX_CONVERSATIONS_PER_USER
        oldest_query = (
            select(Conversation.id)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.asc())
            .limit(excess)
        )
        result = await db.execute(oldest_query)
        ids_to_delete = [row[0] for row in result.all()]

        if ids_to_delete:
            await db.execute(
                delete(Conversation).where(Conversation.id.in_(ids_to_delete))
            )
            await db.flush()
