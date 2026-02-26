import { create } from 'zustand';
import httpClient from '../services/httpClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/**
 * Hotel Search Store - Manages Google Places hotel discovery state
 *
 * Integrates with backend endpoints:
 * - GET /api/v1/hotels/discover - Discover hotels near coordinates
 * - GET /api/v1/hotels/discover/:placeId - Get hotel details
 */
const useHotelSearchStore = create((set, get) => ({
  // Search state
  searchResults: [],
  selectedHotel: null,
  hotelDetails: null,
  searchParams: {
    latitude: null,
    longitude: null,
    radius: 5000,
    keyword: '',
  },

  // Loading states
  isSearching: false,
  isLoadingDetails: false,

  // Error states
  searchError: null,
  detailsError: null,

  // Filters
  filters: {
    sortBy: 'relevance', // relevance, rating
  },

  /**
   * Update search parameters
   */
  setSearchParams: (params) => {
    set((state) => ({
      searchParams: { ...state.searchParams, ...params },
    }));
  },

  /**
   * Update filters
   */
  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  /**
   * Search hotels via Google Places API
   */
  searchHotels: async (params = {}) => {
    const { searchParams, filters } = get();
    const mergedParams = { ...searchParams, ...params };

    if (!mergedParams.latitude || !mergedParams.longitude) {
      set({ searchError: 'Coordinates are required to search for hotels' });
      return [];
    }

    set({ isSearching: true, searchError: null });

    try {
      const queryParams = new URLSearchParams({
        latitude: mergedParams.latitude,
        longitude: mergedParams.longitude,
        radius: mergedParams.radius,
      });

      if (mergedParams.keyword) {
        queryParams.set('keyword', mergedParams.keyword);
      }

      const response = await httpClient.get(
        `${API_BASE_URL}/hotels/discover?${queryParams.toString()}`,
        { requestId: 'hotel-search' }
      );

      const data = response?.data || response || {};
      const hotels = data.results || data || [];

      // Sort results
      const sortedHotels = get().sortHotels(hotels, filters.sortBy);

      set({
        searchResults: sortedHotels,
        isSearching: false,
      });

      return sortedHotels;
    } catch (error) {
      const errorMessage = error.data?.message || error.message || 'Failed to search hotels';
      set({ searchError: errorMessage, isSearching: false });
      throw error;
    }
  },

  /**
   * Sort hotels by various criteria
   */
  sortHotels: (hotels, sortBy) => {
    const sorted = [...hotels];

    switch (sortBy) {
      case 'rating':
        return sorted.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return ratingB - ratingA;
        });
      default:
        return sorted; // relevance - keep API order
    }
  },

  /**
   * Get hotel details (photos, reviews, website, etc.)
   */
  getHotelDetails: async (placeId) => {
    set({ isLoadingDetails: true, detailsError: null });

    try {
      const response = await httpClient.get(
        `${API_BASE_URL}/hotels/discover/${encodeURIComponent(placeId)}`,
        { requestId: 'hotel-details' }
      );

      const details = response?.data || response || null;

      set({
        hotelDetails: details,
        isLoadingDetails: false,
      });

      return details;
    } catch (error) {
      const errorMessage = error.data?.message || error.message || 'Failed to get hotel details';
      set({ detailsError: errorMessage, isLoadingDetails: false });
      throw error;
    }
  },

  /**
   * Clear selected hotel
   */
  clearSelectedHotel: () => {
    set({ selectedHotel: null, hotelDetails: null, detailsError: null });
  },

  /**
   * Clear search results and reset state
   */
  clearSearch: () => {
    httpClient.cancelRequest('hotel-search');
    httpClient.cancelRequest('hotel-details');

    set({
      searchResults: [],
      selectedHotel: null,
      hotelDetails: null,
      searchError: null,
      detailsError: null,
    });
  },

  /**
   * Clear all errors
   */
  clearErrors: () => {
    set({
      searchError: null,
      detailsError: null,
    });
  },
}));

export default useHotelSearchStore;
