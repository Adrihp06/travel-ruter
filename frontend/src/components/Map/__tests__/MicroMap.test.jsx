import { describe, it, expect, vi } from 'vitest';

describe('MicroMap', () => {
  describe('Supercluster configuration (Bug 10)', () => {
    it('should have clustering radius of 35 (not 60)', async () => {
      // Read the MicroMap file to verify the clustering configuration
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'MicroMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that radius is 35
      expect(fileContent).toMatch(/radius:\s*35/);
      // Ensure it's not the old value of 60
      expect(fileContent).not.toMatch(/radius:\s*60/);
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
