import { describe, it, expect } from 'vitest';

describe('mapStyles.css', () => {
  describe('POI highlight circle animation (Bug 7)', () => {
    it('should have poi-highlight-circle class defined', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'mapStyles.css'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for poi-highlight-circle class
      expect(fileContent).toContain('.poi-highlight-circle');
    });

    it('should have poi-pulse animation keyframes', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'mapStyles.css'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for poi-pulse keyframes
      expect(fileContent).toContain('@keyframes poi-pulse');
    });

    it('should have correct animation properties for highlight circle', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'mapStyles.css'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for animation property
      expect(fileContent).toMatch(/animation:\s*poi-pulse/);

      // Check for amber/orange border color
      expect(fileContent).toContain('#f59e0b');

      // Check for pointer-events none (so it doesn't interfere with clicks)
      expect(fileContent).toContain('pointer-events: none');
    });

    it('should scale from 0.8 to 1.8 in animation', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'mapStyles.css'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for scale values in animation
      expect(fileContent).toContain('scale(0.8)');
      expect(fileContent).toContain('scale(1.8)');
    });
  });
});
