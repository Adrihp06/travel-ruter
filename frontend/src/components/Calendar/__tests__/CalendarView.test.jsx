import { describe, it, expect } from 'vitest';
import { getTransportIcon } from '../calendarUtils';
import { Plane, Car, Train, Bus, Footprints, Bike, Ship } from 'lucide-react';

describe('CalendarView', () => {
  describe('getTransportIcon', () => {
    const mockSegments = [
      { from_destination_id: 1, to_destination_id: 2, travel_mode: 'train' },
      { from_destination_id: 2, to_destination_id: 3, travel_mode: 'car' },
      { from_destination_id: 3, to_destination_id: 4, travel_mode: 'plane' },
      { from_destination_id: 4, to_destination_id: 5, travel_mode: 'bus' },
      { from_destination_id: 5, to_destination_id: 6, travel_mode: 'walk' },
      { from_destination_id: 6, to_destination_id: 7, travel_mode: 'bike' },
      { from_destination_id: 7, to_destination_id: 8, travel_mode: 'ferry' },
    ];

    it('returns Train icon for train travel mode on arrival', () => {
      const icon = getTransportIcon(mockSegments, 2, true);
      expect(icon).toBe(Train);
    });

    it('returns Train icon for train travel mode on departure', () => {
      const icon = getTransportIcon(mockSegments, 1, false);
      expect(icon).toBe(Train);
    });

    it('returns Car icon for car travel mode', () => {
      const icon = getTransportIcon(mockSegments, 3, true);
      expect(icon).toBe(Car);
    });

    it('returns Plane icon for plane travel mode', () => {
      const icon = getTransportIcon(mockSegments, 4, true);
      expect(icon).toBe(Plane);
    });

    it('returns Bus icon for bus travel mode', () => {
      const icon = getTransportIcon(mockSegments, 5, true);
      expect(icon).toBe(Bus);
    });

    it('returns Footprints icon for walk travel mode', () => {
      const icon = getTransportIcon(mockSegments, 6, true);
      expect(icon).toBe(Footprints);
    });

    it('returns Bike icon for bike travel mode', () => {
      const icon = getTransportIcon(mockSegments, 7, true);
      expect(icon).toBe(Bike);
    });

    it('returns Ship icon for ferry travel mode', () => {
      const icon = getTransportIcon(mockSegments, 8, true);
      expect(icon).toBe(Ship);
    });

    it('returns Plane icon as default when no segments provided', () => {
      const icon = getTransportIcon([], 1, true);
      expect(icon).toBe(Plane);
    });

    it('returns Plane icon as default when segment not found', () => {
      const icon = getTransportIcon(mockSegments, 999, true);
      expect(icon).toBe(Plane);
    });

    it('returns Plane icon as default for unknown travel mode', () => {
      const segmentsWithUnknown = [
        { from_destination_id: 1, to_destination_id: 2, travel_mode: 'teleport' },
      ];
      const icon = getTransportIcon(segmentsWithUnknown, 2, true);
      expect(icon).toBe(Plane);
    });

    it('handles driving as alias for car', () => {
      const segmentsWithDriving = [
        { from_destination_id: 1, to_destination_id: 2, travel_mode: 'driving' },
      ];
      const icon = getTransportIcon(segmentsWithDriving, 2, true);
      expect(icon).toBe(Car);
    });

    it('handles flight as alias for plane', () => {
      const segmentsWithFlight = [
        { from_destination_id: 1, to_destination_id: 2, travel_mode: 'flight' },
      ];
      const icon = getTransportIcon(segmentsWithFlight, 2, true);
      expect(icon).toBe(Plane);
    });

    it('handles walking as alias for walk', () => {
      const segmentsWithWalking = [
        { from_destination_id: 1, to_destination_id: 2, travel_mode: 'walking' },
      ];
      const icon = getTransportIcon(segmentsWithWalking, 2, true);
      expect(icon).toBe(Footprints);
    });

    it('handles cycling as alias for bike', () => {
      const segmentsWithCycling = [
        { from_destination_id: 1, to_destination_id: 2, travel_mode: 'cycling' },
      ];
      const icon = getTransportIcon(segmentsWithCycling, 2, true);
      expect(icon).toBe(Bike);
    });
  });
});
