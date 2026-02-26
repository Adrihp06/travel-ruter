import React, { useCallback } from 'react';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import '@uiw/react-md-editor/markdown-editor.css';
import { Sparkles, PenLine, FileText } from 'lucide-react';
import useExportWriterStore from '../../stores/useExportWriterStore';

function wordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function SaveStatusIndicator({ status }) {
  if (status === 'saving') {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">Saving...</span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-xs text-green-600 dark:text-green-400">Auto-saved ✓</span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">Error saving</span>
    );
  }
  return null;
}

const MarkdownEditorPanel = ({ onGenerateDraft, onImprove }) => {
  const {
    documents,
    selectedDocId,
    updateContent,
    saveStatus,
  } = useExportWriterStore();

  const selectedDoc = selectedDocId ? documents[selectedDocId] : null;
  const content = selectedDoc?.content || '';
  const words = wordCount(content);

  const handleChange = useCallback(
    (value) => {
      if (selectedDocId) {
        updateContent(selectedDocId, value || '');
      }
    },
    [selectedDocId, updateContent]
  );

  if (!selectedDoc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 text-gray-400 dark:text-gray-500">
        <FileText className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm font-medium">Select a document</p>
        <p className="text-xs mt-1">Choose a document from the tree on the left to start writing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-color-mode="auto">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">
          {selectedDoc.title}
        </span>
        <button
          onClick={() => onGenerateDraft && onGenerateDraft(selectedDoc)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
          title="Ask AI to generate a draft"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Generate Draft
        </button>
        <button
          onClick={() => onImprove && onImprove(selectedDoc)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Ask AI to improve current content"
        >
          <PenLine className="w-3.5 h-3.5" />
          Improve
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MDEditor
          value={content}
          onChange={handleChange}
          height="100%"
          preview="live"
          hideToolbar={false}
          visibleDragbar={false}
          style={{ height: '100%', borderRadius: 0, border: 'none' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {words} word{words !== 1 ? 's' : ''}
        </span>
        <SaveStatusIndicator status={saveStatus} />
      </div>
    </div>
  );
};

export default MarkdownEditorPanel;
