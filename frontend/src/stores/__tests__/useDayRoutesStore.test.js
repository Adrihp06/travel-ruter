import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

let useDayRoutesStore;

describe('useDayRoutesStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('../useDayRoutesStore');
    useDayRoutesStore = module.default;

    act(() => {
      useDayRoutesStore.setState({
        dayRoutes: {
          '2025-01-01': {
            pois: [{ id: 1 }, { id: 2 }],
            segments: [{ from_poi_id: 1, to_poi_id: 2 }],
          },
        },
        visibleDays: ['2025-01-01'],
        segmentModes: { '1-2': 'walking' },
        isCalculating: true,
        error: 'stale error',
      });
    });
  });

  it('clearRoutes resets route data and calculation state', () => {
    act(() => {
      useDayRoutesStore.getState().clearRoutes();
    });

    const state = useDayRoutesStore.getState();
    expect(state.dayRoutes).toEqual({});
    expect(state.visibleDays).toEqual([]);
    expect(state.segmentModes).toEqual({});
    expect(state.isCalculating).toBe(false);
    expect(state.error).toBeNull();
  });
});
