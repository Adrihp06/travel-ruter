/**
 * Route block rendering helpers for the PDF export pipeline.
 *
 * Resolves route block shortcodes (from routeBlockContract) into renderable
 * data for the PDF: map images, Google Maps links, and route metadata.
 *
 * Integration flow:
 *   1. resolveRouteBlocksForExport() parses route blocks from markdown
 *   2. Each block is replaced with a sentinel: <!-- ROUTE_CARD:N -->
 *   3. Map images are fetched in parallel
 *   4. markdownToPDFDocument() detects sentinels and renders route cards
 */

import {
  parseRouteBlocks,
  replaceRouteBlocks,
  buildRouteMapUrl,
  ROUTE_BLOCK_TYPE,
} from './routeBlockContract';
import {
  buildTripOverviewMapUrl,
  buildDestinationMapUrl,
  fetchMapAsBase64,
} from './mapboxStaticImage';
import { generateGoogleMapsUrl, GoogleMapsTravelMode } from './googleMaps';
import authFetch from './authFetch';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const DEFAULT_DAY_ROUTE_MODE = 'walking';

function toGoogleMapsTravelMode(mode) {
  switch (mode) {
    case 'walk':
    case 'walking':
      return GoogleMapsTravelMode.WALKING;
    case 'bike':
    case 'bicycling':
    case 'cycling':
      return GoogleMapsTravelMode.BICYCLING;
    case 'train':
    case 'bus':
    case 'transit':
      return GoogleMapsTravelMode.TRANSIT;
    default:
      return GoogleMapsTravelMode.DRIVING;
  }
}

// ---------------------------------------------------------------------------
// Sentinel pattern (used by markdownToPDF to detect route card placeholders)
// ---------------------------------------------------------------------------

/** Regex to detect route card sentinels injected into processed markdown. */
export const ROUTE_CARD_SENTINEL_RE = /<!--\s*ROUTE_CARD:(\d+)\s*-->/;

function isFiniteCoordinatePair(coordinate) {
  return Array.isArray(coordinate)
    && coordinate.length >= 2
    && Number.isFinite(coordinate[0])
    && Number.isFinite(coordinate[1]);
}

function appendCoordinates(target, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return;
  }

  coordinates.forEach((coordinate, index) => {
    if (!isFiniteCoordinatePair(coordinate)) {
      return;
    }

    const [lng, lat] = coordinate;
    const last = target[target.length - 1];
    if (index === 0 && last && last[0] === lng && last[1] === lat) {
      return;
    }

    target.push([lng, lat]);
  });
}

function getCoordinatePairFromLocation(location) {
  if (!location) {
    return null;
  }

  const lng = location.longitude ?? location.lng ?? location.from_longitude ?? location.to_longitude;
  const lat = location.latitude ?? location.lat ?? location.from_latitude ?? location.to_latitude;

  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

function flattenPoisResponse(data) {
  if (!data) {
    return [];
  }

  const items = Array.isArray(data) ? data : (data.items || []);
  if (items.length === 0) {
    return [];
  }

  if (Array.isArray(items[0]?.pois)) {
    return items.flatMap((group) => group.pois || []);
  }

  return items;
}

async function loadTripSegments(tripId, context = {}) {
  if (!tripId) {
    return [];
  }

  if (typeof context.loadTripSegments === 'function') {
    const segments = await context.loadTripSegments(tripId);
    return Array.isArray(segments) ? segments : [];
  }

  const cache = context.cache?.tripSegments;
  if (cache?.has(tripId)) {
    return cache.get(tripId);
  }

  const promise = (async () => {
    const response = await authFetch(`${API_BASE_URL}/trips/${tripId}/travel-segments?include_origin_return=false`);
    if (!response.ok) {
      throw new Error('Failed to load trip travel segments');
    }

    const data = await response.json();
    return Array.isArray(data?.segments) ? data.segments : [];
  })().catch(() => []);

  cache?.set(tripId, promise);
  return promise;
}

async function loadDestinationPois(destinationId, context = {}) {
  if (!destinationId) {
    return [];
  }

  if (typeof context.loadDestinationPois === 'function') {
    const pois = await context.loadDestinationPois(destinationId);
    return Array.isArray(pois) ? pois : [];
  }

  const cache = context.cache?.destinationPois;
  if (cache?.has(destinationId)) {
    return cache.get(destinationId);
  }

  const promise = (async () => {
    const response = await authFetch(`${API_BASE_URL}/destinations/${destinationId}/pois`);
    if (!response.ok) {
      throw new Error('Failed to load destination POIs');
    }

    const data = await response.json();
    return flattenPoisResponse(data);
  })().catch(() => []);

  cache?.set(destinationId, promise);
  return promise;
}

async function loadDayRouteData(descriptor, context = {}) {
  if (!descriptor?.destinationId || !descriptor?.date) {
    return {
      mapCoordinates: null,
      navigationCoordinates: null,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: 0,
      totalDistanceKm: null,
      totalDurationMin: null,
      stops: null,
    };
  }

  if (typeof context.loadDayRoute === 'function') {
    const result = await context.loadDayRoute(descriptor);
    return {
      mapCoordinates: Array.isArray(result?.mapCoordinates) ? result.mapCoordinates : null,
      navigationCoordinates: Array.isArray(result?.navigationCoordinates) ? result.navigationCoordinates : null,
      travelMode: result?.travelMode || GoogleMapsTravelMode.WALKING,
      stopCount: Number.isFinite(result?.stopCount) ? result.stopCount : 0,
      totalDistanceKm: Number.isFinite(result?.totalDistanceKm) ? result.totalDistanceKm : null,
      totalDurationMin: Number.isFinite(result?.totalDurationMin) ? result.totalDurationMin : null,
      stops: Array.isArray(result?.stops) ? result.stops : null,
    };
  }

  const cacheKey = `${descriptor.destinationId}:${descriptor.date}`;
  const cache = context.cache?.dayRoutes;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const promise = (async () => {
    const scheduledPois = (await loadDestinationPois(descriptor.destinationId, context))
      .filter((poi) => poi?.scheduled_date === descriptor.date)
      .sort((a, b) => (a.day_order || 0) - (b.day_order || 0));

    const navigationCoordinates = scheduledPois
      .map((poi) => getCoordinatePairFromLocation(poi))
      .filter(Boolean);

    // Extract stop metadata for Google Maps URL construction
    const stops = scheduledPois
      .filter((poi) => getCoordinatePairFromLocation(poi))
      .map((poi) => ({
        name: poi.name || null,
        placeId: poi.external_source === 'google_places' ? poi.external_id : null,
      }));

    if (navigationCoordinates.length === 0) {
      return {
        mapCoordinates: null,
        navigationCoordinates: null,
        travelMode: GoogleMapsTravelMode.WALKING,
        stopCount: 0,
        totalDistanceKm: null,
        totalDurationMin: null,
        stops: null,
      };
    }

    if (navigationCoordinates.length === 1) {
      return {
        mapCoordinates: navigationCoordinates,
        navigationCoordinates,
        travelMode: GoogleMapsTravelMode.WALKING,
        stopCount: 1,
        totalDistanceKm: null,
        totalDurationMin: null,
        stops,
      };
    }

    const mapCoordinates = [];
    let totalDistanceKm = 0;
    let totalDurationMin = 0;

    for (let index = 0; index < scheduledPois.length - 1; index += 1) {
      const fromPoi = scheduledPois[index];
      const toPoi = scheduledPois[index + 1];

      const response = await authFetch(`${API_BASE_URL}/routes/day-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_lat: fromPoi.latitude,
          origin_lng: fromPoi.longitude,
          destination_lat: toPoi.latitude,
          destination_lng: toPoi.longitude,
          mode: DEFAULT_DAY_ROUTE_MODE,
        }),
      });

      if (!response.ok) {
        appendCoordinates(mapCoordinates, [
          [fromPoi.longitude, fromPoi.latitude],
          [toPoi.longitude, toPoi.latitude],
        ]);
        continue;
      }

      const segment = await response.json();
      appendCoordinates(mapCoordinates, segment?.geometry?.coordinates);
      if (Number.isFinite(segment?.distance_km)) {
        totalDistanceKm += segment.distance_km;
      }
      if (Number.isFinite(segment?.duration_min)) {
        totalDurationMin += segment.duration_min;
      }
    }

    return {
      mapCoordinates: mapCoordinates.length >= 2 ? mapCoordinates : navigationCoordinates,
      navigationCoordinates,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: scheduledPois.length,
      totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : null,
      totalDurationMin: totalDurationMin > 0 ? totalDurationMin : null,
      stops,
    };
  })().catch(() => {
    const fallbackCoordinates = buildRouteCoordinates(descriptor, context.destinations);
    return {
      mapCoordinates: fallbackCoordinates,
      navigationCoordinates: fallbackCoordinates,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: 0,
      totalDistanceKm: null,
      totalDurationMin: null,
      stops: null,
    };
  });

  cache?.set(cacheKey, promise);
  return promise;
}

async function loadDestinationOverviewData(descriptor, context = {}) {
  if (!descriptor?.destinationId) {
    return {
      mapCoordinates: null,
      navigationCoordinates: null,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: 0,
      totalDistanceKm: null,
      totalDurationMin: null,
      dayCount: 0,
    };
  }

  if (typeof context.loadDestinationOverview === 'function') {
    const result = await context.loadDestinationOverview(descriptor);
    return {
      mapCoordinates: Array.isArray(result?.mapCoordinates) ? result.mapCoordinates : null,
      navigationCoordinates: Array.isArray(result?.navigationCoordinates) ? result.navigationCoordinates : null,
      travelMode: result?.travelMode || GoogleMapsTravelMode.WALKING,
      stopCount: Number.isFinite(result?.stopCount) ? result.stopCount : 0,
      totalDistanceKm: Number.isFinite(result?.totalDistanceKm) ? result.totalDistanceKm : null,
      totalDurationMin: Number.isFinite(result?.totalDurationMin) ? result.totalDurationMin : null,
      dayCount: Number.isFinite(result?.dayCount) ? result.dayCount : 0,
    };
  }

  const cache = context.cache?.destinationRoutes;
  if (cache?.has(descriptor.destinationId)) {
    return cache.get(descriptor.destinationId);
  }

  const promise = (async () => {
    const destinationPois = await loadDestinationPois(descriptor.destinationId, context);
    const scheduledPois = destinationPois
      .filter((poi) => poi?.scheduled_date && getCoordinatePairFromLocation(poi))
      .sort((a, b) => {
        const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.day_order || 0) - (b.day_order || 0);
      });

    const navigationCoordinates = scheduledPois
      .map((poi) => getCoordinatePairFromLocation(poi))
      .filter(Boolean);

    const stops = scheduledPois
      .filter((poi) => getCoordinatePairFromLocation(poi))
      .map((poi) => ({
        name: poi.name || null,
        placeId: poi.external_source === 'google_places' ? poi.external_id : null,
      }));

    // Group POIs by day
    const poisByDay = new Map();
    for (const poi of scheduledPois) {
      const day = poi.scheduled_date;
      if (!poisByDay.has(day)) poisByDay.set(day, []);
      poisByDay.get(day).push(poi);
    }

    if (navigationCoordinates.length === 0) {
      return {
        mapCoordinates: null,
        navigationCoordinates: null,
        travelMode: GoogleMapsTravelMode.WALKING,
        stopCount: 0,
        totalDistanceKm: null,
        totalDurationMin: null,
        dayCount: 0,
      };
    }

    // Compute real routed paths for each day (same approach as loadDayRouteData)
    const mapCoordinates = [];
    let totalDistanceKm = 0;
    let totalDurationMin = 0;

    for (const [, dayPois] of [...poisByDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      for (let index = 0; index < dayPois.length - 1; index += 1) {
        const fromPoi = dayPois[index];
        const toPoi = dayPois[index + 1];

        const response = await authFetch(`${API_BASE_URL}/routes/day-segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lat: fromPoi.latitude,
            origin_lng: fromPoi.longitude,
            destination_lat: toPoi.latitude,
            destination_lng: toPoi.longitude,
            mode: DEFAULT_DAY_ROUTE_MODE,
          }),
        });

        if (!response.ok) {
          appendCoordinates(mapCoordinates, [
            [fromPoi.longitude, fromPoi.latitude],
            [toPoi.longitude, toPoi.latitude],
          ]);
          continue;
        }

        const segment = await response.json();
        appendCoordinates(mapCoordinates, segment?.geometry?.coordinates);
        if (Number.isFinite(segment?.distance_km)) {
          totalDistanceKm += segment.distance_km;
        }
        if (Number.isFinite(segment?.duration_min)) {
          totalDurationMin += segment.duration_min;
        }
      }
    }

    return {
      mapCoordinates: mapCoordinates.length >= 2 ? mapCoordinates : navigationCoordinates,
      navigationCoordinates,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: scheduledPois.length,
      totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : null,
      totalDurationMin: totalDurationMin > 0 ? totalDurationMin : null,
      dayCount: poisByDay.size,
      stops,
    };
  })().catch(() => {
    const fallbackCoordinates = buildRouteCoordinates(descriptor, context.destinations);
    return {
      mapCoordinates: fallbackCoordinates,
      navigationCoordinates: fallbackCoordinates,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: 0,
      totalDistanceKm: null,
      totalDurationMin: null,
      dayCount: 0,
      stops: null,
    };
  });

  cache?.set(descriptor.destinationId, promise);
  return promise;
}

async function resolveTripOverviewData(descriptor, context = {}) {
  const orderedDestinations = (context.destinations || []).filter(
    (destination) => getCoordinatePairFromLocation(destination)
  );
  const navigationCoordinates = orderedDestinations
    .map((destination) => getCoordinatePairFromLocation(destination))
    .filter(Boolean);

  // Build stop metadata for Google Maps URL
  const stops = orderedDestinations.map((d) => ({
    name: d.name || d.city_name || null,
    placeId: null,
  }));

  const segments = await loadTripSegments(descriptor.tripId, context);
  if (!segments.length) {
    return {
      mapCoordinates: navigationCoordinates.length >= 2 ? navigationCoordinates : null,
      navigationCoordinates: navigationCoordinates.length >= 2 ? navigationCoordinates : null,
      travelMode: GoogleMapsTravelMode.DRIVING,
      stopCount: navigationCoordinates.length,
      totalDistanceKm: null,
      totalDurationMin: null,
      stops,
    };
  }

  const segmentMap = new Map(
    segments.map((segment) => [`${segment.from_destination_id}:${segment.to_destination_id}`, segment])
  );

  const mapCoordinates = [];
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let hasDistance = false;
  let hasDuration = false;
  let travelMode = GoogleMapsTravelMode.DRIVING;

  for (let index = 0; index < orderedDestinations.length - 1; index += 1) {
    const fromDestination = orderedDestinations[index];
    const toDestination = orderedDestinations[index + 1];
    const segment = segmentMap.get(`${fromDestination.id}:${toDestination.id}`);

    if (segment?.travel_mode) {
      travelMode = toGoogleMapsTravelMode(segment.travel_mode);
    }

    if (Number.isFinite(segment?.distance_km)) {
      totalDistanceKm += segment.distance_km;
      hasDistance = true;
    }
    if (Number.isFinite(segment?.duration_minutes)) {
      totalDurationMin += segment.duration_minutes;
      hasDuration = true;
    }

    appendCoordinates(
      mapCoordinates,
      segment?.route_geometry?.coordinates || [
        getCoordinatePairFromLocation(fromDestination),
        getCoordinatePairFromLocation(toDestination),
      ]
    );
  }

  return {
    mapCoordinates: mapCoordinates.length >= 2 ? mapCoordinates : navigationCoordinates,
    navigationCoordinates: navigationCoordinates.length >= 2 ? navigationCoordinates : null,
    travelMode,
    stopCount: navigationCoordinates.length,
    totalDistanceKm: hasDistance ? totalDistanceKm : null,
    totalDurationMin: hasDuration ? totalDurationMin : null,
    stops,
  };
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Build a coordinate array for a route block from available destination data.
 *
 * - trip-overview: returns all destination coordinates in order
 * - day-route / destination-overview: returns the single destination coordinate
 *
 * @param {object} descriptor - Parsed route block descriptor
 * @param {Array} destinations - Array of destination objects with latitude/longitude
 * @returns {Array<[number,number]>|null} [[lng, lat], ...] or null
 */
export function buildRouteCoordinates(descriptor, destinations) {
  if (!destinations || destinations.length === 0) return null;

  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    const coords = destinations
      .filter((d) => d.longitude != null && d.latitude != null)
      .map((d) => [d.longitude, d.latitude]);
    return coords.length >= 2 ? coords : null;
  }

  if (
    descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE
    || descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW
  ) {
    const dest = destinations.find((d) => d.id === descriptor.destinationId);
    if (dest?.longitude != null && dest?.latitude != null) {
      return [[dest.longitude, dest.latitude]];
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Google Maps URL builder
// ---------------------------------------------------------------------------

/**
 * Build a Google Maps URL for a route block.
 *
 * - Multi-point routes get a directions URL with origin, destination, and waypoints.
 * - Single-point routes get a place URL centered on the coordinate.
 * - When `stops` array is provided, uses POI names for better Google Maps resolution.
 *
 * @param {Array<[number,number]>|null} coordinates - [lng, lat] pairs
 * @param {string} travelMode
 * @param {Array<{name: string|null, placeId: string|null}>|null} stops - POI metadata aligned with coordinates
 * @returns {string|null}
 */
export function buildGoogleMapsUrlForRoute(coordinates, travelMode = GoogleMapsTravelMode.DRIVING, stops = null) {
  if (!coordinates || coordinates.length === 0) return null;

  if (coordinates.length === 1) {
    const [lng, lat] = coordinates[0];
    const name = stops?.[0]?.name;
    if (name) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query=${lat},${lng}`;
    }
    return `https://www.google.com/maps/@${lat},${lng},14z`;
  }

  // Build location strings using name when available, coordinates as fallback
  const buildLocation = (coord, stop) => {
    if (stop?.name) return stop.name;
    return `${coord[1]},${coord[0]}`;
  };

  const origin = buildLocation(coordinates[0], stops?.[0]);
  const destination = buildLocation(
    coordinates[coordinates.length - 1],
    stops?.[stops.length - 1],
  );

  // Google Maps supports max 9 waypoints
  const middleCoords = coordinates.slice(1, -1);
  const middleStops = stops?.slice(1, -1);
  const maxWaypoints = Math.min(middleCoords.length, 9);
  const waypointStrs = [];
  for (let i = 0; i < maxWaypoints; i += 1) {
    waypointStrs.push(buildLocation(middleCoords[i], middleStops?.[i]));
  }

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: travelMode,
  });

  if (waypointStrs.length > 0) {
    params.set('waypoints', waypointStrs.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Label & stats helpers
// ---------------------------------------------------------------------------

/**
 * Generate a default label when the descriptor doesn't have one.
 *
 * @param {object} descriptor
 * @param {Array} [destinations]
 * @returns {string}
 */
export function defaultRouteLabel(descriptor, destinations) {
  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    return 'Trip Route Overview';
  }
  if (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE) {
    const dest = destinations?.find((d) => d.id === descriptor.destinationId);
    const name = dest?.city_name || dest?.name || 'Destination';
    return descriptor.date ? `${name} \u2014 ${descriptor.date}` : name;
  }
  if (descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW) {
    const dest = destinations?.find((d) => d.id === descriptor.destinationId);
    return `${dest?.city_name || dest?.name || 'Destination'} Route Overview`;
  }
  return 'Route';
}

/**
 * Build route stats metadata for display in the route card.
 *
 * @param {object} descriptor
 * @param {Array<[number,number]>|null} coordinates
 * @param {Array} [destinations]
 * @returns {Array<{key: string, label: string}>|null}
 */
export function buildRouteStats(descriptor, coordinates, destinations, metadata = {}) {
  const stats = [];

  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    const stopCount = metadata.stopCount
      || destinations?.filter((d) => d.longitude != null && d.latitude != null).length
      || 0;
    if (stopCount > 0) {
      stats.push({ key: 'stops', label: `${stopCount} destination${stopCount > 1 ? 's' : ''}` });
    }
  }

  if (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE) {
    const dest = destinations?.find((d) => d.id === descriptor.destinationId);
    if (dest?.city_name || dest?.name) {
      stats.push({ key: 'destination', label: dest.city_name || dest.name });
    }
    if (descriptor.date) {
      stats.push({ key: 'date', label: descriptor.date });
    }
    if (metadata.stopCount > 0) {
      stats.push({ key: 'stops', label: `${metadata.stopCount} stop${metadata.stopCount > 1 ? 's' : ''}` });
    }
  }

  if (descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW) {
    const dest = destinations?.find((d) => d.id === descriptor.destinationId);
    if (dest?.city_name || dest?.name) {
      stats.push({ key: 'destination', label: dest.city_name || dest.name });
    }
    if (metadata.dayCount > 0) {
      stats.push({ key: 'days', label: `${metadata.dayCount} day${metadata.dayCount > 1 ? 's' : ''}` });
    }
    if (metadata.stopCount > 0) {
      stats.push({ key: 'stops', label: `${metadata.stopCount} stop${metadata.stopCount > 1 ? 's' : ''}` });
    }
  }

  if (Number.isFinite(metadata.totalDistanceKm) && metadata.totalDistanceKm > 0) {
    stats.push({ key: 'distance', label: `${metadata.totalDistanceKm.toFixed(1)} km` });
  }

  if (Number.isFinite(metadata.totalDurationMin) && metadata.totalDurationMin > 0) {
    stats.push({ key: 'duration', label: `${Math.round(metadata.totalDurationMin)} min` });
  }

  return stats.length > 0 ? stats : null;
}

// ---------------------------------------------------------------------------
// Map URL builder (with fallback strategy)
// ---------------------------------------------------------------------------

/**
 * Build a map image URL for a route block with appropriate fallbacks.
 *
 * Priority:
 *   1. Route polyline map (2+ coordinates via buildRouteMapUrl)
 *   2. Trip overview markers map (trip-overview fallback)
 *   3. Single destination marker map (day-route / destination-overview fallback)
 *
 * @param {object} descriptor
 * @param {Array<[number,number]>|null} coordinates
 * @param {Array} destinations
 * @param {string} mapboxToken
 * @returns {string|null}
 */
export function buildMapUrlForRoute(descriptor, coordinates, destinations, mapboxToken) {
  if (!mapboxToken) return null;

  // Prefer a route polyline if we have 2+ points
  if (coordinates && coordinates.length >= 2) {
    return buildRouteMapUrl(coordinates, mapboxToken);
  }

  // Fallback: trip overview with destination markers
  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    return buildTripOverviewMapUrl(destinations, mapboxToken);
  }

  // Fallback: single destination marker
  if (
    (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE
      || descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW)
    && coordinates?.length === 1
  ) {
    const [lng, lat] = coordinates[0];
    return buildDestinationMapUrl(lng, lat, mapboxToken);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main export resolver
// ---------------------------------------------------------------------------

/**
 * Resolve route blocks in markdown for PDF export.
 *
 * Phase 1: Replace :::route blocks with <!-- ROUTE_CARD:N --> sentinels
 *          and build route card data objects.
 * Phase 2: Fetch map images in parallel for all cards.
 *
 * @param {string} markdown
 * @param {object} context
 * @param {object} [context.trip]
 * @param {Array}  [context.destinations]
 * @param {string} [context.mapboxToken]
 * @returns {Promise<{processedMarkdown: string, routeCards: Array}>}
 */
export async function resolveRouteBlocksForExport(markdown, context = {}) {
  const { trip, destinations, mapboxToken } = context;
  const blocks = parseRouteBlocks(markdown);
  if (blocks.length === 0) {
    return { processedMarkdown: markdown, routeCards: [] };
  }

  // Pre-allocate in document order and map block offsets to indices
  const cardDataList = new Array(blocks.length);
  const blockIndexMap = new Map();
  blocks.forEach((block, idx) => {
    blockIndexMap.set(block.start, idx);
  });

  await Promise.all(blocks.map(async (block) => {
    const docIndex = blockIndexMap.get(block.start);
    const { descriptor, valid } = block;

    if (!valid) {
      cardDataList[docIndex] = {
        type: null,
        label: 'Invalid Route Block',
        mapUrl: null,
        mapImageDataUri: null,
        googleMapsUrl: null,
        stats: null,
      };
      return;
    }

    let routeData;
    if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
      routeData = await resolveTripOverviewData(descriptor, { ...context, trip, destinations });
    } else if (descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW) {
      routeData = await loadDestinationOverviewData(descriptor, { ...context, trip, destinations });
    } else {
      routeData = await loadDayRouteData(descriptor, { ...context, trip, destinations });
    }

    const fallbackCoordinates = buildRouteCoordinates(descriptor, destinations);
    const mapCoordinates = routeData.mapCoordinates || fallbackCoordinates;
    const navigationCoordinates = routeData.navigationCoordinates || fallbackCoordinates;
    const mapUrl = buildMapUrlForRoute(descriptor, mapCoordinates, destinations, mapboxToken);
    const googleMapsUrl = buildGoogleMapsUrlForRoute(navigationCoordinates, routeData.travelMode, routeData.stops);
    const label = descriptor.label || defaultRouteLabel(descriptor, destinations);
    const stats = buildRouteStats(descriptor, navigationCoordinates, destinations, routeData);

    cardDataList[docIndex] = {
      type: descriptor.type,
      label,
      mapUrl,
      mapImageDataUri: null,
      googleMapsUrl,
      stats,
    };
  }));

  // Phase 1: Replace blocks with sentinels
  const processedMarkdown = replaceRouteBlocks(markdown, (block) => {
    const docIndex = blockIndexMap.get(block.start);
    return `<!-- ROUTE_CARD:${docIndex} -->`;
  });

  // Phase 2: Fetch map images in parallel
  await Promise.all(
    cardDataList.map(async (card) => {
      if (card.mapUrl) {
        card.mapImageDataUri = await fetchMapAsBase64(card.mapUrl);
      }
    })
  );

  return { processedMarkdown, routeCards: cardDataList };
}
