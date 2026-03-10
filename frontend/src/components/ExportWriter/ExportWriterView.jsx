import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useExportWriterStore from '../../stores/useExportWriterStore';
import useDestinationStore from '../../stores/useDestinationStore';
import DocumentTree from './DocumentTree';
import MarkdownEditorPanel from './MarkdownEditorPanel';
import WritingAssistantPanel from './WritingAssistantPanel';
import TravelContextPanel from './TravelContextPanel';
import {
  createTripOverviewBlock,
  createDestinationOverviewBlock,
  createDayRouteBlock,
  insertRouteBlock,
} from '../../utils/routeBlockContract';

const ExportWriterView = ({ tripId, trip }) => {
  const { t } = useTranslation();
  const loadDocuments = useExportWriterStore((s) => s.loadDocuments);
  const loadReferenceNotes = useExportWriterStore((s) => s.loadReferenceNotes);
  const reset = useExportWriterStore((s) => s.reset);
  const documents = useExportWriterStore((s) => s.documents);
  const getSelectedDocument = useExportWriterStore((s) => s.getSelectedDocument);
  const selectDocument = useExportWriterStore((s) => s.selectDocument);
  const updateContent = useExportWriterStore((s) => s.updateContent);
  const fetchDestinations = useDestinationStore((s) => s.fetchDestinations);
  const [activeTab, setActiveTab] = useState('assistant');
  // Trip-scoped destinations: immune to stale shared-store writes from
  // older in-flight fetchDestinations calls after the user switches trips.
  const [localDestinations, setLocalDestinations] = useState([]);
  const [destinationsReady, setDestinationsReady] = useState(false);
  const [initializedTripId, setInitializedTripId] = useState(null);

  // Ref to forward actions from editor toolbar → writing assistant
  const writingAssistantRef = useRef(null);
  // Ref to access editor selection for replace-selection support
  const editorRef = useRef(null);

  // Single coordinated effect: fetch destinations → load documents.
  // Avoids passive destinations.length triggering and stale-trip races.
  useEffect(() => {
    let cancelled = false;

    const initTrip = async () => {
      if (!tripId) return;

      setLocalDestinations([]);
      setDestinationsReady(false);
      setInitializedTripId(null);
      reset();

      try {
        const dests = await fetchDestinations(tripId);
        if (cancelled) return;
        const scopedDestinations = dests || [];
        setLocalDestinations(scopedDestinations);
        setDestinationsReady(true);
        setInitializedTripId(tripId);

        void loadDocuments(tripId, scopedDestinations);
        void loadReferenceNotes(tripId);
      } catch (err) {
        if (!cancelled) {
          setDestinationsReady(true);
          setInitializedTripId(tripId);
          console.error('Export Writer: failed to initialize trip', err);
        }
      }
    };

    initTrip();

    return () => {
      cancelled = true;
      setInitializedTripId(null);
      reset();
    };
  }, [tripId]);

  const isTripReady = initializedTripId === tripId;

  // Callback: toolbar "Generate Draft" → writing assistant generates
  const handleGenerateDraft = (doc) => {
    setActiveTab('assistant');
    writingAssistantRef.current?.triggerGenerateDraft(doc);
  };

  // Callback: toolbar "Improve" → writing assistant improves current content
  const handleImprove = (doc) => {
    const selection = getEditorSelection();
    setActiveTab('assistant');
    writingAssistantRef.current?.triggerImprove(doc, selection);
  };

  // Stable callback for the assistant to query editor selection
  const getEditorSelection = () => editorRef.current?.getSelection?.() || null;

  // --- Route block insertion helpers ---
  const insertBlockAtCursor = useCallback((descriptor) => {
    const selectedDoc = getSelectedDocument?.();
    if (!selectedDoc || selectedDoc.isReference) return;
    const cursorPos = editorRef.current?.getCursorPosition?.();
    const position = cursorPos != null ? cursorPos : (selectedDoc.content || '').length;
    const newContent = insertRouteBlock(selectedDoc.content || '', position, descriptor);
    updateContent(selectedDoc.id, newContent);
  }, [getSelectedDocument, updateContent]);

  // Toolbar action: insert trip-level route block
  const handleInsertTripRoute = useCallback(() => {
    if (!tripId) return;
    const descriptor = createTripOverviewBlock(tripId, trip?.name ? `${trip.name} Route` : null);
    insertBlockAtCursor(descriptor);
  }, [tripId, trip, insertBlockAtCursor]);

  const handleInsertDestinationRoute = useCallback(({ destinationId, label }) => {
    const descriptor = createDestinationOverviewBlock(destinationId, label || null);
    insertBlockAtCursor(descriptor);
  }, [insertBlockAtCursor]);

  // TravelContext action: insert day/destination route block
  const handleInsertDayRoute = useCallback(({ destinationId, date, label }) => {
    const descriptor = createDayRouteBlock(destinationId, date, label || null);
    insertBlockAtCursor(descriptor);
  }, [insertBlockAtCursor]);

  // Callback: Travel Data "Prepare Prompt" → populate assistant input
  const handlePreparePrompt = (preparedPrompt) => {
    const prompt = typeof preparedPrompt === 'string'
      ? { prompt: preparedPrompt, label: t('exportWriter.writer.poiModeLabel') }
      : preparedPrompt;
    const selectedDoc = getSelectedDocument?.();
    let targetDocId = selectedDoc?.id || null;

    if (selectedDoc?.isReference) {
      const draftDocs = Object.values(documents);
      const matchingDraft = draftDocs.find((doc) => doc.destinationId === selectedDoc.destinationId)
        || draftDocs.find((doc) => !doc.destinationId);

      if (matchingDraft) {
        targetDocId = matchingDraft.id;
        selectDocument(matchingDraft.id);
      }
    }

    setActiveTab('assistant');
    writingAssistantRef.current?.setPromptInput(prompt, targetDocId);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Document Tree (~220px) */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {isTripReady && <DocumentTree trip={trip} destinations={localDestinations} />}
      </div>

      {/* Center panel: Markdown Editor (flex-1) */}
      <div className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        {isTripReady && (
          <MarkdownEditorPanel
            ref={editorRef}
            trip={trip}
            tripId={tripId}
            destinations={localDestinations}
            onGenerateDraft={handleGenerateDraft}
            onImprove={handleImprove}
            onInsertTripRoute={handleInsertTripRoute}
          />
        )}
      </div>

      {/* Right panel: Tabbed — Writing Assistant | Travel Data (~320px) */}
      <div className="w-80 flex-shrink-0 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'assistant'
                ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400 bg-white dark:bg-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            >
              <Bot className="w-3.5 h-3.5" />
              {t('exportWriter.writer.title')}
            </button>
          <button
            onClick={() => setActiveTab('context')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === 'context'
                ? 'text-amber-700 dark:text-amber-400 border-b-2 border-amber-600 dark:border-amber-400 bg-white dark:bg-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {t('exportWriter.travelData.title')}
            </button>
        </div>

        {/* Tab content */}
        {/* Both panels stay mounted; hidden panel uses display:none to preserve WS state */}
        <div className={`flex-1 overflow-hidden ${activeTab !== 'assistant' ? 'hidden' : ''}`}>
          {isTripReady && (
            <WritingAssistantPanel
              ref={writingAssistantRef}
              trip={trip}
              destinations={localDestinations}
              destinationsReady={destinationsReady}
              getEditorSelection={getEditorSelection}
            />
          )}
        </div>
        <div className={`flex-1 overflow-hidden ${activeTab !== 'context' ? 'hidden' : ''}`}>
          {isTripReady && (
            <TravelContextPanel
              trip={trip}
              destinations={localDestinations}
              onPreparePrompt={handlePreparePrompt}
              onInsertDestinationRoute={handleInsertDestinationRoute}
              onInsertDayRoute={handleInsertDayRoute}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportWriterView;
