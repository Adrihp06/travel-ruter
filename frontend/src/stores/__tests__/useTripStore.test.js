import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Mock fetch globally
const originalFetch = global.fetch;

// Reset store between tests by importing fresh
let useTripStore;

describe('useTripStore', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset fetch mock
    global.fetch = vi.fn();

    // Dynamically re-import to get a fresh store
    vi.resetModules();
    const module = await import('../useTripStore');
    useTripStore = module.default;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useTripStore.getState();

      expect(state.tripsWithDestinations).toEqual([]);
      expect(state.selectedTrip).toBeNull();
      expect(state.budget).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.statusFilter).toBe('all');
      expect(state.sortBy).toBe('default');
      expect(state.showCompleted).toBe(false);
    });
  });

  describe('Filter Actions', () => {
    it('should set search query', () => {
      act(() => {
        useTripStore.getState().setSearchQuery('Norway');
      });

      expect(useTripStore.getState().searchQuery).toBe('Norway');
    });

    it('should set status filter', () => {
      act(() => {
        useTripStore.getState().setStatusFilter('planning');
      });

      expect(useTripStore.getState().statusFilter).toBe('planning');
    });

    it('should set sort by', () => {
      act(() => {
        useTripStore.getState().setSortBy('date_asc');
      });

      expect(useTripStore.getState().sortBy).toBe('date_asc');
    });

    it('should set show completed', () => {
      act(() => {
        useTripStore.getState().setShowCompleted(true);
      });

      expect(useTripStore.getState().showCompleted).toBe(true);
    });

    it('should clear all filters', () => {
      // Set some filters first
      act(() => {
        useTripStore.getState().setSearchQuery('test');
        useTripStore.getState().setStatusFilter('completed');
        useTripStore.getState().setSortBy('name_asc');
        useTripStore.getState().setShowCompleted(true);
      });

      // Clear filters
      act(() => {
        useTripStore.getState().clearFilters();
      });

      const state = useTripStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.statusFilter).toBe('all');
      expect(state.sortBy).toBe('default');
      expect(state.showCompleted).toBe(false);
    });
  });

  describe('setTrips', () => {
    it('should set trips with destinations structure', () => {
      const trips = [
        { id: 1, title: 'Trip 1' },
        { id: 2, title: 'Trip 2', destinations: [{ id: 1, name: 'Oslo' }] },
      ];

      act(() => {
        useTripStore.getState().setTrips(trips);
      });

      const state = useTripStore.getState();
      expect(state.tripsWithDestinations).toHaveLength(2);
      expect(state.tripsWithDestinations[0].destinations).toEqual([]);
      expect(state.tripsWithDestinations[0].poiStats).toEqual({ total_pois: 0, scheduled_pois: 0 });
      expect(state.tripsWithDestinations[1].destinations).toHaveLength(1);
    });

    it('should deduplicate trips by ID', () => {
      const trips = [
        { id: 1, title: 'Trip 1' },
        { id: 1, title: 'Trip 1 Duplicate' },
        { id: 2, title: 'Trip 2' },
      ];

      act(() => {
        useTripStore.getState().setTrips(trips);
      });

      expect(useTripStore.getState().tripsWithDestinations).toHaveLength(2);
    });
  });

  describe('selectTrip', () => {
    it('should select a trip by ID', () => {
      const trips = [
        { id: 1, title: 'Trip 1' },
        { id: 2, title: 'Trip 2' },
      ];

      act(() => {
        useTripStore.getState().setTrips(trips);
        useTripStore.getState().selectTrip(2);
      });

      expect(useTripStore.getState().selectedTrip?.id).toBe(2);
    });

    it('should return null for non-existent trip', () => {
      act(() => {
        useTripStore.getState().selectTrip(999);
      });

      expect(useTripStore.getState().selectedTrip).toBeNull();
    });
  });

  describe('getFilteredTrips', () => {
    const mockTrips = [
      { id: 1, title: 'Norway Adventure', status: 'planning', start_date: '2026-07-01' },
      { id: 2, title: 'Japan Trip', status: 'completed', start_date: '2025-04-01' },
      { id: 3, title: 'Switzerland Ski', status: 'planning', start_date: '2026-12-15' },
    ];

    beforeEach(() => {
      act(() => {
        useTripStore.getState().setTrips(mockTrips);
      });
    });

    it('should filter by search query', () => {
      act(() => {
        useTripStore.getState().setSearchQuery('Norway');
      });

      const filtered = useTripStore.getState().getFilteredTrips();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Norway Adventure');
    });

    it('should filter by status', () => {
      act(() => {
        useTripStore.getState().setStatusFilter('planning');
        useTripStore.getState().setShowCompleted(true); // Show all to test status filter
      });

      const filtered = useTripStore.getState().getFilteredTrips();
      expect(filtered.every(t => t.status === 'planning')).toBe(true);
    });

    it('should hide completed by default', () => {
      const filtered = useTripStore.getState().getFilteredTrips();
      expect(filtered.some(t => t.status === 'completed')).toBe(false);
    });

    it('should show completed when showCompleted is true', () => {
      act(() => {
        useTripStore.getState().setShowCompleted(true);
      });

      const filtered = useTripStore.getState().getFilteredTrips();
      expect(filtered.some(t => t.status === 'completed')).toBe(true);
    });

    it('should sort by date ascending', () => {
      act(() => {
        useTripStore.getState().setSortBy('date_asc');
        useTripStore.getState().setShowCompleted(true);
      });

      const filtered = useTripStore.getState().getFilteredTrips();
      const dates = filtered.map(t => new Date(t.start_date).getTime());

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('should sort by date descending', () => {
      act(() => {
        useTripStore.getState().setSortBy('date_desc');
        useTripStore.getState().setShowCompleted(true);
      });

      const filtered = useTripStore.getState().getFilteredTrips();
      const dates = filtered.map(t => new Date(t.start_date).getTime());

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });
  });

  describe('getActiveFiltersCount', () => {
    it('should return 0 when no filters active', () => {
      expect(useTripStore.getState().getActiveFiltersCount()).toBe(0);
    });

    it('should count active filters', () => {
      act(() => {
        useTripStore.getState().setSearchQuery('test');
        useTripStore.getState().setStatusFilter('planning');
      });

      expect(useTripStore.getState().getActiveFiltersCount()).toBe(2);
    });
  });

  describe('Soft Delete and Restore', () => {
    const mockTrips = [
      { id: 1, title: 'Trip 1' },
      { id: 2, title: 'Trip 2' },
    ];

    beforeEach(() => {
      act(() => {
        useTripStore.getState().setTrips(mockTrips);
      });
    });

    it('should soft delete a trip', () => {
      act(() => {
        useTripStore.getState().softDeleteTrip(1);
      });

      const state = useTripStore.getState();
      expect(state.tripsWithDestinations).toHaveLength(1);
      expect(state.pendingDelete?.trip?.id).toBe(1);
    });

    it('should restore a soft-deleted trip', () => {
      act(() => {
        useTripStore.getState().softDeleteTrip(1);
      });

      expect(useTripStore.getState().tripsWithDestinations).toHaveLength(1);

      act(() => {
        useTripStore.getState().restoreTrip();
      });

      const state = useTripStore.getState();
      expect(state.tripsWithDestinations).toHaveLength(2);
      expect(state.pendingDelete).toBeNull();
    });

    it('should clear pending delete without restoring', () => {
      act(() => {
        useTripStore.getState().softDeleteTrip(1);
        useTripStore.getState().clearPendingDelete();
      });

      const state = useTripStore.getState();
      expect(state.tripsWithDestinations).toHaveLength(1);
      expect(state.pendingDelete).toBeNull();
    });
  });

  describe('API Actions', () => {
    it('should fetch trips successfully', async () => {
      const mockTrips = [
        { id: 1, title: 'Test Trip' },
      ];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTrips),
        })
        // For destinations fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        })
        // For POI stats fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ total_pois: 0, scheduled_pois: 0 }),
        });

      await act(async () => {
        await useTripStore.getState().fetchTrips();
      });

      expect(useTripStore.getState().tripsWithDestinations).toHaveLength(1);
      expect(useTripStore.getState().isLoading).toBe(false);
    });

    it('should handle fetch trips error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await useTripStore.getState().fetchTrips();
      });

      // Should fall back to mock data
      expect(useTripStore.getState().tripsWithDestinations.length).toBeGreaterThan(0);
      expect(useTripStore.getState().error).toBe('Network error');
    });

    it('should create a trip', async () => {
      const newTrip = { id: 1, title: 'New Trip' };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newTrip),
      });

      let result;
      await act(async () => {
        result = await useTripStore.getState().createTrip({ title: 'New Trip' });
      });

      expect(result.id).toBe(1);
      expect(useTripStore.getState().tripsWithDestinations).toHaveLength(1);
    });

    it('should handle create trip error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Validation error' }),
      });

      await expect(
        act(async () => {
          await useTripStore.getState().createTrip({ title: '' });
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('getDestinationCount', () => {
    it('should return correct destination count', () => {
      const trips = [
        {
          id: 1,
          title: 'Trip 1',
          destinations: [
            { id: 1, name: 'Oslo' },
            { id: 2, name: 'Bergen' },
          ],
        },
      ];

      act(() => {
        useTripStore.getState().setTrips(trips);
      });

      expect(useTripStore.getState().getDestinationCount(1)).toBe(2);
    });

    it('should return 0 for trip with no destinations', () => {
      const trips = [{ id: 1, title: 'Trip 1' }];

      act(() => {
        useTripStore.getState().setTrips(trips);
      });

      expect(useTripStore.getState().getDestinationCount(1)).toBe(0);
    });
  });
});
