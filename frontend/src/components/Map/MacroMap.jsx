import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  FullscreenControl,
  Marker,
  Source,
  Layer,
  Popup
} from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useMapboxToken } from '../../contexts/MapboxContext';
import 'mapbox-gl/dist/mapbox-gl.css';

const MacroMap = ({
  trips = [],
  style = { width: '100%', height: '100%' },
  mapStyle = "mapbox://styles/mapbox/streets-v11"
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [hoveredDestination, setHoveredDestination] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);

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

  // Group destinations by trip for polylines
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

  // Create GeoJSON for route polylines
  const routeGeoJSON = useMemo(() => {
    const features = Object.entries(tripRoutes).map(([tripId, coordinates]) => ({
      type: 'Feature',
      properties: { tripId: Number(tripId) },
      geometry: {
        type: 'LineString',
        coordinates
      }
    }));
    return {
      type: 'FeatureCollection',
      features
    };
  }, [tripRoutes]);

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

  // Route line layer style
  const routeLineLayer = {
    id: 'route-line',
    type: 'line',
    paint: {
      'line-color': '#6366f1', // indigo-500
      'line-width': 3,
      'line-opacity': 0.8,
      'line-dasharray': [2, 1]
    }
  };

  if (!mapboxAccessToken) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
        Map unavailable - Missing Mapbox access token
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
      <FullscreenControl position="top-right" />
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-right" />

      {/* Route polylines connecting destinations */}
      {routeGeoJSON.features.length > 0 && (
        <Source id="route-source" type="geojson" data={routeGeoJSON}>
          <Layer {...routeLineLayer} />
        </Source>
      )}

      {/* Destination markers */}
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
              cursor-pointer transition-all duration-200
              ${hoveredDestination === destination.id ? 'scale-125' : 'scale-100'}
            `}
            onMouseEnter={() => handleMarkerEnter(destination)}
            onMouseLeave={handleMarkerLeave}
          >
            <div className="relative">
              {/* Marker with order number */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                shadow-lg border-2 border-white
                ${hoveredDestination === destination.id
                  ? 'bg-indigo-600'
                  : 'bg-indigo-500'}
              `}>
                <span className="text-white text-sm font-bold">
                  {destination.orderIndex + 1}
                </span>
              </div>
              {/* Pointer */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0
                border-l-4 border-r-4 border-t-6
                border-l-transparent border-r-transparent border-t-indigo-500"
                style={{ borderTopWidth: '6px' }}
              />
            </div>
          </div>
        </Marker>
      ))}

      {/* Popup on hover */}
      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          offset={[0, -40]}
          closeButton={false}
          closeOnClick={false}
          className="macro-map-popup"
        >
          <div className="px-3 py-2 min-w-[150px]">
            <div className="font-semibold text-gray-900">
              {popupInfo.city_name || popupInfo.name}
            </div>
            {popupInfo.country && (
              <div className="text-sm text-gray-500">{popupInfo.country}</div>
            )}
            {popupInfo.tripName && (
              <div className="text-xs text-indigo-600 mt-1 flex items-center">
                <MapPin className="w-3 h-3 mr-1" />
                {popupInfo.tripName}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              Click to view trip details
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
};

export default MacroMap;
