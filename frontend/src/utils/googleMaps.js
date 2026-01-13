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
 * Generate Google Maps URL from an array of coordinates
 * First coordinate is origin, last is destination, middle ones are waypoints
 *
 * @param {Array} coordinates - Array of { lat, lng } objects (minimum 2)
 * @param {string} travelMode - Travel mode
 * @returns {string} Google Maps directions URL
 */
export function generateGoogleMapsUrlFromCoordinates(coordinates, travelMode = GoogleMapsTravelMode.DRIVING) {
  if (!coordinates || coordinates.length < 2) {
    throw new Error('At least 2 coordinates required (origin and destination)');
  }

  const origin = coordinates[0];
  const destination = coordinates[coordinates.length - 1];
  const waypoints = coordinates.length > 2 ? coordinates.slice(1, -1) : [];

  return generateGoogleMapsUrl(origin, destination, waypoints, travelMode);
}

/**
 * Generate Google Maps URL from trip destinations
 *
 * @param {Array} destinations - Array of destination objects with latitude/longitude or coordinates
 * @param {string} travelMode - Travel mode
 * @returns {string} Google Maps directions URL
 */
export function generateGoogleMapsUrlFromDestinations(destinations, travelMode = GoogleMapsTravelMode.DRIVING) {
  if (!destinations || destinations.length < 2) {
    throw new Error('At least 2 destinations required');
  }

  const coordinates = destinations.map((dest) => {
    // Handle different coordinate formats
    if (dest.latitude !== undefined && dest.longitude !== undefined) {
      return { lat: dest.latitude, lng: dest.longitude };
    }
    if (dest.lat !== undefined && dest.lng !== undefined) {
      return { lat: dest.lat, lng: dest.lng };
    }
    if (dest.coordinates) {
      // Handle GeoJSON Point format
      if (dest.coordinates.type === 'Point') {
        return { lat: dest.coordinates.coordinates[1], lng: dest.coordinates.coordinates[0] };
      }
      // Handle simple array [lng, lat]
      if (Array.isArray(dest.coordinates)) {
        return { lat: dest.coordinates[1], lng: dest.coordinates[0] };
      }
    }
    throw new Error(`Invalid coordinate format for destination: ${JSON.stringify(dest)}`);
  });

  return generateGoogleMapsUrlFromCoordinates(coordinates, travelMode);
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

/**
 * Export trip destinations to Google Maps and open in new tab
 *
 * @param {Array} destinations - Array of destination objects
 * @param {string} travelMode - Travel mode
 */
export function exportDestinationsToGoogleMaps(destinations, travelMode = GoogleMapsTravelMode.DRIVING) {
  const url = generateGoogleMapsUrlFromDestinations(destinations, travelMode);
  openGoogleMapsUrl(url);
  return url;
}
