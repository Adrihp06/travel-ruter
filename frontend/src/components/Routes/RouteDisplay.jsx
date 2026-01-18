import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';

/**
 * Generate GeoJSON LineString from route geometry or destinations
 */
const generateRouteGeoJSON = (routeGeometry, destinations) => {
  // If we have actual route geometry from API, use it
  if (routeGeometry?.type === 'LineString' || routeGeometry?.coordinates) {
    return {
      type: 'Feature',
      properties: {},
      geometry: routeGeometry,
    };
  }

  // Fallback: generate straight lines between destinations
  if (!destinations || destinations.length < 2) return null;

  const coords = destinations
    .map((d) => getCoordinates(d))
    .filter((c) => c !== null)
    .map((c) => [c.lng, c.lat]);

  if (coords.length < 2) return null;

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
  };
};

/**
 * Extract coordinates from various destination formats
 */
const getCoordinates = (destination) => {
  if (!destination) return null;

  if (destination.latitude !== undefined && destination.longitude !== undefined) {
    return { lat: destination.latitude, lng: destination.longitude };
  }
  if (destination.lat !== undefined && destination.lng !== undefined) {
    return { lat: destination.lat, lng: destination.lng };
  }
  if (destination.coordinates) {
    if (destination.coordinates.type === 'Point') {
      return {
        lat: destination.coordinates.coordinates[1],
        lng: destination.coordinates.coordinates[0],
      };
    }
    if (Array.isArray(destination.coordinates)) {
      return {
        lat: destination.coordinates[1],
        lng: destination.coordinates[0],
      };
    }
  }
  return null;
};

// Route layer styles based on transport mode
const getRouteLayerStyle = (transportMode, isActive = true) => {
  const baseStyle = {
    id: 'route-line',
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-width': isActive ? 4 : 3,
      'line-opacity': isActive ? 0.9 : 0.6,
    },
  };

  // Color based on transport mode
  switch (transportMode) {
    case 'walking':
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#10B981', // green
          'line-dasharray': [1, 2], // dotted for walking
        },
      };
    case 'cycling':
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#F59E0B', // amber
          'line-dasharray': [2, 1],
        },
      };
    case 'train':
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#8B5CF6', // purple
          'line-dasharray': [4, 2],
        },
      };
    case 'flight':
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#3B82F6', // blue
          'line-dasharray': [8, 4],
        },
      };
    case 'driving':
    case 'driving-traffic':
    default:
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#4F46E5', // indigo
        },
      };
  }
};

// Outline layer for better visibility
const routeOutlineStyle = {
  id: 'route-line-outline',
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#ffffff',
    'line-width': 6,
    'line-opacity': 0.5,
  },
};

/**
 * RouteDisplay component - renders route lines on a Mapbox map
 *
 * @param {Object} props
 * @param {Object} props.routeGeometry - GeoJSON geometry from API (optional)
 * @param {Array} props.destinations - Array of destination objects with coordinates
 * @param {string} props.transportMode - Transport mode ('driving', 'walking', 'cycling', 'train', 'flight')
 * @param {boolean} props.showRoute - Whether to show the route
 * @param {boolean} props.showOutline - Whether to show white outline for visibility
 */
const RouteDisplay = ({
  routeGeometry = null,
  destinations = [],
  transportMode = 'driving',
  showRoute = true,
  showOutline = true,
}) => {
  // Generate route GeoJSON
  const routeGeoJSON = useMemo(() => {
    if (!showRoute) return null;
    return generateRouteGeoJSON(routeGeometry, destinations);
  }, [routeGeometry, destinations, showRoute]);

  // Get layer style based on transport mode
  const layerStyle = useMemo(
    () => getRouteLayerStyle(transportMode, true),
    [transportMode]
  );

  if (!routeGeoJSON) return null;

  return (
    <>
      {/* White outline for better visibility */}
      {showOutline && (
        <Source id="route-outline" type="geojson" data={routeGeoJSON}>
          <Layer {...routeOutlineStyle} beforeId="route-line" />
        </Source>
      )}

      {/* Main route line */}
      <Source id="route" type="geojson" data={routeGeoJSON}>
        <Layer {...layerStyle} />
      </Source>
    </>
  );
};

export default RouteDisplay;
