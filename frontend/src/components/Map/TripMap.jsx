import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Map, {
  Marker,
  Source,
  Layer,
  Popup,
} from 'react-map-gl';
import { MapPin, Plus, Car, Footprints, Bike, Train, Ship, Bus, Calendar, CircleStop } from 'lucide-react';
import ExternalLinkIcon from '@/components/icons/external-link-icon';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';
import HomeIcon from '@/components/icons/home-icon';
import AirplaneIcon from '@/components/icons/airplane-icon';
import { useMapboxToken } from '../../contexts/MapboxContext';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import useRouteStore from '../../stores/useRouteStore';
import useWaypointStore from '../../stores/useWaypointStore';
import useTravelStopStore from '../../stores/useTravelStopStore';
import SegmentNavigator from './SegmentNavigator';
import RouteInfoBar from '../Routes/RouteInfoBar';
import { formatDateRangeShort } from '../../utils/dateFormat';
import { BRAND_COLORS, ROUTE_STYLES, getTransportModeStyle } from './mapStyles';
import 'mapbox-gl/dist/mapbox-gl.css';
import './mapStyles.css';


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

// Route colors and styles based on transport mode - Warm Explorer theme
const TRANSPORT_MODE_STYLES = {
  car: { color: '#D97706', dasharray: null }, // amber (solid)
  driving: { color: '#D97706', dasharray: null }, // amber (solid)
  walk: { color: BRAND_COLORS.accent[600], dasharray: [1, 2] }, // lime green (dotted)
  walking: { color: BRAND_COLORS.accent[600], dasharray: [1, 2] }, // lime green (dotted)
  bike: { color: BRAND_COLORS.primary[400], dasharray: [2, 1] }, // light amber (dashed)
  cycling: { color: BRAND_COLORS.primary[400], dasharray: [2, 1] }, // light amber (dashed)
  train: { color: '#7C3AED', dasharray: null }, // violet (solid - public transit)
  bus: { color: '#7C3AED', dasharray: null }, // violet (solid - public transit)
  plane: { color: '#0284C7', dasharray: [8, 4] }, // sky blue (long-dash)
  flight: { color: '#0284C7', dasharray: [8, 4] }, // sky blue (long-dash)
  ferry: { color: '#0D9488', dasharray: [6, 3] }, // teal (dashed)
};

// Get route layer style for a specific segment with optional highlighting
const getSegmentLayerStyle = (segmentId, transportMode, isSelected = false, hasSelection = false) => {
  const style = TRANSPORT_MODE_STYLES[transportMode] || TRANSPORT_MODE_STYLES.car;

  // Determine opacity and width based on selection state
  let opacity = 0.85;
  let width = 4;

  if (hasSelection) {
    if (isSelected) {
      opacity = 1;
      width = 6;
    } else {
      opacity = 0.4;
      width = 3;
    }
  }

  const paint = {
    'line-color': style.color,
    'line-width': width,
    'line-opacity': opacity,
  };

  if (style.dasharray) {
    paint['line-dasharray'] = style.dasharray;
  }

  return {
    id: `route-segment-${segmentId}`,
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint,
  };
};

// Route outline layer style for a specific segment with optional highlighting
const getSegmentOutlineStyle = (segmentId, isSelected = false, hasSelection = false) => {
  let width = 6;
  let opacity = 0.5;

  if (hasSelection) {
    if (isSelected) {
      width = 10;
      opacity = 0.7;
    } else {
      width = 5;
      opacity = 0.3;
    }
  }

  return {
    id: `route-segment-outline-${segmentId}`,
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': '#ffffff',
      'line-width': width,
      'line-opacity': opacity,
    },
  };
};

// Get route layer style for origin/return segments - uses transport mode styles
// so they appear as part of the main route chain
const getOriginReturnLayerStyle = (segmentId, transportMode) => {
  const style = TRANSPORT_MODE_STYLES[transportMode] || TRANSPORT_MODE_STYLES.car;

  const paint = {
    'line-color': style.color,
    'line-width': 4,
    'line-opacity': 0.85,
  };

  if (style.dasharray) {
    paint['line-dasharray'] = style.dasharray;
  }

  return {
    id: `route-${segmentId}`,
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint,
  };
};

// Origin/Return segment outline style
const getOriginReturnOutlineStyle = (segmentId) => ({
  id: `route-${segmentId}-outline`,
  type: 'line',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#ffffff',
    'line-width': 5,
    'line-opacity': 0.4,
  },
});

// Transport mode icons mapping
const TRANSPORT_MODE_ICONS = {
  car: Car,
  driving: Car,
  walk: Footprints,
  walking: Footprints,
  bike: Bike,
  cycling: Bike,
  train: Train,
  bus: Bus,
  plane: AirplaneIcon,
  flight: AirplaneIcon,
  ferry: Ship,
};

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
  showRouteControls = true, // Show route info bar
  height = '400px',
  className = '',
  tripLocation = null, // { latitude, longitude, name } - fallback location when no destinations
  enableAddDestination = false, // Enable click-to-add-destination mode
  onAddDestination = null, // Callback when clicking on map to add destination: ({ latitude, longitude }) => void
  tripId = null, // Trip ID for fetching travel segments
  onSegmentRouteUpdated = null, // Callback when a segment route is updated (after waypoint changes)
  // Origin and return point data from trip
  originPoint = null, // { name, latitude, longitude }
  returnPoint = null, // { name, latitude, longitude }
}) => {
  const { t } = useTranslation();
  // Can add destination from map click
  const canAddDestination = enableAddDestination && onAddDestination;
  const { mapboxAccessToken } = useMapboxToken();
  const mapRef = useRef(null);
  const [hoveredDestinationId, setHoveredDestinationId] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [hoveredStopId, setHoveredStopId] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 10.7522,
    latitude: 59.9139,
    zoom: 5,
  });
  const [showFallbackWarning, setShowFallbackWarning] = useState(true);

  // Travel segments store for segment-based routing
  const { segments, originSegment, returnSegment, fetchTripSegments, clearSegments, isLoading: isSegmentsLoading, hasFetchedInitial } = useTravelSegmentStore();

  // Route store for Google Maps export and route calculation
  const { exportToGoogleMaps, calculateORSRoute, checkORSAvailability } = useRouteStore();

  // Calculated routes for origin/return when backend doesn't provide route_geometry
  const [calculatedOriginRoute, setCalculatedOriginRoute] = useState(null);
  const [calculatedReturnRoute, setCalculatedReturnRoute] = useState(null);

  // Waypoint store for adding waypoints via map clicks
  const {
    addingWaypointMode,
    createWaypoint,
    exitAddWaypointMode,
    getWaypoints,
    fetchSegmentWaypoints,
  } = useWaypointStore();

  // Track waypoints for all segments
  const [segmentWaypoints, setSegmentWaypoints] = useState({});

  // Travel stop store for intermediate stops between destinations
  const { stopsBySegment, fetchStopsForSegments } = useTravelStopStore();

  // Sort destinations chronologically
  const sortedDestinations = useMemo(() => {
    if (!destinations || destinations.length === 0) return [];
    return [...destinations].sort(
      (a, b) => new Date(a.arrivalDate) - new Date(b.arrivalDate)
    );
  }, [destinations]);

  // Create a stable key for destination ordering to detect reorders
  const destinationOrderKey = useMemo(() => {
    return sortedDestinations.map(d => d.id).join(',');
  }, [sortedDestinations]);

  // Clear segments when tripId changes or component unmounts
  useEffect(() => {
    return () => {
      clearSegments();
    };
  }, [tripId, clearSegments]);

  // Fetch travel segments when trip changes or destinations are reordered
  useEffect(() => {
    if (tripId && sortedDestinations.length >= 2) {
      fetchTripSegments(tripId);
    }
  }, [tripId, destinationOrderKey, fetchTripSegments]);

  // Calculate real routes for origin/return when backend doesn't provide route_geometry
  useEffect(() => {
    let cancelled = false;

    const calculateMissingRoutes = async () => {
      const firstDestination = sortedDestinations[0];
      const lastDestination = sortedDestinations[sortedDestinations.length - 1];

      // Check if we need to calculate origin route
      const needsOriginRoute = originPoint?.latitude && originPoint?.longitude &&
        firstDestination &&
        !originSegment?.route_geometry?.coordinates?.length;

      // Check if we need to calculate return route
      const needsReturnRoute = returnPoint?.latitude && returnPoint?.longitude &&
        lastDestination &&
        !returnSegment?.route_geometry?.coordinates?.length;

      if (!needsOriginRoute && !needsReturnRoute) return;

      // Check if ORS is available
      const orsAvailable = await checkORSAvailability();
      if (!orsAvailable || cancelled) return;

      // Modes that ORS can route (road/path based)
      const routableModes = new Set(['car', 'driving', 'walk', 'walking', 'bike', 'cycling', 'bus', 'train']);

      // Calculate origin route if needed
      if (needsOriginRoute) {
        const firstDestCoords = getCoordinates(firstDestination);
        const originMode = originSegment?.travel_mode || 'car';

        if (firstDestCoords) {
          if (routableModes.has(originMode)) {
            // Use ORS for routable modes
            const orsMode = (originMode === 'walk' || originMode === 'walking') ? 'walking'
              : (originMode === 'bike' || originMode === 'cycling') ? 'cycling'
              : 'driving';
            const result = await calculateORSRoute([
              { latitude: originPoint.latitude, longitude: originPoint.longitude },
              { latitude: firstDestCoords.lat, longitude: firstDestCoords.lng }
            ], orsMode);
            if (result?.geometry && !cancelled) {
              setCalculatedOriginRoute(result.geometry);
            }
          } else {
            // For plane/flight/ferry - use straight line
            if (!cancelled) {
              setCalculatedOriginRoute({
                type: 'LineString',
                coordinates: [
                  [originPoint.longitude, originPoint.latitude],
                  [firstDestCoords.lng, firstDestCoords.lat],
                ],
              });
            }
          }
        }
      }

      if (cancelled) return;

      // Calculate return route if needed
      if (needsReturnRoute) {
        const lastDestCoords = getCoordinates(lastDestination);
        const returnMode = returnSegment?.travel_mode || 'car';

        if (lastDestCoords) {
          if (routableModes.has(returnMode)) {
            // Use ORS for routable modes
            const orsMode = (returnMode === 'walk' || returnMode === 'walking') ? 'walking'
              : (returnMode === 'bike' || returnMode === 'cycling') ? 'cycling'
              : 'driving';
            const result = await calculateORSRoute([
              { latitude: lastDestCoords.lat, longitude: lastDestCoords.lng },
              { latitude: returnPoint.latitude, longitude: returnPoint.longitude }
            ], orsMode);
            if (result?.geometry && !cancelled) {
              setCalculatedReturnRoute(result.geometry);
            }
          } else {
            // For plane/flight/ferry - use straight line
            if (!cancelled) {
              setCalculatedReturnRoute({
                type: 'LineString',
                coordinates: [
                  [lastDestCoords.lng, lastDestCoords.lat],
                  [returnPoint.longitude, returnPoint.latitude],
                ],
              });
            }
          }
        }
      }
    };

    if (sortedDestinations.length > 0 && hasFetchedInitial) {
      calculateMissingRoutes();
    }

    return () => { cancelled = true; };
  }, [
    originPoint, returnPoint, sortedDestinations, originSegment, returnSegment,
    checkORSAvailability, calculateORSRoute, hasFetchedInitial
  ]);

  // Fetch waypoints for all segments
  useEffect(() => {
    const fetchAllWaypoints = async () => {
      if (!segments || segments.length === 0) return;

      const waypointsMap = {};
      for (const segment of segments) {
        try {
          const waypoints = await fetchSegmentWaypoints(segment.id);
          waypointsMap[segment.id] = waypoints || [];
        } catch {
          waypointsMap[segment.id] = [];
        }
      }
      setSegmentWaypoints(waypointsMap);
    };

    fetchAllWaypoints();
  }, [segments, fetchSegmentWaypoints]);

  // Fetch travel stops for all segments
  useEffect(() => {
    if (segments && segments.length > 0) {
      const segmentIds = segments.map(s => s.id);
      fetchStopsForSegments(segmentIds);
    }
  }, [segments, fetchStopsForSegments]);

  // Collect all travel stops across segments for rendering
  const allTravelStops = useMemo(() => {
    const stops = [];
    Object.entries(stopsBySegment).forEach(([segmentId, segmentStops]) => {
      if (Array.isArray(segmentStops)) {
        segmentStops.forEach(stop => {
          if (stop.latitude && stop.longitude) {
            stops.push({ ...stop, _segmentId: segmentId });
          }
        });
      }
    });
    return stops;
  }, [stopsBySegment]);

  // Calculate initial view to fit all destinations, origin, and return points
  useEffect(() => {
    // Include origin and return points in bounds calculation
    const allPoints = [...sortedDestinations];

    // Add origin point as a pseudo-destination for bounds calculation
    if (originPoint?.latitude && originPoint?.longitude) {
      allPoints.push({ latitude: originPoint.latitude, longitude: originPoint.longitude });
    }

    // Add return point if different from origin
    if (returnPoint?.latitude && returnPoint?.longitude) {
      allPoints.push({ latitude: returnPoint.latitude, longitude: returnPoint.longitude });
    }

    const bounds = calculateBounds(allPoints);
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
  }, [sortedDestinations, tripLocation, originPoint, returnPoint]);

  // Build valid consecutive destination pairs
  const validSegmentPairs = useMemo(() => {
    const pairs = new Set();
    for (let i = 0; i < sortedDestinations.length - 1; i++) {
      pairs.add(`${sortedDestinations[i].id}-${sortedDestinations[i + 1].id}`);
    }
    return pairs;
  }, [sortedDestinations]);

  // Build segment data with GeoJSON for rendering
  // When a segment has route_legs (per-leg travel modes), produce multiple features
  const segmentGeoJSONs = useMemo(() => {
    if (!showRoute || !segments || segments.length === 0) return [];

    return segments
      // Only include segments that match current destination order
      .filter((segment) => {
        const pairKey = `${segment.from_destination_id}-${segment.to_destination_id}`;
        return validSegmentPairs.has(pairKey);
      })
      .map((segment) => {
        // Build features array: one feature per leg, or single feature for whole segment
        const features = [];
        const modesSet = new Set();

        if (segment.route_legs?.length > 0) {
          // Per-leg features from route_legs
          for (const leg of segment.route_legs) {
            if (!leg.geometry?.type || !leg.geometry?.coordinates?.length) continue;
            const mode = leg.travel_mode || segment.travel_mode || 'car';
            modesSet.add(mode);
            features.push({
              type: 'Feature',
              properties: { travel_mode: mode },
              geometry: leg.geometry,
            });
          }
        }

        // Fallback: single geometry for the whole segment
        if (features.length === 0) {
          const fromDest = sortedDestinations.find(d => d.id === segment.from_destination_id);
          const toDest = sortedDestinations.find(d => d.id === segment.to_destination_id);

          let geometry = null;

          if (segment.route_geometry?.type === 'LineString' && segment.route_geometry?.coordinates?.length >= 2) {
            geometry = segment.route_geometry;
          } else if (!isSegmentsLoading) {
            // Only generate straight-line fallback AFTER loading completes
            const fromCoords = getCoordinates(fromDest);
            const toCoords = getCoordinates(toDest);
            if (fromCoords && toCoords) {
              geometry = {
                type: 'LineString',
                coordinates: [
                  [fromCoords.lng, fromCoords.lat],
                  [toCoords.lng, toCoords.lat],
                ],
              };
            }
          }

          if (!geometry) return null;

          const mode = segment.travel_mode || 'car';
          modesSet.add(mode);
          features.push({
            type: 'Feature',
            properties: { travel_mode: mode },
            geometry,
          });
        }

        return {
          id: segment.id,
          parentSegmentId: segment.id,
          travel_mode: segment.travel_mode,
          distance_km: segment.distance_km,
          duration_minutes: segment.duration_minutes,
          modes: [...modesSet],
          geojson: {
            type: 'FeatureCollection',
            features,
          },
        };
      })
      .filter(Boolean);
  }, [showRoute, segments, sortedDestinations, validSegmentPairs, isSegmentsLoading]);

  // Build GeoJSON for origin and return segments (dotted line style)
  const originReturnGeoJSONs = useMemo(() => {
    if (!showRoute) return [];

    const results = [];
    const firstDestination = sortedDestinations[0];
    const lastDestination = sortedDestinations[sortedDestinations.length - 1];

    // Origin segment: origin point → first destination
    if (originPoint?.latitude && originPoint?.longitude && firstDestination) {
      const firstDestCoords = getCoordinates(firstDestination);
      let geometry = null;

      // Priority 1: Use route_geometry from API if available and valid
      if (originSegment?.route_geometry?.type === 'LineString' &&
          originSegment?.route_geometry?.coordinates?.length >= 2) {
        geometry = originSegment.route_geometry;
      }
      // Priority 2: Use calculated route from ORS
      else if (calculatedOriginRoute?.type === 'LineString' &&
               calculatedOriginRoute?.coordinates?.length >= 2) {
        geometry = calculatedOriginRoute;
      }
      // Priority 3: Fallback to straight line (only after loading completes)
      else if (!isSegmentsLoading && firstDestCoords) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [originPoint.longitude, originPoint.latitude],
            [firstDestCoords.lng, firstDestCoords.lat],
          ],
        };
      }

      if (geometry) {
        results.push({
          id: 'origin-segment',
          segment_type: 'origin',
          travel_mode: originSegment?.travel_mode || 'car',
          distance_km: originSegment?.distance_km,
          duration_minutes: originSegment?.duration_minutes,
          is_fallback: !originSegment?.route_geometry && !calculatedOriginRoute,
          geojson: {
            type: 'Feature',
            properties: {
              id: 'origin-segment',
              segment_type: 'origin',
              travel_mode: originSegment?.travel_mode || 'car',
            },
            geometry,
          },
        });
      }
    }

    // Return segment: last destination → return point
    if (returnPoint?.latitude && returnPoint?.longitude && lastDestination) {
      const lastDestCoords = getCoordinates(lastDestination);
      let geometry = null;

      // Priority 1: Use route_geometry from API if available and valid
      if (returnSegment?.route_geometry?.type === 'LineString' &&
          returnSegment?.route_geometry?.coordinates?.length >= 2) {
        geometry = returnSegment.route_geometry;
      }
      // Priority 2: Use calculated route from ORS
      else if (calculatedReturnRoute?.type === 'LineString' &&
               calculatedReturnRoute?.coordinates?.length >= 2) {
        geometry = calculatedReturnRoute;
      }
      // Priority 3: Fallback to straight line (only after loading completes)
      else if (!isSegmentsLoading && lastDestCoords) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [lastDestCoords.lng, lastDestCoords.lat],
            [returnPoint.longitude, returnPoint.latitude],
          ],
        };
      }

      if (geometry) {
        results.push({
          id: 'return-segment',
          segment_type: 'return',
          travel_mode: returnSegment?.travel_mode || 'car',
          distance_km: returnSegment?.distance_km,
          duration_minutes: returnSegment?.duration_minutes,
          is_fallback: !returnSegment?.route_geometry && !calculatedReturnRoute,
          geojson: {
            type: 'Feature',
            properties: {
              id: 'return-segment',
              segment_type: 'return',
              travel_mode: returnSegment?.travel_mode || 'car',
            },
            geometry,
          },
        });
      }
    }

    return results;
  }, [showRoute, originSegment, returnSegment, originPoint, returnPoint, sortedDestinations, calculatedOriginRoute, calculatedReturnRoute, isSegmentsLoading]);

  // Filter segments to only valid pairs for calculations
  const validSegments = useMemo(() => {
    if (!segments || segments.length === 0) return [];
    return segments.filter((segment) => {
      const pairKey = `${segment.from_destination_id}-${segment.to_destination_id}`;
      return validSegmentPairs.has(pairKey);
    });
  }, [segments, validSegmentPairs]);

  // Calculate total distance and duration from valid segments plus origin/return
  const routeTotals = useMemo(() => {
    const hasDestinationSegments = validSegments && validSegments.length > 0;
    const hasOriginReturn = originSegment || returnSegment;

    if (!hasDestinationSegments && !hasOriginReturn) return null;

    let totalDistance = validSegments.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    let totalDuration = validSegments.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    let segmentCount = validSegments.length;
    const fallbackSegments = validSegments.filter(s => s.is_fallback);
    let fallbackCount = fallbackSegments.length;

    // Add origin segment
    if (originSegment) {
      totalDistance += originSegment.distance_km || 0;
      totalDuration += originSegment.duration_minutes || 0;
      segmentCount += 1;
      if (originSegment.is_fallback) fallbackCount += 1;
    }

    // Add return segment
    if (returnSegment) {
      totalDistance += returnSegment.distance_km || 0;
      totalDuration += returnSegment.duration_minutes || 0;
      segmentCount += 1;
      if (returnSegment.is_fallback) fallbackCount += 1;
    }

    return {
      distance_km: totalDistance,
      duration_minutes: totalDuration,
      segment_count: segmentCount,
      has_fallback: fallbackCount > 0,
      fallback_count: fallbackCount,
      has_origin: !!originSegment,
      has_return: !!returnSegment,
    };
  }, [validSegments, originSegment, returnSegment]);

  // Auto-hide fallback warning after 4 seconds
  useEffect(() => {
    if (routeTotals?.has_fallback) {
      setShowFallbackWarning(true);
      const timer = setTimeout(() => {
        setShowFallbackWarning(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [routeTotals?.has_fallback, routeTotals?.fallback_count]);

  // Handle Google Maps export - includes travel stops as waypoints
  const handleExportToGoogleMaps = useCallback(async () => {
    if (sortedDestinations.length < 2) return;
    const origin = sortedDestinations[0];
    const destination = sortedDestinations[sortedDestinations.length - 1];

    // Build ordered waypoints: intermediate destinations + travel stops
    const orderedWaypoints = [];
    for (let i = 0; i < sortedDestinations.length - 1; i++) {
      // Add intermediate destination (skip first=origin, include middle ones)
      if (i > 0) {
        orderedWaypoints.push(sortedDestinations[i]);
      }
      // Find segment between this dest and the next, add its stops
      const segment = segments.find(s =>
        s.from_destination_id === sortedDestinations[i].id &&
        s.to_destination_id === sortedDestinations[i + 1].id
      );
      if (segment) {
        const stops = stopsBySegment[segment.id] || [];
        stops.filter(s => s.latitude && s.longitude)
             .forEach(s => orderedWaypoints.push(s));
      }
    }

    await exportToGoogleMaps(origin, destination, orderedWaypoints, 'driving');
  }, [sortedDestinations, segments, stopsBySegment, exportToGoogleMaps]);

  // Handle segment click - center map on segment and highlight it
  const handleSegmentClick = useCallback((segment) => {
    // Toggle selection if clicking the same segment
    if (selectedSegmentId === segment.id) {
      setSelectedSegmentId(null);
      return;
    }

    setSelectedSegmentId(segment.id);

    // Collect all geometry coordinates from the segment's FeatureCollection
    const segmentEntry = segmentGeoJSONs.find(s => s.id === segment.id);
    const allCoordinates = (segmentEntry?.geojson?.features || []).flatMap(
      f => f.geometry?.coordinates || []
    );
    if (allCoordinates.length < 2) return;

    // Calculate bounds from all coordinates
    const lngs = allCoordinates.map(c => c[0]);
    const lats = allCoordinates.map(c => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Fit map to segment bounds with padding
    if (mapRef.current) {
      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        {
          padding: { top: 80, bottom: 120, left: 60, right: 60 },
          duration: 800,
        }
      );
    }
  }, [selectedSegmentId, segmentGeoJSONs]);

  const handleMarkerClick = useCallback(
    (destination, e) => {
      e.originalEvent.stopPropagation();
      if (onSelectDestination) {
        onSelectDestination(destination.id);
      }
    },
    [onSelectDestination]
  );

  // Handle map click for adding POI or waypoint
  const handleMapClick = useCallback(
    async (event) => {
      const { lngLat } = event;

      // Check if we're in waypoint adding mode
      if (addingWaypointMode) {
        const waypointData = {
          latitude: lngLat.lat,
          longitude: lngLat.lng,
        };

        try {
          await createWaypoint(addingWaypointMode, waypointData);
          exitAddWaypointMode();

          // Refresh segments to get updated route geometry
          if (tripId) {
            await fetchTripSegments(tripId);
          }

          // Notify parent about route update
          if (onSegmentRouteUpdated) {
            onSegmentRouteUpdated(addingWaypointMode);
          }
        } catch (err) {
          console.error('Failed to create waypoint:', err);
        }
        return;
      }

      // Handle destination adding mode
      if (!isAddMode) return;

      const location = {
        latitude: lngLat.lat,
        longitude: lngLat.lng,
      };

      // Exit add mode and trigger callback
      setIsAddMode(false);

      if (onAddDestination) {
        onAddDestination(location);
      }
    },
    [isAddMode, onAddDestination, addingWaypointMode, createWaypoint, exitAddWaypointMode, tripId, fetchTripSegments, onSegmentRouteUpdated]
  );

  // Toggle add mode
  const toggleAddMode = useCallback(() => {
    setIsAddMode((prev) => !prev);
  }, []);

  // Reset add mode when feature is disabled
  useEffect(() => {
    if (!canAddDestination) {
      setIsAddMode(false);
    }
  }, [canAddDestination]);

  if (!mapboxAccessToken) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500 dark:text-gray-400">{t('map.unavailableMissingToken')}</p>
      </div>
    );
  }

  // Check if we have a trip location to center on when no destinations
  const hasTripLocation = tripLocation?.latitude && tripLocation?.longitude;
  const hasOriginPoint = originPoint?.latitude && originPoint?.longitude;

  if (sortedDestinations.length === 0 && !hasTripLocation && !hasOriginPoint) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl ${className}`}
        style={{ height }}
      >
        <p className="text-gray-500 dark:text-gray-400">{t('map.noDestinations')}</p>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${className}`}
      style={{ height }}
    >
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        attributionControl={false}
        cursor={isAddMode || addingWaypointMode ? 'crosshair' : 'grab'}
      >
        {/* Route segments - each with its own color based on transport mode */}
        {segmentGeoJSONs.map((segmentData) => {
          const isSelected = selectedSegmentId === segmentData.id;
          const hasSelection = selectedSegmentId !== null;

          return (
            <React.Fragment key={`segment-${segmentData.id}`}>
              {/* Segment outline for visibility */}
              <Source
                id={`route-segment-outline-${segmentData.id}`}
                type="geojson"
                data={segmentData.geojson}
              >
                <Layer {...getSegmentOutlineStyle(segmentData.id, isSelected, hasSelection)} />
              </Source>
              {/* Per-mode layers within one stable source */}
              <Source
                id={`route-segment-${segmentData.id}`}
                type="geojson"
                data={segmentData.geojson}
              >
                {segmentData.modes.map((mode) => {
                  const style = getSegmentLayerStyle(`${segmentData.id}-${mode}`, mode, isSelected, hasSelection);
                  return (
                    <Layer
                      key={mode}
                      {...style}
                      filter={['==', ['get', 'travel_mode'], mode]}
                    />
                  );
                })}
              </Source>
            </React.Fragment>
          );
        })}

        {/* Origin/Return route segments - styled by transport mode */}
        {originReturnGeoJSONs.map((segmentData) => (
          <React.Fragment key={`or-segment-${segmentData.id}`}>
            {/* Segment outline for visibility */}
            <Source
              id={`${segmentData.id}-outline-source`}
              type="geojson"
              data={segmentData.geojson}
            >
              <Layer {...getOriginReturnOutlineStyle(segmentData.id)} />
            </Source>
            {/* Segment line with transport mode color */}
            <Source
              id={`${segmentData.id}-source`}
              type="geojson"
              data={segmentData.geojson}
            >
              <Layer {...getOriginReturnLayerStyle(segmentData.id, segmentData.travel_mode)} />
            </Source>
          </React.Fragment>
        ))}

        {/* Destination markers - Warm Explorer theme */}
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
                  className={`map-marker cursor-pointer transition-all duration-200 ${
                    isHovered || isSelected ? 'scale-125' : 'scale-100'
                  }`}
                  onMouseEnter={() => setHoveredDestinationId(destination.id)}
                  onMouseLeave={() => setHoveredDestinationId(null)}
                >
                  <div className="destination-marker">
                    <div
                      className={`destination-marker-circle ${isSelected ? 'map-marker-selected' : ''}`}
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, ${BRAND_COLORS.primary[700]} 0%, ${BRAND_COLORS.primary[800]} 100%)`
                          : (isHovered || isSelected)
                            ? `linear-gradient(135deg, ${BRAND_COLORS.primary[600]} 0%, ${BRAND_COLORS.primary[700]} 100%)`
                            : '#ffffff',
                        color: isSelected ? '#ffffff' : BRAND_COLORS.primary[600],
                        border: isSelected ? '3px solid #ffffff' : `3px solid ${BRAND_COLORS.primary[600]}`,
                      }}
                    >
                      <span className="text-sm font-bold">{index + 1}</span>
                    </div>
                    {/* Pointer triangle */}
                    <div
                      className="destination-marker-pointer"
                      style={{
                        borderTopColor: isSelected ? BRAND_COLORS.primary[700] : BRAND_COLORS.primary[600],
                      }}
                    />
                  </div>
                </div>
              </Marker>
              {(isHovered || isSelected) && (
                <Popup
                  longitude={coords.lng}
                  latitude={coords.lat}
                  anchor="bottom"
                  offset={[0, -44]}
                  closeButton={false}
                  closeOnClick={false}
                  className="trip-map-popup"
                >
                  <div className="p-4 min-w-[160px]">
                    <h3 className="font-display font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">
                      {destination.name || destination.city_name}
                    </h3>
                    {destination.arrivalDate && destination.departureDate && (
                      <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-700">
                        <p className="text-amber-600 dark:text-amber-400 font-semibold text-xs flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {formatDateRangeShort(destination.arrivalDate, destination.departureDate)}
                        </p>
                        <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5 font-medium">
                          {calculateNights(destination.arrivalDate, destination.departureDate)} {t('common.nights')}
                        </p>
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                        {t('routes.openInGoogleMaps')}
                      </button>
                    </div>
                    <p className="text-stone-400 dark:text-stone-500 text-xs mt-2 font-medium">
                      {t('map.clickToViewDetails')}
                    </p>
                  </div>
                </Popup>
              )}
            </React.Fragment>
          );
        })}

        {/* Waypoint markers */}
        {Object.entries(segmentWaypoints).map(([segmentId, waypoints]) =>
          waypoints.map((waypoint) => (
            <Marker
              key={`waypoint-${waypoint.id}`}
              longitude={waypoint.longitude}
              latitude={waypoint.latitude}
              anchor="center"
            >
              <div
                className="w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm cursor-pointer hover:scale-125 transition-transform"
                title={waypoint.name || `Waypoint ${waypoint.order_index + 1}`}
              />
            </Marker>
          ))
        )}

        {/* Travel stop markers - Orange stop markers distinct from destinations */}
        {allTravelStops.map((stop) => (
          <React.Fragment key={`stop-${stop.id}`}>
            <Marker
              longitude={stop.longitude}
              latitude={stop.latitude}
              anchor="bottom"
            >
              <div
                className={`map-marker cursor-pointer transition-all duration-200 ${
                  hoveredStopId === stop.id ? 'scale-125' : 'scale-100'
                }`}
                onMouseEnter={() => setHoveredStopId(stop.id)}
                onMouseLeave={() => setHoveredStopId(null)}
              >
                <div className="destination-marker">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white"
                    style={{
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      boxShadow: '0 3px 10px rgba(249, 115, 22, 0.4), 0 1px 3px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <CircleStop className="w-4 h-4" />
                  </div>
                  <div
                    className="destination-marker-pointer"
                    style={{ borderTopColor: '#f97316' }}
                  />
                </div>
              </div>
            </Marker>
            {hoveredStopId === stop.id && (
              <Popup
                longitude={stop.longitude}
                latitude={stop.latitude}
                anchor="bottom"
                offset={[0, -36]}
                closeButton={false}
                closeOnClick={false}
                className="trip-map-popup"
              >
                <div className="p-3 min-w-[140px]">
                  <h3 className="font-display font-bold text-stone-900 dark:text-stone-100 text-sm">
                    {stop.name}
                  </h3>
                  {stop.duration_minutes > 0 && (
                    <p className="text-orange-600 dark:text-orange-400 text-xs font-medium mt-1">
                      {stop.duration_minutes >= 60
                        ? `${Math.floor(stop.duration_minutes / 60)}h${Math.round(stop.duration_minutes % 60) > 0 ? ` ${Math.round(stop.duration_minutes % 60)}m` : ''}`
                        : `${Math.round(stop.duration_minutes)}m`
                      } {t('routes.stop')}
                    </p>
                  )}
                  {stop.address && (
                    <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5 truncate">{stop.address}</p>
                  )}
                </div>
              </Popup>
            )}
          </React.Fragment>
        ))}

        {/* Origin marker - Green with plane icon and gradient */}
        {originPoint?.latitude && originPoint?.longitude && (
          <Marker
            longitude={originPoint.longitude}
            latitude={originPoint.latitude}
            anchor="bottom"
          >
            <div className="map-marker">
              <div className="destination-marker">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white border-3 border-white"
                  style={{
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <AirplaneIcon className="w-5 h-5" />
                </div>
                <div
                  className="destination-marker-pointer"
                  style={{ borderTopColor: '#22c55e' }}
                />
              </div>
            </div>
          </Marker>
        )}

        {/* Return marker - Rose with home icon (only if different from origin) */}
        {returnPoint?.latitude && returnPoint?.longitude &&
          (originPoint?.latitude !== returnPoint?.latitude ||
           originPoint?.longitude !== returnPoint?.longitude) && (
          <Marker
            longitude={returnPoint.longitude}
            latitude={returnPoint.latitude}
            anchor="bottom"
          >
            <div className="map-marker">
              <div className="destination-marker">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white border-3 border-white"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                    boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <HomeIcon className="w-5 h-5" />
                </div>
                <div
                  className="destination-marker-pointer"
                  style={{ borderTopColor: '#f43f5e' }}
                />
              </div>
            </div>
          </Marker>
        )}

      </Map>

      {/* Waypoint adding mode hint */}
      {addingWaypointMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm z-20 shadow-lg">
          {t('map.clickToAddWaypoint')}
        </div>
      )}

      {/* Add Destination button - show if enabled - Warm Explorer theme */}
      {/* Position adjusts based on whether route info bar is showing below */}
      {enableAddDestination && (
        <button
          onClick={toggleAddMode}
          className={`absolute left-3 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg font-semibold transition-all flex items-center gap-2 z-10 text-sm ${
            showRouteControls && sortedDestinations.length >= 2 ? 'bottom-16' : 'bottom-3'
          }`}
          style={{
            background: isAddMode
              ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
              : `linear-gradient(135deg, ${BRAND_COLORS.primary[600]} 0%, ${BRAND_COLORS.primary[700]} 100%)`,
            color: '#ffffff',
            boxShadow: isAddMode
              ? '0 4px 14px rgba(244, 63, 94, 0.35)'
              : '0 4px 14px rgba(180, 83, 9, 0.35)',
          }}
        >
          <Plus className={`w-4 h-4 ${isAddMode ? 'rotate-45' : ''} transition-transform duration-200`} />
          <span>{isAddMode ? t('common.cancel') : t('map.addDestination')}</span>
        </button>
      )}

      {/* Overlay hint when in add mode - Enhanced styling */}
      {isAddMode && (
        <div className="absolute top-4 left-1/2 z-20">
          <div className="add-mode-overlay">
            <Plus className="w-4 h-4" />
            <span>{t('map.clickToAddDestination')}</span>
          </div>
        </div>
      )}

      {/* Segment Navigator + Fallback Warning - top-left stack */}
      {showRouteControls && sortedDestinations.length >= 2 && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {routeTotals && (
            <div className="bg-white/95 dark:bg-stone-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-stone-200 dark:border-stone-700 px-3 py-2">
              <SegmentNavigator
                segments={validSegments}
                destinations={sortedDestinations}
                selectedSegmentId={selectedSegmentId}
                onSegmentClick={handleSegmentClick}
              />
            </div>
          )}

          {/* Fallback Warning - below segment navigator, auto-hides after 4 seconds */}
          {routeTotals?.has_fallback && showFallbackWarning && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl shadow-lg p-2 transition-opacity duration-300 max-w-[280px]">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <TriangleAlertIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-semibold">
                  {t('map.fallbackRouteWarning', { count: routeTotals.fallback_count })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Route Info Bar - Bottom left - compact, only distance + duration + Google Maps */}
      {showRouteControls && sortedDestinations.length >= 2 && (
        <div className="absolute bottom-3 left-3 z-10">
          <RouteInfoBar
            distance={routeTotals?.distance_km}
            duration={routeTotals?.duration_minutes}
            isCalculating={isSegmentsLoading}
            onExportGoogleMaps={handleExportToGoogleMaps}
            emptyLabel={`${sortedDestinations.length} ${t('routes.stops')}`}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(TripMap);
