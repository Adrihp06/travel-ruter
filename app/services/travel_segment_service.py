from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from pyproj import Geod
import json
import logging

from app.models.travel_segment import TravelSegment
from app.models.destination import Destination
from app.models.route_waypoint import RouteWaypoint
from app.schemas.travel_segment import TravelMode, TravelSegmentCreate
from app.schemas.routing_preferences import RoutingPreference
from app.services.mapbox_service import MapboxService, MapboxServiceError, MapboxRoutingProfile
from app.services.openrouteservice import OpenRouteServiceService, ORSServiceError, ORSRoutingProfile
from app.services.google_maps_routes_service import (
    GoogleMapsRoutesService,
    GoogleMapsRoutesError,
    GoogleMapsRouteTravelMode,
)

logger = logging.getLogger(__name__)


class TravelSegmentService:
    """Service for calculating and managing travel segments between destinations"""

    # Speed estimates in km/h for different travel modes
    SPEED_ESTIMATES = {
        TravelMode.PLANE: 800,     # Commercial flight cruising speed
        TravelMode.CAR: 80,        # Average inter-city driving
        TravelMode.TRAIN: 120,     # High-speed train average
        TravelMode.BUS: 60,        # Inter-city bus
        TravelMode.WALK: 5,        # Walking pace
        TravelMode.BIKE: 20,       # Cycling pace
        TravelMode.FERRY: 30,      # Ferry speed
    }

    # Distance multipliers to account for road/rail network
    DISTANCE_MULTIPLIERS = {
        TravelMode.PLANE: 1.0,     # Direct flight
        TravelMode.CAR: 1.3,       # Road network adds ~30%
        TravelMode.TRAIN: 1.2,     # Rail network adds ~20%
        TravelMode.BUS: 1.3,       # Bus follows roads
        TravelMode.WALK: 1.4,      # Walking paths may be indirect
        TravelMode.BIKE: 1.3,      # Cycling paths
        TravelMode.FERRY: 1.1,     # Mostly direct water routes
    }

    # Additional overhead in minutes (airport procedures, station waits, etc.)
    OVERHEAD_MINUTES = {
        TravelMode.PLANE: 150,     # 2.5 hours for airport procedures
        TravelMode.CAR: 0,         # No overhead
        TravelMode.TRAIN: 30,      # Station wait time
        TravelMode.BUS: 20,        # Bus station wait
        TravelMode.WALK: 0,        # No overhead
        TravelMode.BIKE: 0,        # No overhead
        TravelMode.FERRY: 45,      # Port boarding procedures
    }

    @staticmethod
    def calculate_distance(
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """Calculate great circle distance between two points in km"""
        geod = Geod(ellps='WGS84')
        _, _, dist_meters = geod.inv(lon1, lat1, lon2, lat2)
        return dist_meters / 1000.0

    @classmethod
    def calculate_travel_time(
        cls,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
        mode: TravelMode
    ) -> tuple[float, int]:
        """
        Calculate distance and duration between two points for a given mode.

        Returns:
            tuple: (distance_km, duration_minutes)
        """
        base_distance = cls.calculate_distance(lat1, lon1, lat2, lon2)
        multiplier = cls.DISTANCE_MULTIPLIERS.get(mode, 1.0)
        effective_distance = base_distance * multiplier

        speed = cls.SPEED_ESTIMATES.get(mode, 60)
        travel_hours = effective_distance / speed
        travel_minutes = travel_hours * 60

        overhead = cls.OVERHEAD_MINUTES.get(mode, 0)
        total_minutes = int(round(travel_minutes + overhead))

        return round(effective_distance, 2), total_minutes

    @classmethod
    def _map_mode_to_mapbox_profile(cls, mode: TravelMode) -> Optional[MapboxRoutingProfile]:
        """Map travel mode to Mapbox routing profile."""
        mapping = {
            TravelMode.CAR: MapboxRoutingProfile.DRIVING,
            TravelMode.WALK: MapboxRoutingProfile.WALKING,
            TravelMode.BIKE: MapboxRoutingProfile.CYCLING,
        }
        return mapping.get(mode)

    @classmethod
    def _map_mode_to_ors_profile(cls, mode: TravelMode) -> Optional[ORSRoutingProfile]:
        """Map travel mode to OpenRouteService routing profile."""
        mapping = {
            TravelMode.CAR: ORSRoutingProfile.DRIVING_CAR,
            TravelMode.WALK: ORSRoutingProfile.FOOT_WALKING,
            TravelMode.BIKE: ORSRoutingProfile.CYCLING_REGULAR,
            # For train/bus, we use driving-car to get road network geometry
            # (as a reasonable approximation since there's no dedicated rail routing)
            TravelMode.TRAIN: ORSRoutingProfile.DRIVING_CAR,
            TravelMode.BUS: ORSRoutingProfile.DRIVING_CAR,
        }
        return mapping.get(mode)

    @classmethod
    def _map_mode_to_google_maps(cls, mode: TravelMode) -> Optional[GoogleMapsRouteTravelMode]:
        """Map travel mode to Google Maps Routes API travel mode."""
        mapping = {
            TravelMode.CAR: GoogleMapsRouteTravelMode.DRIVE,
            TravelMode.WALK: GoogleMapsRouteTravelMode.WALK,
            TravelMode.BIKE: GoogleMapsRouteTravelMode.BICYCLE,
            # For train/bus, we use TRANSIT to get real public transport routes
            TravelMode.TRAIN: GoogleMapsRouteTravelMode.TRANSIT,
            TravelMode.BUS: GoogleMapsRouteTravelMode.TRANSIT,
        }
        return mapping.get(mode)

    @classmethod
    def _is_public_transport(cls, mode: TravelMode) -> bool:
        """Check if the travel mode is public transport (train or bus)."""
        return mode in (TravelMode.TRAIN, TravelMode.BUS)

    @classmethod
    async def _fetch_google_maps_route(
        cls,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
        mode: TravelMode
    ) -> tuple[Optional[dict], Optional[float], Optional[int]]:
        """
        Fetch route geometry from Google Maps Routes API.

        Returns:
            tuple: (geometry_dict, distance_km, duration_minutes) or (None, None, None) if failed
        """
        from datetime import datetime, timedelta

        google_mode = cls._map_mode_to_google_maps(mode)
        if not google_mode:
            return None, None, None

        try:
            service = GoogleMapsRoutesService()
            if not service.is_available():
                return None, None, None

            # For transit, we need to provide a departure time
            # Use tomorrow at 9 AM as a reasonable default
            departure_time = None
            if google_mode == GoogleMapsRouteTravelMode.TRANSIT:
                tomorrow = datetime.utcnow() + timedelta(days=1)
                tomorrow_9am = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
                departure_time = tomorrow_9am.strftime("%Y-%m-%dT%H:%M:%SZ")
                logger.info(f"Using departure time for transit: {departure_time}")

            result = await service.get_route(
                origin=(lon1, lat1),
                destination=(lon2, lat2),
                travel_mode=google_mode,
                departure_time=departure_time,
            )

            distance_km = round(result.distance_meters / 1000, 2)
            duration_min = int(round(result.duration_seconds / 60))

            # Add overhead for public transport
            if mode == TravelMode.TRAIN:
                duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)
            elif mode == TravelMode.BUS:
                duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.BUS, 20)

            return result.geometry, distance_km, duration_min

        except GoogleMapsRoutesError as e:
            logger.warning(f"Google Maps routing failed: {e}")
            return None, None, None

    @classmethod
    async def _fetch_route_geometry(
        cls,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
        mode: TravelMode,
        routing_preference: RoutingPreference = RoutingPreference.DEFAULT
    ) -> tuple[Optional[dict], Optional[float], Optional[int], bool]:
        """
        Fetch real route geometry from routing services.

        Args:
            lat1, lon1: Origin coordinates
            lat2, lon2: Destination coordinates
            mode: Travel mode (car, train, bus, walk, bike, etc.)
            routing_preference: Which routing service to prefer

        Returns:
            tuple: (geometry_dict, distance_km, duration_minutes, is_fallback) or (None, None, None, False) if failed
        """
        # Log routing service availability
        mapbox_service = MapboxService()
        ors_service = OpenRouteServiceService()
        google_service = GoogleMapsRoutesService()

        logger.info(
            f"Routing service availability - Mapbox: {mapbox_service.is_available()}, "
            f"ORS: {ors_service.is_available()}, Google Maps: {google_service.is_available()}"
        )

        # For flights and ferries, we don't have real routing - use straight line
        if mode in (TravelMode.PLANE, TravelMode.FERRY):
            logger.debug(f"Mode {mode} does not support routing, using straight line")
            return None, None, None, False

        geometry = None
        distance_km = None
        duration_min = None

        # Determine if we should use Google Maps
        # Always try Google Maps first for public transport (train/bus) since it's the only
        # service that provides real transit routing. For other modes, check the preference.
        use_google = False
        if cls._is_public_transport(mode):
            # Always use Google Maps for train/bus - it's the only real transit routing
            use_google = True
            logger.info(f"Using Google Maps for public transport mode: {mode}")
        elif routing_preference == RoutingPreference.GOOGLE_EVERYTHING:
            use_google = True

        # Try Google Maps first for public transport or if preference is set
        if use_google:
            geometry, distance_km, duration_min = await cls._fetch_google_maps_route(
                lat1, lon1, lat2, lon2, mode
            )
            if geometry is not None:
                return geometry, distance_km, duration_min, False  # Not a fallback - got real transit data
            # If Google Maps failed, fall through to other services
            logger.info(f"Google Maps routing failed for {mode}, falling back to other services")

        # Try Mapbox for car, walking, biking
        mapbox_profile = cls._map_mode_to_mapbox_profile(mode)
        if mapbox_profile:
            try:
                service = MapboxService()
                if not service.is_available():
                    logger.warning("Mapbox service not available (no access token)")
                else:
                    logger.debug(f"Attempting Mapbox routing with profile {mapbox_profile}")
                    result = await service.get_route(
                        origin=(lon1, lat1),
                        destination=(lon2, lat2),
                        profile=mapbox_profile,
                    )
                    distance_km = round(result.distance_meters / 1000, 2)
                    duration_min = int(round(result.duration_seconds / 60))
                    geometry = result.geometry
                    logger.info(f"Mapbox routing successful: {distance_km}km, {duration_min}min")
                    return geometry, distance_km, duration_min, False  # Not a fallback for car/walk/bike
            except MapboxServiceError as e:
                logger.warning(f"Mapbox routing failed: {e}")

        # Try OpenRouteService for train/bus or as fallback if Mapbox failed
        ors_profile = cls._map_mode_to_ors_profile(mode)
        if ors_profile:
            try:
                service = OpenRouteServiceService()
                if not service.is_available():
                    logger.warning("OpenRouteService not available (no API key)")
                else:
                    logger.debug(f"Attempting ORS routing with profile {ors_profile}")
                    result = await service.get_route(
                        origin=(lon1, lat1),
                        destination=(lon2, lat2),
                        profile=ors_profile,
                    )
                    distance_km = round(result.distance_meters / 1000, 2)
                    duration_min = int(round(result.duration_seconds / 60))

                    # Adjust for train/bus speed differences
                    # ORS uses driving profile for train/bus, so it's a fallback
                    is_fallback = cls._is_public_transport(mode)
                    if mode == TravelMode.TRAIN:
                        # Trains are faster than cars
                        duration_min = int(round(duration_min * 0.75))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)
                    elif mode == TravelMode.BUS:
                        # Buses are slower than cars
                        duration_min = int(round(duration_min * 1.2))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.BUS, 20)

                    logger.info(f"ORS routing successful: {distance_km}km, {duration_min}min (fallback={is_fallback})")
                    return result.geometry, distance_km, duration_min, is_fallback
            except ORSServiceError as e:
                logger.warning(f"ORS routing failed: {e}")

        # Final fallback: For train/bus, try Mapbox driving profile to get road network geometry
        # This is better than a straight line since trains/buses often follow road corridors
        if mode in (TravelMode.TRAIN, TravelMode.BUS) and geometry is None:
            try:
                service = MapboxService()
                if not service.is_available():
                    logger.warning("Mapbox fallback not available (no access token)")
                else:
                    logger.debug(f"Attempting Mapbox driving fallback for {mode}")
                    result = await service.get_route(
                        origin=(lon1, lat1),
                        destination=(lon2, lat2),
                        profile=MapboxRoutingProfile.DRIVING,
                    )
                    # Use driving geometry as approximation
                    geometry = result.geometry
                    # Calculate distance and duration based on heuristics since driving
                    # route doesn't accurately reflect train/bus times
                    base_distance_km = round(result.distance_meters / 1000, 2)

                    if mode == TravelMode.TRAIN:
                        # Trains are faster than cars, use driving distance but faster time
                        distance_km = base_distance_km
                        # Train speed ~120 km/h vs car ~80 km/h
                        duration_min = int(round((base_distance_km / 120) * 60))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)
                    elif mode == TravelMode.BUS:
                        # Buses follow roads but are slower
                        distance_km = base_distance_km
                        # Bus speed ~60 km/h
                        duration_min = int(round((base_distance_km / 60) * 60))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.BUS, 20)

                    logger.info(f"Mapbox driving fallback successful for {mode}: {distance_km}km, {duration_min}min")
                    return geometry, distance_km, duration_min, True  # This is a fallback - using car route for transit
            except MapboxServiceError as e:
                logger.warning(f"Mapbox fallback for {mode} failed: {e}")

        logger.warning(f"All routing services failed for mode {mode}, using straight line fallback")
        # If we're returning None for public transport, it's still a fallback situation
        return None, None, None, cls._is_public_transport(mode)

    @staticmethod
    async def get_segment(
        db: AsyncSession,
        from_destination_id: int,
        to_destination_id: int
    ) -> Optional[TravelSegment]:
        """Get a travel segment between two destinations"""
        result = await db.execute(
            select(TravelSegment).where(
                and_(
                    TravelSegment.from_destination_id == from_destination_id,
                    TravelSegment.to_destination_id == to_destination_id
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_segment_by_id(
        db: AsyncSession,
        segment_id: int
    ) -> Optional[TravelSegment]:
        """Get a travel segment by ID"""
        result = await db.execute(
            select(TravelSegment).where(TravelSegment.id == segment_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_trip_segments(
        db: AsyncSession,
        trip_id: int
    ) -> list[TravelSegment]:
        """Get all travel segments for a trip's destinations"""
        # First get all destination IDs for the trip
        dest_result = await db.execute(
            select(Destination.id)
            .where(Destination.trip_id == trip_id)
            .order_by(Destination.order_index.asc(), Destination.arrival_date.asc())
        )
        destination_ids = [row[0] for row in dest_result.fetchall()]

        if len(destination_ids) < 2:
            return []

        # Get segments where both from and to are in the trip
        result = await db.execute(
            select(TravelSegment)
            .where(
                and_(
                    TravelSegment.from_destination_id.in_(destination_ids),
                    TravelSegment.to_destination_id.in_(destination_ids)
                )
            )
        )
        return list(result.scalars().all())

    @classmethod
    async def calculate_and_save_segment(
        cls,
        db: AsyncSession,
        from_destination_id: int,
        to_destination_id: int,
        mode: TravelMode
    ) -> TravelSegment:
        """
        Calculate travel time between two destinations and save/update the segment.
        Fetches real route geometry from routing services when available.
        """
        # Get destination coordinates
        from_dest_result = await db.execute(
            select(Destination).where(Destination.id == from_destination_id)
        )
        from_dest = from_dest_result.scalar_one_or_none()

        to_dest_result = await db.execute(
            select(Destination).where(Destination.id == to_destination_id)
        )
        to_dest = to_dest_result.scalar_one_or_none()

        if not from_dest or not to_dest:
            raise ValueError("One or both destinations not found")

        if from_dest.latitude is None or from_dest.longitude is None:
            raise ValueError(
                f"Origin destination '{from_dest.city_name}' has no coordinates"
            )

        if to_dest.latitude is None or to_dest.longitude is None:
            raise ValueError(
                f"Target destination '{to_dest.city_name}' has no coordinates"
            )

        # Try to fetch real route geometry from routing services
        route_geometry, api_distance_km, api_duration_min, is_fallback = await cls._fetch_route_geometry(
            from_dest.latitude, from_dest.longitude,
            to_dest.latitude, to_dest.longitude,
            mode
        )

        if route_geometry and api_distance_km is not None and api_duration_min is not None:
            # Use API results
            distance_km = api_distance_km
            duration_minutes = api_duration_min
            # Convert GeoJSON geometry to WKT for PostGIS storage
            if route_geometry.get("type") == "LineString":
                coords = route_geometry.get("coordinates", [])
                wkt_coords = ", ".join(f"{c[0]} {c[1]}" for c in coords)
                geometry_wkt = f"LINESTRING({wkt_coords})"
            else:
                # Fallback to straight line
                geometry_wkt = f"LINESTRING({from_dest.longitude} {from_dest.latitude}, {to_dest.longitude} {to_dest.latitude})"
        else:
            # Fallback to heuristic calculation
            distance_km, duration_minutes = cls.calculate_travel_time(
                from_dest.latitude, from_dest.longitude,
                to_dest.latitude, to_dest.longitude,
                mode
            )
            # Straight line geometry
            geometry_wkt = f"LINESTRING({from_dest.longitude} {from_dest.latitude}, {to_dest.longitude} {to_dest.latitude})"

        # Check if segment already exists
        existing = await cls.get_segment(db, from_destination_id, to_destination_id)

        if existing:
            # Update existing segment
            existing.travel_mode = mode.value
            existing.distance_km = distance_km
            existing.duration_minutes = duration_minutes
            existing.geometry = geometry_wkt
            existing.is_fallback = is_fallback
            await db.flush()
            await db.refresh(existing)
            return existing
        else:
            # Create new segment
            segment = TravelSegment(
                from_destination_id=from_destination_id,
                to_destination_id=to_destination_id,
                travel_mode=mode.value,
                distance_km=distance_km,
                duration_minutes=duration_minutes,
                geometry=geometry_wkt,
                is_fallback=is_fallback
            )
            db.add(segment)
            await db.flush()
            await db.refresh(segment)
            return segment

    @staticmethod
    async def delete_segment(
        db: AsyncSession,
        segment_id: int
    ) -> bool:
        """Delete a travel segment"""
        segment = await TravelSegmentService.get_segment_by_id(db, segment_id)
        if segment:
            await db.delete(segment)
            await db.flush()
            return True
        return False

    @classmethod
    async def recalculate_trip_segments(
        cls,
        db: AsyncSession,
        trip_id: int
    ) -> list[TravelSegment]:
        """
        Recalculate all travel segments for a trip based on destination order.
        This should be called when destinations are reordered.
        """
        # Get destinations in order
        result = await db.execute(
            select(Destination)
            .where(Destination.trip_id == trip_id)
            .order_by(Destination.order_index.asc(), Destination.arrival_date.asc())
        )
        destinations = list(result.scalars().all())

        if len(destinations) < 2:
            return []

        # Get existing segments to preserve travel modes
        existing_segments = await cls.get_trip_segments(db, trip_id)
        segment_modes = {
            (s.from_destination_id, s.to_destination_id): s.travel_mode
            for s in existing_segments
        }

        # Delete old segments that are no longer valid
        valid_pairs = set()
        for i in range(len(destinations) - 1):
            valid_pairs.add((destinations[i].id, destinations[i + 1].id))

        for segment in existing_segments:
            pair = (segment.from_destination_id, segment.to_destination_id)
            if pair not in valid_pairs:
                await db.delete(segment)

        # Create/update segments for consecutive destinations
        segments = []
        for i in range(len(destinations) - 1):
            from_dest = destinations[i]
            to_dest = destinations[i + 1]

            # Use existing mode or default to car
            existing_mode = segment_modes.get((from_dest.id, to_dest.id))
            mode = TravelMode(existing_mode) if existing_mode else TravelMode.CAR

            # Skip if coordinates missing
            if (from_dest.latitude is None or from_dest.longitude is None or
                    to_dest.latitude is None or to_dest.longitude is None):
                continue

            segment = await cls.calculate_and_save_segment(
                db, from_dest.id, to_dest.id, mode
            )
            segments.append(segment)

        return segments

    @classmethod
    async def _fetch_route_with_waypoints(
        cls,
        origin_lat: float, origin_lon: float,
        dest_lat: float, dest_lon: float,
        waypoints: list[RouteWaypoint],
        mode: TravelMode
    ) -> tuple[Optional[dict], Optional[float], Optional[int], bool]:
        """
        Fetch route geometry through waypoints from routing services.

        Args:
            origin_lat, origin_lon: Origin coordinates
            dest_lat, dest_lon: Destination coordinates
            waypoints: List of RouteWaypoint objects in order
            mode: Travel mode

        Returns:
            tuple: (geometry_dict, distance_km, duration_minutes, is_fallback)
        """
        # For flights and ferries, waypoints don't make sense
        if mode in (TravelMode.PLANE, TravelMode.FERRY):
            logger.debug(f"Mode {mode} does not support waypoint routing")
            return None, None, None, False

        # Build waypoint coordinates list: [(lon, lat), ...]
        waypoint_coords = [(wp.longitude, wp.latitude) for wp in waypoints]

        # Try Mapbox first for car, walking, biking
        mapbox_profile = cls._map_mode_to_mapbox_profile(mode)
        if mapbox_profile:
            try:
                service = MapboxService()
                if service.is_available():
                    logger.debug(f"Attempting Mapbox routing with {len(waypoint_coords)} waypoints")
                    result = await service.get_route(
                        origin=(origin_lon, origin_lat),
                        destination=(dest_lon, dest_lat),
                        profile=mapbox_profile,
                        waypoints=waypoint_coords if waypoint_coords else None,
                    )
                    distance_km = round(result.distance_meters / 1000, 2)
                    duration_min = int(round(result.duration_seconds / 60))
                    logger.info(f"Mapbox waypoint routing successful: {distance_km}km, {duration_min}min")
                    return result.geometry, distance_km, duration_min, False
            except MapboxServiceError as e:
                logger.warning(f"Mapbox waypoint routing failed: {e}")

        # Try OpenRouteService as fallback
        ors_profile = cls._map_mode_to_ors_profile(mode)
        if ors_profile:
            try:
                service = OpenRouteServiceService()
                if service.is_available():
                    logger.debug(f"Attempting ORS routing with {len(waypoint_coords)} waypoints")
                    result = await service.get_route(
                        origin=(origin_lon, origin_lat),
                        destination=(dest_lon, dest_lat),
                        profile=ors_profile,
                        waypoints=waypoint_coords if waypoint_coords else None,
                    )
                    distance_km = round(result.distance_meters / 1000, 2)
                    duration_min = int(round(result.duration_seconds / 60))

                    # Adjust for train/bus speed differences
                    is_fallback = cls._is_public_transport(mode)
                    if mode == TravelMode.TRAIN:
                        duration_min = int(round(duration_min * 0.75))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)
                    elif mode == TravelMode.BUS:
                        duration_min = int(round(duration_min * 1.2))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.BUS, 20)

                    logger.info(f"ORS waypoint routing successful: {distance_km}km, {duration_min}min")
                    return result.geometry, distance_km, duration_min, is_fallback
            except ORSServiceError as e:
                logger.warning(f"ORS waypoint routing failed: {e}")

        logger.warning("All waypoint routing services failed")
        return None, None, None, cls._is_public_transport(mode)

    @classmethod
    async def recalculate_segment_with_waypoints(
        cls,
        db: AsyncSession,
        segment_id: int
    ) -> Optional[TravelSegment]:
        """
        Recalculate a segment's route including its waypoints.

        This should be called when waypoints are added, updated, reordered, or deleted.
        """
        # Get the segment
        segment = await cls.get_segment_by_id(db, segment_id)
        if not segment:
            logger.warning(f"Segment {segment_id} not found for waypoint recalculation")
            return None

        # Get destination coordinates
        from_dest_result = await db.execute(
            select(Destination).where(Destination.id == segment.from_destination_id)
        )
        from_dest = from_dest_result.scalar_one_or_none()

        to_dest_result = await db.execute(
            select(Destination).where(Destination.id == segment.to_destination_id)
        )
        to_dest = to_dest_result.scalar_one_or_none()

        if not from_dest or not to_dest:
            logger.warning(f"Destinations not found for segment {segment_id}")
            return None

        if (from_dest.latitude is None or from_dest.longitude is None or
                to_dest.latitude is None or to_dest.longitude is None):
            logger.warning(f"Missing coordinates for segment {segment_id}")
            return None

        # Get waypoints in order
        waypoint_result = await db.execute(
            select(RouteWaypoint)
            .where(RouteWaypoint.travel_segment_id == segment_id)
            .order_by(RouteWaypoint.order_index)
        )
        waypoints = list(waypoint_result.scalars().all())

        mode = TravelMode(segment.travel_mode)

        if waypoints:
            # Fetch route with waypoints
            route_geometry, distance_km, duration_min, is_fallback = await cls._fetch_route_with_waypoints(
                from_dest.latitude, from_dest.longitude,
                to_dest.latitude, to_dest.longitude,
                waypoints,
                mode
            )
        else:
            # No waypoints - use standard routing
            route_geometry, distance_km, duration_min, is_fallback = await cls._fetch_route_geometry(
                from_dest.latitude, from_dest.longitude,
                to_dest.latitude, to_dest.longitude,
                mode
            )

        # Update segment with new route
        if route_geometry and distance_km is not None and duration_min is not None:
            if route_geometry.get("type") == "LineString":
                coords = route_geometry.get("coordinates", [])
                wkt_coords = ", ".join(f"{c[0]} {c[1]}" for c in coords)
                geometry_wkt = f"LINESTRING({wkt_coords})"
            else:
                geometry_wkt = f"LINESTRING({from_dest.longitude} {from_dest.latitude}, {to_dest.longitude} {to_dest.latitude})"

            segment.distance_km = distance_km
            segment.duration_minutes = duration_min
            segment.geometry = geometry_wkt
            segment.is_fallback = is_fallback
        else:
            # Fallback to heuristic calculation
            distance_km, duration_minutes = cls.calculate_travel_time(
                from_dest.latitude, from_dest.longitude,
                to_dest.latitude, to_dest.longitude,
                mode
            )

            # Build geometry through waypoints as straight line segments
            coords = [(from_dest.longitude, from_dest.latitude)]
            for wp in waypoints:
                coords.append((wp.longitude, wp.latitude))
            coords.append((to_dest.longitude, to_dest.latitude))

            wkt_coords = ", ".join(f"{c[0]} {c[1]}" for c in coords)
            geometry_wkt = f"LINESTRING({wkt_coords})"

            segment.distance_km = distance_km
            segment.duration_minutes = duration_minutes
            segment.geometry = geometry_wkt
            segment.is_fallback = is_fallback if is_fallback else cls._is_public_transport(mode)

        await db.flush()
        await db.refresh(segment)

        logger.info(f"Recalculated segment {segment_id} with {len(waypoints)} waypoints")
        return segment
