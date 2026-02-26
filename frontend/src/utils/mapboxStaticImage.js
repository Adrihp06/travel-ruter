/**
 * Mapbox Static Images API utilities for PDF generation
 */

const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static';

/**
 * Build a Mapbox Static API URL showing all trip destinations with markers.
 * Uses auto bounds to fit all markers.
 */
export function buildTripOverviewMapUrl(destinations, token) {
  if (!token || !destinations || destinations.length === 0) return null;

  // Build markers for each destination that has coordinates
  const validDests = destinations.filter((d) => d.latitude && d.longitude);
  if (validDests.length === 0) return null;

  const markers = validDests
    .map((d) => `pin-s+D97706(${d.longitude},${d.latitude})`)
    .join(',');

  return `${MAPBOX_STATIC_BASE}/${markers}/auto/600x300@2x?access_token=${token}&padding=40`;
}

/**
 * Build a Mapbox Static API URL centered on a single destination.
 */
export function buildDestinationMapUrl(lng, lat, token, zoom = 11) {
  if (!token || !lng || !lat) return null;
  const marker = `pin-s+D97706(${lng},${lat})`;
  return `${MAPBOX_STATIC_BASE}/${marker}/${lng},${lat},${zoom}/600x300@2x?access_token=${token}`;
}

/**
 * Fetch a map image URL and return it as a base64 data URI.
 * Returns undefined on error (PDF will skip the image gracefully).
 */
export async function fetchMapAsBase64(url) {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
