import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Stub child components so the test stays focused on data-flow plumbing.
vi.mock('../DocumentTree', () => ({
  default: ({ destinations }) => (
    <div data-testid="doc-tree" data-destinations={JSON.stringify(destinations)} />
  ),
}));
vi.mock('../MarkdownEditorPanel', () => ({
  default: ({ destinations }) => (
    <div data-testid="editor" data-destinations={JSON.stringify(destinations)} />
  ),
}));
vi.mock('../WritingAssistantPanel', () => ({
  default: React.forwardRef(({ destinations }, ref) => (
    <div data-testid="assistant" data-destinations={JSON.stringify(destinations)} />
  )),
}));
vi.mock('../TravelContextPanel', () => ({
  default: ({ destinations }) => (
    <div data-testid="context" data-destinations={JSON.stringify(destinations)} />
  ),
}));

// Mock stores with controllable fetchDestinations.
const mockReset = vi.fn();
const mockLoadDocuments = vi.fn().mockResolvedValue(undefined);
const mockLoadReferenceNotes = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../stores/useExportWriterStore', () => ({
  default: (selector) => selector({
    reset: mockReset,
    loadDocuments: mockLoadDocuments,
    loadReferenceNotes: mockLoadReferenceNotes,
    documents: {},
    getSelectedDocument: () => null,
    selectDocument: vi.fn(),
  }),
}));

let fetchDestinationsImpl = vi.fn();

vi.mock('../../../stores/useDestinationStore', () => ({
  default: (selector) => selector({ fetchDestinations: fetchDestinationsImpl }),
}));

// Must import AFTER mocks are declared.
const { default: ExportWriterView } = await import('../ExportWriterView');

describe('ExportWriterView – trip-scoped destinations', () => {
  const trip = { id: 1, name: 'Trip', start_date: '2025-01-01', end_date: '2025-01-10' };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchDestinationsImpl = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes fetched destinations to children via local state, not the global store', async () => {
    const dests = [{ id: 1, city_name: 'Paris' }];
    fetchDestinationsImpl.mockResolvedValue(dests);

    await act(async () => {
      render(<ExportWriterView tripId={1} trip={trip} />);
    });

    await waitFor(() => {
      const tree = screen.getByTestId('doc-tree');
      expect(JSON.parse(tree.dataset.destinations)).toEqual(dests);
    });
  });

  it('stale in-flight fetchDestinations cannot overwrite local destinations after trip switch', async () => {
    // Trip 1 fetch will resolve AFTER trip 2 fetch (simulates slow network).
    let resolveTrip1;
    const trip1Promise = new Promise((r) => { resolveTrip1 = r; });

    const trip2Dests = [{ id: 20, city_name: 'Tokyo' }];

    fetchDestinationsImpl
      .mockImplementationOnce(() => trip1Promise)           // trip 1 – slow
      .mockImplementationOnce(async () => trip2Dests);      // trip 2 – fast

    const { rerender } = render(<ExportWriterView tripId={1} trip={trip} />);

    // Switch to trip 2 – triggers cleanup (cancelled=true) + new init.
    await act(async () => {
      rerender(<ExportWriterView tripId={2} trip={{ ...trip, id: 2 }} />);
    });

    // Now resolve the stale trip-1 fetch.
    await act(async () => {
      resolveTrip1([{ id: 10, city_name: 'Berlin' }]);
    });

    // Children must show trip 2 destinations, NOT trip 1's stale Berlin data.
    await waitFor(() => {
      const tree = screen.getByTestId('doc-tree');
      expect(JSON.parse(tree.dataset.destinations)).toEqual(trip2Dests);
    });
  });

  it('clears local destinations immediately on trip switch', async () => {
    const dests = [{ id: 1, city_name: 'Paris' }];
    fetchDestinationsImpl.mockResolvedValue(dests);

    const { rerender } = await act(async () =>
      render(<ExportWriterView tripId={1} trip={trip} />)
    );

    // Before trip 2 fetch resolves, destinations should be empty.
    let resolveTrip2;
    fetchDestinationsImpl.mockImplementation(
      () => new Promise((r) => { resolveTrip2 = r; })
    );

    await act(async () => {
      rerender(<ExportWriterView tripId={2} trip={{ ...trip, id: 2 }} />);
    });

    expect(screen.queryByTestId('doc-tree')).toBeNull();

    // Cleanup: resolve the pending promise.
    await act(async () => resolveTrip2([]));
  });

  it('renders the writer shell before document and note bootstrap finish', async () => {
    const dests = [{ id: 1, city_name: 'Paris' }];
    let resolveDocs;
    let resolveRefs;

    fetchDestinationsImpl.mockResolvedValue(dests);
    mockLoadDocuments.mockImplementation(() => new Promise((resolve) => {
      resolveDocs = resolve;
    }));
    mockLoadReferenceNotes.mockImplementation(() => new Promise((resolve) => {
      resolveRefs = resolve;
    }));

    render(<ExportWriterView tripId={1} trip={trip} />);

    await waitFor(() => {
      expect(screen.getByTestId('doc-tree')).toBeInTheDocument();
      expect(screen.getByTestId('editor')).toBeInTheDocument();
      expect(screen.getByTestId('assistant')).toBeInTheDocument();
    });

    await act(async () => {
      resolveDocs();
      resolveRefs();
    });
  });
});
