import { create } from 'zustand';

const useMapStore = create((set) => ({
  center: [59.9139, 10.7522], // Default to Oslo
  zoom: 10,
  markers: [],
  voiceCommand: null, // { center: [lng, lat], zoom, ts }

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setMarkers: (markers) => set({ markers }),
  setViewState: (center, zoom) => set({ center, zoom }),

  /** Called by voice agent to fly the map to a location. Uses timestamp to ensure reactivity. */
  voiceFlyTo: (lng, lat, zoom) => set({
    voiceCommand: { center: [lng, lat], zoom: zoom || 14, ts: Date.now() },
  }),
}));

export default useMapStore;
