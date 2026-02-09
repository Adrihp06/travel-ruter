"""
MCP Tool: calculate_budget

Provides budget calculation and analysis for trips.
"""

import logging
from typing import Optional, List
from decimal import Decimal
from collections import defaultdict

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select, func

from mcp_server.context import get_db_session
from mcp_server.schemas.budget import (
    CalculateBudgetInput,
    BudgetResult,
    CategoryBreakdown,
    DayBreakdown,
)

logger = logging.getLogger(__name__)


def register_tools(server: FastMCP):
    """Register budget-related tools with the MCP server."""

    @server.tool()
    async def calculate_budget(
        trip_id: int,
        include_breakdown: bool = True,
    ) -> dict:
        """
        Calculate budget summary and analysis for a trip.

        Use this tool to get a comprehensive view of trip costs,
        including category and day breakdowns.

        Args:
            trip_id: Trip ID to calculate budget for
            include_breakdown: Whether to include category and day breakdowns (default True)

        Returns:
            Budget summary with totals, remaining budget, and breakdowns.
            Also includes recommendations based on spending patterns.
        """
        logger.info(f"calculate_budget called for trip_id={trip_id}")

        from app.models.trip import Trip
        from app.models.destination import Destination
        from app.models.poi import POI
        from app.services.trip_service import TripService

        async with get_db_session() as db:
            try:
                # Get trip
                trip = await TripService.get_trip(db, trip_id)
                if not trip:
                    return {
                        "error": f"Trip with ID {trip_id} not found",
                        "trip_id": trip_id,
                    }

                # Get budget summary from service
                budget_summary = await TripService.get_budget_summary(db, trip_id)

                # Determine budget status
                if trip.total_budget is None or trip.total_budget <= 0:
                    budget_status = "no_budget_set"
                    budget_display = "No budget set for this trip"
                elif budget_summary.actual_total > trip.total_budget:
                    over_amount = budget_summary.actual_total - trip.total_budget
                    budget_status = "over_budget"
                    budget_display = f"Over budget by {trip.currency} {over_amount:.2f}"
                elif budget_summary.actual_total >= trip.total_budget * Decimal("0.9"):
                    budget_status = "at_budget"
                    budget_display = f"Near budget limit ({budget_summary.budget_percentage:.1f}% used)"
                else:
                    budget_status = "under_budget"
                    budget_display = f"{trip.currency} {budget_summary.remaining_budget:.2f} remaining ({100 - budget_summary.budget_percentage:.1f}%)"

                category_breakdown = []
                day_breakdown = []
                recommendations = []

                if include_breakdown:
                    # Get POIs for breakdown calculation
                    poi_query = (
                        select(POI)
                        .join(Destination, POI.destination_id == Destination.id)
                        .where(Destination.trip_id == trip_id)
                    )
                    poi_result = await db.execute(poi_query)
                    pois = list(poi_result.scalars().all())

                    # Category breakdown
                    category_data = defaultdict(lambda: {
                        "estimated": Decimal("0"),
                        "actual": Decimal("0"),
                        "count": 0,
                    })

                    for poi in pois:
                        cat = poi.category or "Uncategorized"
                        category_data[cat]["estimated"] += poi.estimated_cost or Decimal("0")
                        category_data[cat]["actual"] += poi.actual_cost or Decimal("0")
                        category_data[cat]["count"] += 1

                    for cat, data in sorted(category_data.items()):
                        category_breakdown.append(
                            CategoryBreakdown(
                                category=cat,
                                estimated_total=data["estimated"],
                                actual_total=data["actual"],
                                poi_count=data["count"],
                            )
                        )

                    # Day breakdown
                    day_data = defaultdict(lambda: {
                        "estimated": Decimal("0"),
                        "actual": Decimal("0"),
                        "count": 0,
                    })

                    # Get trip start date for day numbering
                    start_date = trip.start_date

                    for poi in pois:
                        if poi.scheduled_date:
                            date_str = poi.scheduled_date.isoformat()
                            day_data[date_str]["estimated"] += poi.estimated_cost or Decimal("0")
                            day_data[date_str]["actual"] += poi.actual_cost or Decimal("0")
                            day_data[date_str]["count"] += 1

                    for date_str, data in sorted(day_data.items()):
                        from datetime import date as date_class
                        poi_date = date_class.fromisoformat(date_str)
                        day_number = (poi_date - start_date).days + 1 if start_date else 0

                        day_breakdown.append(
                            DayBreakdown(
                                date=date_str,
                                day_number=day_number,
                                estimated_total=data["estimated"],
                                actual_total=data["actual"],
                                poi_count=data["count"],
                            )
                        )

                    # Generate recommendations
                    if budget_status == "no_budget_set" and budget_summary.estimated_total > 0:
                        recommendations.append(
                            f"Consider setting a budget. Estimated total is {trip.currency} {budget_summary.estimated_total:.2f}"
                        )

                    if budget_status == "over_budget":
                        # Find highest spending category
                        if category_breakdown:
                            highest = max(category_breakdown, key=lambda x: x.actual_total)
                            recommendations.append(
                                f"Consider reducing {highest.category} expenses ({trip.currency} {highest.actual_total:.2f})"
                            )

                    # Check for high variance days
                    if day_breakdown:
                        avg_daily = budget_summary.actual_total / len(day_breakdown)
                        for day in day_breakdown:
                            if day.actual_total > avg_daily * Decimal("2"):
                                recommendations.append(
                                    f"Day {day.day_number} ({day.date}) has high spending. Consider spreading activities."
                                )
                                break  # Only one recommendation of this type

                    # Check for unbudgeted POIs
                    unbudgeted_count = sum(1 for poi in pois if not poi.estimated_cost)
                    if unbudgeted_count > 0:
                        recommendations.append(
                            f"{unbudgeted_count} POIs have no estimated cost. Add estimates for better planning."
                        )

                result = BudgetResult(
                    trip_id=trip_id,
                    trip_name=trip.name,
                    currency=trip.currency or "EUR",
                    total_budget=trip.total_budget,
                    estimated_total=budget_summary.estimated_total,
                    actual_total=budget_summary.actual_total,
                    remaining_budget=budget_summary.remaining_budget,
                    budget_percentage=budget_summary.budget_percentage,
                    budget_status=budget_status,
                    budget_display=budget_display,
                    category_breakdown=category_breakdown,
                    day_breakdown=day_breakdown,
                    recommendations=recommendations,
                )

                logger.info(
                    f"calculate_budget for trip {trip_id}: "
                    f"estimated={budget_summary.estimated_total}, "
                    f"actual={budget_summary.actual_total}, "
                    f"status={budget_status}"
                )

                return result.model_dump()

            except Exception as e:
                logger.error(f"calculate_budget failed: {e}")
                return {
                    "error": str(e),
                    "trip_id": trip_id,
                }

    logger.info("Registered budget tools: calculate_budget")
