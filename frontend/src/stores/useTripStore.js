import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const useTripStore = create((set, get) => ({
  trips: [],
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
    } catch (error) {
      // Fallback to mock data if API unavailable
      const mockTrips = [
        { id: 1, title: 'Summer in Norway', date: 'Jul 2026', location: 'Norway' },
        { id: 2, title: 'Winter Alps', date: 'Dec 2026', location: 'Switzerland' },
        { id: 3, title: 'Japan Cherry Blossom', date: 'Apr 2027', location: 'Japan' },
      ];
      set({ trips: mockTrips, isLoading: false, error: error.message });
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
    } catch (error) {
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
}));

export default useTripStore;
