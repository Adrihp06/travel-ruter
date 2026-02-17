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

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:8000/api/v1');
vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token');

// Mock fetch globally
global.fetch = vi.fn();

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
