import { describe, it, expect } from 'vitest';
import {
  createTripOverviewBlock,
  createDayRouteBlock,
  serializeRouteBlock,
  insertRouteBlock,
  parseRouteBlocks,
  validateDescriptor,
} from '../../../utils/routeBlockContract';

describe('Route block insertion — authoring contract integration', () => {
  it('creates and serializes a trip-overview block', () => {
    const descriptor = createTripOverviewBlock(42, 'Full Trip Route');
    expect(descriptor.type).toBe('trip-overview');
    expect(descriptor.tripId).toBe(42);
    expect(descriptor.label).toBe('Full Trip Route');

    const token = serializeRouteBlock(descriptor);
    expect(token).toContain(':::route');
    expect(token).toContain('type: trip-overview');
    expect(token).toContain('tripId: 42');
    expect(token).toContain('label: Full Trip Route');
    expect(token).toMatch(/:::$/);
  });

  it('creates and serializes a day-route block', () => {
    const descriptor = createDayRouteBlock(7, '2025-03-15', 'Day 1 — Rome');
    expect(descriptor.type).toBe('day-route');
    expect(descriptor.destinationId).toBe(7);
    expect(descriptor.date).toBe('2025-03-15');

    const token = serializeRouteBlock(descriptor);
    expect(token).toContain('type: day-route');
    expect(token).toContain('destinationId: 7');
    expect(token).toContain('date: 2025-03-15');
  });

  it('inserts trip-overview block at end of empty document', () => {
    const descriptor = createTripOverviewBlock(10);
    const result = insertRouteBlock('', 0, descriptor);

    expect(result).toContain(':::route');
    expect(result).toContain('type: trip-overview');
    expect(result).toContain('tripId: 10');

    // Should be parseable
    const blocks = parseRouteBlocks(result);
    expect(blocks.length).toBe(1);
    expect(blocks[0].valid).toBe(true);
    expect(blocks[0].descriptor.type).toBe('trip-overview');
  });

  it('inserts day-route block at cursor position in existing content', () => {
    const existing = '# My Trip\n\nSome text about the trip.\n\n## Day 1\n\nVisited the Colosseum.';
    const cursorPos = existing.indexOf('## Day 1');
    const descriptor = createDayRouteBlock(7, '2025-03-15', 'Day 1 Route');
    const result = insertRouteBlock(existing, cursorPos, descriptor);

    // Block should be inserted before "## Day 1"
    expect(result).toContain(':::route');
    expect(result).toContain('type: day-route');
    expect(result).toContain('destinationId: 7');
    // Original content should still be present
    expect(result).toContain('# My Trip');
    expect(result).toContain('## Day 1');
    expect(result).toContain('Visited the Colosseum.');

    // Route block should appear before ## Day 1
    const blockIdx = result.indexOf(':::route');
    const day1Idx = result.indexOf('## Day 1');
    expect(blockIdx).toBeLessThan(day1Idx);
  });

  it('appends route block at end when cursor is at end of content', () => {
    const existing = '# My Trip\n\nSome content here.';
    const descriptor = createTripOverviewBlock(5, 'Overview Map');
    const result = insertRouteBlock(existing, existing.length, descriptor);

    expect(result).toContain('# My Trip');
    expect(result).toContain(':::route');
    // Block should come after original content
    const contentIdx = result.indexOf('Some content here.');
    const blockIdx = result.indexOf(':::route');
    expect(blockIdx).toBeGreaterThan(contentIdx);
  });

  it('ensures blank-line separation when inserting mid-content', () => {
    const existing = 'Before\nAfter';
    const descriptor = createTripOverviewBlock(1);
    const result = insertRouteBlock(existing, 6, descriptor); // After "Before"

    // Should have blank line separation
    const parts = result.split(':::route');
    expect(parts[0].endsWith('\n\n')).toBe(true);
  });

  it('validates created descriptors pass validation', () => {
    const tripBlock = createTripOverviewBlock(42, 'My Route');
    const { valid: tripValid, errors: tripErrors } = validateDescriptor(tripBlock);
    expect(tripValid).toBe(true);
    expect(tripErrors).toHaveLength(0);

    const dayBlock = createDayRouteBlock(7, '2025-03-15', 'Day Route');
    const { valid: dayValid, errors: dayErrors } = validateDescriptor(dayBlock);
    expect(dayValid).toBe(true);
    expect(dayErrors).toHaveLength(0);
  });

  it('round-trips through serialize → parse for trip-overview', () => {
    const original = createTripOverviewBlock(99, 'Round Trip');
    const serialized = serializeRouteBlock(original);
    const parsed = parseRouteBlocks(serialized);

    expect(parsed.length).toBe(1);
    expect(parsed[0].valid).toBe(true);
    expect(parsed[0].descriptor.type).toBe('trip-overview');
    expect(parsed[0].descriptor.tripId).toBe(99);
    expect(parsed[0].descriptor.label).toBe('Round Trip');
  });

  it('round-trips through serialize → parse for day-route', () => {
    const original = createDayRouteBlock(15, '2025-06-20', 'Day 3 Walk');
    const serialized = serializeRouteBlock(original);
    const parsed = parseRouteBlocks(serialized);

    expect(parsed.length).toBe(1);
    expect(parsed[0].valid).toBe(true);
    expect(parsed[0].descriptor.type).toBe('day-route');
    expect(parsed[0].descriptor.destinationId).toBe(15);
    expect(parsed[0].descriptor.date).toBe('2025-06-20');
    expect(parsed[0].descriptor.label).toBe('Day 3 Walk');
  });

  it('handles multiple route blocks in same document', () => {
    let doc = '';
    const trip = createTripOverviewBlock(1, 'Trip Overview');
    doc = insertRouteBlock(doc, 0, trip);
    doc += '\n\n# Day 1\n\n';
    const day1 = createDayRouteBlock(10, '2025-01-01', 'Day 1');
    doc = insertRouteBlock(doc, doc.length, day1);
    doc += '\n\n# Day 2\n\n';
    const day2 = createDayRouteBlock(11, '2025-01-02', 'Day 2');
    doc = insertRouteBlock(doc, doc.length, day2);

    const blocks = parseRouteBlocks(doc);
    expect(blocks.length).toBe(3);
    expect(blocks[0].descriptor.type).toBe('trip-overview');
    expect(blocks[1].descriptor.type).toBe('day-route');
    expect(blocks[1].descriptor.date).toBe('2025-01-01');
    expect(blocks[2].descriptor.type).toBe('day-route');
    expect(blocks[2].descriptor.date).toBe('2025-01-02');
    blocks.forEach(b => expect(b.valid).toBe(true));
  });
});
