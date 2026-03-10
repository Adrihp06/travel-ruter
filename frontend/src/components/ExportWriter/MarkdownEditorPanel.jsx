import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import MDEditor from '@uiw/react-md-editor/nohighlight';
import '@uiw/react-md-editor/markdown-editor.css';
import DOMPurify from 'dompurify';
import { Sparkles, PenLine, FileText, Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useExportWriterStore from '../../stores/useExportWriterStore';
import usePOIStore from '../../stores/usePOIStore';
import useAccommodationStore from '../../stores/useAccommodationStore';
import useDayRoutesStore from '../../stores/useDayRoutesStore';

const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

function wordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function SaveStatusIndicator({ status }) {
  const { t } = useTranslation();

  if (status === 'saving') {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">{t('exportWriter.editor.saving')}</span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-xs text-green-600 dark:text-green-400">{t('exportWriter.editor.saved')}</span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">{t('exportWriter.editor.saveError')}</span>
    );
  }
  return null;
}

const MarkdownEditorPanel = forwardRef(({ onGenerateDraft, onImprove, onInsertTripRoute, tripId }, ref) => {
  const { t } = useTranslation();
  const {
    documents,
    referenceNotes,
    selectedDocId,
    updateContent,
    saveStatus,
  } = useExportWriterStore();

  const editorContainerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getSelection: () => {
      const textarea = editorContainerRef.current?.querySelector('textarea');
      if (!textarea) return null;
      const { selectionStart, selectionEnd, value } = textarea;
      if (selectionStart === selectionEnd) return null;
      return { start: selectionStart, end: selectionEnd, text: value.substring(selectionStart, selectionEnd) };
    },
    getCursorPosition: () => {
      const textarea = editorContainerRef.current?.querySelector('textarea');
      if (!textarea) return null;
      return textarea.selectionStart;
    },
  }), []);

  const selectedDoc = selectedDocId
    ? (documents[selectedDocId] || referenceNotes[selectedDocId] || null)
    : null;
  const isReference = !!selectedDoc?.isReference;
  const content = selectedDoc?.content || '';
  const sanitizedReferenceContent = useMemo(() => {
    if (!isReference) return '';
    if (!content) return `<p class="text-gray-400 italic">${t('journal.noContent')}</p>`;
    return DOMPurify.sanitize(content, sanitizeConfig);
  }, [content, isReference, t]);
  const words = wordCount(
    isReference
      ? sanitizedReferenceContent.replace(/<[^>]+>/g, ' ')
      : content
  );
  const poisLoading = usePOIStore((s) => s.isLoading);
  const accommodationsLoading = useAccommodationStore((s) => s.isLoading);
  const isRouteCalculating = useDayRoutesStore((s) => s.isCalculating);
  const isGeneratingReady = !selectedDoc?.destinationId || (!poisLoading && !accommodationsLoading && !isRouteCalculating);

  const handleChange = useCallback(
    (value) => {
      if (selectedDocId && !isReference) {
        updateContent(selectedDocId, value || '');
      }
    },
    [selectedDocId, updateContent, isReference]
  );

  if (!selectedDoc) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8 text-gray-400 dark:text-gray-500">
          <FileText className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">{t('exportWriter.editor.selectDocument')}</p>
          <p className="text-xs mt-1">{t('exportWriter.editor.selectDocumentHint')}</p>
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
        {isReference ? (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">{t('exportWriter.editor.vaultNote')}</span>
        ) : (
          <>
            <button
              onClick={() => onGenerateDraft && onGenerateDraft(selectedDoc)}
              disabled={!isGeneratingReady}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors"
              title={t('exportWriter.editor.generateDraftTitle')}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('exportWriter.editor.generateDraft')}
            </button>
            <button
              onClick={() => onImprove && onImprove(selectedDoc)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('exportWriter.editor.improveTitle')}
            >
              <PenLine className="w-3.5 h-3.5" />
              {t('exportWriter.editor.improve')}
            </button>
            {tripId && (
              <button
                onClick={() => onInsertTripRoute && onInsertTripRoute()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={t('exportWriter.editor.insertTripRouteTitle')}
                data-testid="insert-trip-route-btn"
              >
                <Route className="w-3.5 h-3.5" />
                {t('exportWriter.editor.insertTripRoute')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Editor */}
      <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden">
        {isReference ? (
          <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
            <div
              data-testid="reference-note-content"
              className="px-4 py-3 prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: sanitizedReferenceContent }}
            />
          </div>
        ) : (
          <MDEditor
            value={content}
            onChange={handleChange}
            height="100%"
            preview="live"
            hideToolbar={false}
            visibleDragbar={false}
            style={{ height: '100%', borderRadius: 0, border: 'none' }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t('exportWriter.editor.wordCount', { count: words })}
        </span>
        {!isReference && <SaveStatusIndicator status={saveStatus} />}
      </div>
    </div>
  );
});

MarkdownEditorPanel.displayName = 'MarkdownEditorPanel';

export default MarkdownEditorPanel;
