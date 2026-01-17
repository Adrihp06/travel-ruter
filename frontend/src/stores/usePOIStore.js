import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const usePOIStore = create((set, get) => ({
  pois: [], // List of POIsByCategory objects
  selectedPOI: null,
  isLoading: false,
  error: null,

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
  }
}));

export default usePOIStore;
