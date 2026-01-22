import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const TRAVEL_MODES = {
  plane: { label: 'Plane', icon: 'Plane' },
  car: { label: 'Car', icon: 'Car' },
  train: { label: 'Train', icon: 'Train' },
  bus: { label: 'Bus', icon: 'Bus' },
  walk: { label: 'Walk', icon: 'Footprints' },
  bike: { label: 'Bike', icon: 'Bike' },
  ferry: { label: 'Ferry', icon: 'Ship' },
};

const useTravelSegmentStore = create((set, get) => ({
  segments: [],
  originSegment: null, // Origin → First destination segment
  returnSegment: null, // Last destination → Return point segment
  isLoading: false,
  hasFetchedInitial: false, // Track if initial fetch has completed
  error: null,
  calculatingSegments: {}, // Track which segments are being calculated { "fromId-toId": true }

  setSegments: (segments) => set({ segments }),

  // Check if a specific segment is being calculated
  isSegmentCalculating: (fromId, toId) => {
    return get().calculatingSegments[`${fromId}-${toId}`] || false;
  },

  // Get segment between two destinations
  getSegment: (fromId, toId) => {
    return get().segments.find(
      (s) => s.from_destination_id === fromId && s.to_destination_id === toId
    );
  },

  // Fetch all travel segments for a trip
  fetchTripSegments: async (tripId) => {
    // Clear old segments first to prevent stale data from showing
    set({ isLoading: true, error: null, segments: [], originSegment: null, returnSegment: null });
    try {
      const response = await fetch(`${API_BASE_URL}/trips/${tripId}/travel-segments`);

      if (!response.ok) {
        throw new Error('Failed to fetch travel segments');
      }

      const data = await response.json();
      set({
        segments: data.segments,
        originSegment: data.origin_segment || null,
        returnSegment: data.return_segment || null,
        isLoading: false,
        hasFetchedInitial: true
      });
      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false, hasFetchedInitial: true });
      throw error;
    }
  },

  // Calculate and save a travel segment
  calculateSegment: async (fromId, toId, travelMode) => {
    const segmentKey = `${fromId}-${toId}`;

    // Mark this segment as calculating
    set((state) => ({
      calculatingSegments: { ...state.calculatingSegments, [segmentKey]: true },
      error: null,
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/${fromId}/travel-segment/${toId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ travel_mode: travelMode }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to calculate travel segment');
      }

      const segment = await response.json();

      set((state) => {
        // Update or add the segment
        const existingIndex = state.segments.findIndex(
          (s) =>
            s.from_destination_id === fromId && s.to_destination_id === toId
        );

        let newSegments;
        if (existingIndex >= 0) {
          newSegments = [...state.segments];
          newSegments[existingIndex] = segment;
        } else {
          newSegments = [...state.segments, segment];
        }

        // Remove from calculating
        const { [segmentKey]: _, ...remainingCalculating } = state.calculatingSegments;

        return { segments: newSegments, calculatingSegments: remainingCalculating };
      });

      return segment;
    } catch (error) {
      console.error('Failed to calculate segment:', error.message);
      set((state) => {
        const { [segmentKey]: _, ...remainingCalculating } = state.calculatingSegments;
        return { error: error.message, calculatingSegments: remainingCalculating };
      });
      // Don't re-throw to prevent React from re-rendering with errors
      return null;
    }
  },

  // Recalculate all segments after destination reorder
  recalculateTrip: async (tripId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_BASE_URL}/trips/${tripId}/travel-segments/recalculate`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to recalculate travel segments');
      }

      const data = await response.json();
      set({ segments: data.segments, isLoading: false });
      return data.segments;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Delete a segment
  deleteSegment: async (segmentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/travel-segments/${segmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete travel segment');
      }

      set((state) => ({
        segments: state.segments.filter((s) => s.id !== segmentId),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  // Clear segments when changing trips
  clearSegments: () => set({
    segments: [],
    originSegment: null,
    returnSegment: null,
    error: null,
    calculatingSegments: {},
    hasFetchedInitial: false
  }),
}));

export default useTravelSegmentStore;
