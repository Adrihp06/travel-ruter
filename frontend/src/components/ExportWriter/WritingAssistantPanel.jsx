/**
 * Writing Assistant Panel — standalone AI chat for travel document writing.
 * Uses its own WebSocket session separate from the main AI chat.
 */
import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import useExportWriterStore, { WRITING_SYSTEM_PROMPT } from '../../stores/useExportWriterStore';
import useAuthStore from '../../stores/useAuthStore';
import usePOIStore from '../../stores/usePOIStore';
import useAccommodationStore from '../../stores/useAccommodationStore';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';
const WS_URL = ORCHESTRATOR_URL.startsWith('http')
  ? ORCHESTRATOR_URL.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${ORCHESTRATOR_URL}`;

function buildTripContext(trip, destinations) {
  if (!trip) return null;
  return {
    tripName: trip.name,
    tripDates: `${trip.start_date || ''} – ${trip.end_date || ''}`,
    tripDescription: trip.description || '',
    destinations: (destinations || []).map((d) => ({
      name: d.city_name,
      country: d.country,
      arrival: d.arrival_date,
      departure: d.departure_date,
      notes: d.notes || '',
    })),
  };
}

function buildDocumentContext(doc, destinations, pois, accommodations) {
  if (!doc) return '';
  const dest = doc.destinationId
    ? destinations?.find((d) => d.id === doc.destinationId)
    : null;
  const scopedPois = doc.destinationId
    ? (pois || []).map((group) => ({
        ...group,
        pois: group.pois.filter((poi) => poi.destination_id === doc.destinationId),
      })).filter((group) => group.pois.length > 0)
    : (pois || []);
  const scopedAccommodations = doc.destinationId
    ? (accommodations || []).filter((acc) => acc.destination_id === doc.destinationId)
    : (accommodations || []);

  let ctx = '';
  if (dest) {
    ctx = `Document: "${doc.title}" (${dest.city_name}, ${dest.country || ''})
Dates: ${dest.arrival_date} – ${dest.departure_date}
Current content (${doc.content?.length || 0} chars): ${doc.content?.slice(0, 200) || '(empty)'}`;
  } else {
    ctx = `Document: "${doc.title}" (Trip Overview)
Current content (${doc.content?.length || 0} chars): ${doc.content?.slice(0, 200) || '(empty)'}`;
  }

  // Append POI data if available
  if (scopedPois.length > 0) {
    const poiLines = scopedPois.map((group) => {
      const names = group.pois.map((p) => p.name).join(', ');
      return `  ${group.category}: ${names}`;
    }).join('\n');
    ctx += `\n\nPlaces of Interest:\n${poiLines}`;
  }

  // Append accommodation data if available
  if (scopedAccommodations.length > 0) {
    const accLines = scopedAccommodations.map((a) => {
      const dates = [a.check_in_date, a.check_out_date].filter(Boolean).join(' – ');
      return `  ${a.name}${dates ? ` (${dates})` : ''}${a.address ? ` — ${a.address}` : ''}`;
    }).join('\n');
    ctx += `\n\nAccommodations:\n${accLines}`;
  }

  return ctx;
}

function MessageBubble({ msg, onOverwrite, onAppend, onReplaceSelection }) {
  const isUser = msg.role === 'user';
  const showApply = !isUser && !msg.isStreaming && msg.content;
  const applyBtnClass =
    'px-2 py-0.5 text-[10px] rounded transition-colors';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
      )}
      <div className="max-w-[85%]">
        <div
          className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-amber-600 text-white rounded-br-none'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'
          }`}
        >
          {msg.content}
          {msg.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>
        {showApply && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {onOverwrite && (
              <button
                onClick={() => onOverwrite(msg.content)}
                className={`${applyBtnClass} text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30`}
              >
                Overwrite document
              </button>
            )}
            {onAppend && (
              <button
                onClick={() => onAppend(msg.content)}
                className={`${applyBtnClass} text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                Append to document
              </button>
            )}
            {onReplaceSelection && (
              <button
                onClick={() => onReplaceSelection(msg.content)}
                className={`${applyBtnClass} text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                Replace selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const WritingAssistantPanel = forwardRef(({ trip, destinations, destinationsReady = true, getEditorSelection }, ref) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const wsRef = useRef(null);
  const isConnectedRef = useRef(false);
  const streamingIdRef = useRef(null);
  const streamingContentRef = useRef('');
  const pendingDocIdRef = useRef(null);
  const preparedDocIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { documents, referenceNotes = {}, selectedDocId, updateContent } = useExportWriterStore();
  const selectedDoc = selectedDocId
    ? (documents[selectedDocId] || referenceNotes[selectedDocId] || null)
    : null;
  const canApplyToDocument = !!selectedDocId && !selectedDoc?.isReference;
  const { accessToken } = useAuthStore();

  // Travel data for enriched AI context
  const pois = usePOIStore((s) => s.pois);
  const accommodations = useAccommodationStore((s) => s.accommodations);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Create session with writing system prompt
  const createSession = useCallback(async () => {
    if (!trip) return null;
    try {
      const tripContext = buildTripContext(trip, destinations);
      const res = await fetch(`${ORCHESTRATOR_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          tripId: trip?.id,
          tripContext,
          agentConfig: {
            name: 'Writing Assistant',
            systemPrompt: WRITING_SYSTEM_PROMPT,
            enabledTools: [],
          },
          chatMode: 'existing',
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.sessionId;
    } catch {
      return null;
    }
  }, [trip, destinations, accessToken]);

  // Connect WebSocket
  const connectWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/api/chat/stream`);

    ws.onopen = () => {
      const token = accessToken;
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      } else {
        // No auth mode — mark connected directly
        isConnectedRef.current = true;
        setIsConnected(true);
      }
    };

    ws.onclose = () => {
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    ws.onerror = () => {
      isConnectedRef.current = false;
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
      } catch {
        // ignore
      }
    };

    wsRef.current = ws;
  }, [accessToken]);

  function handleWSMessage(data) {
    switch (data.type) {
      case 'auth_ok':
        isConnectedRef.current = true;
        setIsConnected(true);
        break;

      case 'start': {
        streamingIdRef.current = data.messageId;
        streamingContentRef.current = '';
        setMessages((prev) => [
          ...prev,
          {
            id: data.messageId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            sourceDocId: pendingDocIdRef.current,
          },
        ]);
        setIsLoading(true);
        break;
      }

      case 'chunk': {
        if (data.content && streamingIdRef.current) {
          streamingContentRef.current += data.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingIdRef.current
                ? { ...m, content: m.content + data.content }
                : m
            )
          );
        }
        break;
      }

      case 'end': {
        const finishedId = streamingIdRef.current;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === finishedId ? { ...m, isStreaming: false } : m
          )
        );
        streamingIdRef.current = null;
        streamingContentRef.current = '';
        setIsLoading(false);
        break;
      }

      case 'error': {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingIdRef.current
              ? { ...m, content: m.content + `\n\n**Error:** ${data.error}`, isStreaming: false }
              : m
          )
        );
        streamingIdRef.current = null;
        setIsLoading(false);
        break;
      }

      default:
        break;
    }
  }

  const waitForConnection = useCallback(() => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      clearInterval(checkConnection);
      reject(new Error('Connection timeout'));
    }, 5000);

    const checkConnection = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && isConnectedRef.current) {
        clearInterval(checkConnection);
        clearTimeout(timeout);
        resolve();
      }
    }, 50);
  }), []);

  // Mount: create session + connect WebSocket
  useEffect(() => {
    let cancelled = false;

    setMessages([]);
    setInputValue('');
    setSessionId(null);
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsLoading(false);
    streamingIdRef.current = null;
    streamingContentRef.current = '';
    pendingDocIdRef.current = null;
    preparedDocIdRef.current = null;

    const setup = async () => {
      const sid = await createSession();
      if (!cancelled && sid) {
        setSessionId(sid);
        connectWS();
      }
    };

    if (trip && destinationsReady) {
      setup();
    }

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [trip?.id, destinationsReady]);

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isLoading) return;

      setIsLoading(true);
      let currentSessionId = sessionId;
      const sourceDocId = preparedDocIdRef.current ?? (canApplyToDocument ? selectedDocId : null);

      // Create session if needed
      if (!currentSessionId) {
        currentSessionId = await createSession();
        if (!currentSessionId) {
          setIsLoading(false);
          return;
        }
        setSessionId(currentSessionId);
      }

      // Ensure WebSocket connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWS();
      }

      if (!isConnectedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          await waitForConnection();
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant_error_${Date.now()}`,
              role: 'assistant',
              content: 'Connection failed. Please try again.',
              isStreaming: false,
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: `user_${Date.now()}`, role: 'user', content: content.trim(), sourceDocId },
      ]);
      pendingDocIdRef.current = sourceDocId;
      preparedDocIdRef.current = null;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'chat', sessionId: currentSessionId, message: content.trim() })
        );
      } else {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, createSession, connectWS, waitForConnection, canApplyToDocument, selectedDocId]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Apply AI content to the editor: overwrite entire document
  const applyOverwrite = useCallback((targetDocId, content) => {
    if (canApplyToDocument && targetDocId && targetDocId === selectedDocId && content) {
      updateContent(targetDocId, content);
    }
  }, [canApplyToDocument, selectedDocId, updateContent]);

  // Apply AI content to the editor: append to existing content
  const applyAppend = useCallback((targetDocId, content) => {
    if (canApplyToDocument && targetDocId && targetDocId === selectedDocId && content) {
      const existing = selectedDoc?.content || '';
      const separator = existing.trim() ? '\n\n' : '';
      updateContent(targetDocId, existing + separator + content);
    }
  }, [canApplyToDocument, selectedDocId, selectedDoc, updateContent]);

  // Apply AI content to the editor: replace selected text
  const applyReplaceSelection = useCallback((targetDocId, content) => {
    if (!canApplyToDocument || !targetDocId || targetDocId !== selectedDocId || !content) return;
    const selection = getEditorSelection?.();
    if (selection) {
      const existing = selectedDoc?.content || '';
      const before = existing.substring(0, selection.start);
      const after = existing.substring(selection.end);
      updateContent(targetDocId, before + content + after);
    }
  }, [canApplyToDocument, selectedDocId, selectedDoc, updateContent, getEditorSelection]);

  // Populate editable prompt for user review before sending
  const generateDraft = useCallback((doc) => {
    if (!doc) return;
    preparedDocIdRef.current = doc.id;
    const docCtx = buildDocumentContext(doc, destinations, pois, accommodations);
    const prompt = `Please write a complete travel document draft in markdown for: ${docCtx}

Write an engaging, informative document in first person with proper markdown headings, paragraphs, and bullet points. Include highlights, practical tips, and personal observations. Write at least 300 words.`;
    setInputValue(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [destinations, pois, accommodations]);

  const improveDraft = useCallback((doc) => {
    if (!doc || !doc.content) return;
    preparedDocIdRef.current = doc.id;
    const prompt = `Please improve the following travel document. Make it more engaging, better structured, and more detailed. Keep the markdown format:\n\n${doc.content}`;
    setInputValue(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Expose imperative actions to parent (via ref from ExportWriterView)
  useImperativeHandle(ref, () => ({
    triggerGenerateDraft: generateDraft,
    triggerImprove: improveDraft,
    setPromptInput: (text, targetDocId = selectedDocId) => {
      preparedDocIdRef.current = targetDocId || null;
      setInputValue(text);
      // Focus the textarea so the user can review / edit before sending
      setTimeout(() => inputRef.current?.focus(), 50);
    },
  }), [generateDraft, improveDraft, selectedDocId]);


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
        <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Writing Assistant</span>
        <div className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isConnected ? 'Connected' : 'Connecting...'} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-600">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">
              {selectedDoc
                ? 'Use the toolbar buttons or type a message to get writing help.'
                : 'Select a document to get started.'}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onOverwrite={msg.sourceDocId && msg.sourceDocId === selectedDocId ? (content) => applyOverwrite(msg.sourceDocId, content) : null}
            onAppend={msg.sourceDocId && msg.sourceDocId === selectedDocId ? (content) => applyAppend(msg.sourceDocId, content) : null}
            onReplaceSelection={msg.sourceDocId && msg.sourceDocId === selectedDocId ? (content) => applyReplaceSelection(msg.sourceDocId, content) : null}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900"
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for writing help..."
          rows={Math.min(6, Math.max(2, (inputValue.match(/\n/g) || []).length + 1))}
          className="flex-1 text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-600"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="flex-shrink-0 p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
});

WritingAssistantPanel.displayName = 'WritingAssistantPanel';

export default WritingAssistantPanel;
