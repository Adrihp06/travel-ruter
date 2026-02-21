import React from 'react';
import Map, { Marker } from 'react-map-gl';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMapboxToken } from '../../contexts/MapboxContext';
import 'mapbox-gl/dist/mapbox-gl.css';

const LocationMapPreview = ({ latitude, longitude, height = 150 }) => {
  const { t } = useTranslation();
  const { mapboxAccessToken } = useMapboxToken();

  if (!latitude || !longitude) {
    return null;
  }

  if (!mapboxAccessToken) {
    return (
      <div
        className="bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm"
        style={{ height }}
      >
        {t('map.mapUnavailable')}
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <Map
        mapboxAccessToken={mapboxAccessToken}
        initialViewState={{
          longitude,
          latitude,
          zoom: 10,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        interactive={false}
        attributionControl={false}
      >
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <div className="bg-[#D97706] text-white p-1.5 rounded-full shadow-lg">
            <MapPin className="h-4 w-4" />
          </div>
        </Marker>
      </Map>
    </div>
  );
};

export default LocationMapPreview;
