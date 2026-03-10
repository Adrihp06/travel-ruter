import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { createRef } from 'react';

// Mock the MDEditor — render a simple textarea to test getSelection
vi.mock('@uiw/react-md-editor/nohighlight', () => ({
  default: ({ value, onChange, ...rest }) => (
    <textarea
      data-testid="mock-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@uiw/react-md-editor/markdown-editor.css', () => ({}));

const mockSanitize = vi.fn((html) => `sanitized:${html}`);
vi.mock('dompurify', () => ({
  default: { sanitize: mockSanitize },
}));

let mockExportWriterState = {
  documents: {
    doc1: { id: 'doc1', title: 'Paris Guide', content: 'Hello beautiful world', destinationId: 1 },
  },
  referenceNotes: {},
  selectedDocId: 'doc1',
  updateContent: vi.fn(),
  saveStatus: 'idle',
};

vi.mock('../../../stores/useExportWriterStore', () => ({
  default: () => mockExportWriterState,
}));

vi.mock('../../../stores/usePOIStore', () => ({
  default: (selector) => selector({ isLoading: false }),
}));

vi.mock('../../../stores/useAccommodationStore', () => ({
  default: (selector) => selector({ isLoading: false }),
}));

vi.mock('../../../stores/useDayRoutesStore', () => ({
  default: (selector) => selector({ isCalculating: false }),
}));

const { default: MarkdownEditorPanel } = await import('../MarkdownEditorPanel');

describe('MarkdownEditorPanel – toolbar and selection support', () => {
  const onGenerateDraft = vi.fn();
  const onImprove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExportWriterState = {
      documents: {
        doc1: { id: 'doc1', title: 'Paris Guide', content: 'Hello beautiful world', destinationId: 1 },
      },
      referenceNotes: {},
      selectedDocId: 'doc1',
      updateContent: vi.fn(),
      saveStatus: 'idle',
    };
  });

  it('renders Generate Draft and Improve toolbar buttons', () => {
    render(<MarkdownEditorPanel onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    expect(screen.getByText('Generate Draft')).toBeTruthy();
    expect(screen.getByText('Improve')).toBeTruthy();
  });

  it('toolbar Generate Draft calls onGenerateDraft with selected doc', () => {
    render(<MarkdownEditorPanel onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    fireEvent.click(screen.getByText('Generate Draft'));
    expect(onGenerateDraft).toHaveBeenCalledTimes(1);
    expect(onGenerateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc1', title: 'Paris Guide' })
    );
  });

  it('toolbar Improve calls onImprove with selected doc', () => {
    render(<MarkdownEditorPanel onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    fireEvent.click(screen.getByText('Improve'));
    expect(onImprove).toHaveBeenCalledTimes(1);
    expect(onImprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'doc1', title: 'Paris Guide' })
    );
  });

  it('exposes getSelection via ref that returns null when no selection', () => {
    const ref = createRef();
    render(<MarkdownEditorPanel ref={ref} onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    expect(ref.current).toBeTruthy();
    expect(typeof ref.current.getSelection).toBe('function');
    // No selection set → should return null
    const sel = ref.current.getSelection();
    expect(sel).toBeNull();
  });

  it('getSelection returns selection range when textarea has selection', () => {
    const ref = createRef();
    render(<MarkdownEditorPanel ref={ref} onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    // Simulate a text selection on the underlying textarea
    const textarea = screen.getByTestId('mock-editor');
    // Set selectionStart and selectionEnd via the native properties
    Object.defineProperty(textarea, 'selectionStart', { value: 6, writable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 15, writable: true });

    const sel = ref.current.getSelection();
    expect(sel).toEqual({
      start: 6,
      end: 15,
      text: 'beautiful',
    });
  });

  it('shows document title in toolbar', () => {
    render(<MarkdownEditorPanel onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);
    expect(screen.getByText('Paris Guide')).toBeTruthy();
  });

  it('sanitizes and renders reference notes outside the markdown editor', () => {
    mockExportWriterState = {
      documents: {},
      referenceNotes: {
        ref1: { id: 'ref1', title: 'Vault Note', content: '<img src=x onerror=alert(1)><p>Safe</p>', isReference: true },
      },
      selectedDocId: 'ref1',
      updateContent: vi.fn(),
      saveStatus: 'idle',
    };

    render(<MarkdownEditorPanel onGenerateDraft={onGenerateDraft} onImprove={onImprove} />);

    expect(mockSanitize).toHaveBeenCalledWith(
      '<img src=x onerror=alert(1)><p>Safe</p>',
      expect.any(Object)
    );
    expect(screen.getByTestId('reference-note-content').innerHTML).toContain('sanitized:');
    expect(screen.getByTestId('reference-note-content').innerHTML).toContain('<p>Safe</p>');
    expect(screen.queryByTestId('mock-editor')).toBeNull();
  });
});
