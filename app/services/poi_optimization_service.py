"""
POI Route Optimization Service.

Optimizes the order of POIs for a given day to minimize travel time,
starting from the accommodation location.
"""
import math
from typing import Optional
from dataclasses import dataclass
import httpx

from app.core.config import settings


@dataclass
class OptimizedRoute:
    """Result from route optimization."""
    optimized_order: list[int]  # List of POI IDs in optimal order
    total_distance_km: float
    total_duration_minutes: int
    route_geometry: Optional[dict]  # GeoJSON geometry


class POIOptimizationError(Exception):
    """Custom exception for POI optimization errors."""
    pass


class POIOptimizationService:
    """Service for optimizing POI visit order using ORS Optimization API with TSP fallback."""

    ORS_BASE_URL = "https://api.openrouteservice.org"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'OPENROUTESERVICE_API_KEY', None)
        self._has_api_key = bool(self.api_key)

    def is_available(self) -> bool:
        """Check if ORS API is available."""
        return self._has_api_key

    async def optimize_route(
        self,
        pois: list[dict],
        start_location: dict,
        profile: str = "foot-walking"
    ) -> OptimizedRoute:
        """
        Optimize the order of POIs starting from a given location.

        Args:
            pois: List of POI dicts with 'id', 'latitude', 'longitude' keys
            start_location: Dict with 'lat' and 'lon' keys for start point
            profile: ORS routing profile (foot-walking, driving-car, etc.)

        Returns:
            OptimizedRoute with optimized order and route metrics
        """
        if not pois:
            return OptimizedRoute(
                optimized_order=[],
                total_distance_km=0.0,
                total_duration_minutes=0,
                route_geometry=None
            )

        if len(pois) == 1:
            # Only one POI, no optimization needed
            return OptimizedRoute(
                optimized_order=[pois[0]['id']],
                total_distance_km=0.0,
                total_duration_minutes=0,
                route_geometry=None
            )

        # Try ORS Optimization API first
        if self._has_api_key:
            try:
                return await self._optimize_with_ors(pois, start_location, profile)
            except POIOptimizationError:
                # Fall back to TSP algorithm
                pass

        # Use TSP fallback
        return self._optimize_with_tsp(pois, start_location)

    async def _optimize_with_ors(
        self,
        pois: list[dict],
        start_location: dict,
        profile: str
    ) -> OptimizedRoute:
        """Use ORS Optimization API (/v2/optimization) for route optimization."""
        url = f"{self.ORS_BASE_URL}/optimization"

        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
        }

        # Build jobs (POIs to visit)
        jobs = []
        for i, poi in enumerate(pois):
            jobs.append({
                "id": i,
                "location": [poi['longitude'], poi['latitude']],
                "service": poi.get('dwell_time', 30) * 60,  # Convert minutes to seconds
            })

        # Build vehicle (starting from accommodation)
        vehicles = [{
            "id": 0,
            "profile": profile,
            "start": [start_location['lon'], start_location['lat']],
            "end": [start_location['lon'], start_location['lat']],  # Return to start (optional)
        }]

        body = {
            "jobs": jobs,
            "vehicles": vehicles,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=headers, json=body)

                if response.status_code == 401:
                    raise POIOptimizationError("Invalid ORS API key")
                if response.status_code == 403:
                    raise POIOptimizationError("ORS API rate limit exceeded")
                if response.status_code >= 400:
                    raise POIOptimizationError(f"ORS API error: {response.status_code}")

                response.raise_for_status()
                data = response.json()

                # Extract optimized route from response
                routes = data.get("routes", [])
                if not routes:
                    raise POIOptimizationError("No optimized route found")

                route = routes[0]
                steps = route.get("steps", [])

                # Extract job order (filter out start/end steps)
                optimized_indices = []
                for step in steps:
                    if step.get("type") == "job":
                        optimized_indices.append(step.get("job"))

                # Map indices back to POI IDs
                optimized_order = [pois[idx]['id'] for idx in optimized_indices]

                # Calculate totals
                total_distance_km = route.get("distance", 0) / 1000
                total_duration_minutes = int(route.get("duration", 0) / 60)

                # Get geometry if available
                route_geometry = await self._get_route_geometry(
                    pois, optimized_indices, start_location, profile
                )

                return OptimizedRoute(
                    optimized_order=optimized_order,
                    total_distance_km=round(total_distance_km, 2),
                    total_duration_minutes=total_duration_minutes,
                    route_geometry=route_geometry
                )

        except httpx.TimeoutException:
            raise POIOptimizationError("ORS API request timed out")
        except httpx.RequestError as e:
            raise POIOptimizationError(f"ORS API request failed: {str(e)}")

    async def _get_route_geometry(
        self,
        pois: list[dict],
        optimized_indices: list[int],
        start_location: dict,
        profile: str
    ) -> Optional[dict]:
        """Get the actual route geometry for the optimized path."""
        if not self._has_api_key or not optimized_indices:
            return None

        # Build coordinates list: start -> pois in order -> start
        coordinates = [[start_location['lon'], start_location['lat']]]
        for idx in optimized_indices:
            poi = pois[idx]
            coordinates.append([poi['longitude'], poi['latitude']])
        coordinates.append([start_location['lon'], start_location['lat']])

        url = f"{self.ORS_BASE_URL}/v2/directions/{profile}"
        headers = {
            "Authorization": self.api_key,
            "Content-Type": "application/json",
        }
        body = {
            "coordinates": coordinates,
            "format": "geojson",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=body)
                if response.status_code >= 400:
                    return None

                data = response.json()
                features = data.get("features", [])
                if features:
                    return features[0].get("geometry")
        except Exception:
            pass

        return None

    def _optimize_with_tsp(
        self,
        pois: list[dict],
        start_location: dict
    ) -> OptimizedRoute:
        """
        Fallback TSP optimization using nearest neighbor heuristic.
        Simple but effective for small numbers of POIs.
        """
        if len(pois) <= 1:
            return OptimizedRoute(
                optimized_order=[poi['id'] for poi in pois],
                total_distance_km=0.0,
                total_duration_minutes=0,
                route_geometry=None
            )

        # Build distance matrix
        n = len(pois)
        all_points = [(start_location['lat'], start_location['lon'])] + [
            (poi['latitude'], poi['longitude']) for poi in pois
        ]

        def haversine(lat1, lon1, lat2, lon2):
            """Calculate haversine distance in km."""
            R = 6371  # Earth's radius in km
            lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = (math.sin(dlat / 2) ** 2 +
                 math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
            return 2 * R * math.asin(math.sqrt(a))

        # Nearest neighbor algorithm starting from start_location
        visited = [False] * n
        order = []
        total_distance = 0.0
        current_point = all_points[0]  # Start location

        for _ in range(n):
            min_dist = float('inf')
            nearest_idx = -1

            for i in range(n):
                if not visited[i]:
                    poi_point = all_points[i + 1]  # +1 because start is at index 0
                    dist = haversine(
                        current_point[0], current_point[1],
                        poi_point[0], poi_point[1]
                    )
                    if dist < min_dist:
                        min_dist = dist
                        nearest_idx = i

            if nearest_idx >= 0:
                visited[nearest_idx] = True
                order.append(nearest_idx)
                total_distance += min_dist
                current_point = all_points[nearest_idx + 1]

        # Map indices back to POI IDs
        optimized_order = [pois[idx]['id'] for idx in order]

        # Estimate duration (assume average walking speed of 5 km/h)
        walking_speed_kmh = 5.0
        total_duration_minutes = int((total_distance / walking_speed_kmh) * 60)

        # Build simple LineString geometry for visualization
        route_geometry = self._build_simple_geometry(pois, order, start_location)

        return OptimizedRoute(
            optimized_order=optimized_order,
            total_distance_km=round(total_distance, 2),
            total_duration_minutes=total_duration_minutes,
            route_geometry=route_geometry
        )

    def _build_simple_geometry(
        self,
        pois: list[dict],
        order: list[int],
        start_location: dict
    ) -> dict:
        """Build a simple GeoJSON LineString for the route."""
        coordinates = [[start_location['lon'], start_location['lat']]]
        for idx in order:
            poi = pois[idx]
            coordinates.append([poi['longitude'], poi['latitude']])
        # Return to start
        coordinates.append([start_location['lon'], start_location['lat']])

        return {
            "type": "LineString",
            "coordinates": coordinates
        }


# Singleton instance
_poi_optimization_service: Optional[POIOptimizationService] = None


def get_poi_optimization_service() -> POIOptimizationService:
    """Get or create a POI optimization service instance."""
    global _poi_optimization_service
    if _poi_optimization_service is None:
        _poi_optimization_service = POIOptimizationService()
    return _poi_optimization_service
