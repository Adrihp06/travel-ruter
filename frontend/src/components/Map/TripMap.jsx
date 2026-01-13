import React, { useMemo, useCallback, useState, useEffect } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  FullscreenControl,
  Marker,
  Source,
  Layer,
  Popup,
} from 'react-map-gl';
import { MapPin } from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
import 'mapbox-gl/dist/mapbox-gl.css';

/**
 * Calculate bounds that fit all destinations
 */
const calculateBounds = (destinations) => {
  if (!destinations || destinations.length === 0) {
    return null;
  }

  const coords = destinations
    .map((d) => getCoordinates(d))
    .filter((c) => c !== null);

  if (coords.length === 0) return null;

  const lngs = coords.map((c) => c.lng);
  const lats = coords.map((c) => c.lat);

  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
};

/**
 * Extract coordinates from various destination formats
 */
const getCoordinates = (destination) => {
  if (!destination) return null;

  // Handle different coordinate formats
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

/**
 * Generate GeoJSON LineString for route between destinations
 */
const generateRouteGeoJSON = (destinations) => {
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

const routeLayerStyle = {
  id: 'route-line',
  type: 'line',
  paint: {
    'line-color': '#4F46E5',
    'line-width': 3,
    'line-opacity': 0.8,
    'line-dasharray': [2, 1],
  },
};

const TripMap = ({
  destinations = [],
  selectedDestinationId = null,
  onSelectDestination = null,
  showRoute = true,
  height = '400px',
  className = '',
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const [popupInfo, setPopupInfo] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 10.7522,
    latitude: 59.9139,
    zoom: 5,
  });

  // Sort destinations chronologically
  const sortedDestinations = useMemo(() => {
    if (!destinations || destinations.length === 0) return [];
    return [...destinations].sort(
      (a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate)
    );
  }, [destinations]);

  // Calculate initial view to fit all destinations
  useEffect(() => {
    const bounds = calculateBounds(sortedDestinations);
    if (bounds) {
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;

      // Calculate appropriate zoom level based on bounds spread
      const lngSpread = bounds.maxLng - bounds.minLng;
      const latSpread = bounds.maxLat - bounds.minLat;
      const maxSpread = Math.max(lngSpread, latSpread);

      let zoom = 10;
      if (maxSpread > 20) zoom = 3;
      else if (maxSpread > 10) zoom = 4;
      else if (maxSpread > 5) zoom = 5;
      else if (maxSpread > 2) zoom = 6;
      else if (maxSpread > 1) zoom = 7;
      else if (maxSpread > 0.5) zoom = 8;

      setViewState({
        longitude: centerLng,
        latitude: centerLat,
        zoom: zoom,
      });
    }
  }, [sortedDestinations]);

  // Generate route line
  const routeGeoJSON = useMemo(() => {
    if (!showRoute) return null;
    return generateRouteGeoJSON(sortedDestinations);
  }, [sortedDestinations, showRoute]);

  const handleMarkerClick = useCallback(
    (destination, e) => {
      e.originalEvent.stopPropagation();
      const coords = getCoordinates(destination);
      if (coords) {
        setPopupInfo({ ...destination, ...coords });
      }
      if (onSelectDestination) {
        onSelectDestination(destination.id);
      }
    },
    [onSelectDestination]
  );

  if (!mapboxAccessToken) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500">Map unavailable - Missing Mapbox token</p>
      </div>
    );
  }

  if (sortedDestinations.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500">No destinations to display</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-sm border border-gray-200 ${className}`}
      style={{ height }}
    >
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-left" />
        <FullscreenControl position="top-right" />

        {/* Route line */}
        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer {...routeLayerStyle} />
          </Source>
        )}

        {/* Destination markers */}
        {sortedDestinations.map((destination, index) => {
          const coords = getCoordinates(destination);
          if (!coords) return null;

          const isSelected = selectedDestinationId === destination.id;

          return (
            <Marker
              key={destination.id}
              longitude={coords.lng}
              latitude={coords.lat}
              anchor="bottom"
              onClick={(e) => handleMarkerClick(destination, e)}
            >
              <div
                className={`flex items-center justify-center cursor-pointer transition-transform ${
                  isSelected ? 'scale-125' : 'hover:scale-110'
                }`}
              >
                <div
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-indigo-600 border-2 border-indigo-600'
                  }`}
                >
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={[0, -30]}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div className="p-2 min-w-[150px]">
              <h3 className="font-semibold text-gray-900">{popupInfo.name}</h3>
              {popupInfo.arrivalDate && (
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(popupInfo.arrivalDate).toLocaleDateString()} -{' '}
                  {new Date(popupInfo.departureDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default TripMap;
