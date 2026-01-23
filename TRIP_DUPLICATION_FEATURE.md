# Trip Duplication Feature Implementation

## Overview

This document describes the implementation of the trip duplication feature, which allows users to create a copy of an existing trip with configurable options for what to include.

## Feature Capabilities

### User Options

When duplicating a trip, users can choose:

1. **Basic Duplicate (Destinations only)**
   - Copies all destinations and their basic information
   - Useful for planning a similar route without detailed planning

2. **Full Duplicate (with POIs)**
   - Includes all points of interest
   - Copies estimated costs (actual costs reset to zero)
   - Resets engagement metrics (likes/vetoes)
   - Adjusts scheduled dates based on new trip dates

3. **Full Duplicate with Accommodations**
   - Includes accommodation details
   - Resets booking references and payment status
   - Adjusts check-in/check-out dates

4. **Full Duplicate with Documents**
   - Copies document references (files are shared, not duplicated)
   - Maintains document structure and organization

### Automatic Adjustments

- **Trip Name**: User provides new name (default: "Original Name (Copy)")
- **Dates**: User selects new start and end dates (default: +1 year)
- **Status**: Always set to "planning" for duplicated trips
- **Date Offset**: All dates automatically adjusted based on new start date
- **Budget**: Total budget copied, but actual spent reset to zero

## Backend Implementation

### API Endpoint

```
POST /api/v1/trips/{trip_id}/duplicate
```

**Request Body** (TripDuplicateRequest):
```json
{
  "name": "Summer in Italy 2027",
  "start_date": "2027-06-15",
  "end_date": "2027-06-25",
  "include_destinations": true,
  "include_pois": true,
  "include_accommodations": true,
  "include_documents": false
}
```

**Response**: TripResponse with the newly created trip

### Files Modified/Created

#### Backend
1. **app/schemas/trip.py**
   - Added `TripDuplicateRequest` schema with validation

2. **app/services/trip_service.py**
   - Added `duplicate_trip()` method
   - Implements deep copying with eager loading
   - Handles date offset calculations
   - Manages cascade copying of related entities

3. **app/api/trips.py**
   - Added `POST /{trip_id}/duplicate` endpoint
   - Imports and uses `TripDuplicateRequest` schema

#### Frontend
1. **frontend/src/components/Trip/TripDuplicateModal.jsx** (NEW)
   - Modal component for duplication options
   - Form validation
   - User-friendly checkboxes for inclusion options
   - Date range picker integration
   - Clear help text explaining what gets copied

2. **frontend/src/stores/useTripStore.js**
   - Updated `duplicateTrip()` function to use new API endpoint
   - Now accepts trip ID and duplication options
   - Improved error handling

3. **frontend/src/pages/GlobalTripView.jsx**
   - Integrated TripDuplicateModal
   - Added `handleDuplicateClick()` to show modal
   - Updated `handleDuplicateTrip()` to work with modal

## Technical Details

### Date Offset Logic

The service calculates the difference between the original trip's start date and the new start date, then applies this offset to all date fields:

- Destination arrival/departure dates
- POI scheduled dates
- Accommodation check-in/check-out dates

Example:
- Original trip: June 1-10, 2026
- New trip: June 1-10, 2027
- Offset: +365 days
- All dates shifted by +365 days

### Cascade Duplication

When duplicating with `include_destinations=true`, the service:

1. Eagerly loads all related data using SQLAlchemy `selectinload()`
2. Creates new Trip entity
3. Iterates through destinations and creates copies
4. Maintains destination-to-destination ID mapping
5. If POIs included, creates POI copies linked to new destinations
6. If accommodations included, creates accommodation copies
7. If documents included, creates document copies with proper linkage

### Reset Behaviors

Certain fields are intentionally reset for the new trip:

- **Trip Status**: Always "planning"
- **POI Actual Costs**: Set to None (estimated costs preserved)
- **POI Engagement**: Likes and vetoes reset to 0
- **Accommodation Booking**: Booking references cleared, is_paid set to False
- **Documents**: File paths preserved (shared), but re-linked to new entities

## User Interface

### Modal Layout

The TripDuplicateModal features:

1. **Header**: Shows the original trip name being duplicated
2. **Trip Name Field**: Required, pre-filled with "(Copy)" suffix
3. **Date Range Picker**: Required, defaults to +1 year from original
4. **Inclusion Options**: Four checkboxes with clear descriptions
   - Destinations (required for POIs/accommodations)
   - POIs (disabled if destinations not selected)
   - Accommodations (disabled if destinations not selected)
   - Documents (independent)
5. **Info Box**: Explains what gets reset/adjusted
6. **Action Buttons**: Cancel and "Duplicate Trip"

### Visual Design

- Dark mode support throughout
- Icons for each option (MapPin, Building, FileText, etc.)
- Disabled state styling for dependent options
- Loading state during duplication
- Error handling with user-friendly messages

## Testing

A test script is provided: `test_duplication.py`

This script:
- Creates a test trip with destinations and POIs
- Tests basic duplication (destinations only)
- Tests full duplication (with POIs)
- Verifies date adjustment
- Verifies data integrity
- Cleans up test data

Run with:
```bash
python test_duplication.py
```

## Use Cases

### 1. Annual Repeat Trip
User wants to visit the same destination every year:
- Duplicate with all POIs and accommodations
- Adjust dates to next year
- Review and update as needed

### 2. Similar Trip Template
User wants to plan a similar trip for a friend:
- Duplicate with destinations and POIs
- Exclude accommodations (different preferences)
- Share the duplicated trip

### 3. Multi-Phase Trip
User wants to split a long trip into multiple trips:
- Duplicate the original trip
- Adjust dates for each phase
- Remove irrelevant destinations from each copy

### 4. Trip Iteration
User wants to improve on a past trip:
- Duplicate completed trip
- Include everything
- Modify based on lessons learned

## API Documentation

The endpoint is fully documented with OpenAPI/Swagger:
- Access at `/docs` when running the backend
- Shows request/response schemas
- Allows testing directly in browser

## Future Enhancements

Potential improvements for future versions:

1. **Partial Date Ranges**: Duplicate only specific destinations/days
2. **Smart Date Suggestions**: Suggest dates based on seasons/holidays
3. **Budget Scaling**: Option to scale budget proportionally
4. **Collaborative Duplication**: Duplicate and immediately share with others
5. **Template Library**: Save frequently duplicated trips as templates
6. **Bulk Operations**: Duplicate multiple trips at once
7. **Document Actual Copy**: Option to actually duplicate files instead of sharing

## Related Files

- Backend Models: `app/models/trip.py`, `destination.py`, `poi.py`, `accommodation.py`, `document.py`
- Backend Service: `app/services/trip_service.py`
- Backend API: `app/api/trips.py`
- Frontend Store: `frontend/src/stores/useTripStore.js`
- Frontend Modal: `frontend/src/components/Trip/TripDuplicateModal.jsx`
- Frontend Page: `frontend/src/pages/GlobalTripView.jsx`

## Summary

The trip duplication feature provides a powerful and flexible way for users to create new trips based on existing ones. The implementation:

✅ Supports configurable duplication options
✅ Automatically adjusts all dates based on the new trip dates
✅ Intelligently resets fields that shouldn't be copied (costs, bookings, etc.)
✅ Provides a clean, intuitive user interface
✅ Maintains data integrity and relationships
✅ Includes comprehensive error handling
✅ Is fully tested and documented

This feature significantly enhances the user experience by reducing repetitive data entry and making it easy to plan similar trips or revisit favorite destinations.
