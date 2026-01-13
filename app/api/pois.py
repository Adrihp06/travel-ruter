from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint

from app.core.database import get_db
from app.models import POI, Destination
from app.schemas.poi import POICreate, POIUpdate, POIResponse, POIsByCategory

router = APIRouter()


@router.post("/pois", response_model=POIResponse, status_code=status.HTTP_201_CREATED)
async def create_poi(
    poi: POICreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new POI"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == poi.destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {poi.destination_id} not found"
        )

    # Create POI
    poi_data = poi.model_dump()
    # Remove latitude/longitude as they're not direct model fields
    latitude = poi_data.pop("latitude", None)
    longitude = poi_data.pop("longitude", None)

    db_poi = POI(**poi_data)

    # If latitude and longitude are provided, create PostGIS point
    if latitude is not None and longitude is not None:
        db_poi.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    db.add(db_poi)
    await db.flush()
    await db.refresh(db_poi)

    return db_poi


@router.get("/destinations/{destination_id}/pois", response_model=List[POIsByCategory])
async def list_pois_by_destination(
    destination_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all POIs for a specific destination, grouped by category"""
    # Verify that the destination exists
    dest_result = await db.execute(select(Destination).where(Destination.id == destination_id))
    destination = dest_result.scalar_one_or_none()

    if not destination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination with id {destination_id} not found"
        )

    # Get POIs ordered by category and priority
    result = await db.execute(
        select(POI)
        .where(POI.destination_id == destination_id)
        .order_by(POI.category.asc(), POI.priority.desc(), POI.created_at.asc())
    )
    pois = result.scalars().all()

    # Group POIs by category
    categories_dict: dict[str, list] = {}
    for poi in pois:
        if poi.category not in categories_dict:
            categories_dict[poi.category] = []
        categories_dict[poi.category].append(poi)

    # Convert to list of POIsByCategory
    grouped_pois = [
        POIsByCategory(category=category, pois=pois_list)
        for category, pois_list in categories_dict.items()
    ]

    return grouped_pois


@router.get("/pois/{id}", response_model=POIResponse)
async def get_poi(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific POI by ID"""
    result = await db.execute(select(POI).where(POI.id == id))
    poi = result.scalar_one_or_none()

    if not poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    return poi


@router.put("/pois/{id}", response_model=POIResponse)
async def update_poi(
    id: int,
    poi_update: POIUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a POI"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    # Update fields
    update_data = poi_update.model_dump(exclude_unset=True)

    # Handle coordinates separately
    latitude = update_data.pop("latitude", None)
    longitude = update_data.pop("longitude", None)

    for field, value in update_data.items():
        setattr(db_poi, field, value)

    # Update coordinates if latitude and longitude are provided
    if latitude is not None and longitude is not None:
        db_poi.coordinates = ST_SetSRID(
            ST_MakePoint(longitude, latitude),
            4326
        )

    await db.flush()
    await db.refresh(db_poi)

    return db_poi


@router.delete("/pois/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a POI"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    await db.delete(db_poi)

    return None
