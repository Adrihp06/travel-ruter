import { useEffect, useCallback, useMemo } from 'react';
import useWeatherStore from '../stores/useWeatherStore';

/**
 * Custom hook to fetch and access weather data for a destination
 * @param {number|null} destinationId - The destination ID
 * @param {number|null} month - Optional month override (1-12)
 * @returns {object} - { weather, isLoading, error }
 */
const useDestinationWeather = (destinationId, month = null) => {
  // Use granular selectors to avoid re-renders from unrelated store changes
  const cacheKey = useMemo(
    () => destinationId ? `${destinationId}-${month || 'default'}` : null,
    [destinationId, month]
  );
  const fetchWeather = useWeatherStore((state) => state.fetchWeather);
  const weather = useWeatherStore((state) => cacheKey ? state.weatherData[cacheKey] || null : null);
  const loading = useWeatherStore((state) => cacheKey ? state.loadingStates[cacheKey] || false : false);
  const error = useWeatherStore((state) => cacheKey ? state.errors[cacheKey] || null : null);

  useEffect(() => {
    if (destinationId) {
      fetchWeather(destinationId, month);
    }
  }, [destinationId, month, fetchWeather]);

  return {
    weather,
    isLoading: loading,
    error,
  };
};

export default useDestinationWeather;
