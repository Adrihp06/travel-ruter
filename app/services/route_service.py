from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route
from typing import List, Optional


class RouteService:
    """Service layer for route operations"""

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
