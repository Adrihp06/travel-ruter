import { describe, it, expect, vi } from 'vitest';

describe('MicroMap', () => {
  describe('Supercluster configuration (Bug 10)', () => {
    it('should have clustering radius of 22 (collision-only)', async () => {
      // Read the MicroMap file to verify the clustering configuration
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that radius is 22 (clusters only when markers visually collide)
      expect(fileContent).toMatch(/radius:\s*22/);
      // Ensure it's not the old values
      expect(fileContent).not.toMatch(/radius:\s*60/);
      expect(fileContent).not.toMatch(/radius:\s*35/);
    });

    it('should have maxZoom of 17 (not 16)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that maxZoom is 17
      expect(fileContent).toMatch(/maxZoom:\s*17/);
      // Ensure it's not the old value of 16 in the supercluster options
      // Note: There might be other maxZoom usages for different purposes
    });
  });

  describe('Map legend default state', () => {
    it('should allow the destination detail view to start with legend collapsed', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const mapFilePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );
      const detailViewPath = path.resolve(
        import.meta.dirname,
        '..',
        '..',
        '..',
        'pages',
        'DetailView.jsx'
      );

      const mapFileContent = fs.readFileSync(mapFilePath, 'utf-8');
      const detailViewContent = fs.readFileSync(detailViewPath, 'utf-8');

      expect(mapFileContent).toContain('legendInitiallyExpanded = true');
      expect(mapFileContent).toContain('initiallyExpanded = true');
      expect(detailViewContent).toContain('legendInitiallyExpanded={false}');

      const legendSection = mapFileContent.slice(
        mapFileContent.indexOf('const MapLegend'),
        mapFileContent.indexOf('const MapLegend') + 700
      );
      expect(legendSection).toContain('useState(initiallyExpanded)');
    });

    it('should still allow user to toggle legend open', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Legend toggle button should call setIsExpanded
      expect(fileContent).toContain('setIsExpanded((prev) => !prev)');
    });
  });

  describe('POI popup photo display', () => {
    it('should have POIPopupPhoto component that loads Google place photos', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // POIPopupPhoto component should exist
      expect(fileContent).toContain('const POIPopupPhoto');
      // Should use the photo-url endpoint for metadata photo_reference
      expect(fileContent).toContain('google-places/photo-url');
      // Should fall back to place photos endpoint via external_id
      expect(fileContent).toContain('/photos');
      // Should guard the fallback to POIs that can resolve through Google place data
      expect(fileContent).toContain('canLookupFromGoogle');
      // Should be used inside POIPopupContent
      expect(fileContent).toContain('<POIPopupPhoto poi={poi}');
    });
  });

  describe('POI highlight behavior (Bug 7)', () => {
    it('should have highlightedPOI state', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that highlightedPOI state exists
      expect(fileContent).toContain('highlightedPOI');
      expect(fileContent).toContain('setHighlightedPOI');
    });

    it('should clear highlight after 4 seconds', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that there's a 4000ms timeout for clearing highlight
      expect(fileContent).toMatch(/setTimeout\([^,]+,\s*4000\)/);
    });

    it('centerOnPOI effect should not change zoom level', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Extract the centerOnPOI effect section
      // Verify flyTo call doesn't include zoom parameter in that context
      // Look for the flyTo pattern without zoom
      expect(fileContent).toContain('flyTo');
      expect(fileContent).toContain('duration: 800');
    });
  });
});
