/**
 * Tests for DailyItinerary drag-and-drop behavior.
 *
 * Root cause: The DragOverlay rendered SortablePOIItem which calls useSortable(),
 * registering a duplicate droppable with the same POI ID. When the overlay
 * unmounts, it unregisters the droppable — permanently removing the original
 * POI's drop zone from @dnd-kit's internal Map. Each drag progressively
 * breaks subsequent drops.
 *
 * Fix: DragOverlay must render a static visual-only component (no useSortable).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Track useSortable calls to detect the bug
const useSortableCalls = [];

vi.mock('@dnd-kit/core', () => {
  const actual = vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragEnd }) => {
      // Store handlers so tests can trigger drag events
      window.__dndHandlers = { onDragStart, onDragEnd };
      return React.createElement('div', { 'data-testid': 'dnd-context' }, children);
    },
    DragOverlay: ({ children }) =>
      React.createElement('div', { 'data-testid': 'drag-overlay' }, children),
    useDroppable: () => ({
      setNodeRef: vi.fn(),
      isOver: false,
      active: null,
      over: null,
    }),
    useSensor: vi.fn((sensor, opts) => ({ sensor, opts })),
    useSensors: vi.fn((...sensors) => sensors),
    closestCorners: vi.fn(),
    PointerSensor: vi.fn(),
    KeyboardSensor: vi.fn(),
  };
});

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable');
  return {
    ...actual,
    SortableContext: ({ children }) =>
      React.createElement('div', { 'data-testid': 'sortable-context' }, children),
    useSortable: (opts) => {
      useSortableCalls.push({ id: opts?.id, stack: new Error().stack });
      return {
        attributes: {},
        listeners: {},
        setNodeRef: vi.fn(),
        transform: null,
        transition: null,
        isDragging: false,
      };
    },
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
    arrayMove: actual.arrayMove,
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: vi.fn(() => '') },
    Transition: { toString: vi.fn(() => '') },
  },
}));

vi.mock('../../../stores/usePOIStore', () => ({
  __esModule: true,
  default: () => ({
    optimizationResult: null,
    isOptimizing: false,
    getAccommodationForDay: vi.fn(),
    optimizeDayRoute: vi.fn(),
    applyOptimizedOrder: vi.fn(),
    clearOptimizationResult: vi.fn(),
    applySmartSchedule: vi.fn(),
  }),
}));

vi.mock('../../../stores/useDayRoutesStore', () => {
  const storeState = {
    dayRoutes: {},
    getSegmentMode: () => 'walking',
    setSegmentMode: vi.fn(),
    getSegmentData: () => null,
  };
  const useStore = (selector) => {
    if (typeof selector === 'function') return selector(storeState);
    return storeState;
  };
  return { __esModule: true, default: useStore };
});

vi.mock('../../common/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Lazy-loaded components
vi.mock('../../../components/Itinerary/OptimizationPreview', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/POI/POISuggestionsModal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/Itinerary/SmartSchedulerModal', () => ({
  __esModule: true,
  default: () => null,
}));

import DailyItinerary from '../DailyItinerary';

const mockDestination = {
  id: 1,
  name: 'Barcelona',
  arrival_date: '2026-06-01',
  departure_date: '2026-06-04',
};

const mockPOIs = [
  {
    category: 'restaurant',
    pois: [
      { id: 10, name: 'Restaurant A', category: 'restaurant', scheduled_date: '2026-06-01', day_order: 0, likes: 0, vetoes: 0 },
      { id: 11, name: 'Restaurant B', category: 'restaurant', scheduled_date: '2026-06-01', day_order: 1, likes: 0, vetoes: 0 },
    ],
  },
  {
    category: 'museum',
    pois: [
      { id: 20, name: 'Museum A', category: 'museum', scheduled_date: null, day_order: null, likes: 0, vetoes: 0 },
    ],
  },
];

describe('DailyItinerary DragOverlay', () => {
  beforeEach(() => {
    useSortableCalls.length = 0;
  });

  it('should NOT call useSortable inside DragOverlay during a drag', async () => {
    const onScheduleChange = vi.fn();

    render(
      <DailyItinerary
        destination={mockDestination}
        pois={mockPOIs}
        onScheduleChange={onScheduleChange}
      />
    );

    // Record which useSortable calls happened during initial render (these are for the actual items)
    const initialCallIds = useSortableCalls.map(c => c.id);

    // Verify that useSortable was called for the actual POI items
    expect(initialCallIds).toContain(10);
    expect(initialCallIds).toContain(11);
    expect(initialCallIds).toContain(20);

    const initialCallCount = useSortableCalls.length;

    // Simulate drag start — this triggers the DragOverlay to render an active POI
    await act(() => {
      window.__dndHandlers?.onDragStart?.({
        active: { id: 10, data: { current: {} } },
      });
    });

    // Check if any NEW useSortable calls happened (from inside DragOverlay)
    const newCalls = useSortableCalls.slice(initialCallCount);
    const overlayCallIds = newCalls.map(c => c.id);

    // Count how many times the active POI (id=10) appears vs non-active POIs.
    // A re-render may call useSortable for all items, but the DragOverlay must NOT
    // add an EXTRA call for the active POI. If it does, it registers a duplicate
    // droppable that corrupts the DnD state.
    const activePoiCalls = overlayCallIds.filter(id => id === 10).length;
    const otherPoiCalls = overlayCallIds.filter(id => id === 11).length;

    // The active POI should not have more useSortable calls than other items
    expect(activePoiCalls).toBeLessThanOrEqual(otherPoiCalls);
  });

  it('should render drag overlay content without sortable hooks', async () => {
    render(
      <DailyItinerary
        destination={mockDestination}
        pois={mockPOIs}
        onScheduleChange={vi.fn()}
      />
    );

    // Trigger drag
    await act(() => {
      window.__dndHandlers?.onDragStart?.({
        active: { id: 10, data: { current: {} } },
      });
    });

    // The overlay should show the POI name
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay.textContent).toContain('Restaurant A');
  });
});
