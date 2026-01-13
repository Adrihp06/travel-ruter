import { create } from 'zustand';

const useMapStore = create((set) => ({
  center: [59.9139, 10.7522], // Default to Oslo
  zoom: 10,
  markers: [],

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setMarkers: (markers) => set({ markers }),
  setViewState: (center, zoom) => set({ center, zoom }),
}));

export default useMapStore;
