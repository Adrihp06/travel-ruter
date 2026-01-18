from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from pyproj import Geod
import json
import logging

from app.models.travel_segment import TravelSegment
from app.models.destination import Destination
from app.schemas.travel_segment import TravelMode, TravelSegmentCreate
from app.services.mapbox_service import MapboxService, MapboxServiceError, MapboxRoutingProfile
from app.services.openrouteservice import OpenRouteServiceService, ORSServiceError, ORSRoutingProfile

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
    async def _fetch_route_geometry(
        cls,
        lat1: float, lon1: float,
        lat2: float, lon2: float,
        mode: TravelMode
    ) -> tuple[Optional[dict], Optional[float], Optional[int]]:
        """
        Fetch real route geometry from routing services.

        Returns:
            tuple: (geometry_dict, distance_km, duration_minutes) or (None, None, None) if failed
        """
        # For flights and ferries, we don't have real routing - use straight line
        if mode in (TravelMode.PLANE, TravelMode.FERRY):
            return None, None, None

        # Try Mapbox first for car, walking, biking
        mapbox_profile = cls._map_mode_to_mapbox_profile(mode)
        if mapbox_profile:
            try:
                service = MapboxService()
                result = await service.get_route(
                    origin=(lon1, lat1),
                    destination=(lon2, lat2),
                    profile=mapbox_profile,
                )
                distance_km = round(result.distance_meters / 1000, 2)
                duration_min = int(round(result.duration_seconds / 60))

                # Apply train overhead if applicable
                if mode == TravelMode.TRAIN:
                    # Trains are faster than cars, reduce duration by 25%
                    duration_min = int(round(duration_min * 0.75))
                    duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)

                return result.geometry, distance_km, duration_min
            except MapboxServiceError as e:
                logger.warning(f"Mapbox routing failed: {e}")

        # Fallback to OpenRouteService for train/bus or if Mapbox failed
        ors_profile = cls._map_mode_to_ors_profile(mode)
        if ors_profile:
            try:
                service = OpenRouteServiceService()
                if service.is_available():
                    result = await service.get_route(
                        origin=(lon1, lat1),
                        destination=(lon2, lat2),
                        profile=ors_profile,
                    )
                    distance_km = round(result.distance_meters / 1000, 2)
                    duration_min = int(round(result.duration_seconds / 60))

                    # Adjust for train/bus speed differences
                    if mode == TravelMode.TRAIN:
                        # Trains are faster than cars
                        duration_min = int(round(duration_min * 0.75))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.TRAIN, 30)
                    elif mode == TravelMode.BUS:
                        # Buses are slower than cars
                        duration_min = int(round(duration_min * 1.2))
                        duration_min += cls.OVERHEAD_MINUTES.get(TravelMode.BUS, 20)

                    return result.geometry, distance_km, duration_min
            except ORSServiceError as e:
                logger.warning(f"ORS routing failed: {e}")

        return None, None, None

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
        route_geometry, api_distance_km, api_duration_min = await cls._fetch_route_geometry(
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
                geometry=geometry_wkt
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
