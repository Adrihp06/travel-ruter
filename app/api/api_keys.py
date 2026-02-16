from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.api_key import ApiKeySet, ApiKeyResponse, ApiKeyTestResult
from app.services import api_key_service
from app.api.deps import get_current_user
from app.api.permissions import require_editor, require_viewer

router = APIRouter(tags=["api-keys"])


@router.get("/trips/{trip_id}/api-keys", response_model=List[dict])
async def get_api_keys(
    trip_id: int,
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    return await api_key_service.get_keys_for_trip(db, trip_id)


@router.put("/trips/{trip_id}/api-keys/{service}")
async def set_api_key(
    trip_id: int,
    service: str,
    data: ApiKeySet,
    user: User = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    key = await api_key_service.set_key(db, trip_id, service, data.key, user.id)
    return {"id": key.id, "service_name": key.service_name, "message": "Key saved"}


@router.delete("/trips/{trip_id}/api-keys/{service}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    trip_id: int,
    service: str,
    user: User = Depends(require_editor),
    db: AsyncSession = Depends(get_db),
):
    deleted = await api_key_service.delete_key(db, trip_id, service)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")


@router.get("/trips/{trip_id}/api-keys/{service}/value")
async def get_api_key_value(
    trip_id: int,
    service: str,
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    """Return decrypted key value (or env var fallback). Used by orchestrator."""
    key = await api_key_service.get_key(db, trip_id, service)
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No key configured")
    return {"service_name": service, "key": key}


@router.post("/trips/{trip_id}/api-keys/{service}/test", response_model=ApiKeyTestResult)
async def test_api_key(
    trip_id: int,
    service: str,
    user: User = Depends(require_viewer),
    db: AsyncSession = Depends(get_db),
):
    key = await api_key_service.get_key(db, trip_id, service)
    if not key:
        return ApiKeyTestResult(service_name=service, is_valid=False, message="No key configured")
    # Basic validation: key is non-empty
    return ApiKeyTestResult(service_name=service, is_valid=bool(key), message="Key found")
