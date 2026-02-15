import { create } from 'zustand';
import authFetch from '../utils/authFetch';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const useWeatherStore = create((set, get) => ({
  weatherData: {}, // Map of destinationId -> weather data
  loadingStates: {}, // Map of destinationId -> loading state
  errors: {}, // Map of destinationId -> error

  fetchWeather: async (destinationId, month = null) => {
    const cacheKey = `${destinationId}-${month || 'default'}`;

    // Check if already cached
    if (get().weatherData[cacheKey]) {
      return get().weatherData[cacheKey];
    }

    // Set loading state
    set((state) => ({
      loadingStates: { ...state.loadingStates, [cacheKey]: true },
      errors: { ...state.errors, [cacheKey]: null }
    }));

    try {
      const url = new URL(`${API_BASE_URL}/destinations/${destinationId}/weather`);
      if (month !== null) {
        url.searchParams.set('month', month);
      }

      const response = await authFetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      set((state) => ({
        weatherData: { ...state.weatherData, [cacheKey]: data },
        loadingStates: { ...state.loadingStates, [cacheKey]: false }
      }));

      return data;
    } catch (error) {
      set((state) => ({
        loadingStates: { ...state.loadingStates, [cacheKey]: false },
        errors: { ...state.errors, [cacheKey]: error.message }
      }));
      return null;
    }
  },

  getWeather: (destinationId, month = null) => {
    const cacheKey = `${destinationId}-${month || 'default'}`;
    return get().weatherData[cacheKey] || null;
  },

  isLoading: (destinationId, month = null) => {
    const cacheKey = `${destinationId}-${month || 'default'}`;
    return get().loadingStates[cacheKey] || false;
  },

  getError: (destinationId, month = null) => {
    const cacheKey = `${destinationId}-${month || 'default'}`;
    return get().errors[cacheKey] || null;
  },

  clearCache: () => set({ weatherData: {}, loadingStates: {}, errors: {} })
}));

export default useWeatherStore;
