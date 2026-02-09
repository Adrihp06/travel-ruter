/**
 * ConnectionStatus - Shows connection state with helpful actions
 * Handles connecting, connected, error, and reconnecting states
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import WifiIcon from '@/components/icons/wifi-icon';
import WifiOffIcon from '@/components/icons/wifi-off-icon';
import RefreshIcon from '@/components/icons/refresh-icon';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';
import FilledCheckedIcon from '@/components/icons/filled-checked-icon';

const ConnectionStatus = ({
  isConnected,
  isConnecting = false,
  error = null,
  onRetry = null,
  variant = 'minimal', // 'minimal' | 'banner' | 'inline'
}) => {
  const { t } = useTranslation();

  // Minimal variant - just a dot with tooltip
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {isConnecting ? (
          <>
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-gray-500 dark:text-gray-400">{t('ai.connecting')}</span>
          </>
        ) : isConnected ? (
          <>
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-gray-500 dark:text-gray-400">{t('ai.connected')}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            <span className="text-gray-500 dark:text-gray-400">{t('ai.disconnected')}</span>
          </>
        )}
      </div>
    );
  }

  // Banner variant - full width with details
  if (variant === 'banner') {
    if (isConnecting) {
      return (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800/50 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            {t('ai.connectingToService')}
          </span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TriangleAlertIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {error}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-colors"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              {t('ai.retry')}
            </button>
          )}
        </div>
      );
    }

    if (!isConnected) {
      return (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOffIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('ai.notConnected')}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs font-medium text-[#D97706] hover:text-[#B45309] transition-colors"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
              {t('ai.connect')}
            </button>
          )}
        </div>
      );
    }

    // Connected - don't show banner
    return null;
  }

  // Inline variant - compact with icon
  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        isConnecting
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
          : isConnected
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : error
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}>
        {isConnecting ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('ai.connecting')}
          </>
        ) : isConnected ? (
          <>
            <FilledCheckedIcon className="w-3 h-3" />
            {t('ai.connected')}
          </>
        ) : error ? (
          <>
            <TriangleAlertIcon className="w-3 h-3" />
            {t('ai.error')}
          </>
        ) : (
          <>
            <WifiOffIcon className="w-3 h-3" />
            {t('ai.offline')}
          </>
        )}
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;
