import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Helper to build POI lookup map from category groups
const buildPOIMap = (pois) => {
  const map = new Map();
  for (const group of pois) {
    for (const poi of group.pois) {
      map.set(poi.id, poi);
    }
  }
  return map;
};

const usePOIStore = create((set, get) => ({
  pois: [], // List of POIsByCategory objects
  poisById: new Map(), // O(1) lookup map for POIs by ID
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

  setPOIs: (pois) => set({ pois, poisById: buildPOIMap(pois) }),

  fetchPOIsByDestination: async (destinationId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_BASE_URL}/destinations/${destinationId}/pois`);

      if (!response.ok) {
        throw new Error('Failed to fetch POIs');
      }

      const data = await response.json();
      // Handle paginated response format { items: [...] } or direct array
      const pois = Array.isArray(data) ? data : (data.items || []);
      set({ pois, poisById: buildPOIMap(pois), isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false, pois: [], poisById: new Map() });
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

        // Update the lookup map
        const newMap = new Map(state.poisById);
        newMap.set(newPOI.id, newPOI);

        return { pois: updatedPOIs, poisById: newMap, isLoading: false };
      });

      return newPOI;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // O(1) lookup using poisById map
  selectPOI: (poiId) => {
    const state = get();
    set({ selectedPOI: state.poisById.get(poiId) || null });
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
      return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs) };
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
        return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs) };
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
        return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs), error: error.message };
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
        return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs), isLoading: false };
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

      set((state) => {
        const updatedPOIs = state.pois.map(group => ({
          ...group,
          pois: group.pois.filter(poi => poi.id !== poiId)
        })).filter(group => group.pois.length > 0);

        // Update the lookup map
        const newMap = new Map(state.poisById);
        newMap.delete(poiId);

        return { pois: updatedPOIs, poisById: newMap, isLoading: false };
      });
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
    // Capture state before optimistic update for rollback
    const previousPOIs = get().pois;
    const previousPoisById = get().poisById;

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
      return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs) };
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
        return { pois: newPOIs, poisById: buildPOIMap(newPOIs) };
      });

      return updatedPOIs;
    } catch (error) {
      // Revert to captured state instead of refetching (faster, preserves local state)
      set({ pois: previousPOIs, poisById: previousPoisById, error: error.message });
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

        // Update the lookup map
        const newMap = new Map(state.poisById);
        newMap.set(newPOI.id, newPOI);

        return { pois: updatedPOIs, poisById: newMap };
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

        return { pois: updatedPOIs, poisById: buildPOIMap(updatedPOIs) };
      });

      return newPOIs;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Fetch travel time matrix for Smart Scheduler
  fetchTravelMatrix: async (destinationId, locations, profile = 'foot-walking') => {
    const response = await fetch(
      `${API_BASE_URL}/destinations/${destinationId}/travel-matrix`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations, profile }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch travel matrix');
    }

    return await response.json();
  },

  // Apply smart schedule with optional route optimization
  applySmartSchedule: async (destinationId, assignments, optimizeRoutes = true, arrivalDate = null) => {
    set({ isLoading: true, error: null });

    try {
      // First, apply all schedule updates using existing bulk method
      await get().updatePOISchedules(destinationId, assignments);

      // If route optimization is requested, optimize each day with 2+ POIs
      if (optimizeRoutes) {
        // Group assignments by date to find days with multiple POIs
        const poisByDate = {};
        assignments.forEach(assignment => {
          if (assignment.scheduled_date) {
            if (!poisByDate[assignment.scheduled_date]) {
              poisByDate[assignment.scheduled_date] = [];
            }
            poisByDate[assignment.scheduled_date].push(assignment);
          }
        });

        // Helper to parse date string in local timezone (avoid UTC issues)
        const parseDateLocal = (dateStr) => {
          if (!dateStr) return null;
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day);
        };

        // Get the trip arrival date for day number calculation
        const tripArrivalDate = parseDateLocal(arrivalDate);

        // Get day numbers for dates that have 2+ POIs
        const daysToOptimize = Object.entries(poisByDate)
          .filter(([, pois]) => pois.length >= 2)
          .map(([date]) => {
            const dateObj = parseDateLocal(date);
            // Calculate actual day number from arrival date
            let dayNumber;
            if (tripArrivalDate && dateObj) {
              const diffMs = dateObj - tripArrivalDate;
              dayNumber = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
            } else {
              // Fallback: use date sorting if no arrival date provided
              dayNumber = null;
            }
            return { date, dateObj, dayNumber };
          })
          .sort((a, b) => a.dateObj - b.dateObj)
          .map((item, index) => ({
            date: item.date,
            // Use calculated day number if available, otherwise fall back to index
            dayNumber: item.dayNumber !== null ? item.dayNumber : index + 1,
          }));

        // Optimize routes for each qualifying day
        for (const { date, dayNumber } of daysToOptimize) {
          try {
            // Get accommodation/start location for this day
            const locationInfo = await get().getAccommodationForDay(destinationId, dayNumber);

            // Optimize the route
            const result = await get().optimizeDayRoute(
              destinationId,
              dayNumber,
              locationInfo.start_location,
              '08:00' // Default start time
            );

            // Apply the optimized order
            if (result && result.optimized_order && result.optimized_order.length > 0) {
              await get().applyOptimizedOrder(destinationId, result.optimized_order, date);
            }
          } catch {
            // If optimization fails for a day, continue with others
            console.warn(`Route optimization failed for day ${dayNumber}, skipping`);
          }
        }
      }

      set({ isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));

// Memoized selectors for performance optimization

// Selector for loading state
export const usePOIsLoading = () => usePOIStore((state) => state.isLoading);

// Selector for error state
export const usePOIsError = () => usePOIStore((state) => state.error);

// Selector for selected POI
export const useSelectedPOI = () => usePOIStore((state) => state.selectedPOI);

// Selector for POIs by category (the main pois array)
export const usePOIsByCategory = () => usePOIStore(
  (state) => state.pois,
  useShallow
);

// Selector for optimization state
export const useOptimizationState = () => usePOIStore(
  useShallow((state) => ({
    optimizationResult: state.optimizationResult,
    isOptimizing: state.isOptimizing,
    optimizationError: state.optimizationError,
  }))
);

// Selector for suggestions state
export const useSuggestionsState = () => usePOIStore(
  useShallow((state) => ({
    suggestions: state.suggestions,
    isFetchingSuggestions: state.isFetchingSuggestions,
    suggestionsError: state.suggestionsError,
  }))
);

// O(1) POI lookup by ID - returns the POI directly from the map
export const usePOIById = (poiId) => usePOIStore((state) => state.poisById.get(poiId));

export default usePOIStore;
