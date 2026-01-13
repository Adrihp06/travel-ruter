import { create } from 'zustand';

const usePOIStore = create((set) => ({
  pois: [],
  selectedPOI: null,

  setPOIs: (pois) => set({ pois }),
  selectPOI: (poiId) => set((state) => ({
    selectedPOI: state.pois.find((p) => p.id === poiId) || null
  })),
}));

export default usePOIStore;
