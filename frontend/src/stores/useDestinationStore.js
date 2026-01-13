import { create } from 'zustand';

const useDestinationStore = create((set) => ({
  destinations: [],
  selectedDestination: null,

  setDestinations: (destinations) => set({ destinations }),
  selectDestination: (destinationId) => set((state) => ({
    selectedDestination: state.destinations.find((d) => d.id === destinationId) || null
  })),
  resetSelectedDestination: () => set({ selectedDestination: null }),
}));

export default useDestinationStore;
