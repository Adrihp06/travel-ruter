import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const PHASE_LABELS = {
  maps: 'exportWriter.progress.fetchingMaps',
  pdf: 'exportWriter.progress.generatingPdfs',
  zip: 'exportWriter.progress.creatingZip',
};

const PHASE_ORDER = ['maps', 'pdf', 'zip'];

const AUTO_DISMISS_MS = 3000;

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
      <div
        className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PhaseSteps({ currentPhase }) {
  const { t } = useTranslation();
  const idx = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-3">
      {PHASE_ORDER.map((phase, i) => {
        const isDone = i < idx;
        const isCurrent = i === idx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <span className="text-gray-300 dark:text-gray-600">→</span>}
            <span
              className={
                isDone
                  ? 'text-green-600 dark:text-green-400 line-through'
                  : isCurrent
                    ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : ''
              }
            >
              {t(PHASE_LABELS[phase])}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ExpandableSection({ icon: Icon, iconClass, label, items, renderItem }) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left text-sm py-1 hover:opacity-80 transition-opacity"
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
        <span className={iconClass}>{label}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 ml-auto text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-auto text-gray-400" />
        )}
      </button>
      {expanded && (
        <ul className="ml-6 mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
          {items.map(renderItem)}
        </ul>
      )}
    </div>
  );
}

function ExportProgressModal({ isOpen, onClose, progress, result }) {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const autoDismissRef = useRef(null);

  const isExporting = !result;
  const hasIssues = result && (result.failed.length > 0 || result.warnings.length > 0);

  // Auto-dismiss on clean success
  useEffect(() => {
    if (result && !hasIssues && isOpen) {
      autoDismissRef.current = setTimeout(() => {
        onClose();
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [result, hasIssues, isOpen, onClose]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    },
    [isExporting, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const progressContent = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {progress ? t(PHASE_LABELS[progress.phase] || 'common.loading') : t('common.loading')}
        </span>
      </div>

      {progress && progress.total > 0 && (
        <>
          <ProgressBar current={progress.current} total={progress.total} />
          <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
            {progress.current} / {progress.total}
          </div>
        </>
      )}

      {progress && <PhaseSteps currentPhase={progress.phase} />}
    </div>
  );

  const resultContent = result && (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {hasIssues ? (
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        ) : (
          <Download className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {hasIssues
            ? t('exportWriter.progress.completeWithIssues')
            : t('exportWriter.progress.complete')}
        </span>
      </div>

      {/* Succeeded */}
      {result.succeeded.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-400">
            {t('exportWriter.progress.succeeded', { count: result.succeeded.length })}
          </span>
        </div>
      )}

      {/* Failed (expandable) */}
      <ExpandableSection
        icon={XCircle}
        iconClass="text-red-600 dark:text-red-400"
        label={t('exportWriter.progress.failed', { count: result.failed.length })}
        items={result.failed}
        renderItem={(item, i) => (
          <li key={i} className="leading-relaxed">
            <span className="font-medium text-gray-700 dark:text-gray-300">{item.title}</span>
            {': '}
            <span className="text-red-600 dark:text-red-400">{item.error}</span>
          </li>
        )}
      />

      {/* Warnings (expandable) */}
      <ExpandableSection
        icon={AlertTriangle}
        iconClass="text-amber-600 dark:text-amber-400"
        label={t('exportWriter.progress.warnings', { count: result.warnings.length })}
        items={result.warnings}
        renderItem={(item, i) => (
          <li key={i} className="text-amber-700 dark:text-amber-400">
            {item}
          </li>
        )}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        {t('common.close')}
      </button>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={!isExporting ? onClose : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('common.export')}
        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (top-right, only when not exporting) */}
        {!isExporting && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {isExporting ? progressContent : resultContent}
      </div>
    </div>,
    document.body,
  );
}

export default ExportProgressModal;
