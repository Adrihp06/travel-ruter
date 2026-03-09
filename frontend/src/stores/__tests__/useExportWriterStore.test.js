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
});
