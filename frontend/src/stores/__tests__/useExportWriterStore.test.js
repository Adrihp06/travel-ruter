import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';

const originalFetch = global.fetch;

let useExportWriterStore;

describe('useExportWriterStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.resetModules();
    const module = await import('../useExportWriterStore');
    useExportWriterStore = module.default;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useExportWriterStore.getState();
      expect(state.documents).toEqual({});
      expect(state.selectedDocId).toBeNull();
      expect(state.selectedForExport).toEqual(new Set());
      expect(state.saveStatus).toBe('idle');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('loadDocuments', () => {
    it('should load existing notes and create missing destination docs', async () => {
      global.fetch = vi.fn()
        // Fetch existing notes
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            notes: [
              { id: 100, title: 'Trip Overview', content: 'overview text', destination_id: null },
              { id: 101, title: 'Paris', content: 'paris text', destination_id: 1 },
            ],
          }),
        })
        // Create note for destination 2 (no existing note)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 102, title: 'London', content: '', destination_id: 2 }),
        });

      const destinations = [
        { id: 1, city_name: 'Paris' },
        { id: 2, city_name: 'London' },
      ];

      await act(async () => {
        await useExportWriterStore.getState().loadDocuments(5, destinations);
      });

      const state = useExportWriterStore.getState();
      expect(Object.keys(state.documents)).toHaveLength(3);
      expect(state.documents[100].title).toBe('Trip Overview');
      expect(state.documents[100].destinationId).toBeNull();
      expect(state.documents[101].title).toBe('Paris');
      expect(state.documents[101].destinationId).toBe(1);
      expect(state.documents[102].title).toBe('London');
      expect(state.documents[102].destinationId).toBe(2);
      expect(state.isLoading).toBe(false);
      expect(String(state.selectedDocId)).toBe('100');
    });

    it('should handle zero destinations — only creates overview', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ notes: [] }),
        })
        // Create overview
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 200, title: 'Trip Overview', content: '' }),
        });

      await act(async () => {
        await useExportWriterStore.getState().loadDocuments(5, []);
      });

      const state = useExportWriterStore.getState();
      expect(Object.keys(state.documents)).toHaveLength(1);
      expect(state.documents[200].title).toBe('Trip Overview');
      expect(state.isLoading).toBe(false);
    });

    it('should discard stale load when reset() is called mid-flight', async () => {
      let resolveFetch;
      global.fetch = vi.fn(() => new Promise((resolve) => {
        resolveFetch = resolve;
      }));

      // Start loading — blocks on fetch
      const loadPromise = useExportWriterStore.getState().loadDocuments(1, []);

      // Reset while loading (simulates trip switch cleanup)
      act(() => {
        useExportWriterStore.getState().reset();
      });

      // Resolve the now-stale fetch
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({
          notes: [{ id: 100, title: 'Stale Overview', content: 'stale data', destination_id: null }],
        }),
      });

      await loadPromise;

      // State should remain reset — stale load must not have written documents
      const state = useExportWriterStore.getState();
      expect(state.documents).toEqual({});
      expect(state.isLoading).toBe(false);
    });

    it('should not create missing documents after reset during response parsing', async () => {
      let resolveFetch;
      let resolveJson;
      let markJsonStarted;
      const jsonStarted = new Promise((resolve) => {
        markJsonStarted = resolve;
      });
      global.fetch = vi.fn((url, options) => {
        if (String(url).includes('/notes?')) {
          return new Promise((resolve) => {
            resolveFetch = () => resolve({
              ok: true,
              json: () => new Promise((jsonResolve) => {
                markJsonStarted();
                resolveJson = jsonResolve;
              }),
            });
          });
        }

        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 999,
              title: 'Trip Overview',
              content: '',
              destination_id: null,
            }),
          });
        }

        throw new Error(`Unexpected fetch call: ${url}`);
      });

      const loadPromise = useExportWriterStore.getState().loadDocuments(1, []);
      resolveFetch();
      await jsonStarted;

      act(() => {
        useExportWriterStore.getState().reset();
      });

      resolveJson({ notes: [] });
      await loadPromise;

      const postCalls = global.fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
      expect(postCalls).toHaveLength(0);
      expect(useExportWriterStore.getState().documents).toEqual({});
    });

    it('should discard first load when second load starts (trip switch)', async () => {
      const resolveFns = [];
      global.fetch = vi.fn(() => new Promise((resolve) => {
        resolveFns.push(resolve);
      }));

      // Start first load (trip 1)
      const load1 = useExportWriterStore.getState().loadDocuments(1, []);

      // Start second load (trip 2) — supersedes first
      const load2 = useExportWriterStore.getState().loadDocuments(2, []);

      // Resolve first fetch (stale)
      resolveFns[0]({
        ok: true,
        json: () => Promise.resolve({
          notes: [{ id: 100, title: 'Trip 1 Overview', content: '', destination_id: null }],
        }),
      });

      // Resolve second fetch (current)
      resolveFns[1]({
        ok: true,
        json: () => Promise.resolve({
          notes: [{ id: 200, title: 'Trip 2 Overview', content: 'trip 2', destination_id: null }],
        }),
      });

      await Promise.all([load1, load2]);

      // Only trip 2's data should be in the store
      const state = useExportWriterStore.getState();
      expect(state.documents[200]).toBeDefined();
      expect(state.documents[200].title).toBe('Trip 2 Overview');
      expect(state.documents[100]).toBeUndefined();
    });

    it('should set error on fetch failure without clobbering a newer load', async () => {
      let resolveFns = [];
      global.fetch = vi.fn(() => new Promise((resolve, reject) => {
        resolveFns.push({ resolve, reject });
      }));

      // Start first load that will fail
      const load1 = useExportWriterStore.getState().loadDocuments(1, []);

      // Start second load
      const load2 = useExportWriterStore.getState().loadDocuments(2, []);

      // Fail first fetch
      resolveFns[0].resolve({ ok: false });

      // Succeed second fetch
      resolveFns[1].resolve({
        ok: true,
        json: () => Promise.resolve({
          notes: [{ id: 300, title: 'Trip 2 Overview', content: '', destination_id: null }],
        }),
      });

      await Promise.allSettled([load1, load2]);

      // Error from stale load1 should NOT appear; load2 should succeed
      const state = useExportWriterStore.getState();
      expect(state.error).toBeNull();
      expect(state.documents[300]).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear all state and cancel pending auto-saves', () => {
      useExportWriterStore.setState({
        documents: { 1: { id: 1, title: 'Test', content: '', destinationId: null, status: 'empty' } },
        selectedDocId: 1,
        selectedForExport: new Set([1]),
        saveStatus: 'saving',
        isLoading: true,
        error: 'some error',
      });

      act(() => {
        useExportWriterStore.getState().reset();
      });

      const state = useExportWriterStore.getState();
      expect(state.documents).toEqual({});
      expect(state.selectedDocId).toBeNull();
      expect(state.selectedForExport).toEqual(new Set());
      expect(state.saveStatus).toBe('idle');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('selectDocument', () => {
    it('should set selectedDocId', () => {
      act(() => {
        useExportWriterStore.getState().selectDocument(42);
      });
      expect(useExportWriterStore.getState().selectedDocId).toBe(42);
    });
  });

  describe('toggleExportSelection', () => {
    it('should toggle a document in/out of export selection', () => {
      act(() => {
        useExportWriterStore.getState().toggleExportSelection(1);
      });
      expect(useExportWriterStore.getState().selectedForExport.has(1)).toBe(true);

      act(() => {
        useExportWriterStore.getState().toggleExportSelection(1);
      });
      expect(useExportWriterStore.getState().selectedForExport.has(1)).toBe(false);
    });
  });

  describe('updateContent', () => {
    it('should update document content and schedule auto-save', () => {
      vi.useFakeTimers();

      useExportWriterStore.setState({
        documents: {
          10: { id: 10, title: 'Doc', content: '', destinationId: null, status: 'empty' },
        },
      });

      act(() => {
        useExportWriterStore.getState().updateContent(10, 'Hello world');
      });

      const doc = useExportWriterStore.getState().documents[10];
      expect(doc.content).toBe('Hello world');
      expect(doc.status).toBe('draft');

      vi.useRealTimers();
    });
  });

  describe('loadReferenceNotes', () => {
    it('should load trip-level and destination notes, excluding export_draft', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          trip_level: [
            { id: 10, title: 'Trip thoughts', content: 'my thoughts', note_type: 'general', destination_id: null },
            { id: 11, title: 'Draft overview', content: '', note_type: 'export_draft', destination_id: null },
          ],
          by_destination: [
            {
              destination_id: 1,
              destination_name: 'Paris',
              notes: [
                { id: 20, title: 'Paris restaurants', content: 'food notes', note_type: 'destination', destination_id: 1 },
                { id: 21, title: 'Paris draft', content: '', note_type: 'export_draft', destination_id: 1 },
              ],
            },
          ],
        }),
      });

      await act(async () => {
        await useExportWriterStore.getState().loadReferenceNotes(5);
      });

      const state = useExportWriterStore.getState();
      // Should include non-export_draft notes only
      expect(Object.keys(state.referenceNotes)).toHaveLength(2);
      expect(state.referenceNotes[10]).toEqual({
        id: 10, title: 'Trip thoughts', content: 'my thoughts',
        destinationId: null, status: 'draft', noteType: 'general', isReference: true,
      });
      expect(state.referenceNotes[20]).toEqual({
        id: 20, title: 'Paris restaurants', content: 'food notes',
        destinationId: 1, status: 'draft', noteType: 'destination', isReference: true,
      });
      // export_draft notes must be excluded
      expect(state.referenceNotes[11]).toBeUndefined();
      expect(state.referenceNotes[21]).toBeUndefined();
      expect(state.isLoadingRefs).toBe(false);
    });

    it('should handle empty grouped response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ trip_level: [], by_destination: [] }),
      });

      await act(async () => {
        await useExportWriterStore.getState().loadReferenceNotes(5);
      });

      const state = useExportWriterStore.getState();
      expect(state.referenceNotes).toEqual({});
      expect(state.isLoadingRefs).toBe(false);
    });

    it('should discard stale reference notes load on reset', async () => {
      let resolveFetch;
      global.fetch = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));

      const loadPromise = useExportWriterStore.getState().loadReferenceNotes(1);

      act(() => { useExportWriterStore.getState().reset(); });

      resolveFetch({
        ok: true,
        json: () => Promise.resolve({
          trip_level: [{ id: 50, title: 'Stale note', content: '', note_type: 'general', destination_id: null }],
          by_destination: [],
        }),
      });

      await loadPromise;

      const state = useExportWriterStore.getState();
      expect(state.referenceNotes).toEqual({});
    });

    it('should not affect selectAllForExport — only documents are selected', async () => {
      useExportWriterStore.setState({
        documents: {
          1: { id: 1, title: 'Overview', content: '', destinationId: null, status: 'empty' },
          2: { id: 2, title: 'Paris', content: '', destinationId: 10, status: 'empty' },
        },
        referenceNotes: {
          50: { id: 50, title: 'A note', content: 'note', destinationId: null, noteType: 'general', isReference: true },
        },
      });

      act(() => { useExportWriterStore.getState().selectAllForExport(); });

      const state = useExportWriterStore.getState();
      expect(state.selectedForExport.has(1)).toBe(true);
      expect(state.selectedForExport.has(2)).toBe(true);
      expect(state.selectedForExport.has(50)).toBe(false);
    });
  });

  describe('getSelectedDocument', () => {
    it('should return a reference note when selectedDocId points to one', () => {
      useExportWriterStore.setState({
        documents: { 1: { id: 1, title: 'Doc', content: '' } },
        referenceNotes: { 50: { id: 50, title: 'Note', content: 'text', isReference: true } },
        selectedDocId: 50,
      });

      const doc = useExportWriterStore.getState().getSelectedDocument();
      expect(doc.id).toBe(50);
      expect(doc.isReference).toBe(true);
    });

    it('should prefer documents over referenceNotes for the same id', () => {
      useExportWriterStore.setState({
        documents: { 1: { id: 1, title: 'Doc', content: 'doc-content' } },
        referenceNotes: { 1: { id: 1, title: 'Note', content: 'note-content', isReference: true } },
        selectedDocId: 1,
      });

      const doc = useExportWriterStore.getState().getSelectedDocument();
      expect(doc.content).toBe('doc-content');
    });
  });

  describe('reset with referenceNotes', () => {
    it('should clear referenceNotes and isLoadingRefs', () => {
      useExportWriterStore.setState({
        referenceNotes: { 10: { id: 10, title: 'Note', isReference: true } },
        isLoadingRefs: true,
      });

      act(() => { useExportWriterStore.getState().reset(); });

      const state = useExportWriterStore.getState();
      expect(state.referenceNotes).toEqual({});
      expect(state.isLoadingRefs).toBe(false);
    });
  });
});
