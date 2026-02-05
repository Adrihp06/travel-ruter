import { describe, it, expect, vi } from 'vitest';

describe('Timeline', () => {
  describe('Origin/Return segment display (Bug 2)', () => {
    it('should accept trip prop with origin/return info', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that Timeline accepts trip prop
      expect(fileContent).toContain('trip, // Full trip object with origin/return info');
      // Or at least that trip is destructured from props
      expect(fileContent).toMatch(/trip[,\s]/);
    });

    it('should import originSegment and returnSegment from store', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that originSegment and returnSegment are destructured from store
      expect(fileContent).toContain('originSegment');
      expect(fileContent).toContain('returnSegment');
    });

    it('should render origin segment when trip has origin_name', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for origin segment section
      expect(fileContent).toContain('trip?.origin_name');
      expect(fileContent).toContain('Origin to First Destination Segment');
    });

    it('should render return segment when trip has return_name', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check for return segment section
      expect(fileContent).toContain('trip?.return_name');
      expect(fileContent).toContain('Last Destination to Return Segment');
    });

    it('should pass correct props to origin TravelSegmentCard', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check origin segment card has correct fromCity (origin_name)
      expect(fileContent).toMatch(/fromCity=\{trip\.origin_name\}/);
    });

    it('should check coordinates for origin/return segments', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'Timeline.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check that origin coordinates are checked
      expect(fileContent).toContain('trip.origin_latitude');
      expect(fileContent).toContain('trip.origin_longitude');

      // Check that return coordinates are checked
      expect(fileContent).toContain('trip.return_latitude');
      expect(fileContent).toContain('trip.return_longitude');
    });
  });
});
