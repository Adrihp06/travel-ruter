import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock mapbox-gl
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      remove: vi.fn(),
      getCanvas: vi.fn(() => document.createElement('canvas')),
      getContainer: vi.fn(() => document.createElement('div')),
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    Popup: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
}));

// Mock react-map-gl
vi.mock('react-map-gl', () => ({
  default: vi.fn(({ children }) => children),
  Map: vi.fn(({ children }) => children),
  Marker: vi.fn(({ children }) => children),
  Popup: vi.fn(({ children }) => children),
  NavigationControl: vi.fn(() => null),
  Source: vi.fn(({ children }) => children),
  Layer: vi.fn(() => null),
}));

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:8000/api/v1');
vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
