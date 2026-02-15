import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import useAuthStore from './useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Authenticated fetch helper — injects Bearer token when available
const authFetch = (url, options = {}) => {
  const token = useAuthStore.getState().getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

// Helper to get trip status priority for default sorting
// Order: ongoing/in progress > planning/upcoming > completed
const getStatusPriority = (trip) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = trip.start_date ? new Date(trip.start_date) : null;
  const endDate = trip.end_date ? new Date(trip.end_date) : null;

  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(0, 0, 0, 0);

  // Check if trip is ongoing (between start and end date)
  if (startDate && endDate && today >= startDate && today <= endDate) {
    return 0; // Highest priority - ongoing
  }

  // Check if trip is upcoming (start date in future)
  if (startDate && today < startDate) {
    // Calculate days until departure for secondary sorting
    const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
    return 1 + (daysUntil / 10000); // Planning trips, closer ones first
  }

  // Completed or past trips
  if (trip.status === 'completed' || (endDate && today > endDate)) {
    return 3; // Lowest priority - completed
  }

  // Cancelled trips
  if (trip.status === 'cancelled') {
    return 4;
  }

  // Default planning status
  return 2;
};

// Helper to filter and sort trips
const filterAndSortTrips = (trips, { searchQuery, statusFilter, sortBy, showCompleted }) => {
  let filtered = [...trips];

  // Filter by status
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(trip => trip.status === statusFilter);
  }

  // Hide completed/cancelled trips by default (only based on status, not date)
  if (!showCompleted) {
    filtered = filtered.filter(trip => {
      // Only hide trips explicitly marked as completed or cancelled
      return trip.status !== 'completed' && trip.status !== 'cancelled';
    });
  }

  // Search filter
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(trip => {
      const name = (trip.name || trip.title || '').toLowerCase();
      const location = (trip.location || '').toLowerCase();
      const description = (trip.description || '').toLowerCase();
      const startDate = trip.start_date || '';
      const endDate = trip.end_date || '';
      const tags = (trip.tags || []).join(' ').toLowerCase();

      return (
        name.includes(query) ||
        location.includes(query) ||
        description.includes(query) ||
        startDate.includes(query) ||
        endDate.includes(query) ||
        tags.includes(query)
      );
    });
  }

  // Sort
  switch (sortBy) {
    case 'date_asc':
      filtered.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
        const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
        return dateA - dateB;
      });
      break;
    case 'date_desc':
      filtered.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
        const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
        return dateB - dateA;
      });
      break;
    case 'name_asc':
      filtered.sort((a, b) => {
        const nameA = (a.name || a.title || '').toLowerCase();
        const nameB = (b.name || b.title || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      break;
    case 'name_desc':
      filtered.sort((a, b) => {
        const nameA = (a.name || a.title || '').toLowerCase();
        const nameB = (b.name || b.title || '').toLowerCase();
        return nameB.localeCompare(nameA);
      });
      break;
    case 'modified':
      filtered.sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at) : new Date(0);
        const dateB = b.updated_at ? new Date(b.updated_at) : new Date(0);
        return dateB - dateA;
      });
      break;
    case 'default':
    default:
      // Default sort: by start_date ascending (earliest trips first)
      filtered.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date) : new Date(0);
        const dateB = b.start_date ? new Date(b.start_date) : new Date(0);
        return dateA - dateB;
      });
      break;
  }

  return filtered;
};

// Mock destinations for demo when API is unavailable
const getMockDestinations = (tripId) => {
  const mockData = {
    1: [ // Summer in Norway
      { id: 1, city_name: 'Oslo', country: 'Norway', latitude: 59.9139, longitude: 10.7522, order_index: 0 },
      { id: 2, city_name: 'Bergen', country: 'Norway', latitude: 60.3913, longitude: 5.3221, order_index: 1 },
      { id: 3, city_name: 'Trondheim', country: 'Norway', latitude: 63.4305, longitude: 10.3951, order_index: 2 },
    ],
    2: [ // Winter Alps
      { id: 4, city_name: 'Zurich', country: 'Switzerland', latitude: 47.3769, longitude: 8.5417, order_index: 0 },
      { id: 5, city_name: 'Zermatt', country: 'Switzerland', latitude: 46.0207, longitude: 7.7491, order_index: 1 },
      { id: 6, city_name: 'Geneva', country: 'Switzerland', latitude: 46.2044, longitude: 6.1432, order_index: 2 },
    ],
    3: [ // Japan Cherry Blossom
      { id: 7, city_name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, order_index: 0 },
      { id: 8, city_name: 'Kyoto', country: 'Japan', latitude: 35.0116, longitude: 135.7681, order_index: 1 },
      { id: 9, city_name: 'Osaka', country: 'Japan', latitude: 34.6937, longitude: 135.5023, order_index: 2 },
    ],
  };
  return mockData[tripId] || [];
};

// Helper to deduplicate trips by ID (keeps first occurrence)
const deduplicateTrips = (trips) =>
  trips.filter((trip, index, self) =>
    index === self.findIndex(t => t.id === trip.id)
  );

const useTripStore = create((set, get) => ({
  // Single source of truth for all trip data (includes destinations and poiStats)
  tripsWithDestinations: [],
  selectedTrip: null,
  budget: null,
  isLoading: false,
  isBudgetLoading: false,
  error: null,
  pendingDelete: null, // { trip } for undo functionality

  // Filter state
  searchQuery: '',
  statusFilter: 'all',
  sortBy: 'default',
  showCompleted: false,

  setTrips: (trips) => {
    // Ensure trips have destination/poiStats structure
    const enrichedTrips = trips.map(trip => ({
      ...trip,
      destinations: trip.destinations || [],
      poiStats: trip.poiStats || { total_pois: 0, scheduled_pois: 0 }
    }));
    set({ tripsWithDestinations: deduplicateTrips(enrichedTrips) });
  },

  // Filter actions
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSortBy: (sortBy) => set({ sortBy }),
  setShowCompleted: (showCompleted) => set({ showCompleted }),
  clearFilters: () => set({
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'default',
    showCompleted: false,
  }),

  // Get filtered and sorted trips from single source of truth
  getFilteredTrips: () => {
    const state = get();
    return filterAndSortTrips(state.tripsWithDestinations, {
      searchQuery: state.searchQuery,
      statusFilter: state.statusFilter,
      sortBy: state.sortBy,
      showCompleted: state.showCompleted,
    });
  },

  // Get count of active filters
  getActiveFiltersCount: () => {
    const state = get();
    let count = 0;
    if (state.searchQuery.trim()) count++;
    if (state.statusFilter !== 'all') count++;
    if (state.sortBy !== 'default') count++;
    if (state.showCompleted) count++;
    return count;
  },
  selectTrip: (tripId) => set((state) => {
    const id = Number(tripId);
    const trip = state.tripsWithDestinations.find((t) => t.id === id);
    return { selectedTrip: trip || null };
  }),

  fetchTrips: async () => {
    set({ isLoading: true });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips`);
      if (!response.ok) throw new Error('Failed to fetch trips');
      const trips = await response.json();
      // Fetch destinations for all trips, then update single source of truth
      await get().fetchTripsWithDestinations(trips);
      set({ isLoading: false });
    } catch (error) {
      // Fallback to mock data if API unavailable
      const mockTrips = [
        { id: 1, title: 'Summer in Norway', date: 'Jul 2026', location: 'Norway' },
        { id: 2, title: 'Winter Alps', date: 'Dec 2026', location: 'Switzerland' },
        { id: 3, title: 'Japan Cherry Blossom', date: 'Apr 2027', location: 'Japan' },
      ];
      // Fetch destinations for mock trips too
      await get().fetchTripsWithDestinations(mockTrips);
      set({ isLoading: false, error: error.message });
    }
  },

  // Optimized: Fetch all trips with destinations and POI stats in ONE API call
  // This eliminates the N+1 problem (2N+1 calls reduced to 1)
  fetchTripsSummary: async () => {
    set({ isLoading: true });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/summary`);
      if (!response.ok) throw new Error('Failed to fetch trips summary');
      const data = await response.json();

      // Transform the response to match the expected format with destinations
      const enrichedTrips = data.trips.map(trip => ({
        ...trip,
        destinations: trip.destinations || [],
        poiStats: trip.poi_stats || { total_pois: 0, scheduled_pois: 0 }
      }));

      set({
        tripsWithDestinations: deduplicateTrips(enrichedTrips),
        isLoading: false
      });
    } catch (error) {
      console.error('fetchTripsSummary error:', error);
      // Fallback to the old method if the new endpoint fails
      get().fetchTrips();
    }
  },

  fetchTripsWithDestinations: async (trips) => {
    try {
      const tripsWithDests = await Promise.all(
        trips.map(async (trip) => {
          try {
            // Fetch destinations and POI stats in parallel
            const [destResponse, statsResponse] = await Promise.all([
              authFetch(`${API_BASE_URL}/trips/${trip.id}/destinations`),
              authFetch(`${API_BASE_URL}/trips/${trip.id}/poi-stats`)
            ]);
            const destData = destResponse.ok ? await destResponse.json() : { items: [] };
            const destinations = destData.items || [];
            const poiStats = statsResponse.ok ? await statsResponse.json() : { total_pois: 0, scheduled_pois: 0 };
            return { ...trip, destinations, poiStats };
          } catch {
            return { ...trip, destinations: [], poiStats: { total_pois: 0, scheduled_pois: 0 } };
          }
        })
      );
      set({ tripsWithDestinations: deduplicateTrips(tripsWithDests) });
    } catch {
      // Fallback to mock destinations for demonstration
      const mockTripsWithDestinations = trips.map(trip => ({
        ...trip,
        destinations: getMockDestinations(trip.id),
        poiStats: { total_pois: 0, scheduled_pois: 0 }
      }));
      set({ tripsWithDestinations: deduplicateTrips(mockTripsWithDestinations) });
    }
  },

  fetchTripDetails: async (tripId) => {
    set({ isLoading: true });
    try {
      // Fetch trip details and destinations in parallel
      const [tripResponse, destinationsResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/trips/${tripId}`),
        authFetch(`${API_BASE_URL}/trips/${tripId}/destinations`)
      ]);

      if (!tripResponse.ok) throw new Error('Failed to fetch trip details');

      const tripDetails = await tripResponse.json();
      const destData = destinationsResponse.ok ? await destinationsResponse.json() : { items: [] };
      const destinations = destData.items || [];

      // Merge destinations into trip details
      const tripWithDestinations = {
        ...tripDetails,
        destinations: destinations
      };

      set({ selectedTrip: tripWithDestinations, isLoading: false });
      // Also fetch budget when loading trip details
      get().fetchTripBudget(tripId);
    } catch (error) {
      // Fallback to mock data if API unavailable
      const mockDetails = {
        id: Number(tripId),
        title: 'Summer in Norway',
        destinations: [
          { id: 1, name: 'Oslo', arrival_date: '2026-07-01', departure_date: '2026-07-03' },
          { id: 2, name: 'Bergen', arrival_date: '2026-07-03', departure_date: '2026-07-05' }
        ],
        days: [
          { day: 1, activities: ['Arrival in Oslo', 'Check-in at Hotel', 'Dinner at Aker Brygge'] },
          { day: 2, activities: ['Train to Bergen', 'Fjord Cruise', 'Fish Market'] },
          { day: 3, activities: ['Hike to Fløyen', 'Departure'] },
        ]
      };
      set({ selectedTrip: mockDetails, isLoading: false, error: error.message });
      // Fetch mock budget
      get().fetchTripBudget(tripId);
    }
  },

  fetchTripBudget: async (tripId) => {
    set({ isBudgetLoading: true });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}/budget`);
      if (!response.ok) throw new Error('Failed to fetch budget');
      const budget = await response.json();
      set({ budget, isBudgetLoading: false });
    } catch {
      // Fallback to mock budget data
      const mockBudget = {
        total_budget: 500,
        estimated_total: 450,
        actual_total: 320,
        currency: 'EUR',
        remaining_budget: 180,
        budget_percentage: 64
      };
      set({ budget: mockBudget, isBudgetLoading: false });
    }
  },

  resetSelectedTrip: () => set({ selectedTrip: null, budget: null }),

  createTrip: async (tripData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Failed to create trip (${response.status})`;
        throw new Error(errorMessage);
      }

      const newTrip = await response.json();

      // Add to single source of truth with destination/poi structure
      const newTripWithDestinations = {
        ...newTrip,
        destinations: [],
        poiStats: { total_pois: 0, scheduled_pois: 0 }
      };

      set((state) => ({
        tripsWithDestinations: deduplicateTrips([...state.tripsWithDestinations, newTripWithDestinations]),
        isLoading: false,
      }));

      return newTrip;
    } catch (error) {
      const message = error.message === 'Failed to fetch'
        ? 'Cannot connect to server. Please ensure the backend is running.'
        : error.message;
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  updateTrip: async (tripId, tripData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error('Failed to update trip');
      }

      const updatedTrip = await response.json();

      set((state) => ({
        tripsWithDestinations: state.tripsWithDestinations.map((t) =>
          t.id === tripId
            ? { ...updatedTrip, destinations: t.destinations, poiStats: t.poiStats }
            : t
        ),
        selectedTrip: state.selectedTrip?.id === tripId
          ? { ...updatedTrip, destinations: state.selectedTrip.destinations }
          : state.selectedTrip,
        isLoading: false,
      }));

      return updatedTrip;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteTrip: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip');
      }

      set((state) => ({
        tripsWithDestinations: state.tripsWithDestinations.filter((t) => t.id !== tripId),
        selectedTrip: state.selectedTrip?.id === tripId ? null : state.selectedTrip,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Soft delete: removes from UI but keeps data for undo
  softDeleteTrip: (tripId) => {
    const state = get();
    const trip = state.tripsWithDestinations.find((t) => t.id === tripId);

    if (!trip) return null;

    set({
      tripsWithDestinations: state.tripsWithDestinations.filter((t) => t.id !== tripId),
      selectedTrip: state.selectedTrip?.id === tripId ? null : state.selectedTrip,
      pendingDelete: { trip },
    });

    return trip;
  },

  // Restore soft-deleted trip
  restoreTrip: () => {
    const state = get();
    const pending = state.pendingDelete;

    if (!pending?.trip) return;

    set({
      tripsWithDestinations: deduplicateTrips([...state.tripsWithDestinations, pending.trip]),
      pendingDelete: null,
    });
  },

  // Confirm deletion: actually delete from server
  confirmDeleteTrip: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip');
      }

      set({ pendingDelete: null, isLoading: false });
    } catch (error) {
      // Restore trip on error
      get().restoreTrip();
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Clear pending delete without restoring
  clearPendingDelete: () => set({ pendingDelete: null }),

  // Duplicate a trip with options
  duplicateTrip: async (tripId, duplicateOptions) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch(`${API_BASE_URL}/trips/${tripId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateOptions),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Failed to duplicate trip (${response.status})`;
        throw new Error(errorMessage);
      }

      const newTrip = await response.json();

      // Fetch destinations and stats for the new trip only
      let destinations = [];
      let poiStats = { total_pois: 0, scheduled_pois: 0 };
      try {
        const [destResponse, statsResponse] = await Promise.all([
          authFetch(`${API_BASE_URL}/trips/${newTrip.id}/destinations`),
          authFetch(`${API_BASE_URL}/trips/${newTrip.id}/poi-stats`)
        ]);
        destinations = destResponse.ok ? await destResponse.json() : [];
        poiStats = statsResponse.ok ? await statsResponse.json() : { total_pois: 0, scheduled_pois: 0 };
      } catch {
        // Use empty defaults on error
      }

      const newTripWithDestinations = {
        ...newTrip,
        destinations,
        poiStats
      };

      // Add to single source of truth
      set((state) => ({
        tripsWithDestinations: deduplicateTrips([...state.tripsWithDestinations, newTripWithDestinations]),
        isLoading: false,
      }));

      return newTrip;
    } catch (error) {
      const message = error.message === 'Failed to fetch'
        ? 'Cannot connect to server. Please ensure the backend is running.'
        : error.message;
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  // Claim an orphan trip (assign to current user)
  claimTrip: async (tripId) => {
    const response = await authFetch(`${API_BASE_URL}/trips/${tripId}/claim`, {
      method: 'POST',
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to claim trip');
    }
    const claimed = await response.json();
    set((state) => ({
      tripsWithDestinations: state.tripsWithDestinations.map((t) =>
        t.id === tripId ? { ...t, user_id: claimed.user_id } : t
      ),
    }));
    return claimed;
  },

  // Get destination count for a trip
  getDestinationCount: (tripId) => {
    const tripWithDests = get().tripsWithDestinations.find(t => t.id === tripId);
    return tripWithDests?.destinations?.length || 0;
  },

  // Get budget info for a trip (from tripsWithDestinations or budget state)
  getTripBudgetInfo: (tripId) => {
    const trip = get().tripsWithDestinations.find(t => t.id === tripId);
    if (get().selectedTrip?.id === tripId && get().budget) {
      return get().budget;
    }
    // Return basic budget info from trip itself
    if (trip?.total_budget) {
      return {
        total_budget: trip.total_budget,
        currency: trip.currency || 'USD',
      };
    }
    return null;
  },

  // Update destinations in selectedTrip (used after reordering)
  setSelectedTripDestinations: (destinations) => {
    const state = get();
    if (state.selectedTrip) {
      set({
        selectedTrip: {
          ...state.selectedTrip,
          destinations,
        },
      });
    }
  },
}));

// Memoized selectors for performance optimization
// These prevent unnecessary re-renders by using shallow equality comparison

// Selector for filtered trips - uses shallow equality to prevent re-renders
export const useFilteredTrips = () => useTripStore(
  (state) => state.getFilteredTrips(),
  useShallow
);

// Selector for loading state
export const useTripsLoading = () => useTripStore((state) => state.isLoading);

// Selector for error state
export const useTripsError = () => useTripStore((state) => state.error);

// Selector for active filters count
export const useActiveFiltersCount = () => useTripStore((state) => state.getActiveFiltersCount());

// Selector for filter state (grouped for components that need multiple filter values)
export const useFilterState = () => useTripStore(
  useShallow((state) => ({
    searchQuery: state.searchQuery,
    statusFilter: state.statusFilter,
    sortBy: state.sortBy,
    showCompleted: state.showCompleted,
  }))
);

// Selector for selected trip
export const useSelectedTrip = () => useTripStore((state) => state.selectedTrip);

// Selector for budget state
export const useTripBudget = () => useTripStore(
  useShallow((state) => ({
    budget: state.budget,
    isBudgetLoading: state.isBudgetLoading,
  }))
);

// Selector for trips with destinations (for map views)
export const useTripsWithDestinations = () => useTripStore(
  (state) => state.tripsWithDestinations,
  useShallow
);

export default useTripStore;
