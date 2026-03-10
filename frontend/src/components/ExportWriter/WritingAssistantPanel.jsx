/**
 * Writing Assistant Panel — standalone AI chat for travel document writing.
 * Uses its own WebSocket session separate from the main AI chat.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Bot, Sparkles, X } from 'lucide-react';
import useExportWriterStore from '../../stores/useExportWriterStore';
import useAuthStore from '../../stores/useAuthStore';
import usePOIStore from '../../stores/usePOIStore';
import useAccommodationStore from '../../stores/useAccommodationStore';
import {
  buildDraftPrompt,
  buildImprovePrompt,
  buildPreparedMessage,
  buildWritingSystemPrompt,
  getAdditionalInstructionsLabel,
} from './writerPrompts';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';
const WS_URL = ORCHESTRATOR_URL.startsWith('http')
  ? ORCHESTRATOR_URL.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${ORCHESTRATOR_URL}`;

function buildTripContext({ trip, destinations, selectedDoc, referenceNotes = {} }) {
  if (!trip) return null;

  const selectedDestinationId = selectedDoc?.destinationId || null;
  const selectedDestination = selectedDestinationId
    ? (destinations || []).find((destination) => destination.id === selectedDestinationId)
    : null;
  const destinationReferenceNotes = Object.values(referenceNotes).filter(
    (note) => note.destinationId === selectedDestinationId
  );
  const tripReferenceNotes = Object.values(referenceNotes).filter((note) => !note.destinationId);

  return {
    tripId: trip.id,
    name: trip.name,
    startDate: trip.start_date || null,
    endDate: trip.end_date || null,
    budget: trip.total_budget || null,
    currency: trip.currency || null,
    description: trip.description || '',
    destinations: (destinations || []).map((destination) => ({
      id: destination.id,
      name: destination.city_name,
      country: destination.country,
      arrivalDate: destination.arrival_date,
      departureDate: destination.departure_date,
      notes: destination.notes || '',
    })),
    destination: selectedDestination
      ? {
          id: selectedDestination.id,
          name: selectedDestination.city_name,
          country: selectedDestination.country,
          arrivalDate: selectedDestination.arrival_date,
          departureDate: selectedDestination.departure_date,
          notes: selectedDestination.notes || '',
          referenceNotes: destinationReferenceNotes.map((note) => ({
            id: note.id,
            title: note.title,
            content: note.content || '',
          })),
        }
      : null,
    writerContext: {
      currentDocumentTitle: selectedDoc?.title || null,
      currentDocumentType: selectedDoc
        ? (selectedDoc.isReference ? 'reference_note' : 'export_draft')
        : null,
      tripReferenceNotes: tripReferenceNotes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content || '',
      })),
    },
  };
}

function buildDocumentContext(doc, destinations, pois, accommodations, referenceNotes, t) {
  if (!doc) return '';

  const destination = doc.destinationId
    ? destinations?.find((item) => item.id === doc.destinationId)
    : null;
  const scopedPois = doc.destinationId
    ? (pois || [])
      .map((group) => ({
        ...group,
        pois: group.pois.filter((poi) => poi.destination_id === doc.destinationId),
      }))
      .filter((group) => group.pois.length > 0)
    : (pois || []);
  const scopedAccommodations = doc.destinationId
    ? (accommodations || []).filter((acc) => acc.destination_id === doc.destinationId)
    : (accommodations || []);
  const scopedNotes = doc.destinationId
    ? Object.values(referenceNotes || {}).filter((note) => note.destinationId === doc.destinationId)
    : [];

  const lines = [];

  if (destination) {
    lines.push(`${t('exportWriter.writer.context.document')}: "${doc.title}" (${destination.city_name}${destination.country ? `, ${destination.country}` : ''})`);
    if (destination.arrival_date || destination.departure_date) {
      lines.push(`${t('exportWriter.writer.context.dates')}: ${destination.arrival_date || '—'} → ${destination.departure_date || '—'}`);
    }
    if (destination.notes) {
      lines.push(`${t('exportWriter.writer.context.destinationNotes')}: ${destination.notes}`);
    }
  } else {
    lines.push(`${t('exportWriter.writer.context.document')}: "${doc.title}" (${t('exportWriter.travelData.tripOverview')})`);
  }

  lines.push(`${t('exportWriter.writer.context.currentContent')}: ${doc.content?.slice(0, 320) || t('exportWriter.writer.context.empty')}`);

  if (scopedNotes.length > 0) {
    lines.push(`${t('exportWriter.writer.context.notes')}:`);
    scopedNotes.forEach((note) => {
      lines.push(`- ${note.title}: ${(note.content || '').replace(/\s+/g, ' ').trim() || t('journal.noContent')}`);
    });
  }

  if (scopedPois.length > 0) {
    lines.push(`${t('exportWriter.writer.context.pois')}:`);
    scopedPois.forEach((group) => {
      const names = group.pois.map((poi) => poi.name).join(', ');
      lines.push(`- ${group.category}: ${names}`);
    });
  }

  if (scopedAccommodations.length > 0) {
    lines.push(`${t('exportWriter.writer.context.accommodations')}:`);
    scopedAccommodations.forEach((acc) => {
      const dates = [acc.check_in_date, acc.check_out_date].filter(Boolean).join(' → ');
      lines.push(`- ${acc.name}${dates ? ` (${dates})` : ''}${acc.address ? ` — ${acc.address}` : ''}`);
    });
  }

  return lines.join('\n');
}

function MessageBubble({
  msg,
  onOverwrite,
  onAppend,
  onReplaceSelection,
  labels,
}) {
  const isUser = msg.role === 'user';
  const showApply = !isUser && !msg.isStreaming && msg.content;
  const applyBtnClass = 'px-2 py-0.5 text-[10px] rounded transition-colors';

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
                {labels.overwrite}
              </button>
            )}
            {onAppend && (
              <button
                onClick={() => onAppend(msg.content)}
                className={`${applyBtnClass} text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                {labels.append}
              </button>
            )}
            {onReplaceSelection && (
              <button
                onClick={() => onReplaceSelection(msg.content, msg.selectionRange)}
                className={`${applyBtnClass} text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700`}
              >
                {labels.replace}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const WritingAssistantPanel = forwardRef(({ trip, destinations, destinationsReady = true, getEditorSelection }, ref) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [preparedContext, setPreparedContext] = useState(null);

  const wsRef = useRef(null);
  const isConnectedRef = useRef(false);
  const streamingIdRef = useRef(null);
  const pendingDocIdRef = useRef(null);
  const preparedDocIdRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const preparedSelectionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { documents, referenceNotes = {}, selectedDocId, updateContent } = useExportWriterStore();
  const selectedDoc = selectedDocId
    ? (documents[selectedDocId] || referenceNotes[selectedDocId] || null)
    : null;
  const selectedDocSnapshot = useMemo(() => (
    selectedDoc
      ? {
          id: selectedDoc.id,
          title: selectedDoc.title,
          destinationId: selectedDoc.destinationId,
          isReference: !!selectedDoc.isReference,
        }
      : null
  ), [selectedDoc]);
  const canApplyToDocument = !!selectedDocId && !selectedDoc?.isReference;
  const { accessToken } = useAuthStore();
  const pois = usePOIStore((state) => state.pois);
  const accommodations = useAccommodationStore((state) => state.accommodations);

  const sessionTripContext = useMemo(
    () => buildTripContext({ trip, destinations, selectedDoc: selectedDocSnapshot, referenceNotes }),
    [trip, destinations, selectedDocSnapshot, referenceNotes]
  );
  const systemPrompt = useMemo(() => buildWritingSystemPrompt(i18n.language), [i18n.language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const createSession = useCallback(async () => {
    if (!trip) return null;

    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          tripId: trip.id,
          tripContext: sessionTripContext,
          agentConfig: {
            name: 'Writing Assistant',
            systemPrompt,
          },
          chatMode: 'existing',
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.sessionId;
    } catch {
      return null;
    }
  }, [trip, accessToken, sessionTripContext, systemPrompt]);

  const handleWSMessage = useCallback((data) => {
    switch (data.type) {
      case 'auth_ok':
        isConnectedRef.current = true;
        setIsConnected(true);
        break;

      case 'start':
        streamingIdRef.current = data.messageId;
        setMessages((previous) => [
          ...previous,
          {
            id: data.messageId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            sourceDocId: pendingDocIdRef.current,
            selectionRange: pendingSelectionRef.current,
          },
        ]);
        setIsLoading(true);
        break;

      case 'chunk':
        if (data.content && streamingIdRef.current) {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === streamingIdRef.current
                ? { ...message, content: message.content + data.content }
                : message
            )
          );
        }
        break;

      case 'end':
        {
          const finishedId = streamingIdRef.current;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === finishedId ? { ...message, isStreaming: false } : message
          )
        );
        streamingIdRef.current = null;
        pendingSelectionRef.current = null;
        pendingDocIdRef.current = null;
        setIsLoading(false);
        break;
        }

      case 'error':
        {
          const failedId = streamingIdRef.current;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === failedId
              ? { ...message, content: `${message.content}\n\n**Error:** ${data.error}`, isStreaming: false }
              : message
          )
        );
        streamingIdRef.current = null;
        pendingSelectionRef.current = null;
        pendingDocIdRef.current = null;
        setIsLoading(false);
        break;
        }

      default:
        break;
    }
  }, []);

  const connectWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/api/chat/stream`);

    ws.onopen = () => {
      if (accessToken) {
        ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
      } else {
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
        // ignore malformed events
      }
    };

    wsRef.current = ws;
  }, [accessToken, handleWSMessage]);

  const syncSessionContext = useCallback(async (currentSessionId) => {
    if (!currentSessionId || !sessionTripContext) return;

    try {
      await fetch(`${ORCHESTRATOR_URL}/api/sessions/${currentSessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          tripContext: sessionTripContext,
        }),
      });
    } catch {
      // best-effort sync only
    }
  }, [accessToken, sessionTripContext]);

  const clearPreparedContext = useCallback(() => {
    setPreparedContext(null);
    preparedDocIdRef.current = null;
    preparedSelectionRef.current = null;
  }, []);

  const preparePrompt = useCallback(({ prompt, label, targetDocId, selectionRange = null }) => {
    if (!prompt) return;

    preparedDocIdRef.current = targetDocId || null;
    preparedSelectionRef.current = selectionRange;
    setPreparedContext({ prompt, label });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    isConnectedRef.current = false;
    streamingIdRef.current = null;
    pendingDocIdRef.current = null;
    preparedDocIdRef.current = null;
    pendingSelectionRef.current = null;
    preparedSelectionRef.current = null;

    queueMicrotask(() => {
      if (cancelled) return;
      setMessages([]);
      setInputValue('');
      setSessionId(null);
      setPreparedContext(null);
      setIsConnected(false);
      setIsLoading(false);
    });

    const setup = async () => {
      const nextSessionId = await createSession();
      if (!cancelled && nextSessionId) {
        setSessionId(nextSessionId);
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
  }, [trip?.id, destinationsReady, i18n.language, accessToken]);

  useEffect(() => {
    if (!sessionId) return;
    void syncSessionContext(sessionId);
  }, [sessionId, syncSessionContext]);

  const sendMessage = useCallback(async ({
    actualContent,
    visibleContent,
    sourceDocId,
    selectionRange = null,
  }) => {
    if (!actualContent?.trim() || isLoading) return;

    setIsLoading(true);
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      currentSessionId = await createSession();
      if (!currentSessionId) {
        setIsLoading(false);
        return;
      }
      setSessionId(currentSessionId);
      await syncSessionContext(currentSessionId);
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWS();
    }

    if (!isConnectedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      try {
        await waitForConnection();
      } catch {
        setMessages((previous) => [
          ...previous,
          {
            id: `assistant_error_${Date.now()}`,
            role: 'assistant',
            content: t('exportWriter.writer.connectionFailed'),
            isStreaming: false,
          },
        ]);
        setIsLoading(false);
        return;
      }
    }

    setMessages((previous) => [
      ...previous,
      {
        id: `user_${Date.now()}`,
        role: 'user',
        content: visibleContent,
        sourceDocId,
      },
    ]);
    pendingDocIdRef.current = sourceDocId;
    pendingSelectionRef.current = selectionRange;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'chat', sessionId: currentSessionId, message: actualContent.trim() })
      );
    } else {
      setIsLoading(false);
    }
  }, [sessionId, isLoading, createSession, connectWS, waitForConnection, syncSessionContext, t]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const manualInput = inputValue.trim();
    if (!preparedContext && !manualInput) return;

    const sourceDocId = preparedDocIdRef.current ?? (canApplyToDocument ? selectedDocId : null);
    const selectionRange = preparedSelectionRef.current ?? null;
    const actualContent = preparedContext
      ? [
        preparedContext.prompt,
        manualInput
          ? `${getAdditionalInstructionsLabel(i18n.language)}\n${manualInput}`
          : null,
      ].filter(Boolean).join('\n\n')
      : manualInput;
    const visibleContent = preparedContext
      ? buildPreparedMessage(i18n.language, { label: preparedContext.label, inputValue: manualInput })
      : manualInput;

    void sendMessage({
      actualContent,
      visibleContent,
      sourceDocId,
      selectionRange,
    });

    setInputValue('');
    clearPreparedContext();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const applyOverwrite = useCallback((targetDocId, content) => {
    if (canApplyToDocument && targetDocId && targetDocId === selectedDocId && content) {
      updateContent(targetDocId, content);
    }
  }, [canApplyToDocument, selectedDocId, updateContent]);

  const applyAppend = useCallback((targetDocId, content) => {
    if (canApplyToDocument && targetDocId && targetDocId === selectedDocId && content) {
      const existing = selectedDoc?.content || '';
      const separator = existing.trim() ? '\n\n' : '';
      updateContent(targetDocId, existing + separator + content);
    }
  }, [canApplyToDocument, selectedDocId, selectedDoc, updateContent]);

  const applyReplaceSelection = useCallback((targetDocId, content, fallbackSelection) => {
    if (!canApplyToDocument || !targetDocId || targetDocId !== selectedDocId || !content) return;

    const selection = getEditorSelection?.() || fallbackSelection;
    if (!selection) return;

    const existing = selectedDoc?.content || '';
    const before = existing.substring(0, selection.start);
    const after = existing.substring(selection.end);
    updateContent(targetDocId, before + content + after);
  }, [canApplyToDocument, selectedDocId, selectedDoc, updateContent, getEditorSelection]);

  const generateDraft = useCallback((doc) => {
    if (!doc) return;

    const documentContext = buildDocumentContext(
      doc,
      destinations,
      pois,
      accommodations,
      referenceNotes,
      t
    );

    preparePrompt({
      prompt: buildDraftPrompt(i18n.language, documentContext),
      label: t('exportWriter.writer.generateModeLabel', { title: doc.title }),
      targetDocId: doc.id,
    });
  }, [destinations, pois, accommodations, referenceNotes, t, i18n.language, preparePrompt]);

  const improveDraft = useCallback((doc, selection = null) => {
    if (!doc || (!doc.content && !selection?.text)) return;

    preparePrompt({
      prompt: buildImprovePrompt(i18n.language, {
        selectedText: selection?.text || '',
        content: doc.content || '',
      }),
      label: selection?.text?.trim()
        ? t('exportWriter.writer.improveSelectionModeLabel')
        : t('exportWriter.writer.improveModeLabel'),
      targetDocId: doc.id,
      selectionRange: selection,
    });
  }, [i18n.language, preparePrompt, t]);

  useImperativeHandle(ref, () => ({
    triggerGenerateDraft: generateDraft,
    triggerImprove: improveDraft,
    setPromptInput: (prepared, targetDocId = selectedDocId) => {
      const preparedValue = typeof prepared === 'string'
        ? { prompt: prepared, label: t('exportWriter.writer.poiModeLabel') }
        : prepared;
      preparePrompt({
        prompt: preparedValue?.prompt,
        label: preparedValue?.label || t('exportWriter.writer.poiModeLabel'),
        targetDocId,
      });
    },
  }), [generateDraft, improveDraft, selectedDocId, preparePrompt, t]);

  const messageActionLabels = {
    overwrite: t('exportWriter.writer.actions.overwrite'),
    append: t('exportWriter.writer.actions.append'),
    replace: t('exportWriter.writer.actions.replace'),
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-gray-900">
        <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('exportWriter.writer.title')}</span>
        <div
          className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
          title={isConnected ? t('exportWriter.writer.connected') : t('exportWriter.writer.connecting')}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-600">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">
              {selectedDoc
                ? t('exportWriter.writer.emptyWithDocument')
                : t('exportWriter.writer.emptyWithoutDocument')}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            labels={messageActionLabels}
            onOverwrite={msg.sourceDocId && msg.sourceDocId === selectedDocId ? (content) => applyOverwrite(msg.sourceDocId, content) : null}
            onAppend={msg.sourceDocId && msg.sourceDocId === selectedDocId ? (content) => applyAppend(msg.sourceDocId, content) : null}
            onReplaceSelection={msg.sourceDocId && msg.sourceDocId === selectedDocId
              ? (content, selectionRange) => applyReplaceSelection(msg.sourceDocId, content, selectionRange)
              : null}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900"
      >
        {preparedContext && (
          <div className="px-3 pt-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                {preparedContext.label}
              </span>
              <button
                type="button"
                onClick={clearPreparedContext}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                aria-label={t('common.cancel')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-2.5">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={preparedContext
              ? t('exportWriter.writer.additionalInstructionsPlaceholder')
              : t('exportWriter.writer.inputPlaceholder')}
            rows={Math.min(6, Math.max(2, (inputValue.match(/\n/g) || []).length + 1))}
            className="flex-1 text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-600"
          />
          <button
            type="submit"
            disabled={(!inputValue.trim() && !preparedContext) || isLoading}
            className="flex-shrink-0 p-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
});

WritingAssistantPanel.displayName = 'WritingAssistantPanel';

export default WritingAssistantPanel;
