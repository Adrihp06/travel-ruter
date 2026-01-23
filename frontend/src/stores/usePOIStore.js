import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const usePOIStore = create((set, get) => ({
  pois: [], // List of POIsByCategory objects
  selectedPOI: null,
  isLoading: false,
  error: null,
  // Optimization state
  optimizationResult: null,
  isOptimizing: false,
  optimizationError: null,
  // Suggestions state
  suggestions: [],
  isFetchingSuggestions: false,
  suggestionsError: null,

  setPOIs: (pois) => set({ pois }),

  fetchPOIsByDestination: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}/pois`);

      if (!response.ok) {
        throw new Error('Failed to fetch POIs');
      }

      const pois = await response.json();
      set({ pois, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false, pois: [] });
    }
  },

  createPOI: async (poiData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: poiData.destination_id,
          name: poiData.name,
          category: poiData.category,
          description: poiData.description,
          estimated_cost: poiData.estimated_cost,
          dwell_time: poiData.dwell_time,
          latitude: poiData.latitude,
          longitude: poiData.longitude,
          address: poiData.address,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create POI');
      }

      const newPOI = await response.json();

      // Add to the correct category group in local state
      set((state) => {
        const updatedPOIs = [...state.pois];
        const categoryIndex = updatedPOIs.findIndex(
          group => group.category === newPOI.category
        );

        if (categoryIndex >= 0) {
          updatedPOIs[categoryIndex] = {
            ...updatedPOIs[categoryIndex],
            pois: [...updatedPOIs[categoryIndex].pois, newPOI]
          };
        } else {
          updatedPOIs.push({
            category: newPOI.category,
            pois: [newPOI]
          });
        }

        return { pois: updatedPOIs, isLoading: false };
      });

      return newPOI;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  selectPOI: (poiId) => {
    const state = get();
    let found = null;
    for (const cat of state.pois) {
      found = cat.pois.find(p => p.id === poiId);
      if (found) break;
    }
    set({ selectedPOI: found || null });
  },

  votePOI: async (poiId, voteType) => {
    // Optimistic update first
    set((state) => {
      const updatedPOIs = state.pois.map(group => ({
        ...group,
        pois: group.pois.map(poi => {
          if (poi.id === poiId) {
            return {
              ...poi,
              likes: voteType === 'like' ? poi.likes + 1 : poi.likes,
              vetoes: voteType === 'veto' ? poi.vetoes + 1 : poi.vetoes,
            };
          }
          return poi;
        }),
      }));
      return { pois: updatedPOIs };
    });

    try {
      const response = await fetch(`${API_BASE_URL}/pois/${poiId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      const updatedPOI = await response.json();

      // Update with server response
      set((state) => {
        const updatedPOIs = state.pois.map(group => ({
          ...group,
          pois: group.pois.map(poi =>
            poi.id === poiId ? { ...poi, ...updatedPOI } : poi
          ),
        }));
        return { pois: updatedPOIs };
      });
    } catch (error) {
      // Revert optimistic update
      set((state) => {
        const updatedPOIs = state.pois.map(group => ({
          ...group,
          pois: group.pois.map(poi => {
            if (poi.id === poiId) {
              return {
                ...poi,
                likes: voteType === 'like' ? poi.likes - 1 : poi.likes,
                vetoes: voteType === 'veto' ? poi.vetoes - 1 : poi.vetoes,
              };
            }
            return poi;
          }),
        }));
        return { pois: updatedPOIs, error: error.message };
      });
    }
  },

  updatePOI: async (poiId, poiData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/pois/${poiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poiData),
      });

      if (!response.ok) {
        throw new Error('Failed to update POI');
      }

      const updatedPOI = await response.json();

      set((state) => {
        const updatedPOIs = state.pois.map(group => ({
          ...group,
          pois: group.pois.map(poi =>
            poi.id === poiId ? { ...poi, ...updatedPOI } : poi
          ),
        }));
        return { pois: updatedPOIs, isLoading: false };
      });

      return updatedPOI;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deletePOI: async (poiId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/pois/${poiId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete POI');
      }

      set((state) => ({
        pois: state.pois.map(group => ({
          ...group,
          pois: group.pois.filter(poi => poi.id !== poiId)
        })).filter(group => group.pois.length > 0),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Get all POIs as a flat list for itinerary view
  getAllPOIs: () => {
    const state = get();
    return state.pois.flatMap(group => group.pois);
  },

  // Get POIs grouped by scheduled date for daily itinerary
  getPOIsBySchedule: () => {
    const allPOIs = get().getAllPOIs();
    const scheduled = {};
    const unscheduled = [];

    allPOIs.forEach(poi => {
      if (poi.scheduled_date) {
        if (!scheduled[poi.scheduled_date]) {
          scheduled[poi.scheduled_date] = [];
        }
        scheduled[poi.scheduled_date].push(poi);
      } else {
        unscheduled.push(poi);
      }
    });

    // Sort POIs within each day by day_order
    Object.keys(scheduled).forEach(date => {
      scheduled[date].sort((a, b) => (a.day_order || 0) - (b.day_order || 0));
    });

    return { scheduled, unscheduled };
  },

  // Bulk update POI schedules (for drag-and-drop)
  updatePOISchedules: async (destinationId, updates) => {
    // Optimistic update
    set((state) => {
      const updatedPOIs = state.pois.map(group => ({
        ...group,
        pois: group.pois.map(poi => {
          const update = updates.find(u => u.id === poi.id);
          if (update) {
            return {
              ...poi,
              scheduled_date: update.scheduled_date,
              day_order: update.day_order,
            };
          }
          return poi;
        }),
      }));
      return { pois: updatedPOIs };
    });

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/${destinationId}/pois/schedule`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update POI schedules');
      }

      const updatedPOIs = await response.json();

      // Update with server response
      set((state) => {
        const newPOIs = state.pois.map(group => ({
          ...group,
          pois: group.pois.map(poi => {
            const updated = updatedPOIs.find(u => u.id === poi.id);
            return updated ? { ...poi, ...updated } : poi;
          }),
        }));
        return { pois: newPOIs };
      });

      return updatedPOIs;
    } catch (error) {
      // Revert on error by refetching
      get().fetchPOIsByDestination(destinationId);
      set({ error: error.message });
      throw error;
    }
  },

  // Get accommodation/start location for a day
  getAccommodationForDay: async (destinationId, dayNumber) => {
    const response = await fetch(
      `${API_BASE_URL}/destinations/${destinationId}/accommodation-for-day?day_number=${dayNumber}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get accommodation');
    }

    return await response.json();
  },

  // Optimize POI route for a specific day
  optimizeDayRoute: async (destinationId, dayNumber, startLocation, startTime = '08:00') => {
    set({ isOptimizing: true, optimizationError: null, optimizationResult: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/${destinationId}/pois/optimize-day`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_number: dayNumber,
            start_location: startLocation,
            start_time: startTime,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to optimize route');
      }

      const result = await response.json();
      set({ optimizationResult: result, isOptimizing: false });
      return result;
    } catch (error) {
      set({ optimizationError: error.message, isOptimizing: false });
      throw error;
    }
  },

  // Apply optimized order to POIs
  applyOptimizedOrder: async (destinationId, optimizedOrder, targetDate) => {
    // Build schedule updates with new day_order
    const updates = optimizedOrder.map((poiId, index) => ({
      id: poiId,
      scheduled_date: targetDate,
      day_order: index,
    }));

    // Use existing bulk update method
    await get().updatePOISchedules(destinationId, updates);

    // Clear optimization state
    set({ optimizationResult: null });
  },

  // Clear optimization state (for cancel action)
  clearOptimizationResult: () => {
    set({ optimizationResult: null, optimizationError: null });
  },

  // Fetch POI suggestions from Google Places API
  fetchPOISuggestions: async (destinationId, params = {}) => {
    set({ isFetchingSuggestions: true, suggestionsError: null, suggestions: [] });

    try {
      const queryParams = new URLSearchParams();
      if (params.radius) queryParams.append('radius', params.radius);
      if (params.category_filter) queryParams.append('category_filter', params.category_filter);
      if (params.trip_type) queryParams.append('trip_type', params.trip_type);
      if (params.max_results) queryParams.append('max_results', params.max_results);

      const response = await fetch(
        `${API_BASE_URL}/destinations/${destinationId}/pois/suggestions?${queryParams.toString()}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch suggestions');
      }

      const data = await response.json();
      set({ suggestions: data.suggestions, isFetchingSuggestions: false });
      return data;
    } catch (error) {
      set({ suggestionsError: error.message, isFetchingSuggestions: false });
      throw error;
    }
  },

  // Add a single suggested POI to the destination
  addSuggestedPOI: async (poiData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poiData),
      });

      if (!response.ok) {
        throw new Error('Failed to add suggested POI');
      }

      const newPOI = await response.json();

      // Add to the correct category group in local state
      set((state) => {
        const updatedPOIs = [...state.pois];
        const categoryIndex = updatedPOIs.findIndex(
          group => group.category === newPOI.category
        );

        if (categoryIndex >= 0) {
          updatedPOIs[categoryIndex] = {
            ...updatedPOIs[categoryIndex],
            pois: [...updatedPOIs[categoryIndex].pois, newPOI]
          };
        } else {
          updatedPOIs.push({
            category: newPOI.category,
            pois: [newPOI]
          });
        }

        return { pois: updatedPOIs };
      });

      return newPOI;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Bulk add multiple suggested POIs
  bulkAddSuggestedPOIs: async (destinationId, placeIds) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/destinations/${destinationId}/pois/suggestions/bulk-add`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination_id: destinationId,
            place_ids: placeIds,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to bulk add suggested POIs');
      }

      const newPOIs = await response.json();

      // Add all new POIs to local state
      set((state) => {
        const updatedPOIs = [...state.pois];

        newPOIs.forEach(newPOI => {
          const categoryIndex = updatedPOIs.findIndex(
            group => group.category === newPOI.category
          );

          if (categoryIndex >= 0) {
            updatedPOIs[categoryIndex] = {
              ...updatedPOIs[categoryIndex],
              pois: [...updatedPOIs[categoryIndex].pois, newPOI]
            };
          } else {
            updatedPOIs.push({
              category: newPOI.category,
              pois: [newPOI]
            });
          }
        });

        return { pois: updatedPOIs };
      });

      return newPOIs;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));

export default usePOIStore;
