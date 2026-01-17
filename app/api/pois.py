from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_X, ST_Y

from app.core.database import get_db
from app.models import POI, Destination
from app.schemas.poi import POICreate, POIUpdate, POIResponse, POIsByCategory, POIVote

router = APIRouter()


def poi_to_response(poi: POI, latitude: float | None = None, longitude: float | None = None) -> dict:
    """Convert POI model to response dict with explicit lat/lng"""
    return {
        "id": poi.id,
        "destination_id": poi.destination_id,
        "name": poi.name,
        "category": poi.category,
        "description": poi.description,
        "address": poi.address,
        "latitude": latitude if latitude is not None else poi.latitude,
        "longitude": longitude if longitude is not None else poi.longitude,
        "estimated_cost": poi.estimated_cost,
        "actual_cost": poi.actual_cost,
        "currency": poi.currency,
        "dwell_time": poi.dwell_time,
        "likes": poi.likes,
        "vetoes": poi.vetoes,
        "priority": poi.priority,
        "files": poi.files,
        "metadata_json": poi.metadata_json,
        "external_id": poi.external_id,
        "external_source": poi.external_source,
        "created_at": poi.created_at,
        "updated_at": poi.updated_at,
    }


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

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == db_poi.id)
    )
    row = result.one()
    created_poi, lat, lng = row

    return poi_to_response(created_poi, lat, lng)


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

    # Get POIs ordered by category and priority, with explicit lat/lng extraction
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.destination_id == destination_id)
        .order_by(POI.category.asc(), POI.priority.desc(), POI.created_at.asc())
    )
    rows = result.all()

    # Group POIs by category
    categories_dict: dict[str, list] = {}
    for row in rows:
        poi = row[0]
        lat = row[1]
        lng = row[2]

        if poi.category not in categories_dict:
            categories_dict[poi.category] = []

        # Create response dict with explicit coordinates
        poi_response = poi_to_response(poi, lat, lng)
        categories_dict[poi.category].append(poi_response)

    # Convert to list of POIsByCategory
    grouped_pois = [
        {"category": category, "pois": pois_list}
        for category, pois_list in categories_dict.items()
    ]

    return grouped_pois


@router.get("/pois/{id}", response_model=POIResponse)
async def get_poi(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific POI by ID"""
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    poi, lat, lng = row
    return poi_to_response(poi, lat, lng)


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

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one()
    updated_poi, lat, lng = row

    return poi_to_response(updated_poi, lat, lng)


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

@router.post("/pois/{id}/vote", response_model=POIResponse)
async def vote_poi(
    id: int,
    vote: POIVote,
    db: AsyncSession = Depends(get_db)
):
    """Vote for a POI (like or veto)"""
    result = await db.execute(select(POI).where(POI.id == id))
    db_poi = result.scalar_one_or_none()

    if not db_poi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"POI with id {id} not found"
        )

    if vote.type == 'like':
        db_poi.likes += 1
    elif vote.type == 'veto':
        db_poi.vetoes += 1

    await db.flush()

    # Re-query to get the coordinates properly extracted
    result = await db.execute(
        select(
            POI,
            ST_Y(POI.coordinates).label('latitude'),
            ST_X(POI.coordinates).label('longitude')
        )
        .where(POI.id == id)
    )
    row = result.one()
    updated_poi, lat, lng = row

    return poi_to_response(updated_poi, lat, lng)