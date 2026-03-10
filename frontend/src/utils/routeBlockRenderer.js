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

async function loadDayRouteData(descriptor, context = {}) {
  if (!descriptor?.destinationId || !descriptor?.date) {
    return {
      mapCoordinates: null,
      navigationCoordinates: null,
      travelMode: GoogleMapsTravelMode.WALKING,
      stopCount: 0,
      totalDistanceKm: null,
      totalDurationMin: null,
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
    };
  }

  const cacheKey = `${descriptor.destinationId}:${descriptor.date}`;
  const cache = context.cache?.dayRoutes;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const promise = (async () => {
    const poisResponse = await authFetch(`${API_BASE_URL}/destinations/${descriptor.destinationId}/pois`);
    if (!poisResponse.ok) {
      throw new Error('Failed to load destination POIs');
    }

    const data = await poisResponse.json();
    const scheduledPois = flattenPoisResponse(data)
      .filter((poi) => poi?.scheduled_date === descriptor.date)
      .sort((a, b) => (a.day_order || 0) - (b.day_order || 0));

    const navigationCoordinates = scheduledPois
      .map((poi) => getCoordinatePairFromLocation(poi))
      .filter(Boolean);

    if (navigationCoordinates.length === 0) {
      return {
        mapCoordinates: null,
        navigationCoordinates: null,
        travelMode: GoogleMapsTravelMode.WALKING,
        stopCount: 0,
        totalDistanceKm: null,
        totalDurationMin: null,
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
    };
  });

  cache?.set(cacheKey, promise);
  return promise;
}

async function resolveTripOverviewData(descriptor, context = {}) {
  const orderedDestinations = (context.destinations || []).filter(
    (destination) => getCoordinatePairFromLocation(destination)
  );
  const navigationCoordinates = orderedDestinations
    .map((destination) => getCoordinatePairFromLocation(destination))
    .filter(Boolean);

  const segments = await loadTripSegments(descriptor.tripId, context);
  if (!segments.length) {
    return {
      mapCoordinates: navigationCoordinates.length >= 2 ? navigationCoordinates : null,
      navigationCoordinates: navigationCoordinates.length >= 2 ? navigationCoordinates : null,
      travelMode: GoogleMapsTravelMode.DRIVING,
      stopCount: navigationCoordinates.length,
      totalDistanceKm: null,
      totalDurationMin: null,
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
  };
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Build a coordinate array for a route block from available destination data.
 *
 * - trip-overview: returns all destination coordinates in order
 * - day-route: returns the single destination coordinate
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

  if (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE) {
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
 *
 * @param {Array<[number,number]>|null} coordinates
 * @returns {string|null}
 */
export function buildGoogleMapsUrlForRoute(coordinates, travelMode = GoogleMapsTravelMode.DRIVING) {
  if (!coordinates || coordinates.length === 0) return null;

  if (coordinates.length === 1) {
    const [lng, lat] = coordinates[0];
    return `https://www.google.com/maps/@${lat},${lng},14z`;
  }

  const origin = { lat: coordinates[0][1], lng: coordinates[0][0] };
  const dest = {
    lat: coordinates[coordinates.length - 1][1],
    lng: coordinates[coordinates.length - 1][0],
  };
  const waypoints =
    coordinates.length > 2
      ? coordinates.slice(1, -1).map(([lng, lat]) => ({ lat, lng }))
      : [];

  return generateGoogleMapsUrl(origin, dest, waypoints, travelMode);
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
 *   3. Single destination marker map (day-route fallback)
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
  if (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE && coordinates?.length === 1) {
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

    const routeData = descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW
      ? await resolveTripOverviewData(descriptor, { ...context, trip, destinations })
      : await loadDayRouteData(descriptor, { ...context, trip, destinations });

    const fallbackCoordinates = buildRouteCoordinates(descriptor, destinations);
    const mapCoordinates = routeData.mapCoordinates || fallbackCoordinates;
    const navigationCoordinates = routeData.navigationCoordinates || fallbackCoordinates;
    const mapUrl = buildMapUrlForRoute(descriptor, mapCoordinates, destinations, mapboxToken);
    const googleMapsUrl = buildGoogleMapsUrlForRoute(navigationCoordinates, routeData.travelMode);
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
