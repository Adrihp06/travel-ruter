import { describe, it, expect } from 'vitest';
import { composePOIPrompt } from '../promptComposer';

describe('composePOIPrompt', () => {
  const basePoi = {
    id: 1,
    name: 'Sagrada Família',
    category: 'attraction',
    description: 'Iconic basilica designed by Antoni Gaudí',
    address: 'C/ de Mallorca, 401, Barcelona',
    dwell_time: 90,
    estimated_cost: 26,
    scheduled_date: '2025-07-15',
  };

  const destination = {
    id: 10,
    city_name: 'Barcelona',
    country: 'Spain',
    arrival_date: '2025-07-14',
    departure_date: '2025-07-18',
  };

  const trip = {
    id: 100,
    name: 'Mediterranean Summer 2025',
    start_date: '2025-07-10',
    end_date: '2025-07-25',
  };

  it('produces a prompt containing the POI name and details', () => {
    const result = composePOIPrompt({ poi: basePoi, destination, trip });
    expect(result).toContain('Sagrada Família');
    expect(result).toContain('attraction');
    expect(result).toContain('Antoni Gaudí');
    expect(result).toContain('90 minutes');
    expect(result).toContain('€26.00');
  });

  it('includes destination context', () => {
    const result = composePOIPrompt({ poi: basePoi, destination, trip });
    expect(result).toContain('Barcelona');
    expect(result).toContain('Spain');
    expect(result).toContain('2025-07-14');
    expect(result).toContain('2025-07-18');
  });

  it('includes trip-level context', () => {
    const result = composePOIPrompt({ poi: basePoi, destination, trip });
    expect(result).toContain('Mediterranean Summer 2025');
    expect(result).toContain('2025-07-10');
  });

  it('includes day route context when provided', () => {
    const dayRoute = {
      pois: [
        { id: 2, name: 'Park Güell' },
        basePoi,
        { id: 3, name: 'Casa Batlló' },
      ],
      segments: [
        { fromPoi: { name: 'Park Güell' }, toPoi: basePoi, distance: 3.2, duration: 12, mode: 'walking' },
        { fromPoi: basePoi, toPoi: { name: 'Casa Batlló' }, distance: 1.5, duration: 6, mode: 'walking' },
      ],
      totalDistance: 4.7,
      totalDuration: 18,
    };

    const result = composePOIPrompt({ poi: basePoi, destination, dayRoute, trip });
    expect(result).toContain('Park Güell');
    expect(result).toContain('Casa Batlló');
    expect(result).toContain('stop 2 of 3');
    expect(result).toContain('4.7 km');
    expect(result).toContain('From previous stop');
    expect(result).toContain('To next stop');
  });

  it('includes accommodation context when provided', () => {
    const accommodations = [
      { name: 'Hotel Arts', check_in_date: '2025-07-14', check_out_date: '2025-07-18', address: 'Marina 19' },
    ];

    const result = composePOIPrompt({ poi: basePoi, destination, accommodations, trip });
    expect(result).toContain('Hotel Arts');
    expect(result).toContain('Marina 19');
  });

  it('works with minimal POI data (only name)', () => {
    const minPoi = { id: 99, name: 'Random Place' };
    const result = composePOIPrompt({ poi: minPoi });
    expect(result).toContain('Random Place');
    expect(result).not.toContain('undefined');
  });

  it('omits day route section when route has fewer than 2 POIs', () => {
    const dayRoute = { pois: [basePoi], segments: [], totalDistance: 0, totalDuration: 0 };
    const result = composePOIPrompt({ poi: basePoi, dayRoute });
    expect(result).not.toContain('Day Itinerary');
  });

  it('handles missing scheduled_date gracefully', () => {
    const poi = { ...basePoi, scheduled_date: null };
    const result = composePOIPrompt({ poi, destination });
    expect(result).not.toContain('Scheduled date');
    expect(result).toContain('Sagrada Família');
  });
});
