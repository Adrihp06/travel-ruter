import React, { useEffect, useRef, useState } from 'react';
import { Bot, MapPin } from 'lucide-react';
import useExportWriterStore from '../../stores/useExportWriterStore';
import useDestinationStore from '../../stores/useDestinationStore';
import DocumentTree from './DocumentTree';
import MarkdownEditorPanel from './MarkdownEditorPanel';
import WritingAssistantPanel from './WritingAssistantPanel';
import TravelContextPanel from './TravelContextPanel';

const ExportWriterView = ({ tripId, trip }) => {
  const { loadDocuments, reset } = useExportWriterStore();
  const fetchDestinations = useDestinationStore((s) => s.fetchDestinations);
  const [activeTab, setActiveTab] = useState('assistant');
  // Trip-scoped destinations: immune to stale shared-store writes from
  // older in-flight fetchDestinations calls after the user switches trips.
  const [localDestinations, setLocalDestinations] = useState([]);

  // Ref to forward actions from editor toolbar → writing assistant
  const writingAssistantRef = useRef(null);

  // Single coordinated effect: fetch destinations → load documents.
  // Avoids passive destinations.length triggering and stale-trip races.
  useEffect(() => {
    let cancelled = false;

    const initTrip = async () => {
      if (!tripId) return;

      setLocalDestinations([]);
      reset();

      try {
        const dests = await fetchDestinations(tripId);
        if (cancelled) return;
        setLocalDestinations(dests || []);
        await loadDocuments(tripId, dests || []);
      } catch (err) {
        if (!cancelled) {
          console.error('Export Writer: failed to initialize trip', err);
        }
      }
    };

    initTrip();

    return () => {
      cancelled = true;
      reset();
    };
  }, [tripId]);

  // Callback: toolbar "Generate Draft" → writing assistant generates
  const handleGenerateDraft = (doc) => {
    setActiveTab('assistant');
    writingAssistantRef.current?.triggerGenerateDraft(doc);
  };

  // Callback: toolbar "Improve" → writing assistant improves current content
  const handleImprove = (doc) => {
    setActiveTab('assistant');
    writingAssistantRef.current?.triggerImprove(doc);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Document Tree (~220px) */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <DocumentTree trip={trip} destinations={localDestinations} />
      </div>

      {/* Center panel: Markdown Editor (flex-1) */}
      <div className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <MarkdownEditorPanel
          trip={trip}
          destinations={localDestinations}
          onGenerateDraft={handleGenerateDraft}
          onImprove={handleImprove}
        />
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
            Writing Assistant
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
            Travel Data
          </button>
        </div>

        {/* Tab content */}
        {/* Both panels stay mounted; hidden panel uses display:none to preserve WS state */}
        <div className={`flex-1 overflow-hidden ${activeTab !== 'assistant' ? 'hidden' : ''}`}>
          <WritingAssistantPanel
            ref={writingAssistantRef}
            trip={trip}
            destinations={localDestinations}
          />
        </div>
        <div className={`flex-1 overflow-hidden ${activeTab !== 'context' ? 'hidden' : ''}`}>
          <TravelContextPanel
            trip={trip}
            destinations={localDestinations}
          />
        </div>
      </div>
    </div>
  );
};

export default ExportWriterView;
