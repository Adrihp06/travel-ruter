import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip_api_key import TripApiKey
from app.services.encryption_service import encrypt, decrypt, mask_key


# Map service names to environment variable names
SERVICE_ENV_MAP = {
    "mapbox": "MAPBOX_ACCESS_TOKEN",
    "openrouteservice": "OPENROUTESERVICE_API_KEY",
    "google_maps": "GOOGLE_MAPS_API_KEY",
    "amadeus_client_id": "AMADEUS_CLIENT_ID",
    "amadeus_client_secret": "AMADEUS_CLIENT_SECRET",
    "perplexity": "PERPLEXITY_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google_ai": "GOOGLE_API_KEY",
}


async def set_key(
    db: AsyncSession, trip_id: int, service_name: str, key: str, user_id: int
) -> TripApiKey:
    """Set (upsert) an API key for a trip+service."""
    stmt = select(TripApiKey).where(
        TripApiKey.trip_id == trip_id,
        TripApiKey.service_name == service_name,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.encrypted_key = encrypt(key)
        existing.added_by = user_id
        await db.flush()
        await db.refresh(existing)
        return existing

    api_key = TripApiKey(
        trip_id=trip_id,
        service_name=service_name,
        encrypted_key=encrypt(key),
        added_by=user_id,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)
    return api_key


async def get_keys_for_trip(db: AsyncSession, trip_id: int) -> list[dict]:
    """Get all API keys for a trip (masked)."""
    stmt = select(TripApiKey).where(TripApiKey.trip_id == trip_id)
    result = await db.execute(stmt)
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "trip_id": k.trip_id,
            "service_name": k.service_name,
            "masked_key": mask_key(decrypt(k.encrypted_key)),
            "added_by": k.added_by,
            "last_used_at": k.last_used_at,
            "created_at": k.created_at,
        }
        for k in keys
    ]


async def get_key(
    db: AsyncSession, trip_id: int, service_name: str
) -> Optional[str]:
    """Get decrypted API key for a trip+service, falling back to env var."""
    stmt = select(TripApiKey).where(
        TripApiKey.trip_id == trip_id,
        TripApiKey.service_name == service_name,
    )
    result = await db.execute(stmt)
    api_key = result.scalar_one_or_none()

    if api_key:
        # Update last_used_at
        api_key.last_used_at = datetime.now(timezone.utc)
        await db.flush()
        return decrypt(api_key.encrypted_key)

    # Fallback to environment variable
    env_var = SERVICE_ENV_MAP.get(service_name)
    if env_var:
        return os.environ.get(env_var)
    return None


async def delete_key(db: AsyncSession, trip_id: int, service_name: str) -> bool:
    """Delete an API key for a trip+service."""
    stmt = delete(TripApiKey).where(
        TripApiKey.trip_id == trip_id,
        TripApiKey.service_name == service_name,
    )
    result = await db.execute(stmt)
    return result.rowcount > 0
