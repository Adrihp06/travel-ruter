import React, { useEffect, useRef } from 'react';
import useExportWriterStore from '../../stores/useExportWriterStore';
import useDestinationStore from '../../stores/useDestinationStore';
import DocumentTree from './DocumentTree';
import MarkdownEditorPanel from './MarkdownEditorPanel';
import WritingAssistantPanel from './WritingAssistantPanel';

const ExportWriterView = ({ tripId, trip }) => {
  const { loadDocuments, reset } = useExportWriterStore();
  const { destinations, fetchDestinations } = useDestinationStore();

  // Ref to forward actions from editor toolbar → writing assistant
  const writingAssistantRef = useRef(null);

  // Fetch destinations on mount, reset store on unmount
  useEffect(() => {
    if (tripId) {
      fetchDestinations(tripId);
    }
    return () => {
      reset();
    };
  }, [tripId]);

  // Load documents once destinations are available
  useEffect(() => {
    if (tripId && destinations && destinations.length >= 0) {
      loadDocuments(tripId, destinations);
    }
  }, [tripId, destinations?.length]);

  // Callback: toolbar "Generate Draft" → writing assistant generates
  const handleGenerateDraft = (doc) => {
    writingAssistantRef.current?.triggerGenerateDraft(doc);
  };

  // Callback: toolbar "Improve" → writing assistant improves current content
  const handleImprove = (doc) => {
    writingAssistantRef.current?.triggerImprove(doc);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Document Tree (~220px) */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <DocumentTree trip={trip} destinations={destinations || []} />
      </div>

      {/* Center panel: Markdown Editor (flex-1) */}
      <div className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <MarkdownEditorPanel
          trip={trip}
          destinations={destinations || []}
          onGenerateDraft={handleGenerateDraft}
          onImprove={handleImprove}
        />
      </div>

      {/* Right panel: Writing Assistant (~320px) */}
      <div className="w-80 flex-shrink-0 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900">
        <WritingAssistantPanel
          ref={writingAssistantRef}
          trip={trip}
          destinations={destinations || []}
        />
      </div>
    </div>
  );
};

export default ExportWriterView;
