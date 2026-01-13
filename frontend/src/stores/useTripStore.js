import { create } from 'zustand';

const useTripStore = create((set) => ({
  trips: [],
  selectedTrip: null,
  isLoading: false,
  error: null,

  setTrips: (trips) => set({ trips }),
  selectTrip: (tripId) => set((state) => ({
    selectedTrip: state.trips.find((t) => t.id === Number(tripId)) || null
  })),
  
  fetchTrips: async () => {
    set({ isLoading: true });
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      const mockTrips = [
        { id: 1, title: 'Summer in Norway', date: 'Jul 2026', location: 'Norway' },
        { id: 2, title: 'Winter Alps', date: 'Dec 2026', location: 'Switzerland' },
        { id: 3, title: 'Japan Cherry Blossom', date: 'Apr 2027', location: 'Japan' },
      ];
      set({ trips: mockTrips, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchTripDetails: async (tripId) => {
    set({ isLoading: true });
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      // Mock details
      const mockDetails = {
        id: Number(tripId),
        title: 'Summer in Norway',
        days: [
          { day: 1, activities: ['Arrival in Oslo', 'Check-in at Hotel', 'Dinner at Aker Brygge'] },
          { day: 2, activities: ['Train to Bergen', 'Fjord Cruise', 'Fish Market'] },
          { day: 3, activities: ['Hike to Fløyen', 'Departure'] },
        ]
      };
      set({ selectedTrip: mockDetails, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  resetSelectedTrip: () => set({ selectedTrip: null }),
}));

export default useTripStore;
