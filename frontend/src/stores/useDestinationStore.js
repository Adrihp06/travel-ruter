import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const useDestinationStore = create((set) => ({
  destinations: [],
  selectedDestination: null,
  isLoading: false,
  error: null,

  setDestinations: (destinations) => set({ destinations }),

  selectDestination: (destinationId) => set((state) => ({
    selectedDestination: state.destinations.find((d) => d.id === destinationId) || null
  })),

  resetSelectedDestination: () => set({ selectedDestination: null }),

  fetchDestinations: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/destinations`);

      if (!response.ok) {
        throw new Error('Failed to fetch destinations');
      }

      const destinations = await response.json();
      set({ destinations, isLoading: false });
      return destinations;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createDestination: async (destinationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destinationData),
      });

      if (!response.ok) {
        throw new Error('Failed to create destination');
      }

      const newDestination = await response.json();

      set((state) => ({
        destinations: [...state.destinations, newDestination].sort(
          (a, b) => new Date(a.arrival_date) - new Date(b.arrival_date)
        ),
        isLoading: false,
      }));

      return newDestination;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateDestination: async (destinationId, destinationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destinationData),
      });

      if (!response.ok) {
        throw new Error('Failed to update destination');
      }

      const updatedDestination = await response.json();

      set((state) => ({
        destinations: state.destinations
          .map(d => d.id === destinationId ? updatedDestination : d)
          .sort((a, b) => new Date(a.arrival_date) - new Date(b.arrival_date)),
        selectedDestination: state.selectedDestination?.id === destinationId
          ? updatedDestination
          : state.selectedDestination,
        isLoading: false,
      }));

      return updatedDestination;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteDestination: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete destination');
      }

      set((state) => ({
        destinations: state.destinations.filter(d => d.id !== destinationId),
        selectedDestination: state.selectedDestination?.id === destinationId
          ? null
          : state.selectedDestination,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useDestinationStore;
