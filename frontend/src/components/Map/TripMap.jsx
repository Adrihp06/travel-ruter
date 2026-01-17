import React, { useMemo, useCallback, useState, useEffect } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  FullscreenControl,
  GeolocateControl,
  Marker,
  Source,
  Layer,
  Popup,
} from 'react-map-gl';
import { MapPin, Plus, Car, Footprints, Bike, Train, Plane, ExternalLink } from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
import useRouteStore from '../../stores/useRouteStore';
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

// Route layer style based on transport mode
const getRouteLayerStyle = (transportMode) => {
  const baseStyle = {
    id: 'route-line',
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-width': 4,
      'line-opacity': 0.85,
    },
  };

  switch (transportMode) {
    case 'walking':
      return {
        ...baseStyle,
        paint: {
          ...baseStyle.paint,
          'line-color': '#10B981', // green
          'line-dasharray': [1, 2],
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

// Route outline for better visibility
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

// Transport mode icons and colors
const TRANSPORT_MODES = [
  { id: 'driving', label: 'Drive', icon: Car, color: 'bg-indigo-100 text-indigo-600' },
  { id: 'walking', label: 'Walk', icon: Footprints, color: 'bg-green-100 text-green-600' },
  { id: 'cycling', label: 'Bike', icon: Bike, color: 'bg-amber-100 text-amber-600' },
  { id: 'train', label: 'Train', icon: Train, color: 'bg-purple-100 text-purple-600' },
  { id: 'flight', label: 'Fly', icon: Plane, color: 'bg-blue-100 text-blue-600' },
];

// Format duration nicely
const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
};

// Format distance
const formatDistance = (km) => {
  if (!km || km <= 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

const TripMap = ({
  destinations = [],
  selectedDestinationId = null,
  onSelectDestination = null,
  showRoute = true,
  showRouteControls = true, // New prop to show route options UI
  height = '400px',
  className = '',
  tripLocation = null, // { latitude, longitude, name } - fallback location when no destinations
  enableAddPOI = false, // Enable click-to-add-POI mode
  onAddPOI = null, // Callback when clicking on map to add POI: ({ latitude, longitude }) => void
}) => {
  // Can only add POI if there are destinations to attach them to
  const canAddPOI = enableAddPOI && destinations.length > 0;
  const { mapboxAccessToken } = useMapboxToken();
  const [hoveredDestinationId, setHoveredDestinationId] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 10.7522,
    latitude: 59.9139,
    zoom: 5,
  });
  // Route store integration
  const {
    transportMode,
    setTransportMode,
    routeGeometry,
    routeDetails,
    isLoading: isRouteLoading,
    calculateMapboxRoute,
    exportToGoogleMaps,
  } = useRouteStore();

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

  // Calculate route using Mapbox when destinations change
  useEffect(() => {
    if (showRoute && sortedDestinations.length >= 2) {
      calculateMapboxRoute(sortedDestinations, transportMode);
    }
  }, [sortedDestinations, transportMode, showRoute, calculateMapboxRoute]);

  // Generate route line - prefer API geometry, fallback to straight lines
  const routeGeoJSON = useMemo(() => {
    if (!showRoute) return null;

    // Use route geometry from Mapbox API if available
    if (routeGeometry?.type === 'LineString' || routeGeometry?.coordinates) {
      return {
        type: 'Feature',
        properties: {},
        geometry: routeGeometry,
      };
    }

    // Fallback to straight lines between destinations
    return generateRouteGeoJSON(sortedDestinations);
  }, [sortedDestinations, showRoute, routeGeometry]);

  // Get route layer style based on transport mode
  const routeLayerStyle = useMemo(
    () => getRouteLayerStyle(transportMode),
    [transportMode]
  );

  // Handle transport mode change
  const handleModeChange = useCallback((mode) => {
    setTransportMode(mode);
  }, [setTransportMode]);

  // Handle Google Maps export
  const handleExportToGoogleMaps = useCallback(async () => {
    if (sortedDestinations.length < 2) return;
    const origin = sortedDestinations[0];
    const destination = sortedDestinations[sortedDestinations.length - 1];
    const waypoints = sortedDestinations.slice(1, -1);
    await exportToGoogleMaps(origin, destination, waypoints, transportMode);
  }, [sortedDestinations, transportMode, exportToGoogleMaps]);

  const handleMarkerClick = useCallback(
    (destination, e) => {
      e.originalEvent.stopPropagation();
      if (onSelectDestination) {
        onSelectDestination(destination.id);
      }
    },
    [onSelectDestination]
  );

  // Handle map click for adding POI
  const handleMapClick = useCallback(
    (event) => {
      if (!isAddMode) return;

      const { lngLat } = event;
      const location = {
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      };

      // Don't set pending location - let the modal handle it
      // The marker will appear once the POI is actually created
      setIsAddMode(false);

      if (onAddPOI) {
        onAddPOI(location);
      }
    },
    [isAddMode, onAddPOI]
  );

  // Toggle add mode
  const toggleAddMode = useCallback(() => {
    setIsAddMode((prev) => !prev);
  }, []);

  // Reset add mode when feature is disabled or no destinations
  useEffect(() => {
    if (!canAddPOI) {
      setIsAddMode(false);
    }
  }, [canAddPOI]);

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
        onClick={handleMapClick}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        cursor={isAddMode ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-left" />
        <FullscreenControl position="top-right" />

        {/* Route outline for visibility */}
        {routeGeoJSON && (
          <Source id="route-outline" type="geojson" data={routeGeoJSON}>
            <Layer {...routeOutlineStyle} />
          </Source>
        )}

        {/* Route line */}
        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            <Layer {...routeLayerStyle} />
          </Source>
        )}

        <GeolocateControl position="top-right" />

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

      {/* Add POI button - only show if enabled and there are destinations */}
      {enableAddPOI && (
        <>
          {canAddPOI ? (
            <button
              onClick={toggleAddMode}
              className={`absolute bottom-20 left-4 px-4 py-2 rounded-lg shadow-lg font-medium transition-all flex items-center space-x-2 z-10 ${
                isAddMode
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Plus className={`w-4 h-4 ${isAddMode ? 'rotate-45' : ''} transition-transform`} />
              <span>{isAddMode ? 'Cancel' : 'Add POI'}</span>
            </button>
          ) : (
            <div className="absolute bottom-20 left-4 px-4 py-2 rounded-lg shadow-lg bg-gray-400 text-white font-medium flex items-center space-x-2 cursor-not-allowed z-10">
              <Plus className="w-4 h-4" />
              <span>Add POI</span>
            </div>
          )}

          {/* Overlay hint when in add mode */}
          {isAddMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm z-20">
              Click on the map to add a point of interest
            </div>
          )}

          {/* Hint when no destinations */}
          {!canAddPOI && (
            <div className="absolute bottom-32 left-4 bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-xs max-w-[200px] z-10">
              Add a destination first to create POIs
            </div>
          )}
        </>
      )}

      {/* Route Controls Overlay */}
      {showRouteControls && sortedDestinations.length >= 2 && (
        <>
          {/* Transport Mode Selector - Top Left */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1">
              <div className="flex items-center gap-1">
                {TRANSPORT_MODES.slice(0, 3).map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = transportMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleModeChange(mode.id)}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? mode.color
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={mode.label}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Route Info Bar - Bottom */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Route Stats */}
                  {routeDetails && (
                    <>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatDistance(routeDetails.distance_km)}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-200" />
                      <div className="flex items-center gap-2">
                        {(() => {
                          const ModeIcon = TRANSPORT_MODES.find(m => m.id === transportMode)?.icon || Car;
                          return <ModeIcon className="w-4 h-4 text-gray-400" />;
                        })()}
                        <span className="text-sm font-medium text-gray-900">
                          {formatDuration(routeDetails.duration_min)}
                        </span>
                      </div>
                    </>
                  )}
                  {isRouteLoading && (
                    <span className="text-sm text-gray-500">Calculating route...</span>
                  )}
                  {!routeDetails && !isRouteLoading && (
                    <span className="text-sm text-gray-500">
                      {sortedDestinations.length} stops
                    </span>
                  )}
                </div>

                {/* Export to Google Maps Button */}
                <button
                  onClick={handleExportToGoogleMaps}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Open in Google Maps</span>
                  <span className="sm:hidden">Navigate</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TripMap;
