import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Bug, Lightbulb, X } from 'lucide-react';

const GITHUB_REPO = 'Adrihp06/travel-ruter';

function getEnvironmentInfo(pathname, language) {
  const isDark = document.documentElement.classList.contains('dark');
  return [
    `Page: ${pathname}`,
    `Browser: ${navigator.userAgent}`,
    `Resolution: ${window.innerWidth}x${window.innerHeight}`,
    `Language: ${language}`,
    `Dark Mode: ${isDark ? 'Yes' : 'No'}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');
}

function buildIssueUrl(template, envInfo) {
  const marker = '<!-- Submitted from app -->';
  const body = `${marker}\n\n### Environment\n\n${envInfo}`;
  const params = new URLSearchParams({
    template,
    body,
  });
  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}

const ReportIssueButton = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleReport = (template) => {
    const envInfo = getEnvironmentInfo(location.pathname, i18n.language);
    const url = buildIssueUrl(template, envInfo);
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="fixed bottom-20 left-6 z-50 sm:bottom-6">
      {/* Expanded menu */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 mb-2 w-56 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-2 animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => handleReport('bug_report.yml')}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Bug className="w-4 h-4 text-red-500" />
            {t('feedback.reportBug')}
          </button>
          <button
            onClick={() => handleReport('feature_request.yml')}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
            {t('feedback.requestFeature')}
          </button>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          relative w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${isOpen
            ? 'bg-gray-500 hover:bg-gray-600 scale-90'
            : 'bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 hover:scale-110 hover:shadow-xl hover:shadow-purple-500/25'
          }
          focus:outline-none focus:ring-4 focus:ring-purple-300/50 dark:focus:ring-purple-600/30
        `}
        aria-label={isOpen ? t('common.close') : t('feedback.reportIssue')}
        title={isOpen ? t('common.close') : t('feedback.reportIssue')}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Bug className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        )}
      </button>

      {/* Early Access badge */}
      {!isOpen && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold leading-none bg-amber-400 text-amber-900 rounded-full shadow-sm pointer-events-none">
          EA
        </span>
      )}
    </div>
  );
};

export default ReportIssueButton;
