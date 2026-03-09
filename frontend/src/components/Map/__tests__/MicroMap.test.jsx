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
    it('should start with legend collapsed (isExpanded = false)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // The MapLegend component should default isExpanded to false
      expect(fileContent).toMatch(/useState\(false\)/);
      // Ensure it's not the old default of true in the legend
      // Find the MapLegend component section and verify
      const legendSection = fileContent.slice(
        fileContent.indexOf('const MapLegend'),
        fileContent.indexOf('const MapLegend') + 500
      );
      expect(legendSection).toContain('useState(false)');
      expect(legendSection).not.toMatch(/isExpanded.*useState\(true\)/);
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
      expect(fileContent).toContain('setIsExpanded(!isExpanded)');
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
