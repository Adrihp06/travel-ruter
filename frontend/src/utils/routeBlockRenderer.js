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

// ---------------------------------------------------------------------------
// Sentinel pattern (used by markdownToPDF to detect route card placeholders)
// ---------------------------------------------------------------------------

/** Regex to detect route card sentinels injected into processed markdown. */
export const ROUTE_CARD_SENTINEL_RE = /<!--\s*ROUTE_CARD:(\d+)\s*-->/;

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
export function buildGoogleMapsUrlForRoute(coordinates) {
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

  return generateGoogleMapsUrl(origin, dest, waypoints, GoogleMapsTravelMode.DRIVING);
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
export function buildRouteStats(descriptor, coordinates, destinations) {
  const stats = [];

  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    const validDests = destinations?.filter((d) => d.longitude != null && d.latitude != null) || [];
    if (validDests.length > 0) {
      stats.push({ key: 'stops', label: `${validDests.length} destination${validDests.length > 1 ? 's' : ''}` });
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
export async function resolveRouteBlocksForExport(markdown, { trip, destinations, mapboxToken } = {}) {
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

  // Phase 1: Replace blocks with sentinels, build card data
  // (replaceRouteBlocks processes in reverse for offset stability;
  //  blockIndexMap ensures card indices stay in document order)
  const processedMarkdown = replaceRouteBlocks(markdown, (block) => {
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
      return `<!-- ROUTE_CARD:${docIndex} -->`;
    }

    const coordinates = buildRouteCoordinates(descriptor, destinations);
    const mapUrl = buildMapUrlForRoute(descriptor, coordinates, destinations, mapboxToken);
    const googleMapsUrl = buildGoogleMapsUrlForRoute(coordinates);
    const label = descriptor.label || defaultRouteLabel(descriptor, destinations);
    const stats = buildRouteStats(descriptor, coordinates, destinations);

    cardDataList[docIndex] = {
      type: descriptor.type,
      label,
      mapUrl,
      mapImageDataUri: null,
      googleMapsUrl,
      stats,
    };

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
