import React from 'react';
import Map, { NavigationControl, ScaleControl, FullscreenControl, GeolocateControl } from 'react-map-gl';
import { useMapboxToken } from '../../contexts/MapboxContext';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapComponent = ({
  initialViewState = {
    longitude: -122.4,
    latitude: 37.8,
    zoom: 14
  },
  style = { width: '100%', height: '100%' },
  mapStyle = "mapbox://styles/mapbox/streets-v11",
  children
}) => {
  const { mapboxAccessToken } = useMapboxToken();

  return (
    <Map
      mapboxAccessToken={mapboxAccessToken}
      initialViewState={initialViewState}
      style={style}
      mapStyle={mapStyle}
    >
      <GeolocateControl position="top-left" />
      <FullscreenControl position="top-left" />
      <NavigationControl position="top-left" />
      <ScaleControl />
      {children}
    </Map>
  );
};

export default MapComponent;
