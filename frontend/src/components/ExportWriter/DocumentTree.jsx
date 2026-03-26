import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Square, CheckSquare, Download, Loader2 } from 'lucide-react';
import useExportWriterStore from '../../stores/useExportWriterStore';
import { exportTripAsPDFs } from '../../utils/pdfExport';
import { useMapboxToken } from '../../contexts/MapboxContext';

function StatusDot({ status, t }) {
  if (status === 'saved') {
    return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title={t('exportWriter.documents.hasContent')} />;
  }
  if (status === 'draft') {
    return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title={t('exportWriter.documents.draft')} />;
  }
  return <span className="w-2 h-2 rounded-full border border-gray-400 dark:border-gray-500 flex-shrink-0" title={t('exportWriter.documents.empty')} />;
}

const DocumentTree = ({ trip, destinations }) => {
  const { t } = useTranslation();
  const {
    documents,
    selectedDocId,
    selectedForExport,
    selectDocument,
    toggleExportSelection,
    selectAllForExport,
    clearExportSelection,
    isLoading,
    isLoadingRefs,
  } = useExportWriterStore();
  const { mapboxAccessToken } = useMapboxToken();
  const [isExporting, setIsExporting] = useState(false);

  const docList = Object.values(documents);
  const selectedCount = docList.filter((doc) => selectedForExport.has(doc.id)).length;
  const overviewDoc = docList.find((doc) => !doc.destinationId);
  const destinationDocs = docList.filter((doc) => doc.destinationId);

  const handleExportSelected = async () => {
    const selectedDocs = docList.filter((doc) => selectedForExport.has(doc.id));
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
        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleExportSelection(doc.id);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          title={isChecked ? t('exportWriter.documents.removeFromExport') : t('exportWriter.documents.addToExport')}
        >
          {isChecked ? (
            <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
        <span className="text-xs font-medium truncate flex-1">{doc.title}</span>
        <StatusDot status={doc.status} t={t} />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-3">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2">
        {t('exportWriter.documents.title')}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {overviewDoc && renderDocItem(overviewDoc)}

          {destinationDocs.length > 0 && (
            <div className="mt-1 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-0.5">
              {destinationDocs.map((doc) => renderDocItem(doc))}
            </div>
          )}

          {isLoadingRefs && docList.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('exportWriter.documents.loadingNotes')}
            </div>
          )}

          {!isLoadingRefs && docList.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2">
              {t('exportWriter.documents.noDocuments')}
            </p>
          )}
        </div>
      )}

      {docList.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <div className="flex gap-1">
            <button
              onClick={selectAllForExport}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title={t('exportWriter.documents.selectAllTitle')}
            >
              {t('common.all')}
            </button>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button
              onClick={clearExportSelection}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              {t('common.none')}
            </button>
          </div>

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
            {selectedCount > 0
              ? t('exportWriter.documents.exportSelectedCount', { count: selectedCount })
              : t('common.export')}
          </button>

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
            {t('exportWriter.documents.exportAllDrafts')}
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentTree;
