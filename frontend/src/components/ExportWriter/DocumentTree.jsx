import React, { useState } from 'react';
import { FileText, Square, CheckSquare, Download, Loader2 } from 'lucide-react';
import useExportWriterStore from '../../stores/useExportWriterStore';
import { exportTripAsPDFs } from '../../utils/pdfExport';
import { useMapboxToken } from '../../contexts/MapboxContext';

/** Visual status indicator for a document */
function StatusDot({ status }) {
  if (status === 'saved') {
    return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Has content" />;
  }
  if (status === 'draft') {
    return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Draft" />;
  }
  return <span className="w-2 h-2 rounded-full border border-gray-400 dark:border-gray-500 flex-shrink-0" title="Empty" />;
}

const DocumentTree = ({ trip, destinations }) => {
  const {
    documents,
    selectedDocId,
    selectedForExport,
    selectDocument,
    toggleExportSelection,
    selectAllForExport,
    clearExportSelection,
    isLoading,
  } = useExportWriterStore();
  const { mapboxAccessToken } = useMapboxToken();
  const [isExporting, setIsExporting] = useState(false);

  const docList = Object.values(documents);
  const selectedCount = selectedForExport.size;

  // Split overview from destination docs
  const overviewDoc = docList.find((d) => !d.destinationId);
  const destDocs = docList.filter((d) => d.destinationId);

  const handleExportSelected = async () => {
    const selectedDocs = docList.filter((d) => selectedForExport.has(d.id));
    if (selectedDocs.length === 0) return;
    setIsExporting(true);
    try {
      await exportTripAsPDFs(selectedDocs, trip, destinations, mapboxAccessToken);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (docList.length === 0) return;
    setIsExporting(true);
    try {
      await exportTripAsPDFs(docList, trip, destinations, mapboxAccessToken);
    } finally {
      setIsExporting(false);
    }
  };

  const renderDocItem = (doc) => {
    const isSelected = selectedDocId === doc.id;
    const isChecked = selectedForExport.has(doc.id);

    return (
      <div
        key={doc.id}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        onClick={() => selectDocument(doc.id)}
      >
        {/* Checkbox for export selection */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExportSelection(doc.id);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          title={isChecked ? 'Remove from export' : 'Add to export'}
        >
          {isChecked ? (
            <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        {/* Document icon + title */}
        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
        <span className="text-xs font-medium truncate flex-1">{doc.title}</span>

        {/* Status dot */}
        <StatusDot status={doc.status} />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-3">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2">
        Documents
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {/* Overview document */}
          {overviewDoc && renderDocItem(overviewDoc)}

          {/* Destination documents */}
          {destDocs.length > 0 && (
            <div className="mt-1 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-0.5">
              {destDocs.map((doc) => renderDocItem(doc))}
            </div>
          )}

          {docList.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2">
              No documents yet
            </p>
          )}
        </div>
      )}

      {/* Selection controls */}
      {docList.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex gap-1">
            <button
              onClick={selectAllForExport}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              All
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              onClick={clearExportSelection}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              None
            </button>
          </div>

          {/* Export selected button */}
          <button
            onClick={handleExportSelected}
            disabled={selectedCount === 0 || isExporting}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCount > 0 && !isExporting
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {selectedCount > 0 ? `Export (${selectedCount})` : 'Export'}
          </button>

          {/* Export all button */}
          <button
            onClick={handleExportAll}
            disabled={docList.length === 0 || isExporting}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export All
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentTree;
