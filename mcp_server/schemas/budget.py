"""
Schemas for budget calculation tools.
"""

from typing import Optional, List, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field


class CalculateBudgetInput(BaseModel):
    """Input schema for calculate_budget tool."""

    trip_id: int = Field(
        ...,
        description="Trip ID to calculate budget for",
    )
    include_breakdown: bool = Field(
        default=True,
        description="Include category-wise breakdown",
    )


class CategoryBreakdown(BaseModel):
    """Budget breakdown by category."""

    category: str = Field(..., description="POI category")
    estimated_total: Decimal = Field(..., description="Total estimated cost")
    actual_total: Decimal = Field(..., description="Total actual cost")
    poi_count: int = Field(..., description="Number of POIs in this category")


class DayBreakdown(BaseModel):
    """Budget breakdown by day."""

    date: str = Field(..., description="Date (YYYY-MM-DD)")
    day_number: int = Field(..., description="Day number in trip")
    estimated_total: Decimal = Field(..., description="Estimated cost for day")
    actual_total: Decimal = Field(..., description="Actual cost for day")
    poi_count: int = Field(..., description="Number of POIs")


class BudgetResult(BaseModel):
    """Schema for budget calculation result."""

    trip_id: int = Field(..., description="Trip ID")
    trip_name: str = Field(..., description="Trip name")
    currency: str = Field(..., description="Budget currency")

    # Overall totals
    total_budget: Optional[Decimal] = Field(
        default=None,
        description="Total budget set for the trip",
    )
    estimated_total: Decimal = Field(
        ...,
        description="Sum of all estimated POI costs",
    )
    actual_total: Decimal = Field(
        ...,
        description="Sum of all actual POI costs",
    )
    remaining_budget: Optional[Decimal] = Field(
        default=None,
        description="Remaining budget (total - actual)",
    )
    budget_percentage: Optional[float] = Field(
        default=None,
        description="Percentage of budget used",
    )

    # Display fields
    budget_status: str = Field(
        ...,
        description="Budget status: under_budget, at_budget, over_budget, no_budget_set",
    )
    budget_display: str = Field(
        ...,
        description="Human-readable budget summary",
    )

    # Breakdowns
    category_breakdown: List[CategoryBreakdown] = Field(
        default_factory=list,
        description="Costs broken down by category",
    )
    day_breakdown: List[DayBreakdown] = Field(
        default_factory=list,
        description="Costs broken down by day",
    )

    # Recommendations
    recommendations: List[str] = Field(
        default_factory=list,
        description="Budget recommendations based on analysis",
    )
