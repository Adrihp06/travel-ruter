/**
 * Google Maps export utilities
 *
 * Generates Google Maps directions URLs for inter-city and intra-city routes.
 * URLs can be opened in browser or will trigger Google Maps mobile app if available.
 */

const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';

/**
 * Travel modes supported by Google Maps
 */
export const GoogleMapsTravelMode = {
  DRIVING: 'driving',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
  TRANSIT: 'transit',
};

/**
 * Generate a Google Maps directions URL
 *
 * @param {Object} origin - Origin coordinate { lat, lng }
 * @param {Object} destination - Destination coordinate { lat, lng }
 * @param {Array} waypoints - Optional array of waypoint coordinates [{ lat, lng }, ...]
 * @param {string} travelMode - Travel mode (driving, walking, bicycling, transit)
 * @returns {string} Google Maps directions URL
 */
export function generateGoogleMapsUrl(origin, destination, waypoints = [], travelMode = GoogleMapsTravelMode.DRIVING) {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
  });

  if (waypoints && waypoints.length > 0) {
    const waypointsStr = waypoints.map((wp) => `${wp.lat},${wp.lng}`).join('|');
    params.set('waypoints', waypointsStr);
  }

  return `${GOOGLE_MAPS_DIRECTIONS_BASE}?${params.toString()}`;
}

const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';

/**
 * Build a Google Maps URL for a single POI.
 *
 * Priority:
 *  1. metadata_json.url — canonical Google Maps listing URL (validated)
 *  2. query + query_place_id via external_id (Google Places)
 *  3. query by name + coordinates
 *  4. query by coordinates only
 *
 * @param {object} poi - POI object with name, latitude, longitude, external_id, external_source, metadata_json
 * @returns {string|null}
 */
export function buildPoiGoogleMapsUrl(poi) {
  if (!poi) return null;

  // Priority 1: canonical Google Maps URL from metadata
  const metaUrl = poi.metadata_json?.url;
  if (metaUrl && typeof metaUrl === 'string' && /^https:\/\/(www\.)?google\.[a-z.]+\/maps\b/i.test(metaUrl)) {
    return metaUrl;
  }

  const hasCoords = Number.isFinite(poi.latitude) && Number.isFinite(poi.longitude);
  const hasPlaceId = poi.external_id && poi.external_source === 'google_places';
  const hasName = typeof poi.name === 'string' && poi.name.trim().length > 0;

  // Priority 2: name + place_id (most reliable for Google-sourced POIs)
  if (hasPlaceId && hasName) {
    const params = new URLSearchParams({
      api: '1',
      query: poi.name,
      query_place_id: poi.external_id,
    });
    return `${GOOGLE_MAPS_SEARCH_BASE}?${params.toString()}`;
  }

  // Priority 3: name + coordinates
  if (hasName && hasCoords) {
    const params = new URLSearchParams({
      api: '1',
      query: `${poi.name}, ${poi.latitude},${poi.longitude}`,
    });
    return `${GOOGLE_MAPS_SEARCH_BASE}?${params.toString()}`;
  }

  // Priority 4: coordinates only
  if (hasCoords) {
    return `${GOOGLE_MAPS_SEARCH_BASE}?api=1&query=${poi.latitude},${poi.longitude}`;
  }

  return null;
}

/**
 * Open Google Maps URL in a new tab/window
 * On mobile devices, this may trigger the Google Maps app
 *
 * @param {string} url - Google Maps URL
 */
export function openGoogleMapsUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Export route to Google Maps and open in new tab
 *
 * @param {Object} origin - Origin coordinate { lat, lng }
 * @param {Object} destination - Destination coordinate { lat, lng }
 * @param {Array} waypoints - Optional waypoints
 * @param {string} travelMode - Travel mode
 */
export function exportToGoogleMaps(origin, destination, waypoints = [], travelMode = GoogleMapsTravelMode.DRIVING) {
  const url = generateGoogleMapsUrl(origin, destination, waypoints, travelMode);
  openGoogleMapsUrl(url);
  return url;
}

