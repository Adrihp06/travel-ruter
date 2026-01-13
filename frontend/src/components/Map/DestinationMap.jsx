import React, { useMemo, useState } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  Marker,
  Popup,
} from 'react-map-gl';
import { MapPin } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

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

const DestinationMap = ({
  destination,
  pois = [],
  height = '250px',
  zoom = 12,
  className = '',
}) => {
  const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const [popupInfo, setPopupInfo] = useState(null);

  const coords = useMemo(() => getCoordinates(destination), [destination]);

  // Extract POI coordinates
  const poiMarkers = useMemo(() => {
    if (!pois || pois.length === 0) return [];

    const markers = [];
    pois.forEach((categoryGroup) => {
      if (categoryGroup.pois) {
        categoryGroup.pois.forEach((poi) => {
          const poiCoords = getCoordinates(poi);
          if (poiCoords) {
            markers.push({ ...poi, ...poiCoords });
          }
        });
      }
    });
    return markers;
  }, [pois]);

  if (!mapboxAccessToken) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">Map unavailable</p>
      </div>
    );
  }

  if (!coords) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">No location data</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg overflow-hidden border border-gray-200 ${className}`}
      style={{ height }}
    >
      <Map
        initialViewState={{
          longitude: coords.lng,
          latitude: coords.lat,
          zoom: zoom,
        }}
        mapboxAccessToken={mapboxAccessToken}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" />

        {/* Main destination marker */}
        <Marker longitude={coords.lng} latitude={coords.lat} anchor="bottom">
          <div className="flex items-center justify-center">
            <div className="bg-indigo-600 text-white p-2 rounded-full shadow-lg">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        </Marker>

        {/* POI markers */}
        {poiMarkers.map((poi) => (
          <Marker
            key={poi.id}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setPopupInfo(poi);
            }}
          >
            <div className="flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <div className="bg-amber-500 text-white p-1.5 rounded-full shadow">
                <MapPin className="w-3 h-3" />
              </div>
            </div>
          </Marker>
        ))}

        {/* POI Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={[0, -20]}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div className="p-1 min-w-[120px]">
              <h4 className="font-medium text-gray-900 text-sm">{popupInfo.name}</h4>
              {popupInfo.category && (
                <p className="text-xs text-gray-500">{popupInfo.category}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default DestinationMap;
