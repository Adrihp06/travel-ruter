/**
 * Writing Assistant Panel — standalone AI chat for travel document writing.
 * Uses its own WebSocket session separate from the main AI chat.
 */
import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Sparkles, PenLine, Plus, Send, Loader2, Bot } from 'lucide-react';
import useExportWriterStore, { WRITING_SYSTEM_PROMPT } from '../../stores/useExportWriterStore';
import useAuthStore from '../../stores/useAuthStore';

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

function buildDocumentContext(doc, destinations) {
  if (!doc) return '';
  const dest = doc.destinationId
    ? destinations?.find((d) => d.id === doc.destinationId)
    : null;

  if (dest) {
    return `Document: "${doc.title}" (${dest.city_name}, ${dest.country || ''})
Dates: ${dest.arrival_date} – ${dest.departure_date}
Current content (${doc.content?.length || 0} chars): ${doc.content?.slice(0, 200) || '(empty)'}`;
  }
  return `Document: "${doc.title}" (Trip Overview)
Current content (${doc.content?.length || 0} chars): ${doc.content?.slice(0, 200) || '(empty)'}`;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
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
    </div>
  );
}

const WritingAssistantPanel = forwardRef(({ trip, destinations }, ref) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const wsRef = useRef(null);
  const streamingIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { documents, selectedDocId } = useExportWriterStore();
  const selectedDoc = selectedDocId ? documents[selectedDocId] : null;
  const { accessToken } = useAuthStore();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          tripId: trip.id,
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
        setIsConnected(true);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
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
        setIsConnected(true);
        break;

      case 'start': {
        streamingIdRef.current = data.messageId;
        setMessages((prev) => [
          ...prev,
          { id: data.messageId, role: 'assistant', content: '', isStreaming: true },
        ]);
        setIsLoading(true);
        break;
      }

      case 'chunk': {
        if (data.text && streamingIdRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingIdRef.current
                ? { ...m, content: m.content + data.text }
                : m
            )
          );
        }
        break;
      }

      case 'end': {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m
          )
        );
        streamingIdRef.current = null;
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

  // Mount: create session + connect WebSocket
  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const sid = await createSession();
      if (!cancelled && sid) {
        setSessionId(sid);
        connectWS();
      }
    };

    if (trip) {
      setup();
    }

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [trip?.id]);

  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isLoading) return;

      let currentSessionId = sessionId;

      // Create session if needed
      if (!currentSessionId) {
        currentSessionId = await createSession();
        if (!currentSessionId) return;
        setSessionId(currentSessionId);
      }

      // Ensure WebSocket connected
      if (!isConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWS();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setMessages((prev) => [
        ...prev,
        { id: `user_${Date.now()}`, role: 'user', content: content.trim() },
      ]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'chat', sessionId: currentSessionId, message: content.trim() })
        );
      }
    },
    [sessionId, isConnected, isLoading, createSession, connectWS]
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

  // Expose imperative actions to parent (via ref from ExportWriterView)
  useImperativeHandle(ref, () => ({
    triggerGenerateDraft: (doc) => {
      if (!doc) return;
      const docCtx = buildDocumentContext(doc, destinations);
      const prompt = `Please write a complete travel document draft in markdown for: ${docCtx}

Write an engaging, informative document in first person with proper markdown headings, paragraphs, and bullet points. Include highlights, practical tips, and personal observations. Write at least 300 words.`;
      sendMessage(prompt);
    },
    triggerImprove: (doc) => {
      if (!doc || !doc.content) return;
      const prompt = `Please improve the following travel document. Make it more engaging, better structured, and more detailed. Keep the markdown format:\n\n${doc.content}`;
      sendMessage(prompt);
    },
  }), [sendMessage, destinations]);

  // Quick action handlers
  const handleGenerateDraft = () => {
    if (!selectedDoc) return;
    const docCtx = buildDocumentContext(selectedDoc, destinations);
    const prompt = `Please write a complete travel document draft in markdown for: ${docCtx}

Write an engaging, informative document in first person with proper markdown headings, paragraphs, and bullet points. Include highlights, practical tips, and personal observations. Write at least 300 words.`;
    sendMessage(prompt);
  };

  const handleImprove = () => {
    if (!selectedDoc || !selectedDoc.content) return;
    const prompt = `Please improve the following travel document. Make it more engaging, better structured, and more detailed. Keep the markdown format:\n\n${selectedDoc.content}`;
    sendMessage(prompt);
  };

  const handleAddDetails = () => {
    if (!selectedDoc) return;
    const dest = selectedDoc.destinationId
      ? destinations?.find((d) => d.id === selectedDoc.destinationId)
      : null;
    const place = dest ? dest.city_name : (trip?.name || 'the destination');
    sendMessage(`Add more interesting details, local tips, and cultural insights for ${place}. Focus on practical advice for travelers.`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
        <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Writing Assistant</span>
        <div className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isConnected ? 'Connected' : 'Connecting...'} />
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 space-y-1.5 flex-shrink-0">
        <button
          onClick={handleGenerateDraft}
          disabled={isLoading || !selectedDoc}
          className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          Generate Draft
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={handleImprove}
            disabled={isLoading || !selectedDoc?.content}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PenLine className="w-3 h-3" />
            Improve
          </button>
          <button
            onClick={handleAddDetails}
            disabled={isLoading || !selectedDoc}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" />
            More details
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-600">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">
              {selectedDoc
                ? 'Use the quick actions above or ask me anything about your travel document.'
                : 'Select a document to get started.'}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
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
          rows={2}
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
