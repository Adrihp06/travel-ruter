import { describe, it, expect, vi } from 'vitest';

describe('TripMap', () => {
  describe('Google Maps export button (Bug 4)', () => {
    it('should have Google Maps link in destination popup', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'TripMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for Google Maps URL construction
      expect(fileContent).toContain('google.com/maps/search');

      // Check for "Open in Google Maps" text
      expect(fileContent).toContain('Open in Google Maps');
    });

    it('should use correct Google Maps API URL format', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'TripMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for proper Google Maps URL with query parameter
      expect(fileContent).toMatch(/google\.com\/maps\/search\/\?api=1&query=/);
    });

    it('should have ExternalLink icon for Google Maps button', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'TripMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that ExternalLink is imported
      expect(fileContent).toContain('ExternalLink');
    });
  });

  describe('Fallback warning position (Bug 6)', () => {
    it('should position fallback warning on the right side', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'TripMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for right positioning classes near fallback warning
      // The warning should have position classes like bottom-20 right-4
      expect(fileContent).toContain('bottom-20 right-4');
    });

    it('should have fallback warning as separate positioned element', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'TripMap.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for absolute positioning on fallback warning container
      expect(fileContent).toMatch(/absolute\s+bottom-\d+\s+right-\d+/);
    });
  });
});
