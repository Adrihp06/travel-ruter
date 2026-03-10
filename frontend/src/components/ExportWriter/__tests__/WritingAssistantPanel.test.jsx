import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { createRef } from 'react';

// ---- Mocks ----

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Minimal WebSocket stub
class FakeWebSocket {
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal('WebSocket', FakeWebSocket);

// Stores
const mockUpdateContent = vi.fn();
let mockAccessToken = null;
vi.mock('../../../stores/useExportWriterStore', () => {
  const WRITING_SYSTEM_PROMPT = 'test-prompt';
  return {
    default: () => ({
      documents: {
        doc1: { id: 'doc1', title: 'Paris', content: 'Hello world', destinationId: 1 },
      },
      selectedDocId: 'doc1',
      updateContent: mockUpdateContent,
    }),
    WRITING_SYSTEM_PROMPT,
  };
});

vi.mock('../../../stores/useAuthStore', () => ({
  default: () => ({ accessToken: mockAccessToken }),
}));

vi.mock('../../../stores/usePOIStore', () => ({
  default: (sel) => sel({ pois: [] }),
}));

vi.mock('../../../stores/useAccommodationStore', () => ({
  default: (sel) => sel({ accommodations: [] }),
}));

// Stub fetch for session creation
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ sessionId: 'sess-1' }),
});

const { default: WritingAssistantPanel } = await import('../WritingAssistantPanel');

describe('WritingAssistantPanel – prompt workflow refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessToken = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const trip = { id: 1, name: 'Trip', start_date: '2025-01-01', end_date: '2025-01-10' };
  const destinations = [{ id: 1, city_name: 'Paris', country: 'France', arrival_date: '2025-01-01', departure_date: '2025-01-05' }];

  it('does NOT render assistant-side quick action buttons', async () => {
    await act(async () => {
      render(<WritingAssistantPanel trip={trip} destinations={destinations} />);
    });
    // The old quick-action buttons used these exact labels inside the assistant panel
    expect(screen.queryByRole('button', { name: /Generate Draft/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Improve$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /More details/i })).toBeNull();
  });

  it('triggerGenerateDraft populates the textarea instead of sending', async () => {
    const ref = createRef();
    await act(async () => {
      render(<WritingAssistantPanel ref={ref} trip={trip} destinations={destinations} />);
    });

    const doc = { id: 'doc1', title: 'Paris', content: '', destinationId: 1 };
    act(() => ref.current.triggerGenerateDraft(doc));

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    expect(textarea.value).toContain('Please write a complete travel document draft');
    expect(textarea.value).toContain('Paris');
  });

  it('triggerImprove populates the textarea instead of sending', async () => {
    const ref = createRef();
    await act(async () => {
      render(<WritingAssistantPanel ref={ref} trip={trip} destinations={destinations} />);
    });

    const doc = { id: 'doc1', title: 'Paris', content: '# Draft\nSome content here.', destinationId: 1 };
    act(() => ref.current.triggerImprove(doc));

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    expect(textarea.value).toContain('improve the following travel document');
    expect(textarea.value).toContain('# Draft');
  });

  it('renders overwrite / append / replace-selection buttons on assistant messages', async () => {
    const ref = createRef();
    let wsInstance;
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(...args) {
        super(...args);
        wsInstance = this;
      }
    });

    await act(async () => {
      render(<WritingAssistantPanel ref={ref} trip={trip} destinations={destinations} />);
    });

    // Simulate user sending a message then receiving a complete response
    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Hello' } });
    });
    await act(async () => {
      fireEvent.submit(textarea.closest('form'));
    });

    // Wait for session setup
    await act(async () => new Promise((r) => setTimeout(r, 50)));

    // Simulate assistant streaming response
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'start', messageId: 'msg-1' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'chunk', content: 'AI response' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'end' }) });
    });

    expect(screen.getByText('Overwrite document')).toBeTruthy();
    expect(screen.getByText('Append to document')).toBeTruthy();
    expect(screen.getByText('Replace selection')).toBeTruthy();
  });

  it('applyOverwrite replaces document content via updateContent', async () => {
    const ref = createRef();
    let wsInstance;
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(...args) { super(...args); wsInstance = this; }
    });

    await act(async () => {
      render(<WritingAssistantPanel ref={ref} trip={trip} destinations={destinations} />);
    });

    // Send + receive a response
    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    await act(async () => { fireEvent.change(textarea, { target: { value: 'Help' } }); });
    await act(async () => { fireEvent.submit(textarea.closest('form')); });
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'start', messageId: 'msg-2' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'chunk', content: 'New content' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'end' }) });
    });

    fireEvent.click(screen.getByText('Overwrite document'));
    expect(mockUpdateContent).toHaveBeenCalledWith('doc1', 'New content');
  });

  it('applyAppend appends to existing content', async () => {
    const ref = createRef();
    let wsInstance;
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(...args) { super(...args); wsInstance = this; }
    });

    await act(async () => {
      render(<WritingAssistantPanel ref={ref} trip={trip} destinations={destinations} />);
    });

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    await act(async () => { fireEvent.change(textarea, { target: { value: 'Help' } }); });
    await act(async () => { fireEvent.submit(textarea.closest('form')); });
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'start', messageId: 'msg-3' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'chunk', content: 'Extra text' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'end' }) });
    });

    fireEvent.click(screen.getByText('Append to document'));
    // Existing content is 'Hello world', so append with separator
    expect(mockUpdateContent).toHaveBeenCalledWith('doc1', 'Hello world\n\nExtra text');
  });

  it('waits for auth_ok before sending the first chat message', async () => {
    mockAccessToken = 'token-123';
    let wsInstance;
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(...args) {
        super(...args);
        wsInstance = this;
      }
    });

    await act(async () => {
      render(<WritingAssistantPanel trip={trip} destinations={destinations} />);
    });

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Help' } });
      fireEvent.submit(textarea.closest('form'));
    });

    await act(async () => new Promise((r) => setTimeout(r, 75)));
    expect(wsInstance.send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(wsInstance.send.mock.calls[0][0])).toEqual({ type: 'auth', token: 'token-123' });

    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'auth_ok' }) });
    });
    await act(async () => new Promise((r) => setTimeout(r, 75)));

    expect(wsInstance.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(wsInstance.send.mock.calls[1][0])).toMatchObject({
      type: 'chat',
      sessionId: 'sess-1',
      message: 'Help',
    });
  });

  it('textarea dynamically adjusts rows based on newlines', async () => {
    await act(async () => {
      render(<WritingAssistantPanel trip={trip} destinations={destinations} />);
    });

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    expect(textarea.rows).toBe(2); // default

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'line1\nline2\nline3\nline4\nline5' } });
    });
    // 5 newlines → 6 rows, capped at 6
    expect(textarea.rows).toBe(5);
  });

  it('clears prior conversation state when the trip changes', async () => {
    let wsInstance;
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(...args) {
        super(...args);
        wsInstance = this;
      }
    });

    const { rerender } = render(<WritingAssistantPanel trip={trip} destinations={destinations} />);

    const textarea = screen.getByPlaceholderText('Ask for writing help...');
    await act(async () => { fireEvent.change(textarea, { target: { value: 'Help' } }); });
    await act(async () => { fireEvent.submit(textarea.closest('form')); });
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'start', messageId: 'msg-4' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'chunk', content: 'Trip A answer' }) });
    });
    await act(async () => {
      wsInstance?.onmessage?.({ data: JSON.stringify({ type: 'end' }) });
    });

    expect(screen.getByText('Trip A answer')).toBeTruthy();

    await act(async () => {
      rerender(
        <WritingAssistantPanel
          trip={{ ...trip, id: 2, name: 'Trip 2' }}
          destinations={destinations}
        />
      );
    });

    expect(screen.queryByText('Trip A answer')).toBeNull();
    expect(screen.getByPlaceholderText('Ask for writing help...').value).toBe('');
  });
});
