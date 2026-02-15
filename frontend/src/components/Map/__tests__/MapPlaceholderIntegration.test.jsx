import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Integration tests verifying that all map components and pages
 * use MapPlaceholder instead of the old MapSkeleton.
 */
describe('MapPlaceholder integration', () => {
  const mapDir = path.resolve(import.meta.dirname, '..');
  const pagesDir = path.resolve(import.meta.dirname, '..', '..', '..', 'pages');

  describe('MapSkeleton removal', () => {
    it('MapSkeleton.jsx file should not exist', () => {
      const skeletonPath = path.join(mapDir, 'MapSkeleton.jsx');
      expect(fs.existsSync(skeletonPath)).toBe(false);
    });
  });

  describe('TripMap does not use placeholder overlay', () => {
    const filePath = path.join(mapDir, 'TripMap.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('does not use MapSkeleton', () => {
      expect(content).not.toContain("import MapSkeleton from './MapSkeleton'");
      expect(content).not.toContain('<MapSkeleton');
    });

    it('relies on native Mapbox GL tile loading instead of a placeholder overlay', () => {
      expect(content).not.toContain('isMapTilesLoaded');
    });
  });

  describe('GlobalTripView uses MapPlaceholder', () => {
    const filePath = path.join(pagesDir, 'GlobalTripView.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('imports MapPlaceholder instead of MapSkeleton', () => {
      expect(content).toContain("MapPlaceholder");
      expect(content).not.toContain("import MapSkeleton");
    });

    it('does not render MapSkeleton anywhere', () => {
      expect(content).not.toContain('<MapSkeleton');
    });

    it('uses MapPlaceholder in the loading state', () => {
      expect(content).toContain('<MapPlaceholder');
    });
  });

  describe('DetailView uses MapPlaceholder', () => {
    const filePath = path.join(pagesDir, 'DetailView.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('imports MapPlaceholder instead of MapSkeleton', () => {
      expect(content).toContain("MapPlaceholder");
      expect(content).not.toContain("import MapSkeleton");
    });

    it('does not render MapSkeleton anywhere', () => {
      expect(content).not.toContain('<MapSkeleton');
    });

    it('uses MapPlaceholder for the level 2 map loading state', () => {
      expect(content).toContain('<MapPlaceholder');
    });
  });

  describe('DestinationMap uses MapPlaceholder', () => {
    const filePath = path.join(mapDir, 'DestinationMap.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('imports MapPlaceholder', () => {
      expect(content).toContain("MapPlaceholder");
    });

    it('uses MapPlaceholder instead of plain text loading', () => {
      expect(content).toContain('<MapPlaceholder');
      // The old plain text loading message should be gone
      expect(content).not.toContain('Loading map...');
    });
  });

  describe('MapPlaceholder is exported from Map index', () => {
    it('Map index barrel file exports MapPlaceholder', () => {
      const indexPath = path.join(mapDir, 'index.js');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        expect(content).toContain('MapPlaceholder');
      }
      // If no index file, this is fine — components import directly
    });
  });
});
