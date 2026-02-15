import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.models.trip_member import TripMember
from app.services.auth_service import decode_token
from app.services.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/trip/{trip_id}")
async def trip_websocket(
    websocket: WebSocket,
    trip_id: int,
    token: str = "",
):
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = int(payload.get("sub", 0))
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    await manager.connect(trip_id, user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # Handle incoming messages (e.g., typing indicators)
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await manager.disconnect(trip_id, user_id)
    except Exception:
        await manager.disconnect(trip_id, user_id)
