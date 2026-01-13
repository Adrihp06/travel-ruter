import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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

const useTripStore = create((set, get) => ({
  trips: [],
  tripsWithDestinations: [],
  selectedTrip: null,
  budget: null,
  isLoading: false,
  isBudgetLoading: false,
  error: null,

  setTrips: (trips) => set({ trips }),
  selectTrip: (tripId) => set((state) => ({
    selectedTrip: state.trips.find((t) => t.id === Number(tripId)) || null
  })),

  fetchTrips: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/trips`);
      if (!response.ok) throw new Error('Failed to fetch trips');
      const trips = await response.json();
      set({ trips, isLoading: false });
      // Fetch destinations for all trips for the macro map
      get().fetchTripsWithDestinations(trips);
    } catch (error) {
      // Fallback to mock data if API unavailable
      const mockTrips = [
        { id: 1, title: 'Summer in Norway', date: 'Jul 2026', location: 'Norway' },
        { id: 2, title: 'Winter Alps', date: 'Dec 2026', location: 'Switzerland' },
        { id: 3, title: 'Japan Cherry Blossom', date: 'Apr 2027', location: 'Japan' },
      ];
      set({ trips: mockTrips, isLoading: false, error: error.message });
      // Fetch destinations for mock trips too
      get().fetchTripsWithDestinations(mockTrips);
    }
  },

  fetchTripsWithDestinations: async (trips) => {
    try {
      const tripsWithDests = await Promise.all(
        trips.map(async (trip) => {
          try {
            const response = await fetch(`${API_BASE_URL}/trips/${trip.id}/destinations`);
            if (!response.ok) return { ...trip, destinations: [] };
            const destinations = await response.json();
            return { ...trip, destinations };
          } catch {
            return { ...trip, destinations: [] };
          }
        })
      );
      set({ tripsWithDestinations: tripsWithDests });
    } catch {
      // Fallback to mock destinations for demonstration
      const mockTripsWithDestinations = trips.map(trip => ({
        ...trip,
        destinations: getMockDestinations(trip.id)
      }));
      set({ tripsWithDestinations: mockTripsWithDestinations });
    }
  },

  fetchTripDetails: async (tripId) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}`);
      if (!response.ok) throw new Error('Failed to fetch trip details');
      const tripDetails = await response.json();
      set({ selectedTrip: tripDetails, isLoading: false });
      // Also fetch budget when loading trip details
      get().fetchTripBudget(tripId);
    } catch (error) {
      // Fallback to mock data if API unavailable
      const mockDetails = {
        id: Number(tripId),
        title: 'Summer in Norway',
        destinations: [
          { id: 1, name: 'Oslo', arrivalDate: '2026-07-01', departureDate: '2026-07-03' },
          { id: 2, name: 'Bergen', arrivalDate: '2026-07-03', departureDate: '2026-07-05' }
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
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/budget`);
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
      const response = await fetch(`${API_BASE_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error('Failed to create trip');
      }

      const newTrip = await response.json();

      set((state) => ({
        trips: [...state.trips, newTrip],
        isLoading: false,
      }));

      return newTrip;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateTrip: async (tripId, tripData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        throw new Error('Failed to update trip');
      }

      const updatedTrip = await response.json();

      set((state) => ({
        trips: state.trips.map((t) => (t.id === tripId ? updatedTrip : t)),
        tripsWithDestinations: state.tripsWithDestinations.map((t) =>
          t.id === tripId ? { ...updatedTrip, destinations: t.destinations } : t
        ),
        selectedTrip: state.selectedTrip?.id === tripId ? updatedTrip : state.selectedTrip,
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
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip');
      }

      set((state) => ({
        trips: state.trips.filter((t) => t.id !== tripId),
        tripsWithDestinations: state.tripsWithDestinations.filter((t) => t.id !== tripId),
        selectedTrip: state.selectedTrip?.id === tripId ? null : state.selectedTrip,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));

export default useTripStore;
