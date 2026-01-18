from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.routing import RoutingRequest, RoutingResponse
from app.schemas.route import RouteRequest, RouteResponse
from app.schemas.mapbox import (
    MapboxRouteRequest,
    MapboxRouteResponse,
    MapboxMultiWaypointRequest,
    MapboxWaypoint,
)
from app.schemas.google_maps import (
    GoogleMapsExportRequest,
    GoogleMapsExportResponse,
)
from app.schemas.openrouteservice import (
    ORSRouteRequest,
    ORSRouteResponse,
    ORSMultiWaypointRequest,
    ORSSegment,
    ORSServiceStatus,
)
from app.services.route_service import RouteService
from app.services.mapbox_service import (
    MapboxService,
    MapboxServiceError,
    MapboxRoutingProfile,
)
from app.services.google_maps_service import GoogleMapsService
from app.services.openrouteservice import (
    OpenRouteServiceService,
    ORSServiceError,
    ORSRoutingProfile,
)

router = APIRouter()


@router.post("/routes/inter-city", response_model=RoutingResponse)
async def calculate_inter_city_route(request: RoutingRequest):
    """Calculate route between two cities"""
    return RouteService.calculate_inter_city_route(request)


@router.post("/routes/intra-city", response_model=RouteResponse)
async def calculate_intra_city_route(request: RouteRequest):
    """Calculate intra-city route with ETA"""
    return RouteService.calculate_intra_city_route(request)


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


@router.post("/routes/mapbox", response_model=MapboxRouteResponse)
async def get_mapbox_route(request: MapboxRouteRequest):
    """
    Get route using Mapbox Directions API.

    Supports multiple routing profiles:
    - driving: Car routing
    - driving-traffic: Car routing with real-time traffic
    - walking: Pedestrian routing
    - cycling: Bicycle routing
    """
    try:
        service = MapboxService()
        profile = MapboxRoutingProfile(request.profile.value)

        # Convert optional waypoints
        waypoints = None
        if request.waypoints:
            waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_route(
            origin=(request.origin.lon, request.origin.lat),
            destination=(request.destination.lon, request.destination.lat),
            profile=profile,
            waypoints=waypoints,
        )

        return MapboxRouteResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=round(result.duration_seconds / 60, 1),
            profile=request.profile,
            geometry=result.geometry,
            waypoints=[
                MapboxWaypoint(name=wp.get("name", ""), location=wp.get("location", []))
                for wp in result.waypoints
            ],
        )

    except MapboxServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/routes/mapbox/multi-waypoint", response_model=MapboxRouteResponse)
async def get_mapbox_multi_waypoint_route(request: MapboxMultiWaypointRequest):
    """
    Get route through multiple waypoints using Mapbox Directions API.

    Requires at least 2 waypoints. Routes are calculated in order.
    """
    try:
        service = MapboxService()
        profile = MapboxRoutingProfile(request.profile.value)

        waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_multi_waypoint_route(
            waypoints=waypoints,
            profile=profile,
        )

        return MapboxRouteResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=round(result.duration_seconds / 60, 1),
            profile=request.profile,
            geometry=result.geometry,
            waypoints=[
                MapboxWaypoint(name=wp.get("name", ""), location=wp.get("location", []))
                for wp in result.waypoints
            ],
        )

    except MapboxServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/routes/export/google-maps", response_model=GoogleMapsExportResponse)
async def export_to_google_maps(request: GoogleMapsExportRequest):
    """
    Export a route to Google Maps.

    Generates a Google Maps directions URL that can be opened in a browser
    or will trigger the Google Maps mobile app if available.

    Supports:
    - Inter-city routes (origin to destination)
    - Intra-city routes (with multiple waypoints)
    - Various travel modes: driving, walking, bicycling, transit
    """
    return GoogleMapsService.export_route(request)


# =============================================================================
# OpenRouteService Endpoints (for real road routing)
# =============================================================================


@router.get("/routes/ors/status", response_model=ORSServiceStatus)
async def get_ors_status():
    """
    Check if OpenRouteService is configured and available.

    Returns the status of the OpenRouteService API configuration.
    If not available, provides instructions on how to configure it.
    """
    service = OpenRouteServiceService()
    if service.is_available():
        return ORSServiceStatus(
            available=True,
            message="OpenRouteService is configured and ready to use."
        )
    else:
        return ORSServiceStatus(
            available=False,
            message="OpenRouteService API key not configured. Set OPENROUTESERVICE_API_KEY environment variable. Get a free key at https://openrouteservice.org/dev/#/signup"
        )


@router.post("/routes/ors", response_model=ORSRouteResponse)
async def get_ors_route(request: ORSRouteRequest):
    """
    Get route using OpenRouteService Directions API.

    Supports multiple routing profiles:
    - driving-car: Car routing
    - foot-walking: Pedestrian routing
    - foot-hiking: Hiking routing
    - cycling-regular: Regular bicycle routing
    - cycling-road: Road bicycle routing
    - cycling-mountain: Mountain bicycle routing
    - cycling-electric: Electric bicycle routing
    - wheelchair: Wheelchair accessible routing

    Note: OpenRouteService provides real road network routing unlike
    the heuristic-based inter-city routing. Get a free API key at
    https://openrouteservice.org/dev/#/signup
    """
    try:
        service = OpenRouteServiceService()
        profile = ORSRoutingProfile(request.profile.value)

        # Convert optional waypoints
        waypoints = None
        if request.waypoints:
            waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_route(
            origin=(request.origin.lon, request.origin.lat),
            destination=(request.destination.lon, request.destination.lat),
            profile=profile,
            waypoints=waypoints,
        )

        return ORSRouteResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=round(result.duration_seconds / 60, 1),
            profile=request.profile,
            geometry=result.geometry,
            segments=[
                ORSSegment(distance=seg.get("distance", 0), duration=seg.get("duration", 0))
                for seg in result.segments
            ],
            bbox=result.bbox,
        )

    except ORSServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/routes/ors/multi-waypoint", response_model=ORSRouteResponse)
async def get_ors_multi_waypoint_route(request: ORSMultiWaypointRequest):
    """
    Get route through multiple waypoints using OpenRouteService Directions API.

    Requires at least 2 waypoints. Routes are calculated in order.

    This provides real road network routing with accurate distances
    and durations along actual roads.
    """
    try:
        service = OpenRouteServiceService()
        profile = ORSRoutingProfile(request.profile.value)

        waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_multi_waypoint_route(
            waypoints=waypoints,
            profile=profile,
        )

        return ORSRouteResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=round(result.duration_seconds / 60, 1),
            profile=request.profile,
            geometry=result.geometry,
            segments=[
                ORSSegment(distance=seg.get("distance", 0), duration=seg.get("duration", 0))
                for seg in result.segments
            ],
            bbox=result.bbox,
        )

    except ORSServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
