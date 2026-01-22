import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Day colors for multi-day route display
const DAY_COLORS = [
  { stroke: '#4F46E5', fill: 'rgba(79, 70, 229, 0.2)', name: 'Indigo' },   // Day 1
  { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.2)', name: 'Emerald' }, // Day 2
  { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.2)', name: 'Amber' },   // Day 3
  { stroke: '#EF4444', fill: 'rgba(239, 68, 68, 0.2)', name: 'Red' },      // Day 4
  { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.2)', name: 'Violet' },  // Day 5
  { stroke: '#06B6D4', fill: 'rgba(6, 182, 212, 0.2)', name: 'Cyan' },     // Day 6
  { stroke: '#EC4899', fill: 'rgba(236, 72, 153, 0.2)', name: 'Pink' },    // Day 7
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

  // Set transport mode for a specific segment
  setSegmentMode: (fromPoiId, toPoiId, mode) => {
    const segmentKey = `${fromPoiId}-${toPoiId}`;
    set((state) => ({
      segmentModes: {
        ...state.segmentModes,
        [segmentKey]: mode,
      },
    }));
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
  calculateDayRoute: async (date, pois) => {
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

  // Calculate routes for all days
  calculateAllDayRoutes: async (poisByDay) => {
    set({ isCalculating: true, error: null });

    const dates = Object.keys(poisByDay);

    for (const date of dates) {
      await get().calculateDayRoute(date, poisByDay[date]);
    }

    set({ isCalculating: false });
  },

  // Recalculate a specific segment (when mode changes)
  recalculateSegment: async (date, fromPoiId, toPoiId) => {
    const dayRoute = get().dayRoutes[date];
    if (!dayRoute) return;

    // Recalculate the entire day route
    await get().calculateDayRoute(date, dayRoute.pois);
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
    set({
      dayRoutes: {},
      visibleDays: [],
      segmentModes: {},
      error: null,
    });
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
