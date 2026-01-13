import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const usePOIStore = create((set, get) => ({
  pois: [], // List of POIsByCategory objects
  selectedPOI: null,
  isLoading: false,
  error: null,

  setPOIs: (pois) => set({ pois }),

  fetchPOIsByDestination: async (destinationId) => {
    set({ isLoading: true });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data mirroring backend structure with extended POI details and coordinates
      // Using Oslo, Norway coordinates as example
      const baseLatitude = 59.9139;
      const baseLongitude = 10.7522;

      const mockPOIs = [
        {
          category: "Sights",
          pois: [
            {
              id: 101,
              name: "Opera House",
              description: "The Oslo Opera House is the home of The Norwegian National Opera and Ballet, and the national opera theatre in Norway.",
              likes: 42,
              vetoes: 1,
              destination_id: destinationId,
              latitude: 59.9075,
              longitude: 10.7533,
              address: "Kirsten Flagstads Plass 1, 0150 Oslo",
              dwell_time: 90,
              dwellTime: 90,
              estimated_cost: 0,
              estimatedCost: 0,
              currency: "USD",
              priority: 5,
              rating: 4.8
            },
            {
              id: 102,
              name: "Royal Palace",
              description: "The official residence of the present Norwegian monarch. The palace has 173 rooms.",
              likes: 25,
              vetoes: 0,
              destination_id: destinationId,
              latitude: 59.9169,
              longitude: 10.7276,
              address: "Slottsplassen 1, 0010 Oslo",
              dwell_time: 60,
              dwellTime: 60,
              estimated_cost: 15,
              estimatedCost: 15,
              currency: "USD",
              priority: 4,
              rating: 4.5
            },
            {
              id: 103,
              name: "Vigeland Sculpture Park",
              description: "World's largest sculpture park made by a single artist, featuring over 200 sculptures.",
              likes: 38,
              vetoes: 2,
              destination_id: destinationId,
              latitude: baseLatitude + 0.015,
              longitude: baseLongitude - 0.025,
              address: "Nobels gate 32, 0268 Oslo",
              dwell_time: 120,
              dwellTime: 120,
              estimated_cost: 0,
              estimatedCost: 0,
              currency: "USD",
              priority: 5,
              rating: 4.7
            }
          ]
        },
        {
          category: "Museums",
          pois: [
            {
              id: 104,
              name: "Munch Museum",
              description: "Home to the world's largest collection of Edvard Munch's works including 'The Scream'.",
              likes: 38,
              vetoes: 2,
              destination_id: destinationId,
              latitude: 59.9061,
              longitude: 10.7555,
              address: "Edvard Munchs plass 1, 0194 Oslo",
              dwell_time: 120,
              dwellTime: 120,
              estimated_cost: 18,
              estimatedCost: 18,
              currency: "USD",
              priority: 5,
              rating: 4.6
            },
            {
              id: 105,
              name: "Viking Ship Museum",
              description: "Houses the world's best-preserved Viking ships and artifacts from Viking graves.",
              likes: 45,
              vetoes: 1,
              destination_id: destinationId,
              latitude: 59.9048,
              longitude: 10.6845,
              address: "Huk Aveny 35, 0287 Oslo",
              dwell_time: 90,
              dwellTime: 90,
              estimated_cost: 12,
              estimatedCost: 12,
              currency: "USD",
              priority: 5,
              rating: 4.7
            }
          ]
        },
        {
          category: "Restaurants",
          pois: [
            {
              id: 201,
              name: "Mathallen",
              description: "Food court with local delicacies, artisan cheeses, fresh seafood, and craft beers.",
              likes: 15,
              vetoes: 2,
              destination_id: destinationId,
              latitude: 59.9225,
              longitude: 10.7520,
              address: "Vulkan 5, 0178 Oslo",
              dwell_time: 60,
              dwellTime: 60,
              estimated_cost: 35,
              estimatedCost: 35,
              currency: "USD",
              priority: 3,
              rating: 4.4
            },
            {
              id: 202,
              name: "Maaemo",
              description: "Three Michelin star restaurant offering innovative Nordic cuisine.",
              likes: 8,
              vetoes: 5,
              destination_id: destinationId,
              latitude: 59.9090,
              longitude: 10.7600,
              address: "Schweigaards gate 15B, 0191 Oslo",
              dwell_time: 180,
              dwellTime: 180,
              estimated_cost: 350,
              estimatedCost: 350,
              currency: "USD",
              priority: 2,
              rating: 4.9
            }
          ]
        },
        {
          category: "Viewpoints",
          pois: [
            {
              id: 301,
              name: "Ekeberg Sculpture Park",
              description: "Hilltop park with panoramic city views and sculptures.",
              likes: 22,
              vetoes: 0,
              destination_id: destinationId,
              latitude: 59.8990,
              longitude: 10.7640,
              address: "Kongsveien 23, 0193 Oslo",
              dwell_time: 90,
              dwellTime: 90,
              estimated_cost: 0,
              estimatedCost: 0,
              currency: "USD",
              priority: 3,
              rating: 4.6
            },
            {
              id: 302,
              name: "Holmenkollen Ski Jump",
              description: "Iconic ski jump with observation deck and museum.",
              likes: 30,
              vetoes: 1,
              destination_id: destinationId,
              latitude: 59.9639,
              longitude: 10.6673,
              address: "Holmenkollveien 64, 0787 Oslo",
              dwell_time: 120,
              dwellTime: 120,
              estimated_cost: 16,
              estimatedCost: 16,
              currency: "USD",
              priority: 4,
              rating: 4.5
            }
          ]
        },
        {
          category: "Accommodation",
          pois: [
            {
              id: 401,
              name: "The Thief Hotel",
              description: "Luxury waterfront hotel with contemporary art and stunning fjord views.",
              likes: 20,
              vetoes: 3,
              destination_id: destinationId,
              latitude: baseLatitude - 0.005,
              longitude: baseLongitude - 0.008,
              address: "Landgangen 1, 0252 Oslo",
              dwell_time: 0,
              dwellTime: 0,
              estimated_cost: 350,
              estimatedCost: 350,
              currency: "USD",
              priority: 4,
              rating: 4.8
            }
          ]
        }
      ];
      set({ pois: mockPOIs, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
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
