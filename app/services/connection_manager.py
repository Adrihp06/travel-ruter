import logging
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections per trip, tracking which users are connected."""

    def __init__(self):
        # {trip_id: {user_id: WebSocket}}
        self._connections: dict[int, dict[int, WebSocket]] = {}

    async def connect(self, trip_id: int, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if trip_id not in self._connections:
            self._connections[trip_id] = {}
        self._connections[trip_id][user_id] = websocket
        await self._broadcast_presence(trip_id)

    async def disconnect(self, trip_id: int, user_id: int):
        if trip_id in self._connections:
            self._connections[trip_id].pop(user_id, None)
            if not self._connections[trip_id]:
                del self._connections[trip_id]
            else:
                await self._broadcast_presence(trip_id)

    def get_online_users(self, trip_id: int) -> list[int]:
        return list(self._connections.get(trip_id, {}).keys())

    async def send_to_user(self, trip_id: int, user_id: int, data: dict):
        ws = self._connections.get(trip_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                logger.warning(f"Failed to send to user {user_id} in trip {trip_id}")

    async def broadcast_to_trip(self, trip_id: int, data: dict, exclude_user: Optional[int] = None):
        connections = self._connections.get(trip_id, {})
        for uid, ws in list(connections.items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                logger.warning(f"Failed to broadcast to user {uid} in trip {trip_id}")

    async def _broadcast_presence(self, trip_id: int):
        online = self.get_online_users(trip_id)
        await self.broadcast_to_trip(trip_id, {
            "type": "presence",
            "online_users": online,
        })

    async def push_notification(self, user_id: int, notification: dict):
        """Push notification to user across all their trip connections."""
        for trip_id, connections in self._connections.items():
            if user_id in connections:
                await self.send_to_user(trip_id, user_id, {
                    "type": "notification",
                    "data": notification,
                })


# Global instance
manager = ConnectionManager()
