import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map, {
  Marker,
  Source,
  Layer,
  Popup
} from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMapboxToken } from '../../contexts/MapboxContext';
import { BRAND_COLORS, ROUTE_STYLES } from './mapStyles';
import 'mapbox-gl/dist/mapbox-gl.css';
import './mapStyles.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const MacroMap = ({
  trips = [],
  style = { width: '100%', height: '100%' },
  mapStyle = "mapbox://styles/mapbox/streets-v11"
}) => {
  const { t } = useTranslation();
  const { mapboxAccessToken } = useMapboxToken();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [hoveredDestination, setHoveredDestination] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [tripSegments, setTripSegments] = useState({}); // { tripId: segments[] }

  // Extract all destinations with coordinates from all trips
  const allDestinations = useMemo(() => {
    const destinations = [];
    trips.forEach(trip => {
      if (trip.destinations) {
        trip.destinations.forEach((dest, index) => {
          if (dest.latitude && dest.longitude) {
            destinations.push({
              ...dest,
              tripId: trip.id,
              tripName: trip.title || trip.name,
              orderIndex: dest.order_index ?? index
            });
          }
        });
      }
    });
    // Sort by trip and order index
    return destinations.sort((a, b) => {
      if (a.tripId !== b.tripId) return a.tripId - b.tripId;
      return a.orderIndex - b.orderIndex;
    });
  }, [trips]);

  // Get unique trip IDs that have destinations with coordinates
  const tripIds = useMemo(() => {
    const ids = new Set();
    trips.forEach(trip => {
      if (trip.destinations?.some(d => d.latitude && d.longitude)) {
        ids.add(trip.id);
      }
    });
    return Array.from(ids);
  }, [trips]);

  // Fetch travel segments for all trips
  useEffect(() => {
    const fetchAllSegments = async () => {
      const newSegments = {};

      await Promise.all(
        tripIds.map(async (tripId) => {
          // Skip if already fetched
          if (tripSegments[tripId]) {
            newSegments[tripId] = tripSegments[tripId];
            return;
          }

          try {
            const response = await fetch(`${API_BASE_URL}/trips/${tripId}/travel-segments`);
            if (response.ok) {
              const data = await response.json();
              newSegments[tripId] = data.segments || [];
            }
          } catch (error) {
            // Silently fail - will use fallback straight lines
            console.warn(`Failed to fetch segments for trip ${tripId}:`, error);
          }
        })
      );

      if (Object.keys(newSegments).length > 0) {
        setTripSegments(prev => ({ ...prev, ...newSegments }));
      }
    };

    if (tripIds.length > 0) {
      fetchAllSegments();
    }
  }, [tripIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group destinations by trip for fallback polylines
  const tripRoutes = useMemo(() => {
    const routes = {};
    allDestinations.forEach(dest => {
      if (!routes[dest.tripId]) {
        routes[dest.tripId] = [];
      }
      routes[dest.tripId].push([dest.longitude, dest.latitude]);
    });
    return routes;
  }, [allDestinations]);

  // Create GeoJSON for route polylines - use real routes when available
  const routeGeoJSON = useMemo(() => {
    const features = [];

    Object.entries(tripRoutes).forEach(([tripId, fallbackCoordinates]) => {
      const segments = tripSegments[tripId];

      if (segments && segments.length > 0) {
        // Use real route geometry from segments
        segments.forEach((segment, index) => {
          let geometry;

          if (segment.route_geometry?.type === 'LineString' &&
              segment.route_geometry?.coordinates?.length >= 2) {
            // Use the real route geometry
            geometry = segment.route_geometry;
          } else {
            // Fallback: straight line for this segment
            const fromDest = allDestinations.find(d => d.id === segment.from_destination_id);
            const toDest = allDestinations.find(d => d.id === segment.to_destination_id);

            if (fromDest && toDest) {
              geometry = {
                type: 'LineString',
                coordinates: [
                  [fromDest.longitude, fromDest.latitude],
                  [toDest.longitude, toDest.latitude]
                ]
              };
            }
          }

          if (geometry) {
            features.push({
              type: 'Feature',
              properties: { tripId: Number(tripId), segmentIndex: index },
              geometry
            });
          }
        });
      } else if (fallbackCoordinates.length >= 2) {
        // No segments available - use straight lines between all destinations
        features.push({
          type: 'Feature',
          properties: { tripId: Number(tripId) },
          geometry: {
            type: 'LineString',
            coordinates: fallbackCoordinates
          }
        });
      }
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }, [tripRoutes, tripSegments, allDestinations]);

  // Calculate bounds to fit all destinations
  const fitMapBounds = useCallback(() => {
    if (!mapRef.current || allDestinations.length === 0) return;

    const map = mapRef.current.getMap();

    if (allDestinations.length === 1) {
      // Single destination - just center on it
      map.flyTo({
        center: [allDestinations[0].longitude, allDestinations[0].latitude],
        zoom: 10,
        duration: 1000
      });
      return;
    }

    // Calculate bounds
    const lngs = allDestinations.map(d => d.longitude);
    const lats = allDestinations.map(d => d.latitude);

    const bounds = [
      [Math.min(...lngs), Math.min(...lats)], // SW
      [Math.max(...lngs), Math.max(...lats)]  // NE
    ];

    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      duration: 1000,
      maxZoom: 12
    });
  }, [allDestinations]);

  // Fit bounds when destinations change
  useEffect(() => {
    // Small delay to ensure map is loaded
    const timer = setTimeout(fitMapBounds, 100);
    return () => clearTimeout(timer);
  }, [fitMapBounds]);

  // Handle marker click - navigate to trip detail view
  const handleMarkerClick = useCallback((destination) => {
    navigate(`/trips/${destination.tripId}`);
  }, [navigate]);

  // Handle marker hover
  const handleMarkerEnter = useCallback((destination) => {
    setHoveredDestination(destination.id);
    setPopupInfo(destination);
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setHoveredDestination(null);
    setPopupInfo(null);
  }, []);

  // Route line outline layer style (for better visibility)
  const routeOutlineLayer = {
    id: 'route-outline',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': ROUTE_STYLES.main.outlineWidth,
      'line-opacity': ROUTE_STYLES.main.outlineOpacity,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  };

  // Route line layer style - Warm Explorer amber theme
  const routeLineLayer = {
    id: 'route-line',
    type: 'line',
    paint: {
      'line-color': BRAND_COLORS.primary[600], // amber-600
      'line-width': ROUTE_STYLES.main.width,
      'line-opacity': ROUTE_STYLES.main.opacity,
      'line-dasharray': [3, 2],
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  };

  if (!mapboxAccessToken) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
        {t('map.mapUnavailable')}
      </div>
    );
  }

  // Default view state (world view)
  const initialViewState = {
    longitude: 0,
    latitude: 30,
    zoom: 1.5
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={mapboxAccessToken}
      initialViewState={initialViewState}
      style={style}
      mapStyle={mapStyle}
      onLoad={fitMapBounds}
      attributionControl={false}
    >

      {/* Route polylines connecting destinations */}
      {routeGeoJSON.features.length > 0 && (
        <Source id="route-source" type="geojson" data={routeGeoJSON}>
          <Layer {...routeOutlineLayer} />
          <Layer {...routeLineLayer} />
        </Source>
      )}

      {/* Destination markers - Warm Explorer theme */}
      {allDestinations.map((destination) => (
        <Marker
          key={`${destination.tripId}-${destination.id}`}
          longitude={destination.longitude}
          latitude={destination.latitude}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(destination);
          }}
        >
          <div
            className={`
              cursor-pointer transition-all duration-200 map-marker
              ${hoveredDestination === destination.id ? 'scale-125' : 'scale-100'}
            `}
            onMouseEnter={() => handleMarkerEnter(destination)}
            onMouseLeave={handleMarkerLeave}
          >
            <div className="destination-marker">
              {/* Marker with order number - gradient amber background */}
              <div
                className={`
                  destination-marker-circle
                  ${hoveredDestination === destination.id ? 'map-marker-selected' : ''}
                `}
                style={{
                  background: hoveredDestination === destination.id
                    ? `linear-gradient(135deg, ${BRAND_COLORS.primary[700]} 0%, ${BRAND_COLORS.primary[800]} 100%)`
                    : `linear-gradient(135deg, ${BRAND_COLORS.primary[600]} 0%, ${BRAND_COLORS.primary[700]} 100%)`,
                }}
              >
                <span className="text-white text-sm font-bold">
                  {destination.orderIndex + 1}
                </span>
              </div>
              {/* Pointer triangle */}
              <div
                className="destination-marker-pointer"
                style={{ borderTopColor: BRAND_COLORS.primary[600] }}
              />
            </div>
          </div>
        </Marker>
      ))}

      {/* Popup on hover - Enhanced typography */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          offset={[0, -44]}
          closeButton={false}
          closeOnClick={false}
          className="macro-map-popup"
        >
          <div className="p-4 min-w-[180px]">
            {/* Destination name with gradient text */}
            <h3 className="font-display font-bold text-base text-stone-900 leading-tight">
              {popupInfo.city_name || popupInfo.name}
            </h3>
            {popupInfo.country && (
              <p className="text-sm text-stone-500 font-medium mt-0.5">{popupInfo.country}</p>
            )}

            {/* Trip info with icon */}
            {popupInfo.tripName && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Navigation className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-sm font-semibold text-amber-700">
                  {popupInfo.tripName}
                </span>
              </div>
            )}

            {/* Call to action */}
            <div className="flex items-center gap-1.5 mt-3 text-xs text-stone-400 font-medium">
              <Calendar className="w-3 h-3" />
              <span>Click to view trip details</span>
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
};

export default React.memo(MacroMap);
