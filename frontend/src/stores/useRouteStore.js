import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Transport mode options
export const TRANSPORT_MODES = {
  // Inter-city modes
  DRIVING: { id: 'driving', label: 'Driving', icon: 'Car', speed: 90 },
  TRAIN: { id: 'train', label: 'Train', icon: 'Train', speed: 120 },
  FLIGHT: { id: 'flight', label: 'Flight', icon: 'Plane', speed: 800 },
  // Intra-city modes (Mapbox)
  WALKING: { id: 'walking', label: 'Walking', icon: 'Footprints', speed: 5 },
  CYCLING: { id: 'cycling', label: 'Cycling', icon: 'Bike', speed: 15 },
  DRIVING_TRAFFIC: { id: 'driving-traffic', label: 'Driving (Traffic)', icon: 'Car', speed: 60 },
};

// Map profile to backend enum
const mapProfileToBackend = (profile) => {
  switch (profile) {
    case 'driving':
    case 'driving-traffic':
      return 'driving';
    case 'walking':
      return 'walking';
    case 'cycling':
      return 'cycling';
    default:
      return 'driving';
  }
};

const useRouteStore = create((set) => ({
  // State
  routes: [],
  activeRoute: null,
  routeGeometry: null,
  isLoading: false,
  error: null,

  // Route settings
  transportMode: 'driving',
  showRoute: true,

  // Calculated route details
  routeDetails: null,

  // Actions
  setTransportMode: (mode) => set({ transportMode: mode }),
  setShowRoute: (show) => set({ showRoute: show }),
  clearError: () => set({ error: null }),
  clearRoute: () => set({ activeRoute: null, routeGeometry: null, routeDetails: null }),

  // Calculate route between destinations using Mapbox
  calculateMapboxRoute: async (destinations, profile = 'driving') => {
    if (!destinations || destinations.length < 2) {
      set({ routeGeometry: null, routeDetails: null });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      // Build waypoints from destinations
      const waypoints = destinations.map(dest => ({
        lon: dest.longitude || dest.lng || dest.coordinates?.[0],
        lat: dest.latitude || dest.lat || dest.coordinates?.[1],
      })).filter(wp => wp.lon && wp.lat);

      if (waypoints.length < 2) {
        throw new Error('Need at least 2 valid waypoints');
      }

      const response = await fetch(`${API_BASE_URL}/routes/mapbox/multi-waypoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints,
          profile: mapProfileToBackend(profile),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to calculate route');
      }

      const data = await response.json();

      set({
        routeGeometry: data.geometry,
        routeDetails: {
          distance_km: data.distance_km,
          duration_min: data.duration_min,
          profile: data.profile,
          waypoints: data.waypoints,
        },
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      // Return null but don't clear existing route on error
      return null;
    }
  },

  // Calculate inter-city route (driving/train/flight)
  calculateInterCityRoute: async (origin, destination, mode = 'driving') => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/routes/inter-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: {
            lat: origin.latitude || origin.lat,
            lon: origin.longitude || origin.lng,
          },
          destination: {
            lat: destination.latitude || destination.lat,
            lon: destination.longitude || destination.lng,
          },
          mode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate inter-city route');
      }

      const data = await response.json();

      set({
        routeGeometry: data.geometry,
        routeDetails: {
          distance_km: data.distance_km,
          duration_min: data.duration_min,
          mode: data.mode,
        },
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Calculate intra-city route (walking/cycling within a city)
  calculateIntraCityRoute: async (points, mode = 'walking') => {
    if (!points || points.length < 2) {
      set({ routeGeometry: null, routeDetails: null });
      return null;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/routes/intra-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          points: points.map(p => ({
            latitude: p.latitude || p.lat,
            longitude: p.longitude || p.lng,
            name: p.name || '',
            dwell_time: p.dwell_time || 0,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate intra-city route');
      }

      const data = await response.json();

      set({
        routeDetails: {
          mode: data.mode,
          total_distance_km: data.total_distance_km,
          total_travel_time_minutes: data.total_travel_time_minutes,
          total_dwell_time_minutes: data.total_dwell_time_minutes,
          total_duration_minutes: data.total_duration_minutes,
          legs: data.legs,
        },
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Export route to Google Maps
  exportToGoogleMaps: async (origin, destination, waypoints = [], travelMode = 'driving') => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/routes/export/google-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: {
            lat: origin.latitude || origin.lat,
            lng: origin.longitude || origin.lng,
          },
          destination: {
            lat: destination.latitude || destination.lat,
            lng: destination.longitude || destination.lng,
          },
          waypoints: waypoints.map(wp => ({
            lat: wp.latitude || wp.lat,
            lng: wp.longitude || wp.lng,
          })),
          travel_mode: travelMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export to Google Maps');
      }

      const data = await response.json();
      set({ isLoading: false });

      // Open Google Maps URL in new tab
      if (data.url) {
        window.open(data.url, '_blank');
      }

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Fetch all saved routes
  fetchRoutes: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE_URL}/routes`);

      if (!response.ok) {
        throw new Error('Failed to fetch routes');
      }

      const data = await response.json();
      set({ routes: data.data || [], isLoading: false });
      return data.data;
    } catch (error) {
      set({ error: error.message, isLoading: false, routes: [] });
      return [];
    }
  },
}));

export default useRouteStore;
