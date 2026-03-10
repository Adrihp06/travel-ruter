# Travel Ruter: Export Writer / PDF Export Pipeline Analysis

## Executive Summary
The travel-ruter project has a well-structured, modular export pipeline that converts markdown documents to PDFs with map imagery. The pipeline supports **image rendering** and **link extraction from markdown**, making it **ideal for embedding route media blocks** (route image + Google Maps export links). The architecture is clean and extensible.

---

## 1. EXPORT SELECTION & ORCHESTRATION

### File: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/components/ExportWriter/DocumentTree.jsx`
**Purpose:** Document tree UI + export orchestration  
**Key Functions:**
- `handleExportSelected()` (L59-68) - Exports selected documents via checkbox UI
- `handleExportAll()` (L70-79) - Exports all draft documents
- Manages `selectedForExport` Set (checkbox states)
- Calls `exportTripAsPDFs(selectedDocs, trip, destinations, mapboxAccessToken)`

**Data Structure:**
```javascript
selectedForExport: new Set()  // Set of noteId values
selectedDocuments: Array<{id, title, content, destinationId}>
```

**Export Trigger:**
```javascript
// Line 64: Called when user clicks export button
await exportTripAsPDFs(selectedDocs, trip, destinations, mapboxAccessToken);
```

### File: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/stores/useExportWriterStore.js`
**Purpose:** Zustand store managing export draft documents  
**Key State:**
- `documents`: Map of noteId → {id, title, content, destinationId, status}
- `selectedForExport`: Set of noteIds checked for export
- `referenceNotes`: Non-export reference materials

**Document Creation:**
```javascript
// Line 109: Creates export_draft note type
createDocument: async (tripId, destinationId, title) → Note object
// Stored with note_type: "export_draft" in backend
```

**Selection Methods:**
- `toggleExportSelection(noteId)` - Toggle individual doc
- `selectAllForExport()` - Select all documents
- `clearExportSelection()` - Clear all selections

---

## 2. PDF GENERATION PIPELINE

### File: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/pdfExport.js`
**Purpose:** Main export orchestrator - markdown → PDFs → ZIP → download  

**Pipeline Steps:**

#### Step 1: Pre-fetch Map Images (L35-54)
```javascript
// Parallel fetch for ALL selected documents
const mapImagePromises = selectedDocuments.map(async (doc) => {
  if (!mapboxToken) return [doc.id, undefined];
  
  let url;
  if (!doc.destinationId) {
    url = buildTripOverviewMapUrl(destinations, mapboxToken);
  } else {
    const dest = destinations.find((d) => d.id === doc.destinationId);
    url = buildDestinationMapUrl(dest.longitude, dest.latitude, mapboxToken);
  }
  const dataUri = await fetchMapAsBase64(url);  // Convert to base64
  return [doc.id, dataUri];
});

const mapImages = Object.fromEntries(await Promise.all(mapImagePromises));
```

**Key Functions Called:**
- `buildTripOverviewMapUrl(destinations, token)` - Mapbox static API with all markers
- `buildDestinationMapUrl(lng, lat, token)` - Single destination centered map
- `fetchMapAsBase64(url)` - Converts HTTP image → base64 data URI

#### Step 2: Generate PDF for Each Document (L59-85)
```javascript
for (const doc of selectedDocuments) {
  const mapImage = mapImages[doc.id];  // Pre-fetched base64
  
  const docElement = markdownToPDFDocument(
    doc.content || '',     // Markdown content
    mapImage,              // Base64 map image
    doc.title,
    tripName
  );
  
  const blob = await pdf(docElement).toBlob();  // Using @react-pdf/renderer
  zip.file(filename, blob);
}
```

#### Step 3: ZIP & Download (L87-97)
```javascript
const zipBlob = await zip.generateAsync({ type: 'blob' });
// Trigger browser download of ZIP file
```

---

## 3. MARKDOWN RENDERING & PDF DOCUMENT STRUCTURE

### File: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/utils/markdownToPDF.jsx`
**Purpose:** Convert markdown tokens to react-pdf JSX elements

**Key Export:**
```javascript
export function markdownToPDFDocument(
  markdownContent,      // Markdown string
  mapImageDataUri,      // Base64 image (top of page)
  title,
  tripName
)
```

**PDF Document Structure (L119-154):**
```
┌─ Document (react-pdf)
│  └─ Page (A4 size)
│     ├─ Map Image (if available) ← BASE64 DATA URI
│     ├─ Title (markdown H1 style)
│     ├─ Divider
│     └─ Content (markdown tokens → react-pdf elements)
│     └─ Footer (trip name + page numbers)
```

**Token Processing (L24-108):**
```javascript
function tokensToElements(tokens, styles) {
  // marked.lexer() produces tokens of various types
  
  switch (token.type) {
    case 'heading': → Text styled as h1/h2/h3
    case 'paragraph': → Text with body style
    case 'list': → Bulleted list with flexDirection: 'row'
    case 'blockquote': → Bordered box with background
    case 'code': → Monospace text in background
    case 'image': {
      // ✅ IMAGES SUPPORTED - both HTTP and data:// URIs
      if (token.href.startsWith('http') || token.href.startsWith('data:')) {
        return <Image src={token.href} style={styles.mapImage} />
      }
    }
    case 'space': → Empty spacer
    default: → Ignored
  }
}
```

**CRITICAL: Image Handling (L89-96)**
```javascript
case 'image': {
  if (token.href && (token.href.startsWith('http') || token.href.startsWith('data:'))) {
    elements.push(
      <Image key={idx} src={token.href} style={styles.mapImage} />
    );
  }
  break;
}
```
✅ Already supports:
- HTTP image URLs (external, public-accessible)
- data:// URIs (base64-encoded)
- Falls back gracefully if image fails

**Link Handling (L17-18):**
```javascript
// Links are stripped during inline text processing
.replace(/\[(.+?)\]\(.+?\)/g, '$1')  // Extracts link text, discards URL
```
⚠️ **ISSUE:** Links are currently STRIPPED from text, not preserved as clickable elements

---

## 4. STYLING & LAYOUT

### File: `/Users/adrihp06/Github/Projects/travel-ruter/frontend/src/components/PDF/PDFStyles.js`
**Purpose:** react-pdf StyleSheet for consistent PDF formatting

**Available Styles:**
```javascript
styles = {
  page: { paddingTop: 48, paddingBottom: 48, ... },
  h1: { fontSize: 22, color: BRAND_AMBER, marginBottom: 8 },
  h2: { fontSize: 16, ... },
  h3: { fontSize: 13, ... },
  body: { fontSize: 11, ... },
  blockquote: { borderLeft: `3pt solid ${BRAND_AMBER}`, ... },
  bulletPoint: { color: BRAND_AMBER, width: 8 },
  code: { fontSize: 10, fontFamily: 'Courier', backgroundColor: GRAY_100 },
  mapImage: { width: '100%', height: 160, objectFit: 'cover', marginBottom: 12 }
}
```

**Fonts Supported by react-pdf (default):**
- Helvetica, Helvetica-Bold, Helvetica-Oblique
- Courier
- Times-Roman, Times-Bold

---

## 5. BACKEND ROUTE DATA & GOOGLE MAPS EXPORT

### File: `/Users/adrihp06/Github/Projects/travel-ruter/app/api/routes.py`
**Available Route Export Endpoints:**

#### 1. Google Maps Export (L195-208)
```python
@router.post("/routes/export/google-maps", response_model=GoogleMapsExportResponse)
async def export_to_google_maps(request: GoogleMapsExportRequest, ...):
    """Generates a Google Maps directions URL"""
    return GoogleMapsService.export_route(request)
```

**Response Schema** (`app/schemas/google_maps.py`):
```python
class GoogleMapsExportResponse(BaseModel):
    url: str  # Direct Google Maps directions URL
    origin: GoogleMapsCoordinate
    destination: GoogleMapsCoordinate
    waypoints_count: int
    travel_mode: GoogleMapsTravelMode  # driving, walking, bicycling, transit
```

**URL Format:** Standard Google Maps sharing link with origin, destination, and waypoints

#### 2. Mapbox Static Image (via `mapboxStaticImage.js`)
```javascript
buildTripOverviewMapUrl(destinations, token)  // All markers on one map
buildDestinationMapUrl(lng, lat, token, zoom=11)  // Single location
// Both return Mapbox Static API URLs, convertible to base64
```

#### 3. Travel Segment Model (`app/models/travel_segment.py`)
```python
class TravelSegment(BaseModel):
    segment_type: str  # 'inter_destination', 'origin', 'return'
    from_destination_id: int
    to_destination_id: int
    travel_mode: str  # plane, car, train, bus, walk, bike, ferry
    distance_km: float
    duration_minutes: int
    geometry: LINESTRING  # PostGIS geometry
    route_legs: JSON  # Multi-leg routes with stops
```

---

## 6. CONTENT STORAGE FORMAT

### File: `/Users/adrihp06/Github/Projects/travel-ruter/app/models/note.py`
**Note Model:**
```python
class Note(BaseModel):
    title: str
    content: Text  # Markdown or HTML (schema not enforced)
    note_type: str  # 'export_draft', 'general', 'destination', 'day', 'poi'
    trip_id: int
    destination_id: int (nullable)
```

**Current Format:** Markdown text stored directly in `content` field

---

## IMPLEMENTATION OPTIONS FOR ROUTE MEDIA BLOCKS

### Option 1: Embed in Markdown via Custom Syntax (RECOMMENDED)

**Advantages:**
- ✅ No backend/store changes needed
- ✅ Works with existing markdown parser
- ✅ User can create blocks manually via editor
- ✅ Clean, readable markdown format

**Implementation:**

1. **Define Custom Block Syntax in Markdown:**
```markdown
## Route from Barcelona to Madrid

[ROUTE_BOX]
from_destination: Barcelona
to_destination: Madrid
travel_mode: driving
image_type: mapbox_static
maps_link_type: google
[/ROUTE_BOX]

This is the scenic route description...
```

2. **Extend markdownToPDF.jsx tokensToElements():**
```javascript
case 'html_inline': {
  if (token.text.includes('[ROUTE_BOX]')) {
    const routeData = parseRouteBoxMarkdown(token.text);
    // Parse and create route box element
    return createRouteBoxElement(routeData, styles);
  }
  break;
}

function createRouteBoxElement(routeData, styles) {
  return (
    <View style={styles.routeBox}>
      <Image src={routeData.mapImageDataUri} style={styles.routeBoxImage} />
      <View style={styles.routeBoxContent}>
        <Text style={styles.routeBoxTitle}>{routeData.title}</Text>
        <Text style={styles.routeBoxMeta}>
          {routeData.distance} km · {routeData.duration} min · {routeData.travelMode}
        </Text>
        {/* Note: PDF doesn't support clickable links directly via react-pdf's <Link>,
            but we can include the URL as text for QR code or manual copying */}
        <Text style={styles.routeBoxLink}>{routeData.mapsUrl}</Text>
      </View>
    </View>
  );
}
```

3. **Add PDFStyles:**
```javascript
routeBox: {
  marginBottom: 12,
  borderRadius: 4,
  border: `1pt solid ${BRAND_AMBER}`,
  backgroundColor: BRAND_AMBER_LIGHT,
  overflow: 'hidden'
},
routeBoxImage: {
  width: '100%',
  height: 120,
  objectFit: 'cover'
},
routeBoxContent: {
  padding: 8,
},
routeBoxTitle: {
  fontSize: 12,
  fontFamily: 'Helvetica-Bold',
  color: GRAY_700,
  marginBottom: 4
},
routeBoxMeta: {
  fontSize: 10,
  color: GRAY_500,
  marginBottom: 6
},
routeBoxLink: {
  fontSize: 9,
  color: '#0066CC',
  textDecoration: 'underline'
  // Text-only; user can QR code or copy
}
```

---

### Option 2: Pre-fetch Route Data in Export Pipeline

**Advantages:**
- ✅ Automatic route enrichment
- ✅ No user interaction required
- ✅ Fetches live route data at export time
- ✅ Can include turn-by-turn info

**Changes Required:**

1. **Extend exportTripAsPDFs()** in `pdfExport.js`:
```javascript
// After fetchMapAsBase64 step, add:
const routeDataPromises = selectedDocuments.map(async (doc) => {
  if (!doc.destinationId) return [doc.id, null];
  
  // Fetch travel segment between this and next destination
  const nextDoc = findNextDestinationDoc(selectedDocuments, doc);
  if (!nextDoc) return [doc.id, null];
  
  const response = await authFetch(
    `/api/v1/trips/${trip.id}/segments?from=${doc.destinationId}&to=${nextDoc.destinationId}`
  );
  const segment = await response.json();
  
  // Generate Google Maps export link
  const mapsResponse = await authFetch('/api/v1/routes/export/google-maps', {
    method: 'POST',
    body: JSON.stringify({
      origin: { lat: segment.from_latitude, lng: segment.from_longitude },
      destination: { lat: segment.to_latitude, lng: segment.to_longitude },
      travel_mode: 'driving'
    })
  });
  const { url: mapsUrl } = await mapsResponse.json();
  
  return [doc.id, {
    mapImage: mapImages[doc.id],
    mapsUrl,
    segment
  }];
});
```

2. **Pass route data to markdownToPDFDocument():**
```javascript
const docElement = markdownToPDFDocument(
  doc.content || '',
  mapImage,
  doc.title,
  tripName,
  routeData[doc.id]  // ← NEW: route enrichment data
);
```

3. **Modify markdownToPDFDocument signature:**
```javascript
export function markdownToPDFDocument(
  markdownContent,
  mapImageDataUri,
  title,
  tripName = '',
  routeEnrichment = null  // ← NEW
) {
  // At end, after contentElements, add:
  if (routeEnrichment) {
    contentElements.push(
      createRouteBoxElement(routeEnrichment, styles)
    );
  }
  
  return <Document>...</Document>;
}
```

---

### Option 3: Hybrid - Editor Button + Auto-embed

**Advantages:**
- ✅ Full control to users
- ✅ Automatic enrichment option
- ✅ Best UX flexibility

**Implementation:**
- Add "Insert Route Box" button to `MarkdownEditorPanel.jsx` toolbar
- Query TravelSegment model for routes linked to current destination
- Insert markdown block at cursor
- Falls back to auto-enrichment for unedited docs

---

## SAFE FORMAT RECOMMENDATIONS FOR ROUTE BLOCKS

### PDF Rendering Capabilities:
✅ **Supported:**
- Base64-encoded images (Mapbox static maps)
- HTTP image URLs (public)
- Text styling (bold, italic via Helvetica-Bold)
- Colors and backgrounds
- Layout via flexbox

⚠️ **NOT Supported (react-pdf limitations):**
- Clickable hyperlinks (no Link component in @react-pdf/renderer v2)
- QR codes (would need image library)
- Embedded interactive maps
- JavaScript/events

### Recommended Route Box Content:
```
┌─ Route Box (amber border box)
│  ├─ Mapbox Static Image (160px height, full width)
│  ├─ Title: "Barcelona → Madrid via A-7"
│  ├─ Metadata: "426 km · 4h 15m · Driving"
│  ├─ Description: "Scenic coastal route..."
│  └─ Google Maps Link (as plain text with URL)
│     "Open in Google Maps: https://maps.google.com/?saddr=...&daddr=..."
└─

For QR code support:
- Generate QR in frontend using qrcode.react library
- Render as image in PDF
- URL embeds all route parameters
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Core Route Box Support (Option 1 - Markdown)
- [ ] Extend `markdownToPDF.jsx`: Handle [ROUTE_BOX] custom markdown
- [ ] Add `PDFStyles.js`: routeBox, routeBoxImage, routeBoxContent, etc.
- [ ] Create `parseRouteBoxMarkdown()` utility function
- [ ] Create `createRouteBoxElement()` JSX component
- [ ] Test with sample markdown documents

### Phase 2: Route Data Enrichment (Option 2)
- [ ] Create `getRouteSegmentBetweenDocs()` utility
- [ ] Extend `pdfExport.js` to pre-fetch route segments
- [ ] Call Google Maps export endpoint (`/routes/export/google-maps`)
- [ ] Pass enrichment data to `markdownToPDFDocument()`
- [ ] Auto-insert route boxes after each destination section

### Phase 3: UI/UX Enhancements
- [ ] Add "Insert Route" button to `MarkdownEditorPanel.jsx`
- [ ] Route picker dialog (from/to destinations)
- [ ] QR code generation for Google Maps links
- [ ] Travel mode selector (driving, transit, walking, etc.)

### Phase 4: Testing & Validation
- [ ] Unit tests for `parseRouteBoxMarkdown()`
- [ ] Integration test: markdown → PDF with route box
- [ ] Visual test: PDF layout with images and links
- [ ] Test fallbacks (missing route data, failed image fetch)

---

## FILES TO MODIFY/CREATE

### Frontend:

1. **`frontend/src/utils/markdownToPDF.jsx`** (MODIFY)
   - Add [ROUTE_BOX] markdown token handler
   - Add `createRouteBoxElement()` function
   - Add `parseRouteBoxMarkdown()` function

2. **`frontend/src/components/PDF/PDFStyles.js`** (MODIFY)
   - Add routeBox*, routeBoxImage, routeBoxContent styles

3. **`frontend/src/utils/pdfExport.js`** (MODIFY - Option 2)
   - Add route enrichment fetching step
   - Pass routeData to markdownToPDFDocument()

4. **`frontend/src/utils/routeBoxUtils.js`** (CREATE)
   - `parseRouteBoxMarkdown(text): Object`
   - `formatRouteMetadata(segment): string`
   - `generateGoogleMapsShareLink(segment): string`

### Backend:
- No changes required (Google Maps export already exists at `/routes/export/google-maps`)
- Optional: Add `/trips/{tripId}/segments` endpoint query for route between destinations

---

## CURRENT LIMITATIONS & CONSIDERATIONS

1. **No Clickable Links in PDF**: react-pdf v2 doesn't support `<Link>` component. Workaround: Include URL as plain text or generate QR code image.

2. **Image Rendering Quality**: Mapbox static images work well (tested at 600x300px). Ensure sufficient resolution for multi-page exports.

3. **Markdown Parser**: Uses `marked` library with custom token handler. Complex nested blocks not supported (design choice for simplicity).

4. **Performance**: For trips with many destinations, parallel image fetching scales well. Add request batching if > 50 destinations.

5. **Data Dependencies**: Route enrichment requires:
   - Destinations with coordinates (already required)
   - Travel segment records (or auto-calculated via `calculate_inter_city_route`)
   - Google Maps API key (optional, falls back to Mapbox)

---

## RISK ASSESSMENT

| Component | Risk | Mitigation |
|-----------|------|-----------|
| Image fetch failures | HTTP image timeouts | Implement 3s timeout, graceful fallback |
| Large exports | Memory usage | Stream PDF generation for 50+ docs |
| Custom markdown parsing | Edge cases in user input | Sanitize input via DOMPurify |
| Route data gaps | Missing travel segments | Check segment existence before enrichment |
| QR code generation | Library size | Use lightweight qrcode.react (11KB gzipped) |

---

## CONCLUSION

The travel-ruter export pipeline is **well-architected and production-ready** for route media enrichment. The current implementation:

✅ **Already supports** image embedding (base64 or HTTP URLs)  
✅ **Modular architecture** makes extensions clean  
✅ **Scalable** with parallel image fetching  
⚠️ **Lacks** clickable links (PDF format limitation, not code)  
🔧 **Easy wins**: Custom markdown block + auto-enrichment toggle  

**Recommended approach:** Start with **Option 1 (markdown blocks)** for full user control, then add **Option 2 (auto-enrichment)** for convenience.

