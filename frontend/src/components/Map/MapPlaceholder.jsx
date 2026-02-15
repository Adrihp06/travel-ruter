import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMapboxToken } from '../../contexts/MapboxContext';

const MAX_STATIC_DIM = 1280;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const LIGHT_STYLE = 'mapbox/streets-v12';
const DARK_STYLE = 'mapbox/dark-v11';

const MapPlaceholder = ({
  longitude,
  latitude,
  zoom = 10,
  height = '100%',
  className = '',
  onReady,
}) => {
  const { mapboxAccessToken } = useMapboxToken();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height: h } = entries[0].contentRect;
      if (width > 0 && h > 0) {
        setDimensions({
          width: Math.min(Math.round(width), MAX_STATIC_DIM),
          height: Math.min(Math.round(h), MAX_STATIC_DIM),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  const hasCoords = longitude != null && latitude != null;
  const hasToken = Boolean(mapboxAccessToken);

  const staticUrl = useMemo(() => {
    if (!hasCoords || !hasToken) return null;
    const style = isDark ? DARK_STYLE : LIGHT_STYLE;
    return `https://api.mapbox.com/styles/v1/${style}/static/${longitude},${latitude},${zoom}/${dimensions.width}x${dimensions.height}@2x?access_token=${mapboxAccessToken}`;
  }, [longitude, latitude, zoom, mapboxAccessToken, isDark, hasCoords, hasToken, dimensions]);

  // Fallback: shimmer placeholder when no coords or no token
  if (!staticUrl) {
    return (
      <div
        ref={containerRef}
        className={`relative overflow-hidden bg-stone-200 dark:bg-stone-800 skeleton-shimmer ${className}`}
        style={{ height }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ height }}
    >
      <img
        src={staticUrl}
        alt="Map preview"
        onLoad={onReady}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: prefersReducedMotion ? 'blur(0px)' : 'blur(8px)',
          transform: prefersReducedMotion ? 'scale(1)' : 'scale(1.05)',
          transition: 'filter 600ms ease-out, transform 600ms ease-out',
        }}
      />
    </div>
  );
};

export default MapPlaceholder;
