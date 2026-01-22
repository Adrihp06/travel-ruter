import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
import { MapPin, Plus, Car, Footprints, Bike, Train, Plane, Ship, Bus, ExternalLink, AlertTriangle, Home } from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
import useTravelSegmentStore from '../../stores/useTravelSegmentStore';
import useRouteStore from '../../stores/useRouteStore';
import useWaypointStore from '../../stores/useWaypointStore';
import SegmentNavigator from './SegmentNavigator';
import { formatDateRangeShort } from '../../utils/dateFormat';
import 'mapbox-gl/dist/mapbox-gl.css';


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

// Route colors and styles based on transport mode
const TRANSPORT_MODE_STYLES = {
  car: { color: '#4F46E5', dasharray: null }, // indigo (solid)
  driving: { color: '#4F46E5', dasharray: null }, // indigo (solid)
  walk: { color: '#10B981', dasharray: [1, 2] }, // green (dotted)
  walking: { color: '#10B981', dasharray: [1, 2] }, // green (dotted)
  bike: { color: '#F59E0B', dasharray: [2, 1] }, // amber (dashed)
  cycling: { color: '#F59E0B', dasharray: [2, 1] }, // amber (dashed)
  train: { color: '#8B5CF6', dasharray: [4, 2] }, // purple (dash-dot)
  bus: { color: '#EC4899', dasharray: [3, 2] }, // pink (dashed)
  plane: { color: '#3B82F6', dasharray: [8, 4] }, // blue (long-dash)
  flight: { color: '#3B82F6', dasharray: [8, 4] }, // blue (long-dash)
  ferry: { color: '#06B6D4', dasharray: [6, 3] }, // cyan (dashed)
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

// Origin/Return segment styles - always dotted
const ORIGIN_RETURN_STYLES = {
  origin: { color: '#10B981', dasharray: [2, 4] }, // green dotted
  return: { color: '#EF4444', dasharray: [2, 4] }, // red dotted
};

// Get route layer style for origin/return segments (always dotted)
const getOriginReturnLayerStyle = (segmentId, segmentType) => {
  const style = ORIGIN_RETURN_STYLES[segmentType] || ORIGIN_RETURN_STYLES.origin;

  return {
    id: `route-${segmentId}`,
    type: 'line',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': style.color,
      'line-width': 3,
      'line-opacity': 0.7,
      'line-dasharray': style.dasharray,
    },
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
  plane: Plane,
  flight: Plane,
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
  enableAddPOI = false, // Enable click-to-add-POI mode
  onAddPOI = null, // Callback when clicking on map to add POI: ({ latitude, longitude }) => void
  tripId = null, // Trip ID for fetching travel segments
  onSegmentRouteUpdated = null, // Callback when a segment route is updated (after waypoint changes)
  // Origin and return point data from trip
  originPoint = null, // { name, latitude, longitude }
  returnPoint = null, // { name, latitude, longitude }
}) => {
  // Can only add POI if there are destinations to attach them to
  const canAddPOI = enableAddPOI && destinations.length > 0;
  const { mapboxAccessToken } = useMapboxToken();
  const mapRef = useRef(null);
  const [hoveredDestinationId, setHoveredDestinationId] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 10.7522,
    latitude: 59.9139,
    zoom: 5,
  });
  const [showFallbackWarning, setShowFallbackWarning] = useState(true);

  // Travel segments store for segment-based routing
  const { segments, originSegment, returnSegment, fetchTripSegments, clearSegments, isLoading: isSegmentsLoading } = useTravelSegmentStore();

  // Route store for Google Maps export only
  const { exportToGoogleMaps } = useRouteStore();

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
  const segmentGeoJSONs = useMemo(() => {
    if (!showRoute || !segments || segments.length === 0) return [];

    return segments
      // Only include segments that match current destination order
      .filter((segment) => {
        const pairKey = `${segment.from_destination_id}-${segment.to_destination_id}`;
        return validSegmentPairs.has(pairKey);
      })
      .map((segment) => {
        // Get from/to destinations for fallback coordinates
        const fromDest = sortedDestinations.find(d => d.id === segment.from_destination_id);
        const toDest = sortedDestinations.find(d => d.id === segment.to_destination_id);

        let geometry = null;

        // Use route_geometry from API if available
        if (segment.route_geometry?.type === 'LineString' && segment.route_geometry?.coordinates?.length >= 2) {
          geometry = segment.route_geometry;
        } else {
          // Fallback to straight line between destinations
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

        return {
          id: segment.id,
          travel_mode: segment.travel_mode,
          distance_km: segment.distance_km,
          duration_minutes: segment.duration_minutes,
          geojson: {
            type: 'Feature',
            properties: {
              id: segment.id,
              travel_mode: segment.travel_mode,
            },
            geometry,
          },
        };
      }).filter(Boolean);
  }, [showRoute, segments, sortedDestinations, validSegmentPairs]);

  // Build GeoJSON for origin and return segments (dotted line style)
  const originReturnGeoJSONs = useMemo(() => {
    if (!showRoute) return [];

    const results = [];

    // Origin segment: origin point → first destination
    if (originSegment?.route_geometry) {
      results.push({
        id: 'origin-segment',
        segment_type: 'origin',
        travel_mode: originSegment.travel_mode,
        distance_km: originSegment.distance_km,
        duration_minutes: originSegment.duration_minutes,
        is_fallback: originSegment.is_fallback,
        geojson: {
          type: 'Feature',
          properties: {
            id: 'origin-segment',
            segment_type: 'origin',
            travel_mode: originSegment.travel_mode,
          },
          geometry: originSegment.route_geometry,
        },
      });
    }

    // Return segment: last destination → return point
    if (returnSegment?.route_geometry) {
      results.push({
        id: 'return-segment',
        segment_type: 'return',
        travel_mode: returnSegment.travel_mode,
        distance_km: returnSegment.distance_km,
        duration_minutes: returnSegment.duration_minutes,
        is_fallback: returnSegment.is_fallback,
        geojson: {
          type: 'Feature',
          properties: {
            id: 'return-segment',
            segment_type: 'return',
            travel_mode: returnSegment.travel_mode,
          },
          geometry: returnSegment.route_geometry,
        },
      });
    }

    return results;
  }, [showRoute, originSegment, returnSegment]);

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

  // Handle Google Maps export
  const handleExportToGoogleMaps = useCallback(async () => {
    if (sortedDestinations.length < 2) return;
    const origin = sortedDestinations[0];
    const destination = sortedDestinations[sortedDestinations.length - 1];
    const waypoints = sortedDestinations.slice(1, -1);
    // Use driving as default for Google Maps export
    await exportToGoogleMaps(origin, destination, waypoints, 'driving');
  }, [sortedDestinations, exportToGoogleMaps]);

  // Handle segment click - center map on segment and highlight it
  const handleSegmentClick = useCallback((segment) => {
    // Toggle selection if clicking the same segment
    if (selectedSegmentId === segment.id) {
      setSelectedSegmentId(null);
      return;
    }

    setSelectedSegmentId(segment.id);

    // Find the segment's geometry to calculate bounds
    const segmentData = segmentGeoJSONs.find(s => s.id === segment.id);
    if (!segmentData?.geojson?.geometry?.coordinates) return;

    const coordinates = segmentData.geojson.geometry.coordinates;
    if (coordinates.length < 2) return;

    // Calculate bounds from segment coordinates
    const lngs = coordinates.map(c => c[0]);
    const lats = coordinates.map(c => c[1]);
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

      // Handle POI adding mode
      if (!isAddMode) return;

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
    [isAddMode, onAddPOI, addingWaypointMode, createWaypoint, exitAddWaypointMode, tripId, fetchTripSegments, onSegmentRouteUpdated]
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
  const hasOriginPoint = originPoint?.latitude && originPoint?.longitude;

  if (sortedDestinations.length === 0 && !hasTripLocation && !hasOriginPoint) {
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
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        cursor={isAddMode || addingWaypointMode ? 'crosshair' : 'grab'}
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-left" />
        <FullscreenControl position="top-right" />

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
              {/* Segment line with transport mode color */}
              <Source
                id={`route-segment-${segmentData.id}`}
                type="geojson"
                data={segmentData.geojson}
              >
                <Layer {...getSegmentLayerStyle(segmentData.id, segmentData.travel_mode, isSelected, hasSelection)} />
              </Source>
            </React.Fragment>
          );
        })}

        {/* Origin/Return route segments - dotted lines */}
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
            {/* Segment line with origin/return color (dotted) */}
            <Source
              id={`${segmentData.id}-source`}
              type="geojson"
              data={segmentData.geojson}
            >
              <Layer {...getOriginReturnLayerStyle(segmentData.id, segmentData.segment_type)} />
            </Source>
          </React.Fragment>
        ))}

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
                          {formatDateRangeShort(destination.arrivalDate, destination.departureDate)}
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

        {/* Origin marker - Green with plane/home icon */}
        {originPoint?.latitude && originPoint?.longitude && (
          <Marker
            longitude={originPoint.longitude}
            latitude={originPoint.latitude}
            anchor="bottom"
          >
            <div className="flex items-center justify-center">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white border-2 border-white shadow-lg">
                <Plane className="w-5 h-5" />
              </div>
            </div>
          </Marker>
        )}

        {/* Return marker - Red with plane icon (only if different from origin) */}
        {returnPoint?.latitude && returnPoint?.longitude &&
          (originPoint?.latitude !== returnPoint?.latitude ||
           originPoint?.longitude !== returnPoint?.longitude) && (
          <Marker
            longitude={returnPoint.longitude}
            latitude={returnPoint.latitude}
            anchor="bottom"
          >
            <div className="flex items-center justify-center">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white border-2 border-white shadow-lg">
                <Home className="w-5 h-5" />
              </div>
            </div>
          </Marker>
        )}

      </Map>

      {/* Waypoint adding mode hint */}
      {addingWaypointMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm z-20 shadow-lg">
          Click on the map to add a waypoint
        </div>
      )}

      {/* Add POI button - only show if enabled and there are destinations */}
      {/* Position adjusts based on whether route info bar is showing below */}
      {enableAddPOI && (
        <>
          {canAddPOI ? (
            <button
              onClick={toggleAddMode}
              className={`absolute left-4 px-4 py-2 rounded-lg shadow-lg font-medium transition-all flex items-center space-x-2 z-10 ${
                showRouteControls && sortedDestinations.length >= 2 ? 'bottom-24' : 'bottom-4'
              } ${
                isAddMode
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Plus className={`w-4 h-4 ${isAddMode ? 'rotate-45' : ''} transition-transform`} />
              <span>{isAddMode ? 'Cancel' : 'Add POI'}</span>
            </button>
          ) : (
            <div className={`absolute left-4 px-4 py-2 rounded-lg shadow-lg bg-gray-400 text-white font-medium flex items-center space-x-2 cursor-not-allowed z-10 ${
              showRouteControls && sortedDestinations.length >= 2 ? 'bottom-24' : 'bottom-4'
            }`}>
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
            <div className={`absolute left-4 bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-xs max-w-[200px] z-10 ${
              showRouteControls && sortedDestinations.length >= 2 ? 'bottom-36' : 'bottom-16'
            }`}>
              Add a destination first to create POIs
            </div>
          )}
        </>
      )}

      {/* Google Maps Floating Action Button - Bottom Right */}
      {showRouteControls && sortedDestinations.length >= 2 && (
        <button
          onClick={handleExportToGoogleMaps}
          className="absolute bottom-7 right-4 z-10 flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-indigo-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">Google Maps</span>
        </button>
      )}

      {/* Route Info Bar - Bottom Left, under Add POI button */}
      {showRouteControls && sortedDestinations.length >= 2 && (
        <div className="absolute bottom-4 left-4 z-10 max-w-lg">
          {/* Fallback Warning - auto-hides after 4 seconds */}
          {routeTotals?.has_fallback && showFallbackWarning && (
            <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-3 mb-2 transition-opacity duration-300">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">
                  Public transport route unavailable for {routeTotals.fallback_count} segment{routeTotals.fallback_count > 1 ? 's' : ''}.
                  Showing car route instead.
                </span>
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
            <div className="flex items-center gap-4">
              {/* Route Stats from travel segments */}
              {routeTotals && (
                <>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatDistance(routeTotals.distance_km)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-gray-200" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatDuration(routeTotals.duration_minutes)}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-gray-200" />
                  {/* Segment Navigator with pagination, hover cards, and click-to-center */}
                  <SegmentNavigator
                    segments={validSegments}
                    destinations={sortedDestinations}
                    selectedSegmentId={selectedSegmentId}
                    onSegmentClick={handleSegmentClick}
                  />
                </>
              )}
              {isSegmentsLoading && (
                <span className="text-sm text-gray-500">Loading routes...</span>
              )}
              {!routeTotals && !isSegmentsLoading && (
                <span className="text-sm text-gray-500">
                  {sortedDestinations.length} stops
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMap;
