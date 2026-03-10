# Export Writer Route & Map Image Integration Analysis

## Executive Summary

The travel-ruter application has a sophisticated route calculation infrastructure with multiple backends and an emerging PDF export feature. This analysis identifies concrete technical options for embedding route images and Google Maps links into exported PDFs.

---

## 1. EXISTING ROUTE & MAP CAPABILITIES

### 1.1 Route Calculation Stores (Frontend)

#### **`useRouteStore.js`** 
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/stores/useRouteStore.js`

- **Purpose:** Single inter-city/inter-destination route storage
- **State:**
  - `routeGeometry`: GeoJSON LineString from API
  - `routeDetails`: { distance_km, duration_min, profile, segments, waypoints }
  - `activeRoute`: Currently selected route
  - `transportMode`: 'driving', 'walking', 'cycling', 'train', 'bus', 'flight'

- **Key Methods:**
  - `calculateORSRoute()`: Uses OpenRouteService for real road network routing
  - `calculateMapboxRoute()`: Uses Mapbox Directions API
  - `exportToGoogleMaps()`: Triggers backend export to Google Maps URL

#### **`useDayRoutesStore.js`** ⭐ **MOST RELEVANT**
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/stores/useDayRoutesStore.js`

- **Purpose:** Per-destination, per-day route management with segment-level transport modes
- **State Structure:**
  ```javascript
  dayRoutes: {
    [date]: {
      pois,           // Array of POI locations
      segments,       // Per-segment info: { fromPoi, toPoi, mode, distance, duration, geometry }
      totalDistance,  // km
      totalDuration,  // minutes
      totalDwellTime, // accumulated dwell times
      isVisible,      // map visibility flag
      geometry        // Combined GeoJSON LineString for full day
    }
  }
  visibleDays,        // Which day routes display on map
  segmentModes        // Per-segment transport mode overrides
  ```

- **Key Methods:**
  - `calculateDayRoute(date, pois, signal)`: Calculates all segments for a day via `/routes/day-segment` API
  - `exportDayToGoogleMaps(date)`: Exports single day's route to Google Maps
  - `getVisibleRoutes()`: Returns routes ready for map display (with geometry)

- **Color Coding:** Each day gets a distinct color (Amber, Lime, Orange, Teal, Fuchsia, Sky, Rose)

---

### 1.2 Google Maps Integration

#### **Frontend Utilities**
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/googleMaps.js`

```javascript
// Key exports:
generateGoogleMapsUrl(origin, destination, waypoints=[], travelMode='driving')
  → Returns: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=...

openGoogleMapsUrl(url)  // Opens in new tab

exportToGoogleMaps(origin, destination, waypoints=[], travelMode)
  → Generates URL + opens it
```

- **Supported Travel Modes:**
  - `DRIVING`, `WALKING`, `BICYCLING`, `TRANSIT`
  
- **URL Format (Google Maps Directions API v1):**
  ```
  https://www.google.com/maps/dir/?api=1
    &origin=lat,lng
    &destination=lat,lng
    &waypoints=lat,lng|lat,lng|...
    &travelmode=driving|walking|bicycling|transit
  ```

#### **Backend Service**
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/app/services/google_maps_service.py`

- Generates same URL format via `generate_directions_url()` method
- Backend endpoint: `POST /routes/export/google-maps`
- Returns: `{ url, origin, destination, waypoints_count, travel_mode }`

#### **Backend Route API**
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/app/api/routes.py`

Endpoints:
- `POST /routes/export/google-maps` - Export route to Google Maps
- `POST /routes/google-maps/multi-waypoint` - Calculate route via Google Maps Routes API
- `POST /routes/day-segment` - Calculate single day POI-to-POI segment

---

### 1.3 Static Map Image Generation

#### **Mapbox Static API Utilities** ⭐ **ALREADY IMPLEMENTED**
**File:** `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/mapboxStaticImage.js`

```javascript
buildTripOverviewMapUrl(destinations, token)
  → Mapbox Static API URL with markers for all destinations
  → Auto-bounds to fit all markers
  → Returns: https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/
             {markers}/auto/600x300@2x?access_token={token}&padding=40

buildDestinationMapUrl(lng, lat, token, zoom=11)
  → Single destination centered map
  → Returns: https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/
             {marker}/{lng},{lat},{zoom}/600x300@2x?access_token={token}

fetchMapAsBase64(url)
  → Fetches map image and converts to base64 data URI for PDF embedding
  → Returns: data:image/png;base64,... or undefined on error
```

**Current PDF Usage:**
- `markdownToPDF.jsx` receives map image as `mapImageDataUri`
- Displayed at top of each PDF page via `<Image>` component from react-pdf
- Style: `mapImage: { width: '100%', height: 160, objectFit: 'cover', ... }`

**Current Implementation Flow:**
```
exportTripAsPDFs()
  ↓
  Step 1: Pre-fetch all map images in parallel
    - For each document:
      - Get overview map OR destination-specific map URL
      - fetchMapAsBase64() each URL → base64 data URIs
  ↓
  Step 2: Generate PDF blobs
    - markdownToPDFDocument(content, mapImageDataUri, title, tripName)
    - react-pdf renders markdown + embedded image
  ↓
  Step 3: ZIP and download
```

---

## 2. ROUTE DATA AVAILABILITY AT PDF EXPORT TIME

### 2.1 What Data Is Available?

**Via Zustand Stores:**
- `useDayRoutesStore.getState().dayRoutes` - All calculated day routes with geometry
- `useExportWriterStore.getState().documents` - Export-draft documents with destinationId
- `useTripStore.getState()` - Trip metadata
- `useDestinationStore.getState()` - Destinations with coordinates

**Via Props to ExportWriter:**
- `trip`: Trip object
- `destinations`: Array of destination objects with lat/lng

### 2.2 Route Geometry Format

All routes stored as **GeoJSON LineString:**
```javascript
geometry: {
  type: 'LineString',
  coordinates: [[lng, lat], [lng, lat], ...] // GeoJSON order!
}
```

---

## 3. TECHNICAL OPTIONS FOR ROUTE IMAGES

### Option A: Mapbox Static API (Route Polyline Overlay) ⭐ **RECOMMENDED - LOWEST FRICTION**

**Implementation:**
```javascript
// Build Mapbox Static API URL with route polyline
function buildRouteMapUrl(geometry, startPoi, endPoi, token) {
  const encoded = encodeRoutePolyline(geometry.coordinates);
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/
          pin-s+00FF00(${startPoi.lng},${startPoi.lat}),
          pin-s+FF0000(${endPoi.lng},${endPoi.lat}),
          path-5+F74E4E-0.75(${encoded})/
          auto/800x400@2x?access_token=${token}`;
}
```

**Pros:**
- ✅ **Already have Mapbox token integration** (via MapboxContext)
- ✅ Static images already fetched & converted to base64 in pdfExport.js
- ✅ Simple URL construction
- ✅ Supports multiple routes overlaid
- ✅ Markers for start/end POIs
- ✅ **Reuses existing `fetchMapAsBase64()` function**

**Cons:**
- ❌ Mapbox Static API has polyline encoding complexity
- ❌ URL length limits (~2000 chars)
- ❌ Not in current code — new implementation needed

**Effort:** LOW (2-3 hours)

**Concrete Files to Modify:**
1. Extend `mapboxStaticImage.js`:
   ```javascript
   export function buildDayRouteMapUrl(dayRoute, token, zoom='auto') {
     // Encode route coordinates as polyline
     // Build static URL with markers + polyline
     // Return URL
   }
   ```
2. Update `pdfExport.js` export flow to fetch route maps for destination documents

---

### Option B: Google Maps Static API (Route Directions) ⭐ **ALTERNATIVE - NEEDS API KEY**

**Implementation:**
```javascript
function buildGoogleMapsStaticUrl(origin, destination, waypoints, apiKey) {
  return `https://maps.googleapis.com/maps/api/staticmap?
    center=${destination.lat},${destination.lng}
    &zoom=12
    &size=800x400
    &markers=color:green|${origin.lat},${origin.lng}
    &markers=color:red|${destination.lat},${destination.lng}
    &path=color:0xff0000ff|weight:2|
      ${origin.lat},${origin.lng}|...
    &key=${apiKey}`;
}
```

**Pros:**
- ✅ Google Maps visual style (familiar to users)
- ✅ Already integrated for routing (Google Maps Routes API endpoint exists)
- ✅ Can add markers, paths, styles
- ✅ Renders actual roads/directions

**Cons:**
- ❌ Requires separate API key (`GOOGLE_MAPS_STATIC_API_KEY`)
- ❌ Billing per image request
- ❌ More complex configuration
- ❌ URL encoding of paths is complex

**Effort:** MEDIUM (3-4 hours)

**Cost:** $2 per 1000 static map requests (add to existing Google Maps billing)

---

### Option C: Canvas/Screenshot Rendering (Client-Side) ⭐ **COMPLEX - NOT RECOMMENDED**

**Concept:**
- Render route on hidden canvas using Mapbox GL
- Convert canvas to blob
- Embed in PDF

**Pros:**
- ✅ Complete visual control
- ✅ No external dependencies beyond Mapbox GL (already in use)
- ✅ Works offline

**Cons:**
- ❌ **Very complex:** Mapbox GL canvas rendering requires special setup
- ❌ Playwright tests already in use — implies headless rendering issues expected
- ❌ Performance: blocks main thread, slow for many routes
- ❌ 500+ lines of code for reliable implementation
- ❌ Browser CORS issues with canvas → blob conversion

**Effort:** VERY HIGH (8-12 hours)

---

### Option D: Server-Side Image Generation (Backend) 🚀 **BEST FOR SCALABILITY**

**Implementation:**
```python
# Backend new endpoint
@router.post("/routes/static-image")
async def generate_route_static_image(
    route_geometry: GeoJSON,
    start_poi: POI,
    end_poi: POI,
    style: str = "mapbox"
) -> bytes:
    """Generate route image server-side, return PNG bytes."""
    
    if style == "mapbox":
        # Call Mapbox Static API
        # Return PNG bytes
    elif style == "google":
        # Call Google Maps Static API
        # Return PNG bytes
    
    # Cache result
    return png_bytes
```

**Pros:**
- ✅ Centralized, no client-side complexity
- ✅ Easy caching
- ✅ Supports batch requests
- ✅ Can render complex visualizations (Pillow, etc.)
- ✅ Resilient: retry logic, fallbacks built in

**Cons:**
- ❌ Additional backend endpoint to maintain
- ❌ API key management complexity
- ❌ Adds latency to export process
- ❌ Requires new dependencies if doing custom rendering (Pillow, etc.)

**Effort:** MEDIUM-HIGH (4-6 hours)

---

## 4. GOOGLE MAPS DIRECTIONS LINKS FOR PDF

### 4.1 Current Implementation

**Already have working export to Google Maps:**
```javascript
// Frontend: utils/googleMaps.js
generateGoogleMapsUrl(origin, destination, waypoints, travelMode)

// Backend: services/google_maps_service.py
generate_directions_url(origin, destination, waypoints, travel_mode)

// API: POST /routes/export/google-maps
```

**URL Format:**
```
https://www.google.com/maps/dir/?api=1
  &origin=40.7128,-74.0060
  &destination=34.0522,-118.2437
  &waypoints=37.7749,-122.4194
  &travelmode=driving
```

### 4.2 Embedding Links in PDF

**Option: Clickable Links in Markdown**

User can add to markdown content:
```markdown
[Open in Google Maps](https://www.google.com/maps/dir/?api=1...)
```

The `markdownToPDF.jsx` parser **already handles link extraction** but strips them:
```javascript
// Current code (line 18):
.replace(/\[(.+?)\]\(.+?\)/g, '$1')  // Removes link URLs!
```

**Recommendation:** Modify to preserve links in PDF:

1. **Modify `markdownToPDF.jsx`:**
   ```javascript
   case 'link': {
     elements.push(
       <Link key={idx} src={token.href} style={styles.link}>
         <Text style={styles.linkText}>{token.text}</Text>
       </Link>
     );
     break;
   }
   ```

2. **Add to `PDFStyles.js`:**
   ```javascript
   link: {
     color: '#0284C7',
     textDecoration: 'underline',
   }
   ```

**Alternative: Auto-Generate Section in Export Writer**

Add automatic "Route Links" section to export drafts:
```markdown
## Navigate This Route

- [Google Maps (Driving)](https://maps.google.com/...)
- [Google Maps (Walking)](https://maps.google.com/...)
- [Google Maps (Transit)](https://maps.google.com/...)
```

---

## 5. RECOMMENDED IMPLEMENTATION STRATEGY

### 5.1 Phase 1: Route Map Images (Quick Win)

**Goal:** Embed Mapbox static route map images in PDFs alongside existing destination overview maps

**Implementation Steps:**

1. **Extend `mapboxStaticImage.js`:**
   ```javascript
   export async function buildAndFetchDayRouteMap(dayRoute, token) {
     if (!token || !dayRoute?.geometry?.coordinates) return undefined;
     
     const coords = dayRoute.geometry.coordinates;
     const markers = [
       `pin-s+00FF00(${dayRoute.pois[0].longitude},${dayRoute.pois[0].latitude})`,
       `pin-s+FF0000(${dayRoute.pois[-1].longitude},${dayRoute.pois[-1].latitude})`
     ];
     
     const encodedPolyline = encodePolyline(coords);
     const pathString = `path-3+D97706-0.7(${encodedPolyline})`;
     
     const url = `${MAPBOX_STATIC_BASE}/${markers.join(',')},${pathString}/auto/800x400@2x?access_token=${token}&padding=50`;
     
     return fetchMapAsBase64(url);
   }
   ```

2. **Update `pdfExport.js`:**
   ```javascript
   const mapImagePromises = selectedDocuments.map(async (doc) => {
     let dataUri = undefined;
     
     if (!doc.destinationId) {
       // Overview map (existing code)
       url = buildTripOverviewMapUrl(destinations, mapboxToken);
     } else {
       // Get day route for this destination
       const destId = doc.destinationId;
       const dayRoute = useDayRoutesStore.getState().dayRoutes[destId];
       if (dayRoute?.geometry?.coordinates?.length > 1) {
         dataUri = await buildAndFetchDayRouteMap(dayRoute, mapboxToken);
       }
       if (!dataUri) {
         // Fallback to destination pin map
         url = buildDestinationMapUrl(dest.longitude, dest.latitude, mapboxToken);
       }
     }
     
     if (!dataUri && url) dataUri = await fetchMapAsBase64(url);
     return [doc.id, dataUri];
   });
   ```

3. **Update `markdownToPDF.jsx`:**
   - Already handles image rendering
   - No changes needed

**Effort:** LOW (3-4 hours)
**Risk:** LOW (reuses proven Mapbox code)
**User Value:** HIGH (visual route preview in PDFs)

---

### 5.2 Phase 2: Clickable Google Maps Links

**Goal:** Auto-generate Google Maps directions links in export documents

**Implementation Steps:**

1. **Create utility function** in `utils/googleMaps.js`:
   ```javascript
   export function generateDayRouteLinks(dayRoute, availableModes = ['driving', 'walking']) {
     const pois = dayRoute.pois;
     if (!pois || pois.length < 2) return '';
     
     const origin = { lat: pois[0].latitude, lng: pois[0].longitude };
     const dest = { lat: pois[-1].latitude, lng: pois[-1].longitude };
     const waypoints = pois.slice(1, -1).map(p => ({ lat: p.latitude, lng: p.longitude }));
     
     return availableModes.map(mode => {
       const url = generateGoogleMapsUrl(origin, dest, waypoints, mode);
       return `[${mode.charAt(0).toUpperCase() + mode.slice(1)}](${url})`;
     }).join(' • ');
   }
   ```

2. **Modify `WritingAssistantPanel.jsx`** to offer "Insert Route Links" action

3. **Or auto-inject into document** in Export Writer:
   ```javascript
   const routeLinksSection = `
   ## Navigate This Route
   
   ${generateDayRouteLinks(dayRoute, ['driving', 'walking'])}
   `;
   ```

**Effort:** LOW (2-3 hours)
**Risk:** LOW (simple string generation)
**User Value:** MEDIUM (convenience feature)

---

### 5.3 Phase 3 (Optional): Enhanced Route Visualization

**Goal:** Add Google Maps Static API fallback + day-by-day route segmentation

- Requires Google Maps Static API key addition
- Condition: `if (mapbox fails) fallback to google`
- Effort: MEDIUM (additional 2-3 hours)

---

## 6. CONCRETE FILES TO MODIFY/CREATE

| File | Action | Rationale |
|------|--------|-----------|
| `frontend/src/utils/mapboxStaticImage.js` | **Extend** | Add `buildAndFetchDayRouteMap()` function |
| `frontend/src/utils/pdfExport.js` | **Modify** | Fetch day route maps for destination docs |
| `frontend/src/utils/googleMaps.js` | **Extend** | Add `generateDayRouteLinks()` function |
| `frontend/src/utils/markdownToPDF.jsx` | **No change** | Already handles image rendering |
| `frontend/src/components/ExportWriter/WritingAssistantPanel.jsx` | **Optional** | Add "Insert Route Links" action |
| `frontend/src/stores/useExportWriterStore.js` | **No change** | Already exposes documents |
| `backend: app/api/routes.py` | **No change** | Existing endpoints sufficient |

---

## 7. API ENDPOINTS TO LEVERAGE

### Frontend-accessible endpoints (already integrated):

- `POST /routes/day-segment` - Calculate day segment geometry
- `POST /routes/export/google-maps` - Generate Google Maps URL
- `POST /routes/google-maps/multi-waypoint` - Full day route via Google Maps Routes API

### Context/Config:
- **Mapbox Token:** Available via `useMapboxToken()` hook
- **Trip Data:** Available via `useTripStore`, passed to ExportWriter
- **Day Routes:** Available via `useDayRoutesStore().dayRoutes`
- **Destinations:** Passed to `exportTripAsPDFs()` function

---

## 8. CONSTRAINTS & TRADE-OFFS

| Constraint | Impact | Mitigation |
|-----------|--------|-----------|
| **Mapbox Static API polyline URL limits** | Routes with 1000+ coordinate points may exceed URL length | Simplify polyline (decimate coordinates) or use Option D |
| **No existing route image generation** | Must build new code | Start with Phase 1 (simple, proven Mapbox approach) |
| **Export happens client-side** | Large images slow down export | Lazy-load images, show progress |
| **Multiple routing backends** | Day routes may use Google/Mapbox/ORS | Store provider info with geometry for consistency |
| **User may not have Mapbox token** | Route images unavailable | Graceful fallback to text-only route summary |

---

## 9. CONCRETE NEXT STEPS

### Recommended: Start with Phase 1

1. **Time estimate:** 3-4 hours development
2. **Complexity:** LOW
3. **Risk:** LOW
4. **Unblocking factor:** None — all dependencies already in codebase

**Development sequence:**
1. Create `buildAndFetchDayRouteMap()` in `mapboxStaticImage.js`
2. Update `pdfExport.js` to call it
3. Test with sample trip
4. Add to `useDayRoutesStore` integration

**File locations:**
- Start: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/mapboxStaticImage.js`
- Modify: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/pdfExport.js`
- Test: Run existing e2e export tests

---

## 10. APPENDIX: Mapbox Static API Polyline Encoding

Mapbox requires polyline coordinates to be URL-encoded. Use an existing library or implement:

```javascript
// Use existing npm package: polyline-encoded
// OR simple inline implementation:
function encodePolyline(coordinates) {
  // See: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  // Simplified version for reference
  const encoded = coordinates.map(([lng, lat]) => 
    `${Math.round(lat * 1e5)},${Math.round(lng * 1e5)}`
  ).join('|');
  return encoded;
}
```

**Note:** Mapbox Static API documentation:
https://docs.mapbox.com/api/maps/static/
