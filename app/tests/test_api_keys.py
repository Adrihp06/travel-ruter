import pytest
from unittest.mock import patch
from cryptography.fernet import Fernet
from app.models.trip_member import TripMember


@pytest.fixture(autouse=True)
def mock_fernet():
    key = Fernet.generate_key().decode()
    with patch("app.services.encryption_service.settings") as mock_settings:
        mock_settings.FERNET_KEY = key
        with patch("app.services.api_key_service.encrypt") as mock_enc, \
             patch("app.services.api_key_service.decrypt") as mock_dec, \
             patch("app.services.api_key_service.mask_key") as mock_mask:
            f = Fernet(key.encode())
            mock_enc.side_effect = lambda x: f.encrypt(x.encode()).decode()
            mock_dec.side_effect = lambda x: f.decrypt(x.encode()).decode()
            mock_mask.side_effect = lambda x: x[:4] + "..." + x[-4:]
            yield


class TestApiKeys:
    async def test_set_api_key_for_trip(self, db, client, trip_with_owner, auth_headers):
        resp = await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "pk.test123456"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["service_name"] == "mapbox"

    async def test_get_api_keys_returns_masked(self, db, client, trip_with_owner, auth_headers):
        await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "pk.test123456"},
            headers=auth_headers,
        )
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        keys = resp.json()
        assert len(keys) >= 1
        assert "masked_key" in keys[0]
        assert keys[0]["masked_key"] != "pk.test123456"

    async def test_delete_api_key(self, db, client, trip_with_owner, auth_headers):
        await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "pk.test123456"},
            headers=auth_headers,
        )
        resp = await client.delete(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_viewer_cannot_set_api_key(self, db, client, trip_with_owner, second_user, second_auth_headers):
        member = TripMember(
            trip_id=trip_with_owner.id, user_id=second_user.id,
            role="viewer", status="accepted",
        )
        db.add(member)
        await db.flush()
        resp = await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "pk.test123456"},
            headers=second_auth_headers,
        )
        assert resp.status_code == 403

    async def test_duplicate_service_updates_key(self, db, client, trip_with_owner, auth_headers):
        await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "first-key"},
            headers=auth_headers,
        )
        await client.put(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys/mapbox",
            json={"key": "second-key"},
            headers=auth_headers,
        )
        resp = await client.get(
            f"/api/v1/trips/{trip_with_owner.id}/api-keys",
            headers=auth_headers,
        )
        keys = resp.json()
        mapbox_keys = [k for k in keys if k["service_name"] == "mapbox"]
        assert len(mapbox_keys) == 1
