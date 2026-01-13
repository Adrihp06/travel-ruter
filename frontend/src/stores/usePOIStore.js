import { create } from 'zustand';

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
      
      // Mock data mirroring backend structure
      const mockPOIs = [
        {
          category: "Sights",
          pois: [
            { id: 101, name: "Opera House", description: "Iconic architecture", likes: 42, vetoes: 1, destination_id: destinationId },
            { id: 102, name: "Royal Palace", description: "Official residence", likes: 25, vetoes: 0, destination_id: destinationId }
          ]
        },
        {
          category: "Food",
          pois: [
            { id: 201, name: "Mathallen", description: "Food court with local delicacies", likes: 15, vetoes: 2, destination_id: destinationId },
            { id: 202, name: "Maaemo", description: "Michelin star experience", likes: 8, vetoes: 5, destination_id: destinationId }
          ]
        }
      ];
      set({ pois: mockPOIs, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
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

  votePOI: async (poiId, type) => {
    // Optimistic update
    set(state => {
      const newPOIs = state.pois.map(cat => ({
        ...cat,
        pois: cat.pois.map(p => {
          if (p.id === poiId) {
            return {
              ...p,
              likes: type === 'like' ? p.likes + 1 : p.likes,
              vetoes: type === 'veto' ? p.vetoes + 1 : p.vetoes
            };
          }
          return p;
        })
      }));
      return { pois: newPOIs };
    });
    
    // In a real app, call API here: await api.post(`/pois/${poiId}/vote`, { type });
  }
}));

export default usePOIStore;