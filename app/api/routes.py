from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services import api_key_service
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
from app.schemas.google_maps_routes import (
    GoogleMapsRoutesRequest,
    GoogleMapsRoutesResponse,
    GoogleMapsMultiWaypointRequest,
    GoogleMapsRoutesTravelMode,
    TransitStep,
)
from app.schemas.routing_preferences import (
    RoutingPreference,
    RoutingPreferencesRequest,
    RoutingPreferencesResponse,
    GoogleMapsStatusResponse,
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
from app.services.google_maps_routes_service import (
    GoogleMapsRoutesService,
    GoogleMapsRoutesError,
    GoogleMapsRouteTravelMode,
)
from app.services.openrouteservice import (
    OpenRouteServiceService,
    ORSServiceError,
    ORSRoutingProfile,
)

router = APIRouter()


@router.post("/routes/inter-city", response_model=RoutingResponse)
async def calculate_inter_city_route(request: RoutingRequest, current_user: User = Depends(get_current_user)):
    """Calculate route between two cities"""
    return RouteService.calculate_inter_city_route(request)


@router.post("/routes/intra-city", response_model=RouteResponse)
async def calculate_intra_city_route(request: RouteRequest, current_user: User = Depends(get_current_user)):
    """Calculate intra-city route with ETA"""
    return RouteService.calculate_intra_city_route(request)


@router.get("/routes")
async def get_routes(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all routes"""
    return {"message": "Get all routes", "data": []}


@router.get("/routes/{route_id}")
async def get_route(route_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get a specific route by ID"""
    return {"message": f"Get route {route_id}", "data": None}


@router.post("/routes")
async def create_route(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new route"""
    return {"message": "Create route", "data": None}


@router.put("/routes/{route_id}")
async def update_route(route_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update a route"""
    return {"message": f"Update route {route_id}", "data": None}


@router.delete("/routes/{route_id}")
async def delete_route(route_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a route"""
    return {"message": f"Delete route {route_id}", "data": None}


@router.post("/routes/mapbox", response_model=MapboxRouteResponse)
async def get_mapbox_route(
    request: MapboxRouteRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get route using Mapbox Directions API.

    Supports multiple routing profiles:
    - driving: Car routing
    - driving-traffic: Car routing with real-time traffic
    - walking: Pedestrian routing
    - cycling: Bicycle routing
    """
    try:
        access_token = await api_key_service.get_key(db, trip_id, "mapbox") if trip_id else None
        service = MapboxService(access_token=access_token)
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
async def get_mapbox_multi_waypoint_route(
    request: MapboxMultiWaypointRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get route through multiple waypoints using Mapbox Directions API.

    Requires at least 2 waypoints. Routes are calculated in order.
    """
    try:
        access_token = await api_key_service.get_key(db, trip_id, "mapbox") if trip_id else None
        service = MapboxService(access_token=access_token)
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
async def export_to_google_maps(request: GoogleMapsExportRequest, current_user: User = Depends(get_current_user)):
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
async def get_ors_status(
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if OpenRouteService is configured and available.

    Returns the status of the OpenRouteService API configuration.
    If not available, provides instructions on how to configure it.
    """
    api_key = await api_key_service.get_key(db, trip_id, "openrouteservice") if trip_id else None
    service = OpenRouteServiceService(api_key=api_key)
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
async def get_ors_route(
    request: ORSRouteRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
        api_key = await api_key_service.get_key(db, trip_id, "openrouteservice") if trip_id else None
        service = OpenRouteServiceService(api_key=api_key)
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
async def get_ors_multi_waypoint_route(
    request: ORSMultiWaypointRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get route through multiple waypoints using OpenRouteService Directions API.

    Requires at least 2 waypoints. Routes are calculated in order.

    This provides real road network routing with accurate distances
    and durations along actual roads.
    """
    try:
        api_key = await api_key_service.get_key(db, trip_id, "openrouteservice") if trip_id else None
        service = OpenRouteServiceService(api_key=api_key)
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


# =============================================================================
# Google Maps Routes API Endpoints (for real transit/public transport routing)
# =============================================================================


@router.get("/routes/google-maps/status", response_model=GoogleMapsStatusResponse)
async def get_google_maps_status(
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if Google Maps Routes API is configured and available.

    Returns the status of the Google Maps API configuration.
    If not available, provides instructions on how to configure it.
    """
    api_key = await api_key_service.get_key(db, trip_id, "google_maps") if trip_id else None
    service = GoogleMapsRoutesService(api_key=api_key)
    if service.is_available():
        return GoogleMapsStatusResponse(
            available=True,
            message="Google Maps Routes API is configured and ready to use."
        )
    else:
        return GoogleMapsStatusResponse(
            available=False,
            message="Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY environment variable. Get a key at https://console.cloud.google.com/apis/credentials"
        )


@router.post("/routes/google-maps", response_model=GoogleMapsRoutesResponse)
async def get_google_maps_route(
    request: GoogleMapsRoutesRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get route using Google Maps Routes API.

    Supports multiple travel modes:
    - DRIVE: Car routing
    - WALK: Pedestrian routing
    - BICYCLE: Bicycle routing
    - TRANSIT: Public transport routing (trains, buses, etc.)

    For TRANSIT mode, returns actual public transport routes with
    real rail/bus geometry and transit details (stops, lines, etc.).

    Note: Requires a Google Maps API key with Routes API enabled.
    Get a key at https://console.cloud.google.com/apis/credentials
    """
    try:
        api_key = await api_key_service.get_key(db, trip_id, "google_maps") if trip_id else None
        service = GoogleMapsRoutesService(api_key=api_key)
        travel_mode = GoogleMapsRouteTravelMode(request.travel_mode.value)

        # Convert optional waypoints
        waypoints = None
        if request.waypoints:
            waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_route(
            origin=(request.origin.lon, request.origin.lat),
            destination=(request.destination.lon, request.destination.lat),
            travel_mode=travel_mode,
            waypoints=waypoints,
            departure_time=request.departure_time,
        )

        # Parse transit details if available
        transit_details = None
        if result.transit_details and result.transit_details.get("steps"):
            transit_details = [
                TransitStep(
                    line_name=step.get("transitLine", {}).get("name"),
                    vehicle_type=step.get("transitLine", {}).get("vehicle", {}).get("type"),
                    departure_stop=step.get("stopDetails", {}).get("departureStop", {}).get("name"),
                    arrival_stop=step.get("stopDetails", {}).get("arrivalStop", {}).get("name"),
                    num_stops=step.get("stopCount"),
                )
                for step in result.transit_details["steps"]
            ]

        return GoogleMapsRoutesResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=int(round(result.duration_seconds / 60)),
            geometry=result.geometry,
            travel_mode=request.travel_mode.value,
            polyline=result.polyline,
            transit_details=transit_details,
        )

    except GoogleMapsRoutesError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/routes/google-maps/multi-waypoint", response_model=GoogleMapsRoutesResponse)
async def get_google_maps_multi_waypoint_route(
    request: GoogleMapsMultiWaypointRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get route through multiple waypoints using Google Maps Routes API.

    Requires at least 2 waypoints. Routes are calculated in order.

    Supports all travel modes including TRANSIT for public transport.
    """
    try:
        api_key = await api_key_service.get_key(db, trip_id, "google_maps") if trip_id else None
        service = GoogleMapsRoutesService(api_key=api_key)
        travel_mode = GoogleMapsRouteTravelMode(request.travel_mode.value)

        waypoints = [(wp.lon, wp.lat) for wp in request.waypoints]

        result = await service.get_multi_waypoint_route(
            waypoints=waypoints,
            travel_mode=travel_mode,
        )

        return GoogleMapsRoutesResponse(
            distance_km=round(result.distance_meters / 1000, 2),
            duration_min=int(round(result.duration_seconds / 60)),
            geometry=result.geometry,
            travel_mode=request.travel_mode.value,
            polyline=result.polyline,
            transit_details=None,
        )

    except GoogleMapsRoutesError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Routing Preferences Endpoints
# =============================================================================

# Store routing preference in memory (in production, this would be per-user in DB)
_current_routing_preference = RoutingPreference.DEFAULT


@router.get("/routes/preferences", response_model=RoutingPreferencesResponse)
async def get_routing_preferences(
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current routing preferences.

    Returns which routing service is configured to be used and
    the availability status of each service.
    """
    google_key = await api_key_service.get_key(db, trip_id, "google_maps") if trip_id else None
    ors_key = await api_key_service.get_key(db, trip_id, "openrouteservice") if trip_id else None
    google_service = GoogleMapsRoutesService(api_key=google_key)
    ors_service = OpenRouteServiceService(api_key=ors_key)

    return RoutingPreferencesResponse(
        preference=_current_routing_preference,
        google_maps_available=google_service.is_available(),
        ors_available=ors_service.is_available(),
    )


@router.put("/routes/preferences", response_model=RoutingPreferencesResponse)
async def update_routing_preferences(
    request: RoutingPreferencesRequest,
    trip_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update routing preferences.

    Options:
    - default: Use OpenRouteService for everything (current behavior)
    - google_public_transport: Use Google Maps for train/bus only, ORS for others
    - google_everything: Use Google Maps for all transport modes

    Note: If a service is not available (API key not configured),
    the system will fall back to the next available service.
    """
    global _current_routing_preference
    _current_routing_preference = request.preference

    google_key = await api_key_service.get_key(db, trip_id, "google_maps") if trip_id else None
    ors_key = await api_key_service.get_key(db, trip_id, "openrouteservice") if trip_id else None
    google_service = GoogleMapsRoutesService(api_key=google_key)
    ors_service = OpenRouteServiceService(api_key=ors_key)

    return RoutingPreferencesResponse(
        preference=_current_routing_preference,
        google_maps_available=google_service.is_available(),
        ors_available=ors_service.is_available(),
    )
