import React, { createContext, useContext, useMemo } from 'react';

const MapboxContext = createContext(null);

export const MapboxProvider = ({ children }) => {
  const mapboxAccessToken = useMemo(() => {
    // First check environment variable, then fallback to localStorage
    return import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || localStorage.getItem('mapbox-access-token');
  }, []);

  const value = useMemo(() => ({
    mapboxAccessToken,
    isConfigured: Boolean(mapboxAccessToken),
  }), [mapboxAccessToken]);

  return (
    <MapboxContext.Provider value={value}>
      {children}
    </MapboxContext.Provider>
  );
};

export const useMapboxToken = () => {
  const context = useContext(MapboxContext);
  if (context === undefined) {
    throw new Error('useMapboxToken must be used within a MapboxProvider');
  }
  return context;
};

export default MapboxContext;
