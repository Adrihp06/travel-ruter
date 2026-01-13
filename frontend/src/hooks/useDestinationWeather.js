import { useEffect } from 'react';
import useWeatherStore from '../stores/useWeatherStore';

/**
 * Custom hook to fetch and access weather data for a destination
 * @param {number|null} destinationId - The destination ID
 * @param {number|null} month - Optional month override (1-12)
 * @returns {object} - { weather, isLoading, error }
 */
const useDestinationWeather = (destinationId, month = null) => {
  const { fetchWeather, getWeather, isLoading, getError } = useWeatherStore();

  useEffect(() => {
    if (destinationId) {
      fetchWeather(destinationId, month);
    }
  }, [destinationId, month, fetchWeather]);

  return {
    weather: destinationId ? getWeather(destinationId, month) : null,
    isLoading: destinationId ? isLoading(destinationId, month) : false,
    error: destinationId ? getError(destinationId, month) : null
  };
};

export default useDestinationWeather;
