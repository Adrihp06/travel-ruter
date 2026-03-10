import { describe, it, expect } from 'vitest';
import {
  ROUTE_BLOCK_TYPE,
  parseRouteBlocks,
  validateDescriptor,
  serializeRouteBlock,
  normalizeDescriptor,
  createTripOverviewBlock,
  createDestinationOverviewBlock,
  createDayRouteBlock,
  insertRouteBlock,
  replaceRouteBlocks,
  encodePathOverlay,
  buildRouteMapUrl,
} from '../routeBlockContract';

// ---------------------------------------------------------------------------
// parseRouteBlocks
// ---------------------------------------------------------------------------

describe('parseRouteBlocks', () => {
  it('returns empty array for null/undefined/empty input', () => {
    expect(parseRouteBlocks(null)).toEqual([]);
    expect(parseRouteBlocks(undefined)).toEqual([]);
    expect(parseRouteBlocks('')).toEqual([]);
  });

  it('returns empty array for markdown with no route blocks', () => {
    expect(parseRouteBlocks('# Hello\n\nSome text here.')).toEqual([]);
  });

  it('parses a single trip-overview block', () => {
    const md = `# Intro

:::route
type: trip-overview
tripId: 42
label: Full Trip Route
:::

More content.`;

    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].descriptor).toEqual({
      type: 'trip-overview',
      tripId: 42,
      destinationId: null,
      date: null,
      label: 'Full Trip Route',
    });
    expect(blocks[0].valid).toBe(true);
    expect(blocks[0].errors).toEqual([]);
  });

  it('parses a single day-route block', () => {
    const md = `:::route
type: day-route
destinationId: 7
date: 2025-03-15
label: Day 1 — Rome Walking Tour
:::`;

    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].descriptor.type).toBe('day-route');
    expect(blocks[0].descriptor.destinationId).toBe(7);
    expect(blocks[0].descriptor.date).toBe('2025-03-15');
    expect(blocks[0].valid).toBe(true);
  });

  it('parses a single destination-overview block', () => {
    const md = `:::route
type: destination-overview
destinationId: 7
label: Rome Route Overview
:::`;

    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].descriptor.type).toBe('destination-overview');
    expect(blocks[0].descriptor.destinationId).toBe(7);
    expect(blocks[0].descriptor.date).toBeNull();
    expect(blocks[0].valid).toBe(true);
  });

  it('parses multiple blocks in a single document', () => {
    const md = `:::route
type: trip-overview
tripId: 1
:::

Some text between blocks.

:::route
type: day-route
destinationId: 5
date: 2025-01-10
:::`;

    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].descriptor.type).toBe('trip-overview');
    expect(blocks[1].descriptor.type).toBe('day-route');
  });

  it('reports start and end offsets correctly', () => {
    const prefix = 'Hello\n\n';
    const block = `:::route\ntype: trip-overview\ntripId: 1\n:::`;
    const md = `${prefix}${block}\n\nBye`;

    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].start).toBe(prefix.length);
    expect(blocks[0].end).toBe(prefix.length + block.length);
    expect(blocks[0].raw).toBe(block);
  });

  it('marks blocks with unknown type as invalid', () => {
    const md = `:::route\ntype: unknown-type\n:::`;
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].valid).toBe(false);
    expect(blocks[0].errors).toContain('Unknown route block type: "unknown-type"');
  });

  it('marks empty blocks as invalid', () => {
    const md = `:::route\n:::`;
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].valid).toBe(false);
    expect(blocks[0].errors).toContain('Missing required property: type');
  });

  it('ignores unknown properties without error', () => {
    const md = `:::route\ntype: trip-overview\ntripId: 1\nfoo: bar\n:::`;
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].valid).toBe(true);
    expect(blocks[0].descriptor.type).toBe('trip-overview');
  });
});

// ---------------------------------------------------------------------------
// validateDescriptor
// ---------------------------------------------------------------------------

describe('validateDescriptor', () => {
  it('returns invalid for null/undefined', () => {
    expect(validateDescriptor(null).valid).toBe(false);
    expect(validateDescriptor(undefined).valid).toBe(false);
  });

  it('validates a correct trip-overview descriptor', () => {
    const result = validateDescriptor({ type: 'trip-overview', tripId: 1 });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates a correct day-route descriptor', () => {
    const result = validateDescriptor({
      type: 'day-route',
      destinationId: 5,
      date: '2025-01-01',
    });
    expect(result.valid).toBe(true);
  });

  it('requires tripId for trip-overview', () => {
    const result = validateDescriptor({ type: 'trip-overview' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('trip-overview block requires tripId');
  });

  it('requires destinationId and date for day-route', () => {
    const result = validateDescriptor({ type: 'day-route' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('day-route block requires destinationId');
    expect(result.errors).toContain('day-route block requires date');
  });

  it('requires destinationId for destination-overview', () => {
    const result = validateDescriptor({ type: 'destination-overview' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('destination-overview block requires destinationId');
  });

  it('rejects unknown types', () => {
    const result = validateDescriptor({ type: 'banana' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown route block type: "banana"');
  });
});

// ---------------------------------------------------------------------------
// serializeRouteBlock
// ---------------------------------------------------------------------------

describe('serializeRouteBlock', () => {
  it('returns empty string for null/undefined', () => {
    expect(serializeRouteBlock(null)).toBe('');
    expect(serializeRouteBlock(undefined)).toBe('');
  });

  it('serializes a trip-overview block', () => {
    const result = serializeRouteBlock({
      type: 'trip-overview',
      tripId: 42,
      label: 'Full Trip',
    });
    expect(result).toBe(':::route\ntype: trip-overview\ntripId: 42\nlabel: Full Trip\n:::');
  });

  it('serializes a day-route block', () => {
    const result = serializeRouteBlock({
      type: 'day-route',
      destinationId: 7,
      date: '2025-03-15',
    });
    expect(result).toBe(
      ':::route\ntype: day-route\ndestinationId: 7\ndate: 2025-03-15\n:::'
    );
  });

  it('serializes a destination-overview block', () => {
    const result = serializeRouteBlock({
      type: 'destination-overview',
      destinationId: 7,
      label: 'Rome Route Overview',
    });
    expect(result).toBe(
      ':::route\ntype: destination-overview\ndestinationId: 7\nlabel: Rome Route Overview\n:::'
    );
  });

  it('omits null/undefined/empty properties', () => {
    const result = serializeRouteBlock({
      type: 'trip-overview',
      tripId: 1,
      destinationId: null,
      date: undefined,
      label: '',
    });
    expect(result).toBe(':::route\ntype: trip-overview\ntripId: 1\n:::');
  });

  it('round-trips through parse → serialize', () => {
    const original = ':::route\ntype: day-route\ndestinationId: 5\ndate: 2025-06-01\nlabel: Walk\n:::';
    const blocks = parseRouteBlocks(original);
    expect(blocks).toHaveLength(1);
    const reserialized = serializeRouteBlock(blocks[0].descriptor);
    expect(reserialized).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// normalizeDescriptor
// ---------------------------------------------------------------------------

describe('normalizeDescriptor', () => {
  it('returns empty descriptor for null/undefined', () => {
    const norm = normalizeDescriptor(null);
    expect(norm.type).toBeNull();
    expect(norm.tripId).toBeNull();
  });

  it('clamps invalid tripId to null', () => {
    expect(normalizeDescriptor({ tripId: -1 }).tripId).toBeNull();
    expect(normalizeDescriptor({ tripId: 0 }).tripId).toBeNull();
    expect(normalizeDescriptor({ tripId: 'abc' }).tripId).toBeNull();
  });

  it('passes valid tripId through', () => {
    expect(normalizeDescriptor({ tripId: 5 }).tripId).toBe(5);
  });

  it('rejects malformed dates', () => {
    expect(normalizeDescriptor({ date: 'not-a-date' }).date).toBeNull();
    expect(normalizeDescriptor({ date: '2025-1-1' }).date).toBeNull();
  });

  it('accepts well-formed dates', () => {
    expect(normalizeDescriptor({ date: '2025-03-15' }).date).toBe('2025-03-15');
  });

  it('trims label whitespace', () => {
    expect(normalizeDescriptor({ label: '  hello  ' }).label).toBe('hello');
  });

  it('nullifies blank label', () => {
    expect(normalizeDescriptor({ label: '   ' }).label).toBeNull();
  });

  it('nullifies unknown type', () => {
    expect(normalizeDescriptor({ type: 'unknown' }).type).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

describe('createTripOverviewBlock', () => {
  it('creates a normalized trip-overview descriptor', () => {
    const d = createTripOverviewBlock(42, 'My Trip Route');
    expect(d.type).toBe('trip-overview');
    expect(d.tripId).toBe(42);
    expect(d.label).toBe('My Trip Route');
    expect(d.destinationId).toBeNull();
    expect(d.date).toBeNull();
  });

  it('works without a label', () => {
    const d = createTripOverviewBlock(1);
    expect(d.type).toBe('trip-overview');
    expect(d.label).toBeNull();
  });
});

describe('createDayRouteBlock', () => {
  it('creates a normalized day-route descriptor', () => {
    const d = createDayRouteBlock(7, '2025-03-15', 'Rome Day');
    expect(d.type).toBe('day-route');
    expect(d.destinationId).toBe(7);
    expect(d.date).toBe('2025-03-15');
    expect(d.label).toBe('Rome Day');
    expect(d.tripId).toBeNull();
  });
});

describe('createDestinationOverviewBlock', () => {
  it('creates a normalized destination-overview descriptor', () => {
    const d = createDestinationOverviewBlock(7, 'Rome Route Overview');
    expect(d.type).toBe('destination-overview');
    expect(d.destinationId).toBe(7);
    expect(d.label).toBe('Rome Route Overview');
    expect(d.tripId).toBeNull();
    expect(d.date).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// insertRouteBlock
// ---------------------------------------------------------------------------

describe('insertRouteBlock', () => {
  const descriptor = {
    type: 'trip-overview',
    tripId: 1,
  };

  it('inserts into empty markdown', () => {
    const result = insertRouteBlock('', 0, descriptor);
    expect(result).toBe(':::route\ntype: trip-overview\ntripId: 1\n:::');
  });

  it('inserts at end of content with blank-line separation', () => {
    const result = insertRouteBlock('Hello', 5, descriptor);
    expect(result).toContain('Hello\n\n:::route');
  });

  it('inserts at beginning with blank-line separation', () => {
    const result = insertRouteBlock('World', 0, descriptor);
    expect(result).toMatch(/^:::route[\s\S]+:::\n\nWorld$/);
  });

  it('does not double blank lines when already present', () => {
    const result = insertRouteBlock('Hello\n\n', 7, descriptor);
    expect(result).not.toContain('\n\n\n');
  });

  it('returns original markdown for null descriptor', () => {
    expect(insertRouteBlock('Hello', 0, null)).toBe('Hello');
  });

  it('clamps position to valid range', () => {
    const result = insertRouteBlock('AB', 999, descriptor);
    expect(result).toContain('AB');
    expect(result).toContain(':::route');
  });
});

// ---------------------------------------------------------------------------
// replaceRouteBlocks
// ---------------------------------------------------------------------------

describe('replaceRouteBlocks', () => {
  it('returns original markdown when no blocks present', () => {
    expect(replaceRouteBlocks('Hello world', () => 'X')).toBe('Hello world');
  });

  it('returns original markdown for null/undefined input', () => {
    expect(replaceRouteBlocks(null, () => 'X')).toBe('');
    expect(replaceRouteBlocks(undefined, () => 'X')).toBe('');
  });

  it('replaces a single block with resolved content', () => {
    const md = `Before\n\n:::route\ntype: trip-overview\ntripId: 1\n:::\n\nAfter`;
    const result = replaceRouteBlocks(md, () => '[RESOLVED ROUTE IMAGE]');
    expect(result).toContain('Before');
    expect(result).toContain('[RESOLVED ROUTE IMAGE]');
    expect(result).toContain('After');
    expect(result).not.toContain(':::route');
  });

  it('replaces multiple blocks independently', () => {
    const md = `:::route\ntype: trip-overview\ntripId: 1\n:::\n\n:::route\ntype: day-route\ndestinationId: 2\ndate: 2025-01-01\n:::`;
    let callCount = 0;
    const result = replaceRouteBlocks(md, (block) => {
      callCount++;
      return `[BLOCK ${block.descriptor.type}]`;
    });
    expect(callCount).toBe(2);
    expect(result).toContain('[BLOCK trip-overview]');
    expect(result).toContain('[BLOCK day-route]');
  });

  it('leaves block as-is when resolver returns null', () => {
    const md = `:::route\ntype: trip-overview\ntripId: 1\n:::`;
    const result = replaceRouteBlocks(md, () => null);
    expect(result).toBe(md);
  });

  it('leaves block as-is when resolver returns undefined', () => {
    const md = `:::route\ntype: trip-overview\ntripId: 1\n:::`;
    const result = replaceRouteBlocks(md, () => undefined);
    expect(result).toBe(md);
  });

  it('passes descriptor and validity to resolver', () => {
    const md = `:::route\ntype: trip-overview\ntripId: 1\n:::`;
    replaceRouteBlocks(md, (block) => {
      expect(block.descriptor.type).toBe('trip-overview');
      expect(block.valid).toBe(true);
      return 'ok';
    });
  });

  it('gracefully handles invalid blocks via resolver', () => {
    const md = `:::route\ntype: unknown\n:::`;
    const result = replaceRouteBlocks(md, (block) => {
      if (!block.valid) return '⚠️ Invalid route block';
      return 'OK';
    });
    expect(result).toContain('⚠️ Invalid route block');
  });
});

// ---------------------------------------------------------------------------
// encodePathOverlay
// ---------------------------------------------------------------------------

describe('encodePathOverlay', () => {
  it('returns null for empty or single-point coordinates', () => {
    expect(encodePathOverlay([])).toBeNull();
    expect(encodePathOverlay([[1, 2]])).toBeNull();
    expect(encodePathOverlay(null)).toBeNull();
  });

  it('encodes a simple 2-point path', () => {
    const result = encodePathOverlay([[12.4964, 41.9028], [12.4922, 41.8902]]);
    expect(result).toMatch(/^path-3\+D97706\(/);
    expect(result).toContain('12.4964,41.9028');
    expect(result).toContain('12.4922,41.8902');
    expect(result).toMatch(/\)$/);
  });

  it('respects custom color and stroke width', () => {
    const result = encodePathOverlay([[0, 0], [1, 1]], '0284C7', 5);
    expect(result).toMatch(/^path-5\+0284C7/);
  });

  it('includes opacity when < 1', () => {
    const result = encodePathOverlay([[0, 0], [1, 1]], 'D97706', 3, 0.5);
    expect(result).toContain('-0.5');
  });

  it('subsamples coordinates exceeding 100 points', () => {
    const coords = Array.from({ length: 200 }, (_, i) => [i * 0.01, i * 0.01]);
    const result = encodePathOverlay(coords);
    // Should contain at most 100 coordinate pairs
    const pairCount = result.match(/\(([^)]+)\)/)[1].split(',').length / 2;
    expect(pairCount).toBeLessThanOrEqual(100);
    expect(pairCount).toBeGreaterThanOrEqual(2);
  });

  it('preserves first and last point during subsampling', () => {
    const coords = Array.from({ length: 200 }, (_, i) => [i * 0.001, i * 0.002]);
    const result = encodePathOverlay(coords);
    expect(result).toContain('0,0'); // first point
    expect(result).toContain('0.199,0.398'); // last point
  });
});

// ---------------------------------------------------------------------------
// buildRouteMapUrl
// ---------------------------------------------------------------------------

describe('buildRouteMapUrl', () => {
  const token = 'pk.test_token';
  const coords = [[12.4964, 41.9028], [12.4922, 41.8902]];

  it('returns null without token', () => {
    expect(buildRouteMapUrl(coords, null)).toBeNull();
    expect(buildRouteMapUrl(coords, '')).toBeNull();
  });

  it('returns null without valid coordinates', () => {
    expect(buildRouteMapUrl([], token)).toBeNull();
    expect(buildRouteMapUrl([[1, 2]], token)).toBeNull();
    expect(buildRouteMapUrl(null, token)).toBeNull();
  });

  it('builds a valid Mapbox static URL', () => {
    const url = buildRouteMapUrl(coords, token);
    expect(url).toContain('api.mapbox.com');
    expect(url).toContain('streets-v12/static');
    expect(url).toContain(`access_token=${token}`);
    expect(url).toContain('auto');
    expect(url).toContain('600x300@2x');
    expect(url).toContain('padding=40');
  });

  it('respects custom dimensions', () => {
    const url = buildRouteMapUrl(coords, token, { width: 800, height: 400, retina: false });
    expect(url).toContain('800x400');
    expect(url).not.toContain('@2x');
  });

  it('respects custom color', () => {
    const url = buildRouteMapUrl(coords, token, { color: '0284C7' });
    expect(url).toContain('0284C7');
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: create → serialize → parse → validate
// ---------------------------------------------------------------------------

describe('full round-trip', () => {
  it('trip-overview: factory → serialize → parse → validate', () => {
    const desc = createTripOverviewBlock(42, 'My Trip');
    const md = serializeRouteBlock(desc);
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].valid).toBe(true);
    expect(blocks[0].descriptor).toEqual(desc);
  });

  it('day-route: factory → serialize → parse → validate', () => {
    const desc = createDayRouteBlock(7, '2025-03-15', 'Rome Walk');
    const md = serializeRouteBlock(desc);
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].valid).toBe(true);
    expect(blocks[0].descriptor).toEqual(desc);
  });

  it('insert → parse round-trip preserves descriptor', () => {
    const desc = createTripOverviewBlock(99, 'Inserted Route');
    const md = insertRouteBlock('# Title\n\nParagraph.', 20, desc);
    const blocks = parseRouteBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].descriptor).toEqual(desc);
    expect(blocks[0].valid).toBe(true);
  });
});
