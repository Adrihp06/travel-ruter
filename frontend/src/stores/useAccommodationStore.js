import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const useAccommodationStore = create((set, get) => ({
  // State
  accommodations: [],
  selectedAccommodation: null,
  isLoading: false,
  error: null,

  // Actions
  fetchAccommodations: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/${destinationId}/accommodations`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch accommodations');
      }

      const accommodations = await response.json();
      set({ accommodations, isLoading: false });
      return accommodations;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createAccommodation: async (accommodationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/accommodations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accommodationData),
      });

      if (!response.ok) {
        throw new Error('Failed to create accommodation');
      }

      const newAccommodation = await response.json();

      set((state) => ({
        accommodations: [...state.accommodations, newAccommodation],
        isLoading: false,
      }));

      return newAccommodation;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateAccommodation: async (accommodationId, accommodationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/accommodations/${accommodationId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accommodationData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update accommodation');
      }

      const updatedAccommodation = await response.json();

      set((state) => ({
        accommodations: state.accommodations.map((a) =>
          a.id === accommodationId ? updatedAccommodation : a
        ),
        selectedAccommodation:
          state.selectedAccommodation?.id === accommodationId
            ? updatedAccommodation
            : state.selectedAccommodation,
        isLoading: false,
      }));

      return updatedAccommodation;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteAccommodation: async (accommodationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/accommodations/${accommodationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete accommodation');
      }

      set((state) => ({
        accommodations: state.accommodations.filter(
          (a) => a.id !== accommodationId
        ),
        selectedAccommodation:
          state.selectedAccommodation?.id === accommodationId
            ? null
            : state.selectedAccommodation,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  selectAccommodation: (accommodationId) => {
    const accommodation = get().accommodations.find(
      (a) => a.id === accommodationId
    );
    set({ selectedAccommodation: accommodation || null });
  },

  clearAccommodations: () => {
    set({ accommodations: [], selectedAccommodation: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAccommodationStore;
