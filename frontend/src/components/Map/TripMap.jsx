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
 * Format date range for display
 */
const formatDateRange = (arrivalDate, departureDate) => {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  const options = { month: 'short', day: 'numeric' };
  return `${arrival.toLocaleDateString('en-US', options)} - ${departure.toLocaleDateString('en-US', options)}`;
};

/**
 * Calculate number of nights between dates
 */
const calculateNights = (arrivalDate, departureDate) => {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  const diffTime = Math.abs(departure - arrival);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

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
 * Get appropriate zoom level based on location name
 * Detects if location is a city (has comma separator) or a country
 * Cities get higher zoom, countries get zoom based on their size
 */
const getZoomForLocation = (locationName) => {
  if (!locationName) return 6; // Default zoom

  const name = locationName.toLowerCase();

  // Check if this is a city (location string contains comma, e.g., "Barcelona, Spain")
  // The first part before comma is typically the city/place name
  const isCity = locationName.includes(',');

  if (isCity) {
    // For cities, use a city-level zoom (11-12)
    return 11;
  }

  // For countries, determine zoom based on country size
  // Very large countries (zoom 3-4)
  const veryLarge = ['russia', 'canada', 'united states', 'usa', 'china', 'brazil', 'australia', 'india', 'argentina', 'kazakhstan'];
  if (veryLarge.some((c) => name.includes(c))) return 4;

  // Large countries (zoom 5)
  const large = ['mexico', 'indonesia', 'sudan', 'libya', 'iran', 'mongolia', 'peru', 'chad', 'niger', 'angola', 'mali', 'south africa', 'colombia', 'ethiopia', 'bolivia', 'mauritania', 'egypt', 'tanzania', 'nigeria', 'venezuela', 'pakistan', 'turkey', 'chile', 'zambia', 'myanmar', 'afghanistan', 'somalia', 'central african', 'ukraine', 'madagascar', 'botswana', 'kenya', 'france', 'yemen', 'thailand', 'spain', 'turkmenistan', 'cameroon', 'papua new guinea', 'sweden', 'uzbekistan', 'morocco', 'iraq', 'paraguay', 'zimbabwe', 'japan', 'germany', 'congo', 'finland', 'vietnam', 'malaysia', 'norway', 'poland', 'ivory coast', 'italy', 'philippines', 'ecuador', 'burkina faso', 'new zealand', 'gabon', 'guinea', 'united kingdom', 'uk', 'great britain', 'england', 'ghana', 'romania', 'laos', 'uganda', 'guyana', 'oman', 'belarus', 'kyrgyzstan', 'senegal', 'syria', 'cambodia', 'uruguay', 'suriname', 'tunisia', 'bangladesh', 'nepal', 'tajikistan', 'greece', 'nicaragua', 'north korea', 'malawi', 'eritrea', 'benin', 'honduras', 'liberia', 'bulgaria', 'cuba', 'guatemala', 'iceland', 'south korea', 'korea', 'hungary', 'jordan', 'serbia', 'azerbaijan', 'panama', 'sierra leone', 'georgia', 'sri lanka', 'lithuania', 'latvia', 'togo', 'costa rica', 'dominican republic', 'estonia', 'bhutan', 'taiwan', 'guinea-bissau', 'moldova', 'lesotho', 'armenia', 'solomon islands', 'equatorial guinea', 'burundi', 'haiti', 'rwanda', 'north macedonia', 'djibouti', 'belize', 'el salvador', 'fiji', 'eswatini', 'east timor', 'bahamas', 'montenegro', 'vanuatu', 'gambia', 'jamaica', 'kosovo', 'brunei', 'trinidad', 'cape verde', 'samoa', 'mauritius', 'comoros', 'são tomé', 'kiribati', 'dominica', 'tonga', 'micronesia', 'saint lucia', 'palau', 'seychelles', 'antigua', 'barbados', 'saint vincent', 'grenada', 'saint kitts', 'marshall islands', 'tuvalu', 'nauru'];
  if (large.some((c) => name.includes(c))) return 5;

  // Medium countries (zoom 6)
  const medium = ['portugal', 'austria', 'czech', 'czechia', 'ireland', 'croatia', 'bosnia', 'slovakia', 'denmark', 'netherlands', 'switzerland', 'belgium', 'albania', 'slovenia', 'israel', 'kuwait', 'qatar', 'lebanon', 'cyprus'];
  if (medium.some((c) => name.includes(c))) return 6;

  // Small countries/regions (zoom 8)
  const small = ['luxembourg', 'bahrain', 'malta', 'maldives', 'liechtenstein', 'san marino', 'andorra'];
  if (small.some((c) => name.includes(c))) return 8;

  // City-states (zoom 10)
  const cityStates = ['monaco', 'vatican', 'singapore', 'hong kong', 'macau'];
  if (cityStates.some((c) => name.includes(c))) return 10;

  // Default for unrecognized countries
  return 6;
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
  tripLocation = null, // { latitude, longitude, name } - fallback location when no destinations
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const [hoveredDestinationId, setHoveredDestinationId] = useState(null);
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

  // Calculate initial view to fit all destinations or show trip location
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
    } else if (tripLocation?.latitude && tripLocation?.longitude) {
      // No destinations - center on trip location with zoom based on country size
      const zoom = getZoomForLocation(tripLocation.name);
      setViewState({
        longitude: tripLocation.longitude,
        latitude: tripLocation.latitude,
        zoom,
      });
    }
  }, [sortedDestinations, tripLocation]);

  // Generate route line
  const routeGeoJSON = useMemo(() => {
    if (!showRoute) return null;
    return generateRouteGeoJSON(sortedDestinations);
  }, [sortedDestinations, showRoute]);

  const handleMarkerClick = useCallback(
    (destination, e) => {
      e.originalEvent.stopPropagation();
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

  // Check if we have a trip location to center on when no destinations
  const hasTripLocation = tripLocation?.latitude && tripLocation?.longitude;

  if (sortedDestinations.length === 0 && !hasTripLocation) {
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
          const isHovered = hoveredDestinationId === destination.id;

          return (
            <React.Fragment key={destination.id}>
              <Marker
                longitude={coords.lng}
                latitude={coords.lat}
                anchor="bottom"
                onClick={(e) => handleMarkerClick(destination, e)}
              >
                <div
                  className={`flex items-center justify-center cursor-pointer transition-transform duration-200 ${
                    isHovered || isSelected ? 'scale-125' : 'scale-100'
                  }`}
                  onMouseEnter={() => setHoveredDestinationId(destination.id)}
                  onMouseLeave={() => setHoveredDestinationId(null)}
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
              {(isHovered || isSelected) && (
                <Popup
                  longitude={coords.lng}
                  latitude={coords.lat}
                  anchor="bottom"
                  offset={[0, -40]}
                  closeButton={false}
                  closeOnClick={false}
                >
                  <div className="p-2 min-w-[120px]">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {destination.name || destination.city_name}
                    </h3>
                    {destination.arrivalDate && destination.departureDate && (
                      <>
                        <p className="text-indigo-600 font-medium text-xs mt-1">
                          {formatDateRange(destination.arrivalDate, destination.departureDate)}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {calculateNights(destination.arrivalDate, destination.departureDate)} nights
                        </p>
                      </>
                    )}
                    <p className="text-gray-400 text-xs mt-1 italic">
                      Click to view details
                    </p>
                  </div>
                </Popup>
              )}
            </React.Fragment>
          );
        })}

      </Map>
    </div>
  );
};

export default TripMap;
