import pytest
from app.services.connection_manager import ConnectionManager


class TestConnectionManager:
    def test_connection_manager_tracks_users(self):
        mgr = ConnectionManager()
        assert mgr.get_online_users(1) == []

    async def test_presence_broadcast_on_disconnect(self):
        mgr = ConnectionManager()
        # After disconnect with no connections, the trip should be removed
        await mgr.disconnect(1, 42)
        assert mgr.get_online_users(1) == []
