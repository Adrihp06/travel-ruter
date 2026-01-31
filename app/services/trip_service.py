from decimal import Decimal
from typing import List, Optional
from datetime import timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from geoalchemy2.elements import WKTElement
from app.models.trip import Trip
from app.models.destination import Destination
from app.models.poi import POI
from app.models.accommodation import Accommodation
from app.models.document import Document
from app.schemas.trip import TripCreate, TripUpdate, BudgetSummary, TripDuplicateRequest


class TripService:
    """Service for Trip CRUD operations"""

    @staticmethod
    async def create_trip(db: AsyncSession, trip_data: TripCreate) -> Trip:
        """Create a new trip"""
        trip = Trip(**trip_data.model_dump())
        db.add(trip)
        await db.flush()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def get_trip(db: AsyncSession, trip_id: int) -> Optional[Trip]:
        """Get a trip by ID"""
        result = await db.execute(select(Trip).where(Trip.id == trip_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_trip_with_destinations(db: AsyncSession, trip_id: int) -> Optional[Trip]:
        """Get a trip by ID with destinations eagerly loaded"""
        result = await db.execute(
            select(Trip)
            .options(selectinload(Trip.destinations))
            .where(Trip.id == trip_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_trips(
        db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> List[Trip]:
        """Get all trips with pagination"""
        result = await db.execute(select(Trip).offset(skip).limit(limit))
        return list(result.scalars().all())

    @staticmethod
    async def get_trips_with_summary(
        db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> tuple[List[dict], int]:
        """
        Get all trips with destinations and POI stats in a single query.
        Returns trips with eager-loaded destinations and batch-queried POI stats.
        This eliminates the N+1 problem by fetching everything in 2 queries.
        """
        # Query 1: Get all trips with destinations eagerly loaded
        trips_result = await db.execute(
            select(Trip)
            .options(selectinload(Trip.destinations))
            .offset(skip)
            .limit(limit)
        )
        trips = list(trips_result.scalars().all())

        # Get total count
        count_result = await db.execute(select(func.count(Trip.id)))
        total_count = count_result.scalar()

        if not trips:
            return [], total_count

        # Query 2: Batch query for POI stats of ALL trips at once
        trip_ids = [trip.id for trip in trips]

        poi_stats_result = await db.execute(
            select(
                Destination.trip_id,
                func.count(POI.id).label('total_pois'),
                func.count(POI.scheduled_date).label('scheduled_pois')
            )
            .select_from(Destination)
            .outerjoin(POI, POI.destination_id == Destination.id)
            .where(Destination.trip_id.in_(trip_ids))
            .group_by(Destination.trip_id)
        )

        # Create a map of trip_id -> POI stats
        poi_stats_map = {}
        for row in poi_stats_result:
            poi_stats_map[row.trip_id] = {
                'total_pois': row.total_pois,
                'scheduled_pois': row.scheduled_pois
            }

        # Combine trips with their POI stats
        trips_with_summary = []
        for trip in trips:
            trip_dict = {
                'trip': trip,
                'destinations': trip.destinations,
                'poi_stats': poi_stats_map.get(trip.id, {'total_pois': 0, 'scheduled_pois': 0})
            }
            trips_with_summary.append(trip_dict)

        return trips_with_summary, total_count

    @staticmethod
    async def update_trip(
        db: AsyncSession, trip_id: int, trip_data: TripUpdate
    ) -> Optional[Trip]:
        """Update a trip"""
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return None

        # Update only provided fields
        update_data = trip_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(trip, field, value)

        await db.flush()
        await db.refresh(trip)
        return trip

    @staticmethod
    async def delete_trip(db: AsyncSession, trip_id: int) -> bool:
        """Delete a trip"""
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return False

        await db.delete(trip)
        await db.flush()
        return True

    @staticmethod
    async def get_poi_stats(db: AsyncSession, trip_id: int) -> dict:
        """Get POI statistics for a trip (total and scheduled counts)"""
        result = await db.execute(
            select(
                func.count(POI.id).label('total_pois'),
                func.count(POI.scheduled_date).label('scheduled_pois')
            )
            .select_from(POI)
            .join(Destination, POI.destination_id == Destination.id)
            .where(Destination.trip_id == trip_id)
        )
        row = result.one()
        return {
            'total_pois': row.total_pois,
            'scheduled_pois': row.scheduled_pois
        }

    @staticmethod
    async def get_budget_summary(db: AsyncSession, trip_id: int) -> Optional[BudgetSummary]:
        """Calculate budget summary for a trip by aggregating POI costs"""
        # Get the trip first
        trip = await TripService.get_trip(db, trip_id)
        if not trip:
            return None

        # Get sum of estimated and actual costs from all POIs in this trip's destinations
        result = await db.execute(
            select(
                func.coalesce(func.sum(POI.estimated_cost), 0).label('estimated_total'),
                func.coalesce(func.sum(POI.actual_cost), 0).label('actual_total')
            )
            .select_from(POI)
            .join(Destination, POI.destination_id == Destination.id)
            .where(Destination.trip_id == trip_id)
        )
        row = result.one()
        estimated_total = Decimal(str(row.estimated_total))
        actual_total = Decimal(str(row.actual_total))

        # Calculate remaining budget and percentage
        remaining_budget = None
        budget_percentage = None
        if trip.total_budget is not None and trip.total_budget > 0:
            remaining_budget = trip.total_budget - actual_total
            budget_percentage = float((actual_total / trip.total_budget) * 100)

        return BudgetSummary(
            total_budget=trip.total_budget,
            estimated_total=estimated_total,
            actual_total=actual_total,
            currency=trip.currency,
            remaining_budget=remaining_budget,
            budget_percentage=budget_percentage
        )

    @staticmethod
    async def duplicate_trip(
        db: AsyncSession,
        trip_id: int,
        duplicate_request: TripDuplicateRequest
    ) -> Optional[Trip]:
        """
        Duplicate a trip with configurable options for what to include.

        Args:
            db: Database session
            trip_id: ID of the trip to duplicate
            duplicate_request: Duplication options (name, dates, what to include)

        Returns:
            The newly created trip with duplicated data
        """
        # Get the original trip with all related data
        query = select(Trip).where(Trip.id == trip_id)

        if duplicate_request.include_destinations:
            query = query.options(selectinload(Trip.destinations))

            if duplicate_request.include_pois:
                query = query.options(
                    selectinload(Trip.destinations).selectinload(Destination.pois)
                )

            if duplicate_request.include_accommodations:
                query = query.options(
                    selectinload(Trip.destinations).selectinload(Destination.accommodations)
                )

        result = await db.execute(query)
        original_trip = result.scalar_one_or_none()

        if not original_trip:
            return None

        # Calculate date offset for adjusting dates in duplicated entities
        date_offset = (duplicate_request.start_date - original_trip.start_date).days

        # Create the new trip (copy all trip-level data)
        new_trip = Trip(
            name=duplicate_request.name,
            location=original_trip.location,
            latitude=original_trip.latitude,
            longitude=original_trip.longitude,
            description=original_trip.description,
            cover_image=original_trip.cover_image,
            start_date=duplicate_request.start_date,
            end_date=duplicate_request.end_date,
            total_budget=original_trip.total_budget,
            currency=original_trip.currency,
            status='planning',  # Always set to planning for duplicated trips
            tags=original_trip.tags if original_trip.tags else [],
            origin_name=original_trip.origin_name,
            origin_latitude=original_trip.origin_latitude,
            origin_longitude=original_trip.origin_longitude,
            return_name=original_trip.return_name,
            return_latitude=original_trip.return_latitude,
            return_longitude=original_trip.return_longitude,
        )

        db.add(new_trip)
        await db.flush()  # Get the new trip ID

        # Duplicate destinations if requested
        if duplicate_request.include_destinations and original_trip.destinations:
            destination_map = {}  # Map old destination IDs to new ones

            for original_dest in original_trip.destinations:
                # Adjust dates based on offset
                new_arrival = original_dest.arrival_date + timedelta(days=date_offset) if original_dest.arrival_date else None
                new_departure = original_dest.departure_date + timedelta(days=date_offset) if original_dest.departure_date else None

                # Create new destination
                new_dest = Destination(
                    trip_id=new_trip.id,
                    city_name=original_dest.city_name,
                    country=original_dest.country,
                    arrival_date=new_arrival,
                    departure_date=new_departure,
                    name=original_dest.name,
                    description=original_dest.description,
                    address=original_dest.address,
                    latitude=original_dest.latitude,
                    longitude=original_dest.longitude,
                    notes=original_dest.notes,
                    order_index=original_dest.order_index,
                )

                # Copy coordinates if they exist
                if original_dest.coordinates is not None:
                    new_dest.coordinates = original_dest.coordinates
                if original_dest.location is not None:
                    new_dest.location = original_dest.location

                db.add(new_dest)
                await db.flush()  # Get the new destination ID

                destination_map[original_dest.id] = new_dest

                # Duplicate POIs if requested
                if duplicate_request.include_pois and hasattr(original_dest, 'pois') and original_dest.pois:
                    for original_poi in original_dest.pois:
                        # Adjust scheduled date if it exists
                        new_scheduled_date = None
                        if original_poi.scheduled_date:
                            new_scheduled_date = original_poi.scheduled_date + timedelta(days=date_offset)

                        new_poi = POI(
                            destination_id=new_dest.id,
                            name=original_poi.name,
                            category=original_poi.category,
                            description=original_poi.description,
                            address=original_poi.address,
                            estimated_cost=original_poi.estimated_cost,
                            actual_cost=None,  # Don't copy actual costs for new trip
                            currency=original_poi.currency,
                            dwell_time=original_poi.dwell_time,
                            likes=0,  # Reset engagement metrics
                            vetoes=0,
                            priority=original_poi.priority,
                            scheduled_date=new_scheduled_date,
                            day_order=original_poi.day_order,
                            files=original_poi.files if original_poi.files else [],
                            metadata_json=original_poi.metadata_json if original_poi.metadata_json else {},
                            external_id=original_poi.external_id,
                            external_source=original_poi.external_source,
                        )

                        # Copy coordinates if they exist
                        if original_poi.coordinates is not None:
                            new_poi.coordinates = original_poi.coordinates

                        db.add(new_poi)

                # Duplicate accommodations if requested
                if duplicate_request.include_accommodations and hasattr(original_dest, 'accommodations') and original_dest.accommodations:
                    for original_accom in original_dest.accommodations:
                        # Adjust check-in/check-out dates
                        new_check_in = original_accom.check_in_date + timedelta(days=date_offset) if original_accom.check_in_date else None
                        new_check_out = original_accom.check_out_date + timedelta(days=date_offset) if original_accom.check_out_date else None

                        new_accom = Accommodation(
                            destination_id=new_dest.id,
                            name=original_accom.name,
                            type=original_accom.type,
                            address=original_accom.address,
                            check_in_date=new_check_in,
                            check_out_date=new_check_out,
                            booking_reference=None,  # Don't copy booking references
                            booking_url=original_accom.booking_url,
                            total_cost=original_accom.total_cost,
                            currency=original_accom.currency,
                            is_paid=False,  # Reset payment status
                            description=original_accom.description,
                            rating=original_accom.rating,
                            review=original_accom.review,
                            contact_info=original_accom.contact_info if original_accom.contact_info else {},
                            amenities=original_accom.amenities if original_accom.amenities else [],
                            files=original_accom.files if original_accom.files else [],
                        )

                        # Copy coordinates if they exist
                        if original_accom.coordinates is not None:
                            new_accom.coordinates = original_accom.coordinates

                        db.add(new_accom)

            # Duplicate trip-level documents if requested
            if duplicate_request.include_documents:
                # Get documents for the original trip
                doc_result = await db.execute(
                    select(Document).where(Document.trip_id == trip_id)
                )
                original_documents = doc_result.scalars().all()

                for original_doc in original_documents:
                    new_doc = Document(
                        trip_id=new_trip.id,
                        filename=original_doc.filename,
                        original_filename=original_doc.original_filename,
                        file_path=original_doc.file_path,  # Points to same file
                        file_size=original_doc.file_size,
                        mime_type=original_doc.mime_type,
                        document_type=original_doc.document_type,
                        title=original_doc.title,
                        description=original_doc.description,
                        # Map destination_id if document is linked to a destination
                        destination_id=(
                            destination_map[original_doc.destination_id].id
                            if original_doc.destination_id and original_doc.destination_id in destination_map
                            else None
                        ),
                        day_number=original_doc.day_number,
                    )
                    db.add(new_doc)

        await db.flush()
        await db.refresh(new_trip)
        return new_trip
