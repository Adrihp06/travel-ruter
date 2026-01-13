from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.routing import RoutingRequest, RoutingResponse
from app.services.route_service import RouteService

router = APIRouter()


@router.post("/routes/inter-city", response_model=RoutingResponse)
async def calculate_inter_city_route(request: RoutingRequest):
    """Calculate route between two cities"""
    return RouteService.calculate_inter_city_route(request)


@router.get("/routes")
async def get_routes(db: AsyncSession = Depends(get_db)):
    """Get all routes"""
    return {"message": "Get all routes", "data": []}


@router.get("/routes/{route_id}")
async def get_route(route_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific route by ID"""
    return {"message": f"Get route {route_id}", "data": None}


@router.post("/routes")
async def create_route(db: AsyncSession = Depends(get_db)):
    """Create a new route"""
    return {"message": "Create route", "data": None}


@router.put("/routes/{route_id}")
async def update_route(route_id: int, db: AsyncSession = Depends(get_db)):
    """Update a route"""
    return {"message": f"Update route {route_id}", "data": None}


@router.delete("/routes/{route_id}")
async def delete_route(route_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a route"""
    return {"message": f"Delete route {route_id}", "data": None}
