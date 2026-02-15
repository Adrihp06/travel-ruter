import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock the MapboxContext
vi.mock('../../../contexts/MapboxContext', () => ({
  useMapboxToken: vi.fn(() => ({
    mapboxAccessToken: 'test-mapbox-token',
    isConfigured: true,
  })),
}));

// Import after mocks
import MapPlaceholder from '../MapPlaceholder';
import { useMapboxToken } from '../../../contexts/MapboxContext';

describe('MapPlaceholder', () => {
  beforeEach(() => {
    // Reset the mock to default return value before each test
    useMapboxToken.mockReturnValue({
      mapboxAccessToken: 'test-mapbox-token',
      isConfigured: true,
    });
    document.documentElement.classList.remove('dark');

    // Mock ResizeObserver to simulate container measurement
    global.ResizeObserver = class {
      constructor(cb) { this._cb = cb; }
      observe() {
        this._cb([{ contentRect: { width: 600, height: 400 } }]);
      }
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe('Static image URL generation', () => {
    it('renders a static Mapbox image when coordinates are provided', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('api.mapbox.com/styles/v1/mapbox/streets-v12/static');
      expect(img.src).toContain('2.3522,48.8566,12');
      expect(img.src).toContain('access_token=test-mapbox-token');
    });

    it('uses 2x retina resolution in the static image URL', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('@2x');
    });

    it('uses container dimensions in the static image URL', () => {
      // ResizeObserver mock reports 600x400
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={10}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('600x400@2x');
    });

    it('caps dimensions at 1280 for the Mapbox Static API limit', () => {
      global.ResizeObserver = class {
        constructor(cb) { this._cb = cb; }
        observe() {
          this._cb([{ contentRect: { width: 1500, height: 2000 } }]);
        }
        unobserve() {}
        disconnect() {}
      };

      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={10}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('1280x1280@2x');
    });

    it('defaults to zoom 10 when zoom is not provided', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('2.3522,48.8566,10');
    });
  });

  describe('Dark mode support', () => {
    it('uses dark map style when dark class is present on documentElement', () => {
      document.documentElement.classList.add('dark');

      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('mapbox/dark-v11');
      expect(img.src).not.toContain('mapbox/streets-v12');
    });

    it('uses streets style when dark mode is not active', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.src).toContain('mapbox/streets-v12');
    });
  });

  describe('Blur transition styling', () => {
    it('applies blur and scale to the static image initially', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.style.filter).toContain('blur');
      expect(img.style.transform).toContain('scale');
    });

    it('has a transition property set for the blur animation', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.style.transition).toBeTruthy();
    });
  });

  describe('Fallback without coordinates', () => {
    it('renders a shimmer placeholder when no coordinates are provided', () => {
      const { container } = render(<MapPlaceholder />);

      const img = screen.queryByRole('img');
      expect(img).not.toBeInTheDocument();

      const fallback = container.querySelector('.skeleton-shimmer');
      expect(fallback).toBeInTheDocument();
    });

    it('renders a shimmer placeholder when only longitude is provided', () => {
      const { container } = render(<MapPlaceholder longitude={2.3522} />);

      const img = screen.queryByRole('img');
      expect(img).not.toBeInTheDocument();

      const fallback = container.querySelector('.skeleton-shimmer');
      expect(fallback).toBeInTheDocument();
    });
  });

  describe('Fallback without Mapbox token', () => {
    it('renders a shimmer fallback when no Mapbox token is available', () => {
      useMapboxToken.mockReturnValue({
        mapboxAccessToken: null,
        isConfigured: false,
      });

      const { container } = render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.queryByRole('img');
      expect(img).not.toBeInTheDocument();

      const fallback = container.querySelector('.skeleton-shimmer');
      expect(fallback).toBeInTheDocument();
    });
  });

  describe('Layout and sizing', () => {
    it('applies custom height', () => {
      const { container } = render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
          height="500px"
        />
      );

      const wrapper = container.firstChild;
      expect(wrapper.style.height).toBe('500px');
    });

    it('defaults height to 100%', () => {
      const { container } = render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const wrapper = container.firstChild;
      expect(wrapper.style.height).toBe('100%');
    });

    it('applies custom className', () => {
      const { container } = render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
          className="rounded-xl shadow-lg"
        />
      );

      const wrapper = container.firstChild;
      expect(wrapper.className).toContain('rounded-xl');
      expect(wrapper.className).toContain('shadow-lg');
    });

    it('positions the image to cover the container', () => {
      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.style.objectFit).toBe('cover');
    });
  });

  describe('Reduced motion', () => {
    it('skips blur animation when prefers-reduced-motion is set', () => {
      // Mock matchMedia to prefer reduced motion
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      expect(img.style.filter).toBe('blur(0px)');
      expect(img.style.transform).toBe('scale(1)');

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('onReady callback', () => {
    it('calls onReady when the static image loads', () => {
      const onReady = vi.fn();

      render(
        <MapPlaceholder
          longitude={2.3522}
          latitude={48.8566}
          zoom={12}
          onReady={onReady}
        />
      );

      const img = screen.getByRole('img', { name: /map preview/i });
      fireEvent.load(img);

      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });
});
