import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useWaypointStore = create((set, get) => ({
  // State
  waypointsBySegment: {}, // { segmentId: [waypoints] }
  isLoading: false,
  loadingSegments: {}, // { segmentId: true }
  error: null,
  addingWaypointMode: null, // segmentId when in "add waypoint" mode, null otherwise

  // Get waypoints for a segment
  getWaypoints: (segmentId) => {
    return get().waypointsBySegment[segmentId] || [];
  },

  // Check if waypoints are loading for a segment
  isSegmentLoading: (segmentId) => {
    return get().loadingSegments[segmentId] || false;
  },

  // Fetch waypoints for a segment
  fetchSegmentWaypoints: async (segmentId) => {
    set((state) => ({
      loadingSegments: { ...state.loadingSegments, [segmentId]: true },
      error: null,
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/travel-segments/${segmentId}/waypoints`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch waypoints');
      }

      const data = await response.json();

      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          waypointsBySegment: {
            ...state.waypointsBySegment,
            [segmentId]: data.waypoints,
          },
          loadingSegments: remainingLoading,
        };
      });

      return data.waypoints;
    } catch (error) {
      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          error: error.message,
          loadingSegments: remainingLoading,
        };
      });
      throw error;
    }
  },

  // Create a new waypoint
  createWaypoint: async (segmentId, waypointData) => {
    set((state) => ({
      loadingSegments: { ...state.loadingSegments, [segmentId]: true },
      error: null,
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/travel-segments/${segmentId}/waypoints`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(waypointData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create waypoint');
      }

      const waypoint = await response.json();

      // Refresh waypoints for this segment to get updated order
      await get().fetchSegmentWaypoints(segmentId);

      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return { loadingSegments: remainingLoading };
      });

      return waypoint;
    } catch (error) {
      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          error: error.message,
          loadingSegments: remainingLoading,
        };
      });
      throw error;
    }
  },

  // Update a waypoint
  updateWaypoint: async (waypointId, waypointData, segmentId) => {
    set((state) => ({
      loadingSegments: { ...state.loadingSegments, [segmentId]: true },
      error: null,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/waypoints/${waypointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waypointData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update waypoint');
      }

      const waypoint = await response.json();

      // Update waypoint in local state
      set((state) => {
        const segmentWaypoints = state.waypointsBySegment[segmentId] || [];
        const updatedWaypoints = segmentWaypoints.map((wp) =>
          wp.id === waypointId ? waypoint : wp
        );
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;

        return {
          waypointsBySegment: {
            ...state.waypointsBySegment,
            [segmentId]: updatedWaypoints,
          },
          loadingSegments: remainingLoading,
        };
      });

      return waypoint;
    } catch (error) {
      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          error: error.message,
          loadingSegments: remainingLoading,
        };
      });
      throw error;
    }
  },

  // Delete a waypoint
  deleteWaypoint: async (waypointId, segmentId) => {
    set((state) => ({
      loadingSegments: { ...state.loadingSegments, [segmentId]: true },
      error: null,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/waypoints/${waypointId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete waypoint');
      }

      // Remove waypoint from local state and refresh
      await get().fetchSegmentWaypoints(segmentId);

      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return { loadingSegments: remainingLoading };
      });
    } catch (error) {
      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          error: error.message,
          loadingSegments: remainingLoading,
        };
      });
      throw error;
    }
  },

  // Reorder waypoints within a segment
  reorderWaypoints: async (segmentId, waypointOrders) => {
    set((state) => ({
      loadingSegments: { ...state.loadingSegments, [segmentId]: true },
      error: null,
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/travel-segments/${segmentId}/waypoints/reorder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints: waypointOrders }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to reorder waypoints');
      }

      const data = await response.json();

      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          waypointsBySegment: {
            ...state.waypointsBySegment,
            [segmentId]: data.waypoints,
          },
          loadingSegments: remainingLoading,
        };
      });

      return data.waypoints;
    } catch (error) {
      set((state) => {
        const { [segmentId]: _, ...remainingLoading } = state.loadingSegments;
        return {
          error: error.message,
          loadingSegments: remainingLoading,
        };
      });
      throw error;
    }
  },

  // Enter "add waypoint" mode for a segment
  enterAddWaypointMode: (segmentId) => {
    set({ addingWaypointMode: segmentId });
  },

  // Exit "add waypoint" mode
  exitAddWaypointMode: () => {
    set({ addingWaypointMode: null });
  },

  // Check if in add waypoint mode for a segment
  isAddingWaypoint: (segmentId) => {
    return get().addingWaypointMode === segmentId;
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Clear all waypoints (when changing trips)
  clearWaypoints: () =>
    set({
      waypointsBySegment: {},
      error: null,
      loadingSegments: {},
      addingWaypointMode: null,
    }),
}));

export default useWaypointStore;
