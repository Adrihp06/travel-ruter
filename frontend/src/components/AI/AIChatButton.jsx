/**
 * AIChatButton - Claude-style floating action button
 * Warm coral gradient matching Claude's brand
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import XIcon from '@/components/icons/x-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';

const AIChatButton = ({ isOpen, onClick, hasUnread = false, isLoading = false }) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-20 right-6 z-40
        sm:bottom-6
        w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-out
        ${isOpen
          ? 'bg-gray-500 hover:bg-gray-600 scale-90'
          : 'bg-gradient-to-br from-[#D97706] to-[#EA580C] hover:from-[#B45309] hover:to-[#C2410C] hover:scale-110 hover:shadow-xl hover:shadow-orange-500/25'
        }
        focus:outline-none focus:ring-4 focus:ring-orange-300/50 dark:focus:ring-orange-600/30
      `}
      aria-label={isOpen ? t('ai.closeAssistant') : t('ai.openAssistant')}
      title={isOpen ? t('ai.closeAssistant') : t('ai.chatTitle')}
    >
      {isOpen ? (
        <XIcon className="w-6 h-6 text-white" />
      ) : (
        <SparklesIcon className="w-6 h-6 text-white" />
      )}

      {/* Unread indicator */}
      {!isOpen && hasUnread && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
        </span>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute inset-0 rounded-full">
          <span className="absolute inset-0 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
        </span>
      )}

      {/* Subtle pulse animation when idle */}
      {!isOpen && !isLoading && (
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] animate-pulse opacity-50" style={{ animationDuration: '3s' }} />
      )}
    </button>
  );
};

export default AIChatButton;
