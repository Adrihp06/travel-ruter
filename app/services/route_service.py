from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route
from typing import List, Optional
from app.schemas.routing import RoutingRequest, RoutingResponse, TravelMode, Coordinate
from pyproj import Geod
import json

class RouteService:
    """Service layer for route operations"""

    @staticmethod
    def calculate_inter_city_route(request: RoutingRequest) -> RoutingResponse:
        """
        Calculate route between two cities based on mode.
        Returns distance, duration and geometry.
        """
        geod = Geod(ellps='WGS84')
        az12, az21, dist_meters = geod.inv(
            request.origin.lon, request.origin.lat,
            request.destination.lon, request.destination.lat
        )
        
        dist_km = dist_meters / 1000.0
        
        # Heuristics
        if request.mode == TravelMode.DRIVING:
            # Road network is usually ~1.3x great circle distance
            # Avg speed ~90 km/h for inter-city driving
            effective_dist_km = dist_km * 1.3
            duration_hours = effective_dist_km / 90.0
        elif request.mode == TravelMode.TRAIN:
            # Tracks are ~1.2x great circle distance
            # Avg speed ~120 km/h for inter-city trains
            effective_dist_km = dist_km * 1.2
            duration_hours = effective_dist_km / 120.0
        elif request.mode == TravelMode.FLIGHT:
            # Flight is direct
            # Avg speed ~800 km/h + 1 hour overhead (taxi, takeoff, landing)
            effective_dist_km = dist_km
            duration_hours = (effective_dist_km / 800.0) + 0.5 # Adding 30 mins overhead
        else:
            effective_dist_km = dist_km
            duration_hours = dist_km / 60.0 # Default fallback
            
        duration_min = duration_hours * 60
        
        # Construct geometry (Simple LineString for now)
        geometry = {
            "type": "LineString",
            "coordinates": [
                [request.origin.lon, request.origin.lat],
                [request.destination.lon, request.destination.lat]
            ]
        }
        
        return RoutingResponse(
            distance_km=round(effective_dist_km, 2),
            duration_min=round(duration_min, 0),
            mode=request.mode,
            origin=request.origin,
            destination=request.destination,
            geometry=geometry
        )

    @staticmethod
    async def get_all_routes(db: AsyncSession) -> List[Route]:
        """Get all routes from database"""
        result = await db.execute(select(Route))
        return result.scalars().all()

    @staticmethod
    async def get_route_by_id(db: AsyncSession, route_id: int) -> Optional[Route]:
        """Get a specific route by ID"""
        result = await db.execute(select(Route).where(Route.id == route_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_route(db: AsyncSession, route_data: dict) -> Route:
        """Create a new route"""
        route = Route(**route_data)
        db.add(route)
        await db.flush()
        await db.refresh(route)
        return route

    @staticmethod
    async def update_route(db: AsyncSession, route_id: int, route_data: dict) -> Optional[Route]:
        """Update an existing route"""
        route = await RouteService.get_route_by_id(db, route_id)
        if route:
            for key, value in route_data.items():
                setattr(route, key, value)
            await db.flush()
            await db.refresh(route)
        return route

    @staticmethod
    async def delete_route(db: AsyncSession, route_id: int) -> bool:
        """Delete a route"""
        route = await RouteService.get_route_by_id(db, route_id)
        if route:
            await db.delete(route)
            await db.flush()
            return True
        return False
