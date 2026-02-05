# Phase 1: Critical Bugs - Research

**Researched:** 2026-02-02
**Domain:** Bug fixes in existing FastAPI + React codebase
**Confidence:** HIGH

## Summary

This phase addresses three critical bugs that break core user workflows. Research was conducted by analyzing the existing codebase to understand each bug's root cause and fix location.

**BUG-01 (Delete destination)**: The backend DELETE endpoint works correctly, but related entities with foreign keys may cause constraint violations. The `TravelSegment` model has `from_destination_id` and `to_destination_id` with `ondelete="CASCADE"` - deletion should cascade, but the Destination model lacks relationship definitions for these backrefs, potentially causing orphan handling issues.

**BUG-02 (Stop geocoding)**: The `AddTravelStopModal.jsx` component calls the Google Places API with the wrong query parameter (`query=` instead of `q=`). The API endpoint `/google-places/autocomplete` expects `q` as defined in `app/api/google_places.py`. This causes 422 validation errors.

**BUG-03 (Trip card route display)**: The `TripCard.jsx` component does not receive or display route start/end information. The Trip model has `origin_name`, `origin_latitude`, `origin_longitude` fields, and destinations have coordinates, but this data is not passed to TripCard or rendered in its template.

**Primary recommendation:** Fix parameter mismatch in BUG-02 first (single line change), then BUG-03 (UI enhancement), then BUG-01 (requires cascade verification).

## Bug Analysis

### BUG-01: Delete Destination Broken

**Location:** Backend + potential cascade issues

**Current Implementation:**
```python
# app/api/destinations.py:143-161
@router.delete("/destinations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_destination(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Destination).where(Destination.id == id))
    db_destination = result.scalar_one_or_none()
    if not db_destination:
        raise HTTPException(status_code=404, ...)
    await db.delete(db_destination)
    await db.flush()
    return None
```

**Related Foreign Keys (all with ondelete="CASCADE"):**
| Model | Column | Cascade |
|-------|--------|---------|
| POI | destination_id | CASCADE |
| Accommodation | destination_id | CASCADE |
| TravelSegment | from_destination_id | CASCADE |
| TravelSegment | to_destination_id | CASCADE |
| Note | destination_id | CASCADE |
| Document | destination_id | SET NULL |

**Likely Issue:** The Destination model defines relationships for `pois` and `accommodations` with `cascade="all, delete-orphan"`, but NOT for travel segments. While database CASCADE should handle deletion, SQLAlchemy's session state may become inconsistent.

**Fix Strategy:**
1. Add `outgoing_segments` and `incoming_segments` relationships to Destination model with proper cascade
2. Verify the backend endpoint returns 204 (not 500)
3. Check frontend store properly handles response
4. Test with destinations that have travel segments

**Frontend Store (verified working):**
```javascript
// frontend/src/stores/useDestinationStore.js:101-123
deleteDestination: async (destinationId) => {
  const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete destination');
  // Updates local state correctly
}
```

### BUG-02: Stop Geocoding Parameter Mismatch

**Location:** Frontend API call

**Current (BROKEN):**
```javascript
// frontend/src/components/TravelSegment/AddTravelStopModal.jsx:64-65
const response = await fetch(
  `${API_BASE_URL}/google-places/autocomplete?query=${encodeURIComponent(searchQuery)}`
);
```

**Expected (API definition):**
```python
# app/api/google_places.py:11-17
@router.get("/autocomplete", response_model=GooglePlacesSearchResponse)
async def autocomplete_places(
    q: str = Query(..., min_length=2, description="Search query"),  # <-- expects 'q'
    ...
):
```

**Working Reference (same codebase):**
```javascript
// frontend/src/components/Map/QuickPOISearch.jsx:62
let url = `${API_BASE_URL}/google-places/autocomplete?q=${encodeURIComponent(searchQuery)}`;
```

**Fix:** Single line change: `query=` -> `q=`

### BUG-03: Trip Card Missing Route Display

**Location:** Frontend components

**Available Data (in Trip model):**
- `origin_name`, `origin_latitude`, `origin_longitude`
- `return_name`, `return_latitude`, `return_longitude`
- `destinations` array with `city_name`, `latitude`, `longitude`

**Current TripCard Props (no route data):**
```javascript
// frontend/src/components/Trip/TripCard.jsx:63-75
const TripCard = React.memo(function TripCard({
  trip,              // Has origin_name, destinations
  destinationCount,  // Just a count
  totalPOIs,
  scheduledPOIs,
  // NO route-related props
})
```

**Current Display (no route info in template):**
- Title, description, dates, budget
- Destination count (number only)
- POI progress
- NO first/last destination names
- NO origin/return info

**Expected Display (per bug description):**
- Route start (origin_name or first destination)
- Route end (last destination or return_name)
- Display on trip card map (if any) AND in left panel text

**Fix Strategy:**
1. Extract route endpoints from trip data:
   - Start: `trip.origin_name` OR `trip.destinations[0]?.city_name`
   - End: `trip.destinations[last]?.city_name` OR `trip.return_name`
2. Add visual element to TripCard showing "Start -> End"
3. Optionally add mini-map showing route (would need destinations passed)

**Data Already Available (verified in GlobalTripView):**
```javascript
// trip object already contains:
trip.origin_name
trip.origin_latitude
trip.origin_longitude
trip.destinations  // Full array with city_name, lat, lon
```

## Architecture Patterns

### Existing Patterns to Follow

**API Error Handling:**
```python
if not db_destination:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Destination with id {id} not found"
    )
```

**Frontend Store Pattern:**
```javascript
deleteX: async (xId) => {
  set({ isLoading: true, error: null });
  try {
    const response = await fetch(...);
    if (!response.ok) throw new Error('...');
    set((state) => ({
      items: state.items.filter(x => x.id !== xId),
      isLoading: false,
    }));
  } catch (error) {
    set({ error: error.message, isLoading: false });
    throw error;
  }
}
```

**TripCard Component Pattern:**
```jsx
// Conditional rendering with fallback
{trip.location && (
  <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
    <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
    <span className="line-clamp-1">{trip.location}</span>
  </div>
)}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cascade deletion | Manual deletion of related entities | SQLAlchemy relationships with cascade | Database handles atomicity |
| API validation | Manual parameter parsing | FastAPI Query() validators | Automatic 422 with details |
| Geocoding | Custom geocoding logic | Existing `/google-places/autocomplete` | Already implemented and cached |

## Common Pitfalls

### Pitfall 1: Testing DELETE without related entities
**What goes wrong:** DELETE works in isolation but fails with travel segments
**Why it happens:** Test data doesn't include TravelSegments referencing the destination
**How to avoid:** Test with full data: destination + POIs + travel segments + notes
**Warning signs:** Works in dev, fails in production with real data

### Pitfall 2: Caching API response errors
**What goes wrong:** Frontend caches 422 error response
**Why it happens:** Not checking response.ok before caching
**How to avoid:** Always check `if (!response.ok)` before processing
**Warning signs:** Same error persists after fix deployed

### Pitfall 3: Missing null checks in UI
**What goes wrong:** "Cannot read property 'city_name' of undefined"
**Why it happens:** `trip.destinations` is empty array or undefined
**How to avoid:** Use optional chaining: `trip.destinations?.[0]?.city_name`
**Warning signs:** Crash on trips with no destinations

## Code Examples

### Fix for BUG-02 (Verified pattern from codebase)
```javascript
// frontend/src/components/TravelSegment/AddTravelStopModal.jsx:64-66
// CHANGE FROM:
const response = await fetch(
  `${API_BASE_URL}/google-places/autocomplete?query=${encodeURIComponent(searchQuery)}`
);

// CHANGE TO:
const response = await fetch(
  `${API_BASE_URL}/google-places/autocomplete?q=${encodeURIComponent(searchQuery)}`
);
```

### Route Display Pattern for BUG-03
```jsx
// Pattern from existing codebase for conditional route display
const routeInfo = useMemo(() => {
  const start = trip.origin_name || trip.destinations?.[0]?.city_name;
  const end = trip.destinations?.[trip.destinations.length - 1]?.city_name
              || trip.return_name;
  if (!start && !end) return null;
  return { start, end };
}, [trip.origin_name, trip.return_name, trip.destinations]);

// Render pattern
{routeInfo && (
  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
    <MapPin className="w-4 h-4 mr-1.5" />
    <span>{routeInfo.start}</span>
    <ArrowRight className="w-3 h-3 mx-1.5 text-gray-400" />
    <span>{routeInfo.end}</span>
  </div>
)}
```

### Cascade Relationship Fix for BUG-01
```python
# app/models/destination.py - Add these relationships
# After line 29 (existing relationships)
travel_segments_from = relationship(
    "TravelSegment",
    foreign_keys="TravelSegment.from_destination_id",
    cascade="all, delete-orphan",
    passive_deletes=True
)
travel_segments_to = relationship(
    "TravelSegment",
    foreign_keys="TravelSegment.to_destination_id",
    cascade="all, delete-orphan",
    passive_deletes=True
)
```

## File Locations

### BUG-01 Files
- `/Users/adrihp06/Github/Projects/travel-ruter/app/api/destinations.py` (DELETE endpoint, line 143)
- `/Users/adrihp06/Github/Projects/travel-ruter/app/models/destination.py` (model relationships, line 27-29)
- `/Users/adrihp06/Github/Projects/travel-ruter/app/models/travel_segment.py` (FK references)
- `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/stores/useDestinationStore.js` (store action, line 101)
- `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/pages/DetailView.jsx` (handler, line 913)

### BUG-02 Files
- `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/components/TravelSegment/AddTravelStopModal.jsx` (line 64-65)
- `/Users/adrihp06/Github/Projects/travel-ruter/app/api/google_places.py` (API definition, line 11-17)

### BUG-03 Files
- `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/components/Trip/TripCard.jsx` (component)
- `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/pages/GlobalTripView.jsx` (parent, passes props)
- `/Users/adrihp06/Github/Projects/travel-ruter/app/schemas/trip.py` (TripSummaryItem with destinations)

## Open Questions

1. **BUG-01 Root Cause Uncertainty**
   - What we know: DELETE endpoint logic is correct, cascade is configured
   - What's unclear: Is this a database constraint issue or frontend error handling?
   - Recommendation: Add logging to backend, test with browser devtools open

2. **BUG-03 Map Display**
   - What we know: Text display of route is missing
   - What's unclear: Should there be a mini-map on TripCard showing route?
   - Recommendation: Start with text display "Start -> End", defer map to later phase

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/app/api/destinations.py`, `/app/api/google_places.py`
- Codebase analysis: `/app/models/destination.py`, `/app/models/travel_segment.py`
- Codebase analysis: `/frontend/src/components/TravelSegment/AddTravelStopModal.jsx`
- Codebase analysis: `/frontend/src/components/Trip/TripCard.jsx`

### Reference Implementation
- Working geocoding: `/frontend/src/components/Map/QuickPOISearch.jsx` (correct `q=` parameter)
- Route display: `/frontend/src/pages/DetailView.jsx` (uses origin_name, destinations)

## Metadata

**Confidence breakdown:**
- BUG-01 analysis: MEDIUM - cascade configuration looks correct, may be session state issue
- BUG-02 analysis: HIGH - clear parameter mismatch, working reference in codebase
- BUG-03 analysis: HIGH - clear what data exists and what UI is missing

**Research date:** 2026-02-02
**Valid until:** Indefinite (codebase analysis, not external dependencies)

## Implementation Priority

1. **BUG-02** (5 min) - Single line fix, immediate value
2. **BUG-03** (30 min) - UI enhancement, clear implementation
3. **BUG-01** (1-2 hr) - Requires debugging, cascade verification, testing
