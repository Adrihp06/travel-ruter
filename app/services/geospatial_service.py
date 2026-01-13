from typing import List, Optional, Any
from sqlalchemy import select, func, cast
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import Geometry, Geography
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint, ST_Distance, ST_DWithin, ST_Buffer, ST_Transform, ST_Within
from geoalchemy2.elements import WKTElement

from app.models.accommodation import Accommodation
from app.models.poi import POI

class GeospatialService:
    
    @staticmethod
    def create_point(latitude: float, longitude: float, srid: int = 4326):
        """
        Creates a PostGIS point geometry from lat/lon.
        """
        return ST_SetSRID(ST_MakePoint(longitude, latitude), srid)

    @staticmethod
    async def calculate_distance(
        db: AsyncSession,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Calculates distance in meters between two lat/lon points.
        Uses ST_Distance on Geography type for accuracy.
        """
        p1 = ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)
        p2 = ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)
        
        # cast to Geography to get distance in meters
        stmt = select(
            func.ST_Distance(
                cast(p1, Geography),
                cast(p2, Geography)
            )
        )
        
        result = await db.execute(stmt)
        return result.scalar() or 0.0

    @staticmethod
    async def get_walkable_radius_geometry(
        db: AsyncSession,
        accommodation_id: int,
        radius_km: float = 5.0
    ) -> Optional[Any]:
        """
        Calculates the geometry of the walkable radius (circle) around an accommodation.
        Returns the Geometry (Polygon) in 4326.
        """
        stmt = select(Accommodation).where(Accommodation.id == accommodation_id)
        result = await db.execute(stmt)
        accommodation = result.scalar_one_or_none()
        
        if not accommodation or accommodation.coordinates is None:
            return None
            
        radius_meters = radius_km * 1000
        
        # Buffer on Geography returns a polygon (approximated) in the same SRID usually or we cast back
        # PostGIS ST_Buffer(geography, float) returns geometry.
        stmt = select(
            func.ST_Buffer(
                cast(accommodation.coordinates, Geography),
                radius_meters
            )
        )
        
        result = await db.execute(stmt)
        return result.scalar()

    @staticmethod
    async def get_pois_within_walkable_radius(
        db: AsyncSession,
        accommodation_id: int,
        radius_km: float = 5.0,
        use_st_within: bool = False
    ) -> List[POI]:
        """
        Finds POIs within a walkable radius of an accommodation.
        
        Args:
            db: Database session
            accommodation_id: ID of the accommodation
            radius_km: Radius in kilometers (default 5.0)
            use_st_within: If True, explicitly generates a buffer and uses ST_Within.
                           If False (default), uses the more efficient ST_DWithin.
        """
        # Get accommodation to verify existence and get destination_id (optimization)
        stmt = select(Accommodation).where(Accommodation.id == accommodation_id)
        result = await db.execute(stmt)
        accommodation = result.scalar_one_or_none()
        
        if not accommodation or accommodation.coordinates is None:
            return []
            
        radius_meters = radius_km * 1000
        
        query = select(POI).where(POI.destination_id == accommodation.destination_id)
        
        if use_st_within:
            # Demonstration of ST_Within usage:
            # 1. Create Buffer (Polygon)
            # 2. Check if POI is Within Buffer
            
            # We buffer the accommodation point. 
            # Note: Buffering geography returns geometry.
            buffer_geom = func.ST_Buffer(
                cast(accommodation.coordinates, Geography),
                radius_meters
            )
            
            # ST_Within(geometry_A, geometry_B) returns true if A is completely inside B
            # We assume POI.coordinates is 4326 Geometry
            # The buffer from ST_Buffer(geog) comes out as Geometry(Polygon, 4326) usually
            
            # We need to cast the resulting buffer to Geometry explicitly if needed, 
            # but usually it's compatible.
            
            query = query.where(
                func.ST_Within(
                    POI.coordinates,
                    cast(buffer_geom, Geometry(srid=4326)) 
                )
            )
        else:
            # Efficient Way: ST_DWithin
            query = query.where(
                func.ST_DWithin(
                    cast(POI.coordinates, Geography),
                    cast(accommodation.coordinates, Geography),
                    radius_meters
                )
            )
            
        result = await db.execute(query)
        return result.scalars().all()
