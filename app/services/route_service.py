from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route
from app.schemas.route import RouteRequest, RouteResponse, RouteLeg
from typing import List, Optional
from app.schemas.routing import RoutingRequest, RoutingResponse, TravelMode
from pyproj import Geod
import math


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
            # Avg speed ~800 km/h + 1h overhead (taxi, takeoff, landing)
            effective_dist_km = dist_km
            duration_hours = (effective_dist_km / 800.0) + 0.5  # +30min overhead
        else:
            effective_dist_km = dist_km
            duration_hours = dist_km / 60.0  # Default fallback

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
    def calculate_haversine_distance(
        lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate the great circle distance between two points."""
        R = 6371  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dlon / 2) * math.sin(dlon / 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @staticmethod
    def calculate_intra_city_route(request: RouteRequest) -> RouteResponse:
        """Calculate route metrics for intra-city travel"""
        speed_kmh = 5.0 if request.mode == "walking" else 15.0

        total_distance = 0.0
        total_travel_time = 0.0
        total_dwell_time = sum(p.dwell_time for p in request.points)
        legs = []

        for i in range(len(request.points) - 1):
            start = request.points[i]
            end = request.points[i+1]

            dist = RouteService.calculate_haversine_distance(
                start.latitude, start.longitude,
                end.latitude, end.longitude
            )

            travel_time = (dist / speed_kmh) * 60  # minutes

            leg = RouteLeg(
                start_point=start,
                end_point=end,
                distance_km=round(dist, 2),
                travel_time_minutes=round(travel_time, 1),
                description=(
                    f"Travel from {start.name or 'Point ' + str(i+1)} "
                    f"to {end.name or 'Point ' + str(i+2)}"
                )
            )

            legs.append(leg)
            total_distance += dist
            total_travel_time += travel_time

        return RouteResponse(
            mode=request.mode,
            total_distance_km=round(total_distance, 2),
            total_travel_time_minutes=round(total_travel_time, 1),
            total_dwell_time_minutes=total_dwell_time,
            total_duration_minutes=round(
                total_travel_time + total_dwell_time, 1
            ),
            legs=legs
        )

    @staticmethod
    async def get_all_routes(db: AsyncSession) -> List[Route]:
        """Get all routes from database"""
        result = await db.execute(select(Route))
        return result.scalars().all()

    @staticmethod
    async def get_route_by_id(
        db: AsyncSession, route_id: int
    ) -> Optional[Route]:
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
    async def update_route(
        db: AsyncSession, route_id: int, route_data: dict
    ) -> Optional[Route]:
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
