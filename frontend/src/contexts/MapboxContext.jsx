import React, { createContext, useContext, useMemo } from 'react';

const MapboxContext = createContext(null);

export const MapboxProvider = ({ children }) => {
  const mapboxAccessToken = useMemo(() => {
    // Priority: runtime injection (Docker) > build-time env (Vite dev) > user setting (localStorage)
    return window.__ENV__?.VITE_MAPBOX_ACCESS_TOKEN
      || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      || localStorage.getItem('mapbox-access-token');
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
