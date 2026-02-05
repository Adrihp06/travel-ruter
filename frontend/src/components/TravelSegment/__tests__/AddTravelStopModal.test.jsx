import { describe, it, expect, vi } from 'vitest';

describe('AddTravelStopModal', () => {
  describe('API parameter fixes (Bug 3)', () => {
    it('should use "q" parameter for autocomplete (not "query")', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'AddTravelStopModal.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check autocomplete uses q= parameter
      expect(fileContent).toMatch(/autocomplete\?q=/);
      // Should NOT use query= parameter
      expect(fileContent).not.toMatch(/autocomplete\?query=/);
    });

    it('should use path parameter for place details (not query parameter)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const filePath = path.resolve(
        import.meta.dirname,
        '..',
        'AddTravelStopModal.jsx'
      );

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Check details uses path parameter: /details/${place_id}
      expect(fileContent).toMatch(/google-places\/details\/\$\{/);
      // Should NOT use query parameter: /details?place_id=
      expect(fileContent).not.toMatch(/google-places\/details\?place_id=/);
    });
  });
});
