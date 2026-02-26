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

