/**
 * Route Block Contract — markdown shortcode format, parser, serializer,
 * and resolver helpers for embedding route blocks in Export Writer documents.
 *
 * Shortcode format (fenced block with YAML-like properties):
 *
 *   :::route
 *   type: trip-overview
 *   tripId: 42
 *   label: Full Trip Route
 *   :::
 *
 *   :::route
 *   type: day-route
 *   destinationId: 7
 *   date: 2025-03-15
 *   label: Day 1 — Rome Walking Tour
 *   :::
 *
 *   :::route
 *   type: destination-overview
 *   destinationId: 7
 *   label: Rome Route Overview
 *   :::
 *
 * Tokens are text-safe and human-readable. Binary data (images) is never
 * stored — route images are resolved at export/render time.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ROUTE_BLOCK_TYPE = {
  TRIP_OVERVIEW: 'trip-overview',
  DAY_ROUTE: 'day-route',
  DESTINATION_OVERVIEW: 'destination-overview',
};

const VALID_TYPES = new Set(Object.values(ROUTE_BLOCK_TYPE));

export const VALID_ROUTE_MODES = new Set(['walking', 'cycling', 'driving', 'transit']);
export const DEFAULT_ROUTE_MODE = 'walking';

/** Regex that captures the full fenced block including delimiters. */
const ROUTE_BLOCK_RE = /^:::route\n([\s\S]*?)^:::/gm;

/** Matches a single `key: value` property line inside the block. */
const PROP_LINE_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)$/;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a single route block body (the lines between the `:::route` fences)
 * into a descriptor object.
 *
 * @param {string} body - Raw text between fences
 * @returns {{ type: string|null, tripId: number|null, destinationId: number|null, date: string|null, label: string|null }}
 */
function parseBlockBody(body) {
  const descriptor = {
    type: null,
    tripId: null,
    destinationId: null,
    date: null,
    mode: null,
    label: null,
  };

  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(PROP_LINE_RE);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim();

    switch (key) {
      case 'type':
        descriptor.type = value;
        break;
      case 'tripId':
        descriptor.tripId = Number(value) || null;
        break;
      case 'destinationId':
        descriptor.destinationId = Number(value) || null;
        break;
      case 'date':
        descriptor.date = value || null;
        break;
      case 'mode':
        descriptor.mode = value || null;
        break;
      case 'label':
        descriptor.label = value || null;
        break;
      default:
        // Unknown keys are silently ignored for forward-compat
        break;
    }
  }

  return descriptor;
}

/**
 * Extract all route-block descriptors from a markdown string.
 *
 * Each result includes:
 *   - `raw`        : the full matched shortcode text
 *   - `start`      : character offset in the source
 *   - `end`        : character offset (exclusive) in the source
 *   - `descriptor` : the parsed descriptor object
 *   - `valid`      : whether the descriptor passes validation
 *   - `errors`     : array of human-readable validation error strings
 *
 * @param {string} markdown
 * @returns {Array<{ raw: string, start: number, end: number, descriptor: object, valid: boolean, errors: string[] }>}
 */
export function parseRouteBlocks(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];

  const results = [];
  const re = new RegExp(ROUTE_BLOCK_RE.source, ROUTE_BLOCK_RE.flags);
  let match;

  while ((match = re.exec(markdown)) !== null) {
    const raw = match[0];
    const body = match[1];
    const descriptor = parseBlockBody(body);
    const { valid, errors } = validateDescriptor(descriptor);

    results.push({
      raw,
      start: match.index,
      end: match.index + raw.length,
      descriptor,
      valid,
      errors,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a route-block descriptor.
 *
 * @param {object} descriptor
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDescriptor(descriptor) {
  const errors = [];

  if (!descriptor || typeof descriptor !== 'object') {
    return { valid: false, errors: ['Descriptor is not an object'] };
  }

  if (!descriptor.type) {
    errors.push('Missing required property: type');
  } else if (!VALID_TYPES.has(descriptor.type)) {
    errors.push(`Unknown route block type: "${descriptor.type}"`);
  }

  if (descriptor.type === ROUTE_BLOCK_TYPE.TRIP_OVERVIEW) {
    if (descriptor.tripId == null) {
      errors.push('trip-overview block requires tripId');
    }
  }

  if (descriptor.type === ROUTE_BLOCK_TYPE.DAY_ROUTE) {
    if (descriptor.destinationId == null) {
      errors.push('day-route block requires destinationId');
    }
    if (!descriptor.date) {
      errors.push('day-route block requires date');
    }
  }

  if (descriptor.type === ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW) {
    if (descriptor.destinationId == null) {
      errors.push('destination-overview block requires destinationId');
    }
  }

  if (descriptor.mode != null && !VALID_ROUTE_MODES.has(descriptor.mode)) {
    errors.push(`Invalid route mode: "${descriptor.mode}". Must be one of: ${[...VALID_ROUTE_MODES].join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a route-block descriptor into a markdown shortcode string.
 * Only non-null properties are emitted.
 *
 * @param {object} descriptor
 * @returns {string}
 */
export function serializeRouteBlock(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    return '';
  }

  const lines = [':::route'];

  // Emit properties in a stable, deterministic order
  const orderedKeys = ['type', 'tripId', 'destinationId', 'date', 'mode', 'label'];
  for (const key of orderedKeys) {
    if (descriptor[key] != null && descriptor[key] !== '') {
      lines.push(`${key}: ${descriptor[key]}`);
    }
  }

  lines.push(':::');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a descriptor — clamp values, fill defaults, strip unknowns.
 * Returns a new clean descriptor.
 *
 * @param {object} raw
 * @returns {object}
 */
export function normalizeDescriptor(raw) {
  if (!raw || typeof raw !== 'object') {
    return { type: null, tripId: null, destinationId: null, date: null, mode: null, label: null };
  }

  const type = VALID_TYPES.has(raw.type) ? raw.type : null;
  const tripId = typeof raw.tripId === 'number' && raw.tripId > 0 ? raw.tripId : null;
  const destinationId =
    typeof raw.destinationId === 'number' && raw.destinationId > 0 ? raw.destinationId : null;

  let date = null;
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    date = raw.date;
  }

  const mode = typeof raw.mode === 'string' && VALID_ROUTE_MODES.has(raw.mode) ? raw.mode : null;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : null;

  return { type, tripId, destinationId, date, mode, label };
}

// ---------------------------------------------------------------------------
// Factory helpers (convenient shorthand for creating descriptors)
// ---------------------------------------------------------------------------

/**
 * Create a trip-overview route block descriptor.
 *
 * @param {number} tripId
 * @param {string} [label]
 * @returns {object}
 */
export function createTripOverviewBlock(tripId, label) {
  return normalizeDescriptor({
    type: ROUTE_BLOCK_TYPE.TRIP_OVERVIEW,
    tripId,
    label: label ?? null,
  });
}

/**
 * Create a day-route block descriptor.
 *
 * @param {number} destinationId
 * @param {string} date          - ISO date string (YYYY-MM-DD)
 * @param {string} [label]
 * @param {string} [mode]        - Travel mode (walking, cycling, driving, transit)
 * @returns {object}
 */
export function createDayRouteBlock(destinationId, date, label, mode) {
  return normalizeDescriptor({
    type: ROUTE_BLOCK_TYPE.DAY_ROUTE,
    destinationId,
    date,
    mode: mode ?? null,
    label: label ?? null,
  });
}

/**
 * Create a destination-overview route block descriptor.
 *
 * @param {number} destinationId
 * @param {string} [label]
 * @param {string} [mode]        - Travel mode (walking, cycling, driving, transit)
 * @returns {object}
 */
export function createDestinationOverviewBlock(destinationId, label, mode) {
  return normalizeDescriptor({
    type: ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW,
    destinationId,
    mode: mode ?? null,
    label: label ?? null,
  });
}

// ---------------------------------------------------------------------------
// Markdown insertion helper
// ---------------------------------------------------------------------------

/**
 * Insert a route block shortcode into a markdown string at the given offset.
 * Ensures blank lines surround the block for proper markdown separation.
 *
 * @param {string} markdown  - Existing markdown content
 * @param {number} position  - Character offset (0-based) to insert at
 * @param {object} descriptor
 * @returns {string}         - Updated markdown string
 */
export function insertRouteBlock(markdown, position, descriptor) {
  const md = markdown || '';
  const pos = Math.max(0, Math.min(position, md.length));
  const block = serializeRouteBlock(descriptor);
  if (!block) return md;

  const before = md.slice(0, pos);
  const after = md.slice(pos);

  // Ensure blank-line separation from surrounding content
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n\n');
  const needsTrailingNewline = after.length > 0 && !after.startsWith('\n\n');

  const prefix = needsLeadingNewline ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = needsTrailingNewline ? (after.startsWith('\n') ? '\n' : '\n\n') : '';

  return before + prefix + block + suffix + after;
}

// ---------------------------------------------------------------------------
// Replacement helper (used at export/render time)
// ---------------------------------------------------------------------------

/**
 * Replace all route-block shortcodes in markdown with resolved content
 * produced by a resolver function.
 *
 * The resolver receives each parsed block entry and should return:
 *   - a string to replace the shortcode, or
 *   - `null`/`undefined` to leave the block as-is (graceful fallback).
 *
 * @param {string} markdown
 * @param {(block: { descriptor: object, valid: boolean, errors: string[] }) => string|null|undefined} resolver
 * @returns {string}
 */
export function replaceRouteBlocks(markdown, resolver) {
  if (!markdown || typeof markdown !== 'string') return markdown || '';
  if (typeof resolver !== 'function') return markdown;

  const blocks = parseRouteBlocks(markdown);
  if (blocks.length === 0) return markdown;

  // Process blocks in reverse order so offsets stay valid
  let result = markdown;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const replacement = resolver(block);
    if (replacement != null && typeof replacement === 'string') {
      result = result.slice(0, block.start) + replacement + result.slice(block.end);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Route-image URL builder (extends mapboxStaticImage patterns)
// ---------------------------------------------------------------------------

/**
 * Encode a GeoJSON LineString coordinate array into a Mapbox Static API
 * path overlay string.
 *
 * Mapbox path overlay format:
 *   path-{strokeWidth}+{color}-{opacity}({coords})
 *   coords are comma-separated lon,lat pairs joined by commas.
 *
 * Coordinates are encoded using the Google Polyline Encoding Algorithm for
 * compact URLs and smooth rendering by the Mapbox Static API.
 *
 * @param {Array<[number,number]>} coordinates - [[lng, lat], …]
 * @param {string} [color='D97706'] - Hex color without #
 * @param {number} [strokeWidth=3]
 * @param {number} [opacity=1]
 * @param {number} [maxPointsOverride] - Override the default 200-point subsample limit
 * @returns {string|null}
 */
export function encodePathOverlay(coordinates, color = 'D97706', strokeWidth = 3, opacity = 1, maxPointsOverride) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  // Subsample for very long routes to stay within URL limits
  const maxPoints = Number.isFinite(maxPointsOverride) && maxPointsOverride > 2
    ? maxPointsOverride
    : 200;
  const sampled =
    coordinates.length > maxPoints ? subsampleCoordinates(coordinates, maxPoints) : coordinates;

  const polyline = encodePolyline(sampled);
  const opacityStr = opacity < 1 ? `-${opacity}` : '';

  // URL-encode only the polyline (may contain ?, \, etc.) — not the overlay syntax
  return `path-${strokeWidth}+${color}${opacityStr}(${encodeURIComponent(polyline)})`;
}

/**
 * Build a Mapbox Static API URL that renders a route polyline with optional
 * numbered POI markers.
 *
 * @param {Array<[number,number]>} coordinates - [[lng, lat], …]
 * @param {string} token - Mapbox access token
 * @param {{ color?: string, strokeWidth?: number, width?: number, height?: number, retina?: boolean, padding?: number, markers?: Array<{lng: number, lat: number, label: string}> }} [options]
 * @returns {string|null}
 */
export function buildRouteMapUrl(coordinates, token, options = {}) {
  if (!token || !Array.isArray(coordinates) || coordinates.length < 2) return null;

  const {
    color = 'D97706',
    strokeWidth = 3,
    width = 600,
    height = 300,
    retina = true,
    padding = 40,
    markers = [],
  } = options;

  const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';
  const suffix = retina ? '@2x' : '';
  const MAX_URL_LENGTH = 7500;

  const validMarkers = Array.isArray(markers)
    ? markers.filter((m) => m && Number.isFinite(m.lng) && Number.isFinite(m.lat))
    : [];

  // Try building with full markers (labeled), then degrade if URL is too long
  const buildUrl = (pathOverlay, markerOverlays) => {
    const overlayStr = [pathOverlay, ...markerOverlays].filter(Boolean).join(',');
    return `${MAPBOX_STATIC_BASE}/${overlayStr}/auto/${width}x${height}${suffix}?access_token=${token}&padding=${padding}`;
  };

  const labeledPins = validMarkers.map((m) => {
    const lng = round5(m.lng);
    const lat = round5(m.lat);
    // Mapbox labels support 0–99; beyond that, use unlabeled pins
    const labelNum = Number(m.label);
    const labelPart = Number.isFinite(labelNum) && labelNum >= 0 && labelNum <= 99
      ? `-${m.label}`
      : '';
    return `pin-s${labelPart}+${color}(${lng},${lat})`;
  });

  const unlabeledPins = validMarkers.map((m) => {
    const lng = round5(m.lng);
    const lat = round5(m.lat);
    return `pin-s+${color}(${lng},${lat})`;
  });

  // Attempt 1: full polyline + labeled markers
  let overlay = encodePathOverlay(coordinates, color, strokeWidth);
  if (!overlay) return null;

  let url = buildUrl(overlay, labeledPins);
  if (url.length <= MAX_URL_LENGTH) return url;

  // Attempt 2: drop labels — use unlabeled small pins
  url = buildUrl(overlay, unlabeledPins);
  if (url.length <= MAX_URL_LENGTH) return url;

  // Attempt 3: reduce polyline precision (fewer subsampled points)
  const reducedOverlay = encodePathOverlay(coordinates, color, strokeWidth, 1, 80);
  if (reducedOverlay) {
    url = buildUrl(reducedOverlay, unlabeledPins);
    if (url.length <= MAX_URL_LENGTH) return url;
  }

  // Attempt 4: omit markers entirely
  const finalOverlay = reducedOverlay || overlay;
  url = buildUrl(finalOverlay, []);
  if (url.length <= MAX_URL_LENGTH) return url;

  // Last resort: reduced polyline, no markers
  return `${MAPBOX_STATIC_BASE}/${finalOverlay}/auto/${width}x${height}${suffix}?access_token=${token}&padding=${padding}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Google Polyline Encoding Algorithm — encodes an array of [lng, lat]
 * coordinates into a compact ASCII string understood by the Mapbox Static API.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function encodePolyline(coordinates) {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lng, lat] of coordinates) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);

    result += encodeSignedValue(latE5 - prevLat);
    result += encodeSignedValue(lngE5 - prevLng);

    prevLat = latE5;
    prevLng = lngE5;
  }

  return result;
}

function encodeSignedValue(value) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode(((v & 0x1f) | 0x20) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Subsample an array of coordinates down to `maxPoints` while preserving
 * the first and last point and distributing the rest evenly.
 */
function subsampleCoordinates(coords, maxPoints) {
  if (coords.length <= maxPoints) return coords;
  const result = [coords[0]];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}
