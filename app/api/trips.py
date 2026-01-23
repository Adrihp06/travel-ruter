import os
import uuid
import aiofiles
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.schemas.trip import TripCreate, TripUpdate, TripResponse, TripWithDestinationsResponse, BudgetSummary, POIStats, CoverImageUploadResponse, TripDuplicateRequest
from app.services.trip_service import TripService

router = APIRouter()

# Allowed image types for cover upload
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post(
    "/upload-cover",
    response_model=CoverImageUploadResponse,
    summary="Upload a cover image for a trip",
    description="Upload an image file to be used as a trip cover. Returns the URL of the uploaded image."
)
async def upload_cover_image(
    file: UploadFile = File(...),
) -> CoverImageUploadResponse:
    """Upload a cover image and return its URL"""
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Allowed types: JPEG, PNG, WebP"
        )

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB"
        )

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{ext}"

    # Create covers directory
    covers_dir = os.path.join(settings.DOCUMENTS_UPLOAD_PATH, "covers")
    os.makedirs(covers_dir, exist_ok=True)

    file_path = os.path.join(covers_dir, unique_filename)

    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(content)

    # Return the URL that can be used to access the image
    # This assumes a static files route is configured
    url = f"/api/v1/trips/covers/{unique_filename}"

    return CoverImageUploadResponse(url=url, filename=unique_filename)


@router.get(
    "/covers/{filename}",
    summary="Get a cover image",
    description="Retrieve an uploaded cover image by filename"
)
async def get_cover_image(filename: str):
    """Serve a cover image file"""
    from fastapi.responses import FileResponse

    covers_dir = os.path.join(settings.DOCUMENTS_UPLOAD_PATH, "covers")
    file_path = os.path.join(covers_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cover image not found"
        )

    return FileResponse(file_path)


@router.post(
    "/",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trip",
    description="Create a new trip with automatic night calculation based on start and end dates"
)
async def create_trip(
    trip_data: TripCreate,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Create a new trip"""
    trip = await TripService.create_trip(db, trip_data)
    return TripResponse.model_validate(trip)


@router.get(
    "/",
    response_model=List[TripResponse],
    summary="List all trips",
    description="Retrieve all trips with pagination support"
)
async def get_trips(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    db: AsyncSession = Depends(get_db)
) -> List[TripResponse]:
    """Get all trips with pagination"""
    trips = await TripService.get_trips(db, skip=skip, limit=limit)
    return [TripResponse.model_validate(trip) for trip in trips]


@router.get(
    "/{trip_id}",
    response_model=TripWithDestinationsResponse,
    summary="Get trip details",
    description="Retrieve details of a specific trip by ID, including all destinations"
)
async def get_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> TripWithDestinationsResponse:
    """Get a specific trip by ID with destinations"""
    trip = await TripService.get_trip_with_destinations(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return TripWithDestinationsResponse.model_validate(trip)


@router.put(
    "/{trip_id}",
    response_model=TripResponse,
    summary="Update a trip",
    description="Update an existing trip. Nights are automatically recalculated if dates change."
)
async def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Update a trip"""
    trip = await TripService.update_trip(db, trip_id, trip_data)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return TripResponse.model_validate(trip)


@router.post(
    "/{trip_id}/duplicate",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Duplicate a trip",
    description="Create a copy of an existing trip with configurable options for what to include (destinations, POIs, accommodations, documents)"
)
async def duplicate_trip(
    trip_id: int,
    duplicate_request: TripDuplicateRequest,
    db: AsyncSession = Depends(get_db)
) -> TripResponse:
    """Duplicate a trip with specified options"""
    new_trip = await TripService.duplicate_trip(db, trip_id, duplicate_request)
    if not new_trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return TripResponse.model_validate(new_trip)


@router.delete(
    "/{trip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trip",
    description="Delete a trip by ID"
)
async def delete_trip(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a trip"""
    success = await TripService.delete_trip(db, trip_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )


@router.get(
    "/{trip_id}/budget",
    response_model=BudgetSummary,
    summary="Get trip budget summary",
    description="Calculate and return budget summary for a trip, including estimated and actual costs from all POIs"
)
async def get_trip_budget(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> BudgetSummary:
    """Get budget summary for a trip"""
    budget = await TripService.get_budget_summary(db, trip_id)
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    return budget


@router.get(
    "/{trip_id}/poi-stats",
    response_model=POIStats,
    summary="Get POI statistics for a trip",
    description="Get the total and scheduled POI counts for a trip"
)
async def get_trip_poi_stats(
    trip_id: int,
    db: AsyncSession = Depends(get_db)
) -> POIStats:
    """Get POI statistics for a trip"""
    # Verify trip exists
    trip = await TripService.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id {trip_id} not found"
        )
    stats = await TripService.get_poi_stats(db, trip_id)
    return POIStats(**stats)
