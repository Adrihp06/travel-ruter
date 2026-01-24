import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useTravelStopStore = create((set, get) => ({
  // Store stops by segment ID for efficient lookup
  stopsBySegment: {}, // { segmentId: [stops] }
  isLoading: false,
  error: null,

  // Get stops for a specific segment
  getStopsForSegment: (segmentId) => {
    return get().stopsBySegment[segmentId] || [];
  },

  // Fetch stops for a segment
  fetchStopsForSegment: async (segmentId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/travel-segments/${segmentId}/stops`);

      if (!response.ok) {
        throw new Error('Failed to fetch travel stops');
      }

      const stops = await response.json();

      set((state) => ({
        stopsBySegment: {
          ...state.stopsBySegment,
          [segmentId]: stops,
        },
        isLoading: false,
      }));

      return stops;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Fetch stops for multiple segments at once
  fetchStopsForSegments: async (segmentIds) => {
    if (!segmentIds.length) return;

    set({ isLoading: true, error: null });
    try {
      const results = await Promise.all(
        segmentIds.map(async (segmentId) => {
          const response = await fetch(`${API_BASE_URL}/travel-segments/${segmentId}/stops`);
          if (!response.ok) return { segmentId, stops: [] };
          const stops = await response.json();
          return { segmentId, stops };
        })
      );

      const newStopsBySegment = {};
      results.forEach(({ segmentId, stops }) => {
        newStopsBySegment[segmentId] = stops;
      });

      set((state) => ({
        stopsBySegment: {
          ...state.stopsBySegment,
          ...newStopsBySegment,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Create a new stop
  // Returns { stop, segmentId } so caller can refetch segment for updated route
  createStop: async (segmentId, stopData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/travel-segments/${segmentId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stopData,
          travel_segment_id: segmentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create travel stop');
      }

      const newStop = await response.json();

      set((state) => ({
        stopsBySegment: {
          ...state.stopsBySegment,
          [segmentId]: [...(state.stopsBySegment[segmentId] || []), newStop].sort(
            (a, b) => a.order_index - b.order_index
          ),
        },
      }));

      // Return both stop and segmentId so caller can refetch segment for updated route
      return { stop: newStop, segmentId };
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Update a stop
  // Returns { stop, segmentId } so caller can refetch segment for updated route
  updateStop: async (stopId, stopData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stops/${stopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stopData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update travel stop');
      }

      const updatedStop = await response.json();
      const segmentId = updatedStop.travel_segment_id;

      set((state) => {
        const currentStops = state.stopsBySegment[segmentId] || [];
        const updatedStops = currentStops
          .map((s) => (s.id === stopId ? updatedStop : s))
          .sort((a, b) => a.order_index - b.order_index);

        return {
          stopsBySegment: {
            ...state.stopsBySegment,
            [segmentId]: updatedStops,
          },
        };
      });

      // Return both stop and segmentId so caller can refetch segment for updated route
      return { stop: updatedStop, segmentId };
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Delete a stop
  // Returns { segmentId } so caller can refetch segment for updated route
  deleteStop: async (stopId, segmentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stops/${stopId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete travel stop');
      }

      set((state) => ({
        stopsBySegment: {
          ...state.stopsBySegment,
          [segmentId]: (state.stopsBySegment[segmentId] || []).filter(
            (s) => s.id !== stopId
          ),
        },
      }));

      // Return segmentId so caller can refetch segment for updated route
      return { segmentId };
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Reorder stops within a segment
  reorderStops: async (segmentId, stopIds) => {
    try {
      const response = await fetch(`${API_BASE_URL}/travel-segments/${segmentId}/stops/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_ids: stopIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder travel stops');
      }

      const reorderedStops = await response.json();

      set((state) => ({
        stopsBySegment: {
          ...state.stopsBySegment,
          [segmentId]: reorderedStops,
        },
      }));

      return reorderedStops;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Clear stops for a segment
  clearStopsForSegment: (segmentId) => {
    set((state) => {
      const { [segmentId]: _, ...rest } = state.stopsBySegment;
      return { stopsBySegment: rest };
    });
  },

  // Clear all stops
  clearAllStops: () => set({ stopsBySegment: {}, error: null }),

  clearError: () => set({ error: null }),
}));

export default useTravelStopStore;
