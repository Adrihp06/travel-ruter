"""
MCP Tool: generate_smart_schedule

Provides intelligent POI scheduling across trip days.
Port of the frontend poiScheduler.js algorithm to Python.
"""

import logging
import math
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from mcp.server.fastmcp import FastMCP

from mcp_server.schemas.scheduler import (
    GenerateSmartScheduleInput,
    SmartScheduleResult,
    POIAssignment,
    DaySummary,
    ScheduleWarning,
    ScheduleStats,
    SchedulerConstraints,
    POIInput,
    DayInput,
    AccommodationInput,
)

logger = logging.getLogger(__name__)

# Default constraints
DEFAULT_CONSTRAINTS = {
    "max_food_per_day": 2,
    "max_hours_per_day": 8,
    "max_travel_minutes_in_cluster": 15,
}

# Food-related categories
FOOD_CATEGORIES = ["Food", "Restaurants", "Restaurant", "Cafe", "Bar", "Dining"]


def _to_radians(degrees: float) -> float:
    """Convert degrees to radians."""
    return degrees * (math.pi / 180)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the Haversine distance between two coordinates in kilometers.

    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates

    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in km
    d_lat = _to_radians(lat2 - lat1)
    d_lon = _to_radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2 +
        math.cos(_to_radians(lat1)) * math.cos(_to_radians(lat2)) *
        math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_food_category(category: Optional[str]) -> bool:
    """Check if a category is food-related."""
    if not category:
        return False
    category_lower = category.lower()
    return any(food.lower() in category_lower for food in FOOD_CATEGORIES)


def estimate_travel_time(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    profile: str = "foot-walking"
) -> float:
    """
    Estimate travel time from coordinates when matrix is not available.

    Returns:
        Estimated travel time in seconds
    """
    distance = haversine_distance(lat1, lon1, lat2, lon2) * 1000  # Convert to meters

    # Average speeds in m/s
    speeds = {
        "foot-walking": 1.4,      # ~5 km/h
        "cycling-regular": 4.2,   # ~15 km/h
        "driving-car": 8.3,       # ~30 km/h (urban average)
    }

    speed = speeds.get(profile, 1.4)
    return distance / speed


def get_travel_time_from_matrix(
    from_id: str,
    to_id: str,
    matrix: Optional[Dict[str, Any]],
) -> Optional[float]:
    """Get travel time from matrix if available."""
    if not matrix or "durations" not in matrix:
        return None
    durations = matrix.get("durations", {})
    if isinstance(durations, dict):
        return durations.get(from_id, {}).get(to_id)
    return None


def get_day_dwell_time(pois: List[POIInput]) -> int:
    """Get total dwell time for a day in minutes."""
    return sum(poi.dwell_time or 60 for poi in pois)


def count_food_pois(pois: List[POIInput]) -> int:
    """Count food POIs for a day."""
    return sum(1 for poi in pois if is_food_category(poi.category))


def calculate_day_travel_time(
    day_pois: List[POIInput],
    accommodation: Optional[AccommodationInput],
    matrix: Optional[Dict[str, Any]],
    profile: str = "foot-walking",
) -> int:
    """Calculate total travel time for a day's POIs in minutes."""
    if not day_pois:
        return 0

    total_seconds = 0.0

    # Travel from accommodation to first POI
    if accommodation and accommodation.latitude and accommodation.longitude:
        first_poi = day_pois[0]
        if first_poi.latitude and first_poi.longitude:
            from_id = f"accom_{accommodation.day_number}"
            to_id = f"poi_{first_poi.id}"

            matrix_time = get_travel_time_from_matrix(from_id, to_id, matrix)
            if matrix_time is not None:
                total_seconds += matrix_time
            else:
                total_seconds += estimate_travel_time(
                    accommodation.latitude, accommodation.longitude,
                    first_poi.latitude, first_poi.longitude,
                    profile
                )

    # Travel between POIs
    for i in range(len(day_pois) - 1):
        from_poi = day_pois[i]
        to_poi = day_pois[i + 1]

        if not all([from_poi.latitude, from_poi.longitude, to_poi.latitude, to_poi.longitude]):
            continue

        from_id = f"poi_{from_poi.id}"
        to_id = f"poi_{to_poi.id}"

        matrix_time = get_travel_time_from_matrix(from_id, to_id, matrix)
        if matrix_time is not None:
            total_seconds += matrix_time
        else:
            total_seconds += estimate_travel_time(
                from_poi.latitude, from_poi.longitude,
                to_poi.latitude, to_poi.longitude,
                profile
            )

    return round(total_seconds / 60)


def score_poi_for_day(
    poi: POIInput,
    day_pois: List[POIInput],
    constraints: Dict[str, Any],
    accommodation: Optional[AccommodationInput],
    matrix: Optional[Dict[str, Any]],
    profile: str = "foot-walking",
) -> float:
    """
    Score a POI for placement on a specific day.
    Higher scores are better.
    """
    score = 100.0  # Base score

    current_dwell_time = get_day_dwell_time(day_pois)
    poi_dwell_time = poi.dwell_time or 60
    max_minutes = constraints.get("max_hours_per_day", 8) * 60

    # Calculate travel time if adding this POI
    current_travel_time = calculate_day_travel_time(day_pois, accommodation, matrix, profile)
    projected_pois = day_pois + [poi]
    projected_travel_time = calculate_day_travel_time(projected_pois, accommodation, matrix, profile)
    added_travel_time = projected_travel_time - current_travel_time

    # Time fitness - penalize if exceeding budget
    projected_total = current_dwell_time + poi_dwell_time + added_travel_time
    if projected_total > max_minutes:
        score -= 50  # Heavy penalty for exceeding
    else:
        # Bonus for good time fit
        fill_ratio = projected_total / max_minutes
        score += fill_ratio * 20

    # Penalty for excessive travel time
    if added_travel_time > 30:
        score -= min(30, added_travel_time - 30)

    # Category penalty - check food limit
    max_food = constraints.get("max_food_per_day", 2)
    current_food_count = count_food_pois(day_pois)

    if is_food_category(poi.category):
        if current_food_count >= max_food:
            score -= 80
        elif current_food_count == max_food - 1:
            score -= 20

    # Geographic bonus based on accommodation
    if poi.latitude and poi.longitude and accommodation:
        if accommodation.latitude and accommodation.longitude:
            from_id = f"accom_{accommodation.day_number}"
            to_id = f"poi_{poi.id}"

            matrix_time = get_travel_time_from_matrix(from_id, to_id, matrix)
            if matrix_time is not None:
                travel_to_accom = matrix_time / 60
            else:
                travel_to_accom = estimate_travel_time(
                    accommodation.latitude, accommodation.longitude,
                    poi.latitude, poi.longitude,
                    profile
                ) / 60

            # Prefer POIs close to accommodation
            if travel_to_accom <= 10:
                score += 15 * (1 - travel_to_accom / 10)

    # Geographic bonus - proximity to existing POIs
    if poi.latitude and poi.longitude and day_pois:
        last_poi = day_pois[-1]
        if last_poi.latitude and last_poi.longitude:
            from_id = f"poi_{last_poi.id}"
            to_id = f"poi_{poi.id}"

            matrix_time = get_travel_time_from_matrix(from_id, to_id, matrix)
            if matrix_time is not None:
                travel_from_last = matrix_time / 60
            else:
                travel_from_last = estimate_travel_time(
                    last_poi.latitude, last_poi.longitude,
                    poi.latitude, poi.longitude,
                    profile
                ) / 60

            max_travel_minutes = constraints.get("max_travel_minutes_in_cluster", 15)

            if travel_from_last <= max_travel_minutes:
                score += 30 * (1 - travel_from_last / max_travel_minutes)
            elif travel_from_last <= max_travel_minutes * 2:
                score += 10
            else:
                score -= 15

    # Bonus for adding to empty day
    if not day_pois:
        score += 5

    return score


def cluster_pois_by_travel_time(
    pois: List[POIInput],
    max_minutes: int,
    matrix: Optional[Dict[str, Any]],
    profile: str = "foot-walking",
) -> List[List[POIInput]]:
    """Cluster POIs by travel time."""
    clusters = []
    assigned = set()
    max_seconds = max_minutes * 60

    # Sort POIs by having coordinates first
    sorted_pois = sorted(
        pois,
        key=lambda p: (0 if p.latitude and p.longitude else 1),
    )

    for poi in sorted_pois:
        if poi.id in assigned:
            continue

        cluster = [poi]
        assigned.add(poi.id)

        if poi.latitude and poi.longitude:
            for other in sorted_pois:
                if other.id in assigned:
                    continue
                if not other.latitude or not other.longitude:
                    continue

                from_id = f"poi_{poi.id}"
                to_id = f"poi_{other.id}"

                matrix_time = get_travel_time_from_matrix(from_id, to_id, matrix)
                if matrix_time is not None:
                    travel_seconds = matrix_time
                else:
                    travel_seconds = estimate_travel_time(
                        poi.latitude, poi.longitude,
                        other.latitude, other.longitude,
                        profile
                    )

                if travel_seconds <= max_seconds:
                    cluster.append(other)
                    assigned.add(other.id)

        clusters.append(cluster)

    return clusters


def generate_saturation_warnings(
    schedule: Dict[str, List[POIInput]],
    days: List[DayInput],
    constraints: Dict[str, Any],
    matrix: Optional[Dict[str, Any]],
    accommodations_by_day: Dict[int, AccommodationInput],
    profile: str = "foot-walking",
) -> List[ScheduleWarning]:
    """Generate saturation warnings for a schedule."""
    warnings = []
    max_minutes = constraints.get("max_hours_per_day", 8) * 60
    max_food = constraints.get("max_food_per_day", 2)

    # Calculate average POIs per day
    total_pois = sum(len(pois) for pois in schedule.values())
    avg_pois = total_pois / len(days) if days else 0

    for day in days:
        day_pois = schedule.get(day.date, [])
        accommodation = accommodations_by_day.get(day.day_number)

        dwell_time = get_day_dwell_time(day_pois)
        travel_time = calculate_day_travel_time(day_pois, accommodation, matrix, profile)
        total_time = dwell_time + travel_time
        food_count = count_food_pois(day_pois)

        # Time exceeded warning
        if total_time > max_minutes:
            warnings.append(ScheduleWarning(
                day_number=day.day_number,
                type="time_exceeded",
                severity="error",
                message=f"Day {day.day_number} exceeds time budget by {round((total_time - max_minutes) / 60, 1)} hours",
            ))
        elif total_time >= max_minutes * 0.9:
            warnings.append(ScheduleWarning(
                day_number=day.day_number,
                type="time_near_limit",
                severity="warning",
                message=f"Day {day.day_number} is at {round(total_time / max_minutes * 100)}% capacity",
            ))

        # Food limit warning
        if food_count > max_food:
            warnings.append(ScheduleWarning(
                day_number=day.day_number,
                type="food_exceeded",
                severity="error",
                message=f"Day {day.day_number} has {food_count} food stops (max {max_food})",
            ))

        # Overloaded warning
        if len(day_pois) > avg_pois * 1.5 and len(day_pois) >= 5:
            warnings.append(ScheduleWarning(
                day_number=day.day_number,
                type="overloaded",
                severity="warning",
                message=f"Day {day.day_number} has {len(day_pois)} POIs (avg {round(avg_pois)})",
            ))

        # No accommodation warning
        if not accommodation or not accommodation.name:
            warnings.append(ScheduleWarning(
                day_number=day.day_number,
                type="no_accommodation",
                severity="info",
                message=f"Day {day.day_number} has no accommodation set",
            ))

    return warnings


def register_tools(server: FastMCP):
    """Register scheduler tools with the MCP server."""

    @server.tool()
    async def generate_smart_schedule(
        pois: List[Dict[str, Any]],
        days: List[Dict[str, Any]],
        max_food_per_day: int = 2,
        max_hours_per_day: int = 8,
        max_travel_minutes_in_cluster: int = 15,
        accommodations: Optional[List[Dict[str, Any]]] = None,
        transport_profile: str = "foot-walking",
        travel_matrix: Optional[Dict[str, Any]] = None,
    ) -> dict:
        """
        Generate a smart schedule distributing POIs across available days.

        Uses clustering, scoring, and constraint optimization to create
        an efficient itinerary that respects time budgets and category limits.

        Args:
            pois: List of POIs to schedule. Each POI should have:
                  - id: POI ID (required)
                  - name: POI name (required)
                  - category: POI category
                  - latitude, longitude: Coordinates (optional but recommended)
                  - dwell_time: Expected time at POI in minutes (default 60)
                  - is_anchored: Whether time-locked (default false)
                  - anchored_time: Time if anchored (HH:MM format)
                  - scheduled_date: Pre-assigned date (YYYY-MM-DD)

            days: List of available days. Each day should have:
                  - date: Date string (YYYY-MM-DD)
                  - day_number: Day number in trip (1-indexed)

            max_food_per_day: Maximum food/restaurant POIs per day (1-4, default 2)
            max_hours_per_day: Maximum activity hours per day (4-12, default 8)
            max_travel_minutes_in_cluster: Max travel time within cluster (default 15)

            accommodations: Optional list of accommodations for proximity optimization.
                           Each should have: day_number, name, latitude, longitude

            transport_profile: Transport mode - foot-walking, cycling-regular, driving-car

            travel_matrix: Optional pre-computed travel matrix from get_travel_matrix.
                          If not provided, Haversine estimation is used.

        Returns:
            Schedule with POI assignments, day summaries, statistics, and warnings.
            Use this to apply the schedule to a trip via manage_trip.
        """
        logger.info(
            f"generate_smart_schedule called with {len(pois)} POIs, "
            f"{len(days)} days, profile={transport_profile}"
        )

        # Parse inputs
        poi_inputs = [POIInput(**p) for p in pois]
        day_inputs = [DayInput(**d) for d in days]

        constraints = {
            "max_food_per_day": max_food_per_day,
            "max_hours_per_day": max_hours_per_day,
            "max_travel_minutes_in_cluster": max_travel_minutes_in_cluster,
        }

        accommodations_by_day: Dict[int, AccommodationInput] = {}
        if accommodations:
            for acc in accommodations:
                accom = AccommodationInput(**acc)
                accommodations_by_day[accom.day_number] = accom

        # Handle empty inputs
        if not poi_inputs or not day_inputs:
            return SmartScheduleResult(
                success=True,
                message="No POIs or days to schedule",
                assignments=[],
                day_summaries=[],
                stats=ScheduleStats(
                    total_pois=0,
                    distributed_pois=0,
                    anchored_count=0,
                    avg_hours_per_day=0,
                    days_used=0,
                ),
                warnings=[],
                constraints_applied=constraints,
            ).model_dump()

        # Initialize schedule
        schedule: Dict[str, List[POIInput]] = {day.date: [] for day in day_inputs}
        assignments: List[POIAssignment] = []

        # Separate anchored from unanchored POIs
        anchored_pois = [p for p in poi_inputs if p.is_anchored and p.anchored_time and p.scheduled_date]
        unanchored_pois = [p for p in poi_inputs if not p.is_anchored]

        # Pre-assign anchored POIs
        for poi in anchored_pois:
            if poi.scheduled_date in schedule:
                schedule[poi.scheduled_date].append(poi)
                assignments.append(POIAssignment(
                    poi_id=poi.id,
                    poi_name=poi.name,
                    scheduled_date=poi.scheduled_date,
                    day_order=0,  # Will be recalculated
                    is_anchored=True,
                    anchored_time=poi.anchored_time,
                ))

        # Sort anchored POIs by time within each day
        for day in day_inputs:
            schedule[day.date].sort(
                key=lambda p: p.anchored_time or "23:59"
            )

        # Cluster unanchored POIs
        clusters = cluster_pois_by_travel_time(
            unanchored_pois,
            constraints["max_travel_minutes_in_cluster"],
            travel_matrix,
            transport_profile,
        )

        # Flatten clusters while preserving order
        pois_to_assign = [poi for cluster in clusters for poi in cluster]

        # Assign unanchored POIs using scoring
        for poi in pois_to_assign:
            best_day = None
            best_score = float("-inf")

            for day in day_inputs:
                day_pois = schedule[day.date]
                accommodation = accommodations_by_day.get(day.day_number)

                score = score_poi_for_day(
                    poi, day_pois, constraints,
                    accommodation, travel_matrix, transport_profile
                )

                if score > best_score:
                    best_score = score
                    best_day = day

            if best_day:
                schedule[best_day.date].append(poi)
                assignments.append(POIAssignment(
                    poi_id=poi.id,
                    poi_name=poi.name,
                    scheduled_date=best_day.date,
                    day_order=0,
                    is_anchored=False,
                ))

        # Recalculate day_order
        for day in day_inputs:
            for idx, poi in enumerate(schedule[day.date]):
                for assignment in assignments:
                    if assignment.poi_id == poi.id:
                        assignment.day_order = idx
                        break

        # Generate warnings
        warnings = generate_saturation_warnings(
            schedule, day_inputs, constraints,
            travel_matrix, accommodations_by_day, transport_profile
        )

        # Build day summaries
        day_summaries = []
        for day in day_inputs:
            day_pois = schedule[day.date]
            accommodation = accommodations_by_day.get(day.day_number)

            dwell_time = get_day_dwell_time(day_pois)
            travel_time = calculate_day_travel_time(day_pois, accommodation, travel_matrix, transport_profile)
            total_time = dwell_time + travel_time
            max_minutes = constraints["max_hours_per_day"] * 60

            # Day-specific warnings
            day_warnings = []
            if total_time > max_minutes:
                day_warnings.append({
                    "type": "time_exceeded",
                    "severity": "error",
                    "message": f"Exceeds budget by {round((total_time - max_minutes) / 60, 1)}h",
                })

            food_count = count_food_pois(day_pois)
            if food_count > constraints["max_food_per_day"]:
                day_warnings.append({
                    "type": "food_exceeded",
                    "severity": "error",
                    "message": f"{food_count} food stops (max {constraints['max_food_per_day']})",
                })

            day_summaries.append(DaySummary(
                date=day.date,
                day_number=day.day_number,
                poi_count=len(day_pois),
                anchored_count=sum(1 for p in day_pois if p.is_anchored),
                dwell_time_hours=round(dwell_time / 60, 1),
                travel_time_minutes=travel_time,
                total_time_hours=round(total_time / 60, 1),
                food_count=food_count,
                accommodation=accommodation.name if accommodation else None,
                warnings=day_warnings,
            ))

        # Calculate stats
        days_with_pois = [day for day in day_inputs if schedule[day.date]]
        total_minutes = sum(get_day_dwell_time(schedule[d.date]) for d in day_inputs)
        avg_minutes_per_day = total_minutes / len(days_with_pois) if days_with_pois else 0

        stats = ScheduleStats(
            total_pois=len(poi_inputs),
            distributed_pois=len(assignments),
            anchored_count=len(anchored_pois),
            avg_hours_per_day=round(avg_minutes_per_day / 60, 1),
            days_used=len(days_with_pois),
        )

        result = SmartScheduleResult(
            success=True,
            message=f"Scheduled {len(assignments)} POIs across {len(days_with_pois)} days",
            assignments=assignments,
            day_summaries=day_summaries,
            stats=stats,
            warnings=warnings,
            constraints_applied=constraints,
        )

        logger.info(
            f"generate_smart_schedule completed: {stats.distributed_pois} POIs, "
            f"{stats.days_used} days, {len(warnings)} warnings"
        )

        return result.model_dump()

    logger.info("Registered scheduler tools: generate_smart_schedule")
