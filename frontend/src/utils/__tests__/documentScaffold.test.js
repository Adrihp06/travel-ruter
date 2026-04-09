import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scaffoldOverviewDocument,
  scaffoldDestinationDocument,
} from '../documentScaffold';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const trip = {
  id: 1,
  name: 'Europe Summer 2025',
  start_date: '2025-06-01',
  end_date: '2025-06-20',
  budget_total: 5000,
  currency: 'EUR',
};

const destinations = [
  {
    id: 10,
    city_name: 'Rome',
    country: 'Italy',
    arrival_date: '2025-06-01',
    departure_date: '2025-06-07',
  },
  {
    id: 20,
    city_name: 'Barcelona',
    country: 'Spain',
    arrival_date: '2025-06-07',
    departure_date: '2025-06-12',
  },
];

const destination = destinations[0];

const pois = [
  { name: 'Colosseum', scheduled_date: '2025-06-02', day_order: 1, duration_minutes: 120, cost_estimate: 16, notes: 'Book online' },
  { name: 'Trevi Fountain', scheduled_date: '2025-06-02', day_order: 2, duration_minutes: 30, cost_estimate: null, notes: null },
  { name: 'Vatican Museums', scheduled_date: '2025-06-03', day_order: 1, duration_minutes: 180, cost_estimate: 20, notes: 'Wear long pants' },
  { name: 'Local Market', scheduled_date: null, day_order: null, duration_minutes: null, cost_estimate: null, notes: null },
];

const accommodations = [
  {
    name: 'Hotel Roma',
    accommodation_type: 'Hotel',
    check_in: '2025-06-01',
    check_out: '2025-06-07',
    cost_per_night: 120,
    currency: 'EUR',
    booking_reference: 'BOOK-123',
    notes: 'Near station',
  },
];

const notes = [
  { title: 'Packing List', content: '- Sunscreen\n- Comfortable shoes', note_type: 'general', created_at: '2025-05-01' },
  { title: 'Restaurant Ideas', content: 'Try the local pasta.', note_type: 'general', created_at: '2025-05-02' },
];

// ---------------------------------------------------------------------------
// scaffoldOverviewDocument
// ---------------------------------------------------------------------------

describe('scaffoldOverviewDocument', () => {
  it('generates full trip overview with all data', () => {
    const md = scaffoldOverviewDocument(trip, destinations);

    expect(md).toContain('# Europe Summer 2025');
    expect(md).toContain('**Budget**: 5000 EUR');
    expect(md).toContain('## Destinations');
    expect(md).toContain('Rome, Italy');
    expect(md).toContain('Barcelona, Spain');
    expect(md).toContain('6 nights');
    expect(md).toContain('5 nights');
    // Route block
    expect(md).toContain(':::route');
    expect(md).toContain('type: trip-overview');
    expect(md).toContain('tripId: 1');
  });

  it('handles minimal/empty data gracefully', () => {
    const md = scaffoldOverviewDocument({}, []);

    expect(md).toContain('# Trip Overview');
    expect(md).toContain('**Dates**');
    // No destinations table
    expect(md).not.toContain('## Destinations');
    // No route block without trip.id
    expect(md).not.toContain(':::route');
  });

  it('handles null trip and destinations', () => {
    const md = scaffoldOverviewDocument(null, null);
    expect(md).toContain('# Trip Overview');
    expect(md).not.toContain('## Destinations');
  });

  it('omits budget line when budget_total is missing', () => {
    const md = scaffoldOverviewDocument({ name: 'Test Trip', id: 1 }, []);
    expect(md).not.toContain('**Budget**');
  });
});

// ---------------------------------------------------------------------------
// scaffoldDestinationDocument
// ---------------------------------------------------------------------------

describe('scaffoldDestinationDocument', () => {
  it('generates full destination document with all sections', () => {
    const md = scaffoldDestinationDocument(destination, pois, accommodations, notes);

    // Header
    expect(md).toContain('# Rome, Italy');
    expect(md).toContain('**Dates**');

    // Accommodation
    expect(md).toContain('## Accommodation');
    expect(md).toContain('Hotel Roma');
    expect(md).toContain('120 EUR/night');
    expect(md).toContain('Booking ref: BOOK-123');

    // Itinerary
    expect(md).toContain('## Daily Itinerary');
    expect(md).toContain('Colosseum');
    expect(md).toContain('120min');
    expect(md).toContain('Book online');
    expect(md).toContain('Vatican Museums');

    // Notes
    expect(md).toContain('## Notes');
    expect(md).toContain('### Packing List');
    expect(md).toContain('- Sunscreen');

    // Route blocks
    expect(md).toContain('type: day-route');
    expect(md).toContain('type: destination-overview');
  });

  it('skips itinerary section when no POIs', () => {
    const md = scaffoldDestinationDocument(destination, [], accommodations, notes);

    expect(md).not.toContain('## Daily Itinerary');
    // Other sections still present
    expect(md).toContain('## Accommodation');
    expect(md).toContain('## Notes');
  });

  it('skips accommodation section when no accommodations', () => {
    const md = scaffoldDestinationDocument(destination, pois, [], notes);

    expect(md).not.toContain('## Accommodation');
    expect(md).toContain('## Daily Itinerary');
  });

  it('skips notes section when no notes', () => {
    const md = scaffoldDestinationDocument(destination, pois, accommodations, []);

    expect(md).not.toContain('## Notes');
  });

  it('handles completely empty data', () => {
    const md = scaffoldDestinationDocument(destination, [], [], []);

    expect(md).toContain('# Rome, Italy');
    expect(md).not.toContain('## Accommodation');
    expect(md).not.toContain('## Daily Itinerary');
    expect(md).not.toContain('## Notes');
    // Destination overview route is still included
    expect(md).toContain('type: destination-overview');
  });
});

// ---------------------------------------------------------------------------
// POI grouping and sorting
// ---------------------------------------------------------------------------

describe('POI grouping by date and sorting', () => {
  it('groups POIs by scheduled_date and sorts by day_order', () => {
    const unsorted = [
      { name: 'B', scheduled_date: '2025-06-02', day_order: 2 },
      { name: 'A', scheduled_date: '2025-06-02', day_order: 1 },
      { name: 'C', scheduled_date: '2025-06-03', day_order: 1 },
    ];

    const md = scaffoldDestinationDocument(destination, unsorted, [], []);

    // Day 1 should come before Day 2
    const day1Pos = md.indexOf('Day 1');
    const day2Pos = md.indexOf('Day 2');
    expect(day1Pos).toBeLessThan(day2Pos);

    // Within Day 1, A should come before B
    const aPos = md.indexOf('| A |');
    const bPos = md.indexOf('| B |');
    expect(aPos).toBeLessThan(bPos);

    // A should be #1, B should be #2
    expect(md).toMatch(/\| 1 \| A \|/);
    expect(md).toMatch(/\| 2 \| B \|/);
  });

  it('puts unscheduled POIs at the end', () => {
    const mixed = [
      { name: 'Scheduled', scheduled_date: '2025-06-02', day_order: 1 },
      { name: 'Unscheduled', scheduled_date: null, day_order: null },
    ];

    const md = scaffoldDestinationDocument(destination, mixed, [], []);

    const scheduledPos = md.indexOf('Scheduled');
    const unscheduledPos = md.indexOf('### Unscheduled');
    expect(scheduledPos).toBeLessThan(unscheduledPos);
  });

  it('does not emit day-route block for unscheduled section', () => {
    const unscheduledOnly = [
      { name: 'Market', scheduled_date: null, day_order: null },
    ];

    const md = scaffoldDestinationDocument(destination, unscheduledOnly, [], []);

    expect(md).toContain('### Unscheduled');
    // Should have destination-overview but NOT day-route
    expect(md).toContain('type: destination-overview');
    expect(md).not.toContain('type: day-route');
  });
});

// ---------------------------------------------------------------------------
// Route block generation
// ---------------------------------------------------------------------------

describe('route block generation', () => {
  it('includes trip-overview route block in overview document', () => {
    const md = scaffoldOverviewDocument(trip, destinations);

    expect(md).toContain(':::route');
    expect(md).toContain('type: trip-overview');
    expect(md).toContain(`tripId: ${trip.id}`);
    expect(md).toContain(':::');
  });

  it('includes day-route blocks for each scheduled day', () => {
    const md = scaffoldDestinationDocument(destination, pois, [], []);

    // Two scheduled dates: 2025-06-02 and 2025-06-03
    const dayRouteMatches = md.match(/type: day-route/g);
    expect(dayRouteMatches).toHaveLength(2);

    expect(md).toContain('date: 2025-06-02');
    expect(md).toContain('date: 2025-06-03');
    expect(md).toContain(`destinationId: ${destination.id}`);
  });

  it('includes destination-overview route block', () => {
    const md = scaffoldDestinationDocument(destination, [], [], []);

    expect(md).toContain('type: destination-overview');
    expect(md).toContain(`destinationId: ${destination.id}`);
  });

  it('route blocks are properly fenced with :::route and :::', () => {
    const md = scaffoldOverviewDocument(trip, destinations);

    // Each :::route should have a matching closing :::
    const openCount = (md.match(/^:::route$/gm) || []).length;
    const closeCount = (md.match(/^:::$/gm) || []).length;
    expect(openCount).toBeGreaterThan(0);
    expect(openCount).toBe(closeCount);
  });
});
