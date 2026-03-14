import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ROUTE_CARD_SENTINEL_RE,
  buildRouteCoordinates,
  buildGoogleMapsUrlForRoute,
  defaultRouteLabel,
  buildRouteStats,
  buildMapUrlForRoute,
  resolveRouteBlocksForExport,
} from '../routeBlockRenderer';
import { ROUTE_BLOCK_TYPE } from '../routeBlockContract';

// ---------------------------------------------------------------------------
// Mock fetchMapAsBase64 — avoids real network calls in tests
// ---------------------------------------------------------------------------

vi.mock('../mapboxStaticImage', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchMapAsBase64: vi.fn(async (url) =>
      url ? 'data:image/png;base64,MOCK_IMAGE' : undefined
    ),
  };
});

// ---------------------------------------------------------------------------
// Test data fixtures
// ---------------------------------------------------------------------------

const destinations = [
  { id: 1, city_name: 'Rome', name: 'Roma', longitude: 12.4964, latitude: 41.9028 },
  { id: 2, city_name: 'Florence', name: 'Firenze', longitude: 11.2558, latitude: 43.7696 },
  { id: 3, city_name: 'Venice', name: 'Venezia', longitude: 12.3155, latitude: 45.4408 },
];

const tripOverviewDesc = {
  type: ROUTE_BLOCK_TYPE.TRIP_OVERVIEW,
  tripId: 42,
  destinationId: null,
  date: null,
  label: 'Full Trip Route',
};

const dayRouteDesc = {
  type: ROUTE_BLOCK_TYPE.DAY_ROUTE,
  tripId: null,
  destinationId: 1,
  date: '2025-03-15',
  label: null,
};

const destinationOverviewDesc = {
  type: ROUTE_BLOCK_TYPE.DESTINATION_OVERVIEW,
  tripId: null,
  destinationId: 1,
  date: null,
  label: null,
};

// ---------------------------------------------------------------------------
// ROUTE_CARD_SENTINEL_RE
// ---------------------------------------------------------------------------

describe('ROUTE_CARD_SENTINEL_RE', () => {
  it('matches a valid sentinel', () => {
    const match = '<!-- ROUTE_CARD:0 -->'.match(ROUTE_CARD_SENTINEL_RE);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('0');
  });

  it('matches multi-digit indices', () => {
    const match = '<!-- ROUTE_CARD:42 -->'.match(ROUTE_CARD_SENTINEL_RE);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('42');
  });

  it('does not match regular HTML comments', () => {
    expect('<!-- some comment -->'.match(ROUTE_CARD_SENTINEL_RE)).toBeNull();
  });

  it('tolerates extra whitespace inside the comment', () => {
    const match = '<!--  ROUTE_CARD:5  -->'.match(ROUTE_CARD_SENTINEL_RE);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// buildRouteCoordinates
// ---------------------------------------------------------------------------

describe('buildRouteCoordinates', () => {
  it('returns null for empty destinations', () => {
    expect(buildRouteCoordinates(tripOverviewDesc, [])).toBeNull();
    expect(buildRouteCoordinates(tripOverviewDesc, null)).toBeNull();
  });

  it('returns all destination coords for trip-overview (2+)', () => {
    const coords = buildRouteCoordinates(tripOverviewDesc, destinations);
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([12.4964, 41.9028]);
    expect(coords[2]).toEqual([12.3155, 45.4408]);
  });

  it('returns null for trip-overview with only 1 valid destination', () => {
    const coords = buildRouteCoordinates(tripOverviewDesc, [destinations[0]]);
    expect(coords).toBeNull();
  });

  it('filters destinations without coordinates for trip-overview', () => {
    const dests = [
      ...destinations,
      { id: 4, city_name: 'NoCoords', longitude: null, latitude: null },
    ];
    const coords = buildRouteCoordinates(tripOverviewDesc, dests);
    expect(coords).toHaveLength(3);
  });

  it('returns single coordinate for day-route', () => {
    const coords = buildRouteCoordinates(dayRouteDesc, destinations);
    expect(coords).toEqual([[12.4964, 41.9028]]);
  });

  it('returns single coordinate for destination-overview', () => {
    const coords = buildRouteCoordinates(destinationOverviewDesc, destinations);
    expect(coords).toEqual([[12.4964, 41.9028]]);
  });

  it('returns null for day-route with unknown destinationId', () => {
    const desc = { ...dayRouteDesc, destinationId: 999 };
    expect(buildRouteCoordinates(desc, destinations)).toBeNull();
  });

  it('returns null for day-route when destination has no coords', () => {
    const dests = [{ id: 1, city_name: 'NoCoords', longitude: null, latitude: null }];
    expect(buildRouteCoordinates(dayRouteDesc, dests)).toBeNull();
  });

  it('returns null for unknown descriptor type', () => {
    const desc = { type: 'unknown' };
    expect(buildRouteCoordinates(desc, destinations)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildGoogleMapsUrlForRoute
// ---------------------------------------------------------------------------

describe('buildGoogleMapsUrlForRoute', () => {
  it('returns null for null/empty coordinates', () => {
    expect(buildGoogleMapsUrlForRoute(null)).toBeNull();
    expect(buildGoogleMapsUrlForRoute([])).toBeNull();
  });

  it('returns a place URL for a single coordinate', () => {
    const url = buildGoogleMapsUrlForRoute([[12.4964, 41.9028]]);
    expect(url).toContain('google.com/maps/@');
    expect(url).toContain('41.9028');
    expect(url).toContain('12.4964');
    expect(url).toContain('14z');
  });

  it('returns a directions URL for multiple coordinates', () => {
    const coords = [
      [12.4964, 41.9028],
      [11.2558, 43.7696],
      [12.3155, 45.4408],
    ];
    const url = buildGoogleMapsUrlForRoute(coords);
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('origin=41.9028');
    expect(url).toContain('destination=45.4408');
    expect(url).toContain('waypoints=');
    expect(url).toContain('43.7696');
  });

  it('returns directions URL without waypoints for exactly 2 coordinates', () => {
    const coords = [
      [12.4964, 41.9028],
      [12.3155, 45.4408],
    ];
    const url = buildGoogleMapsUrlForRoute(coords);
    expect(url).toContain('google.com/maps/dir');
    expect(url).not.toContain('waypoints=');
  });
});

// ---------------------------------------------------------------------------
// defaultRouteLabel
// ---------------------------------------------------------------------------

describe('defaultRouteLabel', () => {
  it('returns "Trip Route Overview" for trip-overview', () => {
    expect(defaultRouteLabel(tripOverviewDesc)).toBe('Trip Route Overview');
  });

  it('uses city_name + date for day-route', () => {
    const label = defaultRouteLabel(dayRouteDesc, destinations);
    expect(label).toContain('Rome');
    expect(label).toContain('2025-03-15');
  });

  it('falls back to "Destination" when destination not found', () => {
    const desc = { ...dayRouteDesc, destinationId: 999 };
    const label = defaultRouteLabel(desc, destinations);
    expect(label).toContain('Destination');
  });

  it('uses destination name without date if date is missing', () => {
    const desc = { ...dayRouteDesc, date: null };
    const label = defaultRouteLabel(desc, destinations);
    expect(label).toBe('Rome');
  });

  it('uses destination name for destination-overview', () => {
    const label = defaultRouteLabel(destinationOverviewDesc, destinations);
    expect(label).toBe('Rome Route Overview');
  });

  it('returns "Route" for unknown type', () => {
    expect(defaultRouteLabel({ type: 'unknown' })).toBe('Route');
  });
});

// ---------------------------------------------------------------------------
// buildRouteStats
// ---------------------------------------------------------------------------

describe('buildRouteStats', () => {
  it('returns destination count for trip-overview', () => {
    const stats = buildRouteStats(tripOverviewDesc, null, destinations);
    expect(stats).not.toBeNull();
    expect(stats.find((s) => s.key === 'stops').label).toBe('3 destinations');
  });

  it('uses singular "destination" for single valid dest', () => {
    const stats = buildRouteStats(tripOverviewDesc, null, [destinations[0]]);
    expect(stats.find((s) => s.key === 'stops').label).toBe('1 destination');
  });

  it('returns destination name and date for day-route', () => {
    const stats = buildRouteStats(dayRouteDesc, null, destinations);
    expect(stats).not.toBeNull();
    expect(stats.find((s) => s.key === 'destination').label).toBe('Rome');
    expect(stats.find((s) => s.key === 'date').label).toBe('2025-03-15');
  });

  it('returns null when no stats can be derived', () => {
    const desc = { type: ROUTE_BLOCK_TYPE.TRIP_OVERVIEW };
    expect(buildRouteStats(desc, null, [])).toBeNull();
  });

  it('returns null for empty destinations in trip-overview', () => {
    expect(buildRouteStats(tripOverviewDesc, null, null)).toBeNull();
  });

  it('returns destination and stop count for destination-overview', () => {
    const stats = buildRouteStats(destinationOverviewDesc, null, destinations, {
      stopCount: 4,
      dayCount: 2,
    });
    expect(stats.find((s) => s.key === 'destination').label).toBe('Rome');
    expect(stats.find((s) => s.key === 'days').label).toBe('2 days');
    expect(stats.find((s) => s.key === 'stops').label).toBe('4 stops');
  });
});

// ---------------------------------------------------------------------------
// buildMapUrlForRoute
// ---------------------------------------------------------------------------

describe('buildMapUrlForRoute', () => {
  const token = 'pk.test_token';

  it('returns null without mapboxToken', () => {
    const coords = [[12.4964, 41.9028], [11.2558, 43.7696]];
    expect(buildMapUrlForRoute(tripOverviewDesc, coords, destinations, null)).toBeNull();
    expect(buildMapUrlForRoute(tripOverviewDesc, coords, destinations, '')).toBeNull();
  });

  it('uses route polyline map for 2+ coordinates', () => {
    const coords = [[12.4964, 41.9028], [11.2558, 43.7696]];
    const url = buildMapUrlForRoute(tripOverviewDesc, coords, destinations, token);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('path-');
  });

  it('falls back to trip overview markers when coords are insufficient', () => {
    const url = buildMapUrlForRoute(tripOverviewDesc, null, destinations, token);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('pin-s');
  });

  it('falls back to destination marker for day-route single coord', () => {
    const coords = [[12.4964, 41.9028]];
    const url = buildMapUrlForRoute(dayRouteDesc, coords, destinations, token);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('pin-s');
  });

  it('falls back to destination marker for destination-overview single coord', () => {
    const coords = [[12.4964, 41.9028]];
    const url = buildMapUrlForRoute(destinationOverviewDesc, coords, destinations, token);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('pin-s');
  });

  it('returns null for day-route with no coordinates', () => {
    expect(buildMapUrlForRoute(dayRouteDesc, null, destinations, token)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveRouteBlocksForExport
// ---------------------------------------------------------------------------

describe('resolveRouteBlocksForExport', () => {
  const context = {
    trip: { id: 42, name: 'Italy Trip' },
    destinations,
    mapboxToken: 'pk.test_token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unchanged markdown when no route blocks present', async () => {
    const md = '# Hello\n\nSome text here.';
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toBe(md);
    expect(routeCards).toEqual([]);
  });

  it('replaces a trip-overview block with a sentinel', async () => {
    const md = `# Intro

:::route
type: trip-overview
tripId: 42
label: Full Trip Route
:::

More content.`;
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:0 -->');
    expect(processedMarkdown).not.toContain(':::route');
    expect(processedMarkdown).toContain('# Intro');
    expect(processedMarkdown).toContain('More content.');
    expect(routeCards).toHaveLength(1);
    expect(routeCards[0].label).toBe('Full Trip Route');
    expect(routeCards[0].type).toBe('trip-overview');
  });

  it('replaces a day-route block with a sentinel', async () => {
    const md = `:::route
type: day-route
destinationId: 1
date: 2025-03-15
:::`;
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:0 -->');
    expect(routeCards).toHaveLength(1);
    expect(routeCards[0].type).toBe('day-route');
  });

  it('replaces a destination-overview block with a sentinel', async () => {
    const md = `:::route
type: destination-overview
destinationId: 1
:::`;
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:0 -->');
    expect(routeCards).toHaveLength(1);
    expect(routeCards[0].type).toBe('destination-overview');
  });

  it('resolves multiple blocks with sequential indices', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::

:::route
type: day-route
destinationId: 1
date: 2025-03-15
:::`;
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:0 -->');
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:1 -->');
    expect(routeCards).toHaveLength(2);
    expect(routeCards[0].type).toBe('trip-overview');
    expect(routeCards[1].type).toBe('day-route');
  });

  it('fetches map images for resolved cards', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(routeCards[0].mapImageDataUri).toBe('data:image/png;base64,MOCK_IMAGE');
  });

  it('handles invalid blocks gracefully', async () => {
    const md = `:::route
type: unknown-type
:::`;
    const { processedMarkdown, routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('<!-- ROUTE_CARD:0 -->');
    expect(routeCards[0].label).toBe('Invalid Route Block');
    expect(routeCards[0].type).toBeNull();
  });

  it('generates Google Maps URL for trip overview', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(routeCards[0].googleMapsUrl).toContain('google.com/maps/dir');
  });

  it('generates Google Maps place URL for day-route', async () => {
    const md = `:::route
type: day-route
destinationId: 1
date: 2025-03-15
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(routeCards[0].googleMapsUrl).toContain('google.com/maps/@');
  });

  it('builds stats for route cards', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(routeCards[0].stats).not.toBeNull();
    expect(routeCards[0].stats.find((s) => s.key === 'stops')).toBeDefined();
  });

  it('uses default label when descriptor has no label', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, context);
    expect(routeCards[0].label).toBe('Trip Route Overview');
  });

  it('works without mapboxToken (no map images)', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;
    const { routeCards } = await resolveRouteBlocksForExport(md, {
      ...context,
      mapboxToken: undefined,
    });
    expect(routeCards[0].mapUrl).toBeNull();
    expect(routeCards[0].mapImageDataUri).toBeNull();
  });

  it('preserves surrounding markdown content', async () => {
    const md = `# Title

Some paragraph.

:::route
type: trip-overview
tripId: 42
:::

- List item 1
- List item 2`;
    const { processedMarkdown } = await resolveRouteBlocksForExport(md, context);
    expect(processedMarkdown).toContain('# Title');
    expect(processedMarkdown).toContain('Some paragraph.');
    expect(processedMarkdown).toContain('- List item 1');
    expect(processedMarkdown).toContain('- List item 2');
  });

  it('uses trip segment geometry and transit links when provided', async () => {
    const md = `:::route
type: trip-overview
tripId: 42
:::`;

    const { routeCards } = await resolveRouteBlocksForExport(md, {
      ...context,
      loadTripSegments: vi.fn(async () => [
        {
          from_destination_id: 1,
          to_destination_id: 2,
          travel_mode: 'train',
          distance_km: 230.4,
          duration_minutes: 90,
          route_geometry: {
            coordinates: [[12.4964, 41.9028], [11.9, 42.9], [11.2558, 43.7696]],
          },
        },
        {
          from_destination_id: 2,
          to_destination_id: 3,
          travel_mode: 'train',
          distance_km: 260,
          duration_minutes: 110,
          route_geometry: {
            coordinates: [[11.2558, 43.7696], [11.8, 44.6], [12.3155, 45.4408]],
          },
        },
      ]),
    });

    expect(routeCards[0].mapUrl).toContain('path-');
    expect(routeCards[0].googleMapsUrl).toContain('travelmode=transit');
    expect(routeCards[0].stats.find((s) => s.key === 'distance').label).toBe('490.4 km');
    expect(routeCards[0].stats.find((s) => s.key === 'duration').label).toBe('200 min');
  });

  it('uses day route geometry and walking directions when provided', async () => {
    const md = `:::route
type: day-route
destinationId: 1
date: 2025-03-15
:::`;

    const { routeCards } = await resolveRouteBlocksForExport(md, {
      ...context,
      loadDayRoute: vi.fn(async () => ({
        mapCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        navigationCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        travelMode: 'walking',
        stopCount: 3,
        totalDistanceKm: 4.2,
        totalDurationMin: 55,
      })),
    });

    expect(routeCards[0].mapUrl).toContain('path-');
    expect(routeCards[0].googleMapsUrl).toContain('travelmode=walking');
    expect(routeCards[0].googleMapsUrl).toContain('google.com/maps/dir');
    expect(routeCards[0].stats.find((s) => s.key === 'stops').label).toBe('3 stops');
    expect(routeCards[0].stats.find((s) => s.key === 'distance').label).toBe('4.2 km');
  });

  it('uses destination overview geometry when provided', async () => {
    const md = `:::route
type: destination-overview
destinationId: 1
:::`;

    const { routeCards } = await resolveRouteBlocksForExport(md, {
      ...context,
      loadDestinationOverview: vi.fn(async () => ({
        mapCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        navigationCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        travelMode: 'walking',
        stopCount: 3,
        dayCount: 2,
      })),
    });

    expect(routeCards[0].mapUrl).toContain('path-');
    expect(routeCards[0].googleMapsUrl).toContain('travelmode=walking');
    expect(routeCards[0].label).toBe('Rome Route Overview');
    expect(routeCards[0].stats.find((s) => s.key === 'days').label).toBe('2 days');
    expect(routeCards[0].stats.find((s) => s.key === 'stops').label).toBe('3 stops');
  });

  it('destination overview includes distance and duration when provided', async () => {
    const md = `:::route
type: destination-overview
destinationId: 1
:::`;

    const { routeCards } = await resolveRouteBlocksForExport(md, {
      ...context,
      loadDestinationOverview: vi.fn(async () => ({
        mapCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        navigationCoordinates: [[12.4964, 41.9028], [12.49, 41.91], [12.48, 41.93]],
        travelMode: 'walking',
        stopCount: 5,
        dayCount: 2,
        totalDistanceKm: 8.3,
        totalDurationMin: 105,
      })),
    });

    expect(routeCards[0].stats.find((s) => s.key === 'distance').label).toBe('8.3 km');
    expect(routeCards[0].stats.find((s) => s.key === 'duration').label).toBe('105 min');
  });
});
