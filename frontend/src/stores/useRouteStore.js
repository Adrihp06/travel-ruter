import { create } from 'zustand';
import authFetch from '../utils/authFetch';
import useTripStore from './useTripStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const SETTINGS_KEY = 'travel-ruter-settings';

// Append trip_id query parameter to URL when a trip is selected
const withTripId = (url) => {
  const tripId = useTripStore.getState()?.selectedTrip?.id;
  if (tripId) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}trip_id=${tripId}`;
  }
  return url;
};

// Transport mode options
export const TRANSPORT_MODES = {
  // Inter-city modes
  DRIVING: { id: 'driving', label: 'Driving', icon: 'Car', speed: 90 },
  TRAIN: { id: 'train', label: 'Train', icon: 'Train', speed: 120 },
  BUS: { id: 'bus', label: 'Bus', icon: 'Bus', speed: 60 },
  FLIGHT: { id: 'flight', label: 'Flight', icon: 'Plane', speed: 800 },
  // Intra-city modes (Mapbox)
  WALKING: { id: 'walking', label: 'Walking', icon: 'Footprints', speed: 5 },
  CYCLING: { id: 'cycling', label: 'Cycling', icon: 'Bike', speed: 15 },
  DRIVING_TRAFFIC: { id: 'driving-traffic', label: 'Driving (Traffic)', icon: 'Car', speed: 60 },
};

// Map mode to Google Maps Routes API travel mode
const mapModeToGoogleMaps = (mode) => {
  switch (mode) {
    case 'driving':
      return 'DRIVE';
    case 'walking':
      return 'WALK';
    case 'cycling':
      return 'BICYCLE';
    case 'train':
    case 'bus':
      return 'TRANSIT';
    default:
      return 'DRIVE';
  }
};

// Check if mode is public transport
const isPublicTransport = (mode) => {
  return mode === 'train' || mode === 'bus';
};

// Get routing preference from localStorage
const getRoutingPreference = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.routing?.preference || 'default';
    }
  } catch {
    // Ignore parse errors
  }
  return 'default';
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

// Map mode to OpenRouteService profile
const mapModeToORS = (mode) => {
  switch (mode) {
    case 'driving':
    case 'train': // Use driving-car for train as ORS follows roads (gives realistic route geometry)
      return 'driving-car';
    case 'walking':
      return 'foot-walking';
    case 'cycling':
      return 'cycling-regular';
    default:
      return 'driving-car';
  }
};

const useRouteStore = create((set, get) => ({
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

  // OpenRouteService availability (cached)
  orsAvailable: null, // null = not checked, true/false = cached result

  // Google Maps availability (cached)
  googleMapsAvailable: null, // null = not checked, true/false = cached result

  // Actions
  setTransportMode: (mode) => set({ transportMode: mode }),
  setShowRoute: (show) => set({ showRoute: show }),
  clearError: () => set({ error: null }),
  clearRoute: () => set({ activeRoute: null, routeGeometry: null, routeDetails: null }),

  // Check if OpenRouteService is available
  checkORSAvailability: async () => {
    const { orsAvailable } = get();
    if (orsAvailable !== null) return orsAvailable;

    try {
      const response = await authFetch(withTripId(`${API_BASE_URL}/routes/ors/status`));
      if (response.ok) {
        const data = await response.json();
        set({ orsAvailable: data.available });
        return data.available;
      }
    } catch {
      // ORS not available
    }
    set({ orsAvailable: false });
    return false;
  },

  // Check if Google Maps Routes API is available
  checkGoogleMapsAvailability: async () => {
    const { googleMapsAvailable } = get();
    if (googleMapsAvailable !== null) return googleMapsAvailable;

    try {
      const response = await authFetch(withTripId(`${API_BASE_URL}/routes/google-maps/status`));
      if (response.ok) {
        const data = await response.json();
        set({ googleMapsAvailable: data.available });
        return data.available;
      }
    } catch {
      // Google Maps not available
    }
    set({ googleMapsAvailable: false });
    return false;
  },

  // Calculate route using Google Maps Routes API
  calculateGoogleMapsRoute: async (destinations, mode = 'driving') => {
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

      const response = await authFetch(withTripId(`${API_BASE_URL}/routes/google-maps/multi-waypoint`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints,
          travel_mode: mapModeToGoogleMaps(mode),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to calculate route via Google Maps');
      }

      const data = await response.json();

      set({
        routeGeometry: data.geometry,
        routeDetails: {
          distance_km: data.distance_km,
          duration_min: data.duration_min,
          travel_mode: data.travel_mode,
          transit_details: data.transit_details,
        },
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Calculate route using OpenRouteService (real road network routing)
  calculateORSRoute: async (destinations, mode = 'driving') => {
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

      const response = await authFetch(withTripId(`${API_BASE_URL}/routes/ors/multi-waypoint`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints,
          profile: mapModeToORS(mode),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to calculate route via OpenRouteService');
      }

      const data = await response.json();

      set({
        routeGeometry: data.geometry,
        routeDetails: {
          distance_km: data.distance_km,
          duration_min: data.duration_min,
          profile: data.profile,
          segments: data.segments,
        },
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

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

      const response = await authFetch(withTripId(`${API_BASE_URL}/routes/mapbox/multi-waypoint`), {
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

  // Calculate inter-city route (driving/train/bus/flight)
  // Uses routing service based on user preference:
  // - default: ORS for everything
  // - google_public_transport: Google Maps for train/bus, ORS for others
  // - google_everything: Google Maps for all modes
  calculateInterCityRoute: async (origin, destination, mode = 'driving') => {
    set({ isLoading: true, error: null });

    const routingPreference = getRoutingPreference();
    const useGoogleMaps =
      routingPreference === 'google_everything' ||
      (routingPreference === 'google_public_transport' && isPublicTransport(mode));

    // Try Google Maps first if preference is set
    if (useGoogleMaps) {
      const googleAvailable = await get().checkGoogleMapsAvailability();
      if (googleAvailable) {
        const result = await get().calculateGoogleMapsRoute([origin, destination], mode);
        if (result) {
          set((state) => ({
            routeDetails: {
              ...state.routeDetails,
              mode: mode,
            },
          }));
          return result;
        }
        // If Google Maps failed, fall through to other services
      }
    }

    // For train/bus mode, try to use OpenRouteService for real road network routing
    // This gives a more realistic route geometry that follows actual roads
    if (isPublicTransport(mode)) {
      const orsAvailable = await get().checkORSAvailability();
      if (orsAvailable) {
        const result = await get().calculateORSRoute([origin, destination], mode);
        if (result) {
          // ORS succeeded - adjust the duration for train/bus speed
          const speedMultiplier = mode === 'train' ? 0.75 : 1.2; // train faster, bus slower than car
          set((state) => ({
            routeDetails: {
              ...state.routeDetails,
              duration_min: Math.round(state.routeDetails.duration_min * speedMultiplier),
              mode: mode,
            },
          }));
          return result;
        }
        // If ORS failed, fall through to heuristic-based routing
      }
    }

    try {
      const response = await authFetch(`${API_BASE_URL}/routes/inter-city`, {
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
      const response = await authFetch(`${API_BASE_URL}/routes/intra-city`, {
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
      const response = await authFetch(`${API_BASE_URL}/routes/export/google-maps`, {
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
      const response = await authFetch(`${API_BASE_URL}/routes`);

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
