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
      
      // Mock data mirroring backend structure with extended POI details
      const mockPOIs = [
        {
          category: "Sights",
          pois: [
            { id: 101, name: "Opera House", description: "Iconic architecture and stunning waterfront views", likes: 42, vetoes: 1, destination_id: destinationId, estimatedCost: 0, dwellTime: 90, rating: 4.8, latitude: 59.9075, longitude: 10.7533 },
            { id: 102, name: "Royal Palace", description: "Official residence of the Norwegian monarch", likes: 25, vetoes: 0, destination_id: destinationId, estimatedCost: 15, dwellTime: 60, rating: 4.5, latitude: 59.9169, longitude: 10.7276 }
          ]
        },
        {
          category: "Museums",
          pois: [
            { id: 103, name: "Munch Museum", description: "Home to Edvard Munch's famous artworks including The Scream", likes: 38, vetoes: 2, destination_id: destinationId, estimatedCost: 18, dwellTime: 120, rating: 4.6, latitude: 59.9061, longitude: 10.7555 },
            { id: 104, name: "Viking Ship Museum", description: "Ancient Viking ships and artifacts", likes: 45, vetoes: 1, destination_id: destinationId, estimatedCost: 12, dwellTime: 90, rating: 4.7, latitude: 59.9048, longitude: 10.6845 }
          ]
        },
        {
          category: "Restaurants",
          pois: [
            { id: 201, name: "Mathallen", description: "Food court with local delicacies and artisan products", likes: 15, vetoes: 2, destination_id: destinationId, estimatedCost: 35, dwellTime: 60, rating: 4.4, latitude: 59.9225, longitude: 10.7520 },
            { id: 202, name: "Maaemo", description: "Three Michelin star Nordic dining experience", likes: 8, vetoes: 5, destination_id: destinationId, estimatedCost: 350, dwellTime: 180, rating: 4.9, latitude: 59.9090, longitude: 10.7600 }
          ]
        },
        {
          category: "Viewpoints",
          pois: [
            { id: 301, name: "Ekeberg Sculpture Park", description: "Hilltop park with panoramic city views and sculptures", likes: 22, vetoes: 0, destination_id: destinationId, estimatedCost: 0, dwellTime: 90, rating: 4.6, latitude: 59.8990, longitude: 10.7640 },
            { id: 302, name: "Holmenkollen Ski Jump", description: "Iconic ski jump with observation deck and museum", likes: 30, vetoes: 1, destination_id: destinationId, estimatedCost: 16, dwellTime: 120, rating: 4.5, latitude: 59.9639, longitude: 10.6673 }
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