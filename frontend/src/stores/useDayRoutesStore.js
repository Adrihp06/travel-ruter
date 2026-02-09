import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Debounce configuration
const ROUTE_CALCULATION_DEBOUNCE_MS = 500;

// Global AbortController for route calculations
let currentAbortController = null;

// Module-level debounce timer (shared across all calls)
let debounceTimer = null;

// Day colors for multi-day route display
const DAY_COLORS = [
  { stroke: '#D97706', fill: 'rgba(217, 119, 6, 0.2)', name: 'Amber' },     // Day 1 - primary
  { stroke: '#65A30D', fill: 'rgba(101, 163, 13, 0.2)', name: 'Lime' },     // Day 2 - accent green
  { stroke: '#EA580C', fill: 'rgba(234, 88, 12, 0.2)', name: 'Orange' },    // Day 3 - terracotta
  { stroke: '#0D9488', fill: 'rgba(13, 148, 136, 0.2)', name: 'Teal' },     // Day 4 - nature
  { stroke: '#C026D3', fill: 'rgba(192, 38, 211, 0.2)', name: 'Fuchsia' },  // Day 5 - vibrant
  { stroke: '#0284C7', fill: 'rgba(2, 132, 199, 0.2)', name: 'Sky' },       // Day 6 - sky blue
  { stroke: '#E11D48', fill: 'rgba(225, 29, 72, 0.2)', name: 'Rose' },      // Day 7 - warm rose
];

/**
 * Store for managing per-day routes with segment-level transport modes
 *
 * Structure:
 * - Each day has its own route with multiple segments
 * - Each segment (POI to POI) can have a different transport mode
 * - Routes are calculated independently per day
 * - Multiple days can be displayed simultaneously with different colors
 */
const useDayRoutesStore = create((set, get) => ({
  // Map of day routes: { [date]: DayRoute }
  // DayRoute: { pois, segments, totalDistance, totalDuration, isVisible, isLoading, geometry }
  dayRoutes: {},

  // Which days are currently visible on the map
  visibleDays: [],

  // Segment transport modes: { [segmentKey]: mode }
  // segmentKey format: "fromPoiId-toPoiId"
  segmentModes: {},

  // Loading state
  isCalculating: false,

  // Error state
  error: null,

  // Get color for a day (by index)
  getDayColor: (dayIndex) => {
    return DAY_COLORS[dayIndex % DAY_COLORS.length];
  },

  // Set transport mode for a specific segment and trigger recalculation
  setSegmentMode: (fromPoiId, toPoiId, mode) => {
    const segmentKey = `${fromPoiId}-${toPoiId}`;
    set((state) => ({
      segmentModes: {
        ...state.segmentModes,
        [segmentKey]: mode,
      },
    }));

    // Find which day this segment belongs to and trigger recalculation
    const { dayRoutes, recalculateSegment } = get();
    for (const [date, dayRoute] of Object.entries(dayRoutes)) {
      if (!dayRoute?.pois) continue;
      const pois = dayRoute.pois;
      for (let i = 0; i < pois.length - 1; i++) {
        if (pois[i].id === fromPoiId && pois[i + 1].id === toPoiId) {
          recalculateSegment(date, fromPoiId, toPoiId);
          return;
        }
      }
    }
  },

  // Get transport mode for a segment (default: walking)
  getSegmentMode: (fromPoiId, toPoiId) => {
    const segmentKey = `${fromPoiId}-${toPoiId}`;
    return get().segmentModes[segmentKey] || 'walking';
  },

  // Toggle day visibility
  toggleDayVisibility: (date) => {
    set((state) => {
      const isCurrentlyVisible = state.visibleDays.includes(date);
      return {
        visibleDays: isCurrentlyVisible
          ? state.visibleDays.filter(d => d !== date)
          : [...state.visibleDays, date],
      };
    });
  },

  // Set multiple days visible
  setVisibleDays: (dates) => {
    set({ visibleDays: dates });
  },

  // Calculate route for a single day
  calculateDayRoute: async (date, pois, signal) => {
    if (!pois || pois.length < 2) {
      // Clear route for this day if not enough POIs
      set((state) => ({
        dayRoutes: {
          ...state.dayRoutes,
          [date]: {
            pois,
            segments: [],
            totalDistance: 0,
            totalDuration: 0,
            totalDwellTime: pois?.reduce((sum, p) => sum + (p.dwell_time || 0), 0) || 0,
            isVisible: state.visibleDays.includes(date),
            isLoading: false,
            geometry: null,
            error: null,
          },
        },
      }));
      return;
    }

    // Mark as loading
    set((state) => ({
      dayRoutes: {
        ...state.dayRoutes,
        [date]: {
          ...state.dayRoutes[date],
          isLoading: true,
          error: null,
        },
      },
    }));

    try {
      const segments = [];
      let totalDistance = 0;
      let totalDuration = 0;
      const allCoordinates = [];

      // Calculate each segment
      for (let i = 0; i < pois.length - 1; i++) {
        // Check if aborted before each segment
        if (signal?.aborted) {
          return;
        }

        const fromPoi = pois[i];
        const toPoi = pois[i + 1];
        const mode = get().getSegmentMode(fromPoi.id, toPoi.id);

        // Build waypoints for Mapbox
        const waypoints = [
          { latitude: fromPoi.latitude, longitude: fromPoi.longitude },
          { latitude: toPoi.latitude, longitude: toPoi.longitude },
        ];

        try {
          const requestBody = {
            waypoints: waypoints.map(w => ({
              lon: w.longitude,
              lat: w.latitude,
            })),
            profile: mode === 'driving' ? 'driving' : mode,
          };

          const response = await fetch(`${API_BASE_URL}/routes/mapbox/multi-waypoint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal,
          });

          if (response.ok) {
            const data = await response.json();
            segments.push({
              fromPoi,
              toPoi,
              mode,
              distance: data.distance_km,
              duration: data.duration_min,
              geometry: data.geometry,
            });
            totalDistance += data.distance_km;
            totalDuration += data.duration_min;

            // Collect coordinates for combined geometry
            if (data.geometry?.coordinates) {
              allCoordinates.push(...data.geometry.coordinates);
            }
          } else {
            // Log the error for debugging
            const errorText = await response.text();
            console.warn(`Route API error for segment ${fromPoi.name} -> ${toPoi.name}:`, response.status, errorText);
            // Fallback: use straight line with estimate
            const distance = calculateHaversineDistance(
              fromPoi.latitude, fromPoi.longitude,
              toPoi.latitude, toPoi.longitude
            );
            const duration = estimateDuration(distance, mode);

            segments.push({
              fromPoi,
              toPoi,
              mode,
              distance,
              duration,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [fromPoi.longitude, fromPoi.latitude],
                  [toPoi.longitude, toPoi.latitude],
                ],
              },
            });
            totalDistance += distance;
            totalDuration += duration;
            allCoordinates.push(
              [fromPoi.longitude, fromPoi.latitude],
              [toPoi.longitude, toPoi.latitude]
            );
          }
        } catch (err) {
          // Don't log or fallback for abort errors
          if (err.name === 'AbortError') {
            return;
          }
          // Fallback on error
          console.warn(`Route API exception for segment:`, err);
          const distance = calculateHaversineDistance(
            fromPoi.latitude, fromPoi.longitude,
            toPoi.latitude, toPoi.longitude
          );
          const duration = estimateDuration(distance, mode);

          segments.push({
            fromPoi,
            toPoi,
            mode,
            distance,
            duration,
            geometry: {
              type: 'LineString',
              coordinates: [
                [fromPoi.longitude, fromPoi.latitude],
                [toPoi.longitude, toPoi.latitude],
              ],
            },
          });
          totalDistance += distance;
          totalDuration += duration;
          allCoordinates.push(
            [fromPoi.longitude, fromPoi.latitude],
            [toPoi.longitude, toPoi.latitude]
          );
        }
      }

      // Check if aborted before setting state
      if (signal?.aborted) {
        return;
      }

      // Calculate total dwell time
      const totalDwellTime = pois.reduce((sum, p) => sum + (p.dwell_time || 0), 0);

      // Create combined geometry for the full day route
      const combinedGeometry = {
        type: 'LineString',
        coordinates: allCoordinates,
      };

      set((state) => ({
        dayRoutes: {
          ...state.dayRoutes,
          [date]: {
            pois,
            segments,
            totalDistance,
            totalDuration,
            totalDwellTime,
            isVisible: state.visibleDays.includes(date),
            isLoading: false,
            geometry: combinedGeometry,
            error: null,
          },
        },
      }));
    } catch (error) {
      // Don't update state for abort errors
      if (error.name === 'AbortError') {
        return;
      }
      set((state) => ({
        dayRoutes: {
          ...state.dayRoutes,
          [date]: {
            ...state.dayRoutes[date],
            isLoading: false,
            error: error.message,
          },
        },
      }));
    }
  },

  // Calculate routes for all days (debounced to prevent excessive API calls)
  calculateAllDayRoutes: (poisByDay) => {
    // Clear any pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    return new Promise((resolve) => {
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        // Abort any previous calculations
        if (currentAbortController) {
          currentAbortController.abort();
        }
        currentAbortController = new AbortController();
        const signal = currentAbortController.signal;

        set({ isCalculating: true, error: null });

        const dates = Object.keys(poisByDay);

        for (const date of dates) {
          if (signal.aborted) {
            break;
          }
          await get().calculateDayRoute(date, poisByDay[date], signal);
        }

        if (!signal.aborted) {
          set({ isCalculating: false });
        }
        resolve();
      }, ROUTE_CALCULATION_DEBOUNCE_MS);
    });
  },

  // Calculate routes immediately without debounce (for explicit user actions)
  calculateAllDayRoutesImmediate: async (poisByDay) => {
    // Abort any previous calculations
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    set({ isCalculating: true, error: null });

    const dates = Object.keys(poisByDay);

    for (const date of dates) {
      if (signal.aborted) {
        break;
      }
      await get().calculateDayRoute(date, poisByDay[date], signal);
    }

    if (!signal.aborted) {
      set({ isCalculating: false });
    }
  },

  // Recalculate a specific segment (when mode changes)
  recalculateSegment: async (date, fromPoiId, toPoiId) => {
    const dayRoute = get().dayRoutes[date];
    if (!dayRoute) return;

    // Create a new AbortController for this recalculation
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    // Recalculate the entire day route
    await get().calculateDayRoute(date, dayRoute.pois, currentAbortController.signal);
  },

  // Export day route to Google Maps
  exportDayToGoogleMaps: async (date) => {
    const dayRoute = get().dayRoutes[date];
    if (!dayRoute || dayRoute.pois.length < 2) return null;

    const origin = dayRoute.pois[0];
    const destination = dayRoute.pois[dayRoute.pois.length - 1];
    const waypoints = dayRoute.pois.slice(1, -1);

    try {
      const response = await fetch(`${API_BASE_URL}/routes/export/google-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: origin.latitude, lon: origin.longitude },
          destination: { lat: destination.latitude, lon: destination.longitude },
          waypoints: waypoints.map(w => ({ lat: w.latitude, lon: w.longitude })),
          travel_mode: 'walking', // Default mode for overall trip
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
        return data;
      }
    } catch (error) {
      console.error('Failed to export to Google Maps:', error);
    }
    return null;
  },

  // Clear all routes
  clearRoutes: () => {
    // Cancel any pending debounced calculations
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // Abort any in-flight requests
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    set({
      dayRoutes: {},
      visibleDays: [],
      segmentModes: {},
      error: null,
    });
  },

  // Cancel pending route calculations (useful for cleanup)
  cancelPendingCalculations: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    set({ isCalculating: false });
  },

  // Get visible routes for map display
  getVisibleRoutes: () => {
    const { dayRoutes, visibleDays } = get();
    return visibleDays
      .map(date => ({ date, ...dayRoutes[date] }))
      .filter(route => route.geometry);
  },
}));

// Helper: Calculate haversine distance between two points (in km)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Helper: Estimate duration based on distance and mode
function estimateDuration(distanceKm, mode) {
  const speeds = {
    walking: 5,    // km/h
    cycling: 15,   // km/h
    driving: 40,   // km/h (city driving)
  };
  const speed = speeds[mode] || speeds.walking;
  return (distanceKm / speed) * 60; // Convert to minutes
}

export default useDayRoutesStore;
