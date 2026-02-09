import React from 'react';
import { useTranslation } from 'react-i18next';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import FilledCheckedIcon from '@/components/icons/filled-checked-icon';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';
import XIcon from '@/components/icons/x-icon';

/**
 * Alert Component
 *
 * Variants: info, success, warning, error
 */
const Alert = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  icon = true,
  action,
  className = '',
}) => {
  // Variant configurations
  const variants = {
    info: {
      container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: InfoCircleIcon,
      iconColor: 'text-blue-500 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      content: 'text-blue-700 dark:text-blue-300',
      dismiss: 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    },
    success: {
      container: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: FilledCheckedIcon,
      iconColor: 'text-green-500 dark:text-green-400',
      title: 'text-green-800 dark:text-green-200',
      content: 'text-green-700 dark:text-green-300',
      dismiss: 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/50',
    },
    warning: {
      container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: TriangleAlertIcon,
      iconColor: 'text-yellow-500 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      content: 'text-yellow-700 dark:text-yellow-300',
      dismiss: 'text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/50',
    },
    error: {
      container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: InfoCircleIcon,
      iconColor: 'text-red-500 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      content: 'text-red-700 dark:text-red-300',
      dismiss: 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50',
    },
  };

  const { t } = useTranslation();
  const config = variants[variant];
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={`
        flex gap-3 p-4 rounded-lg border
        ${config.container}
        ${className}
      `}
    >
      {/* Icon */}
      {icon && (
        <div className="flex-shrink-0">
          <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`font-medium ${config.title}`}>
            {title}
          </h4>
        )}
        {children && (
          <div className={`${title ? 'mt-1' : ''} text-sm ${config.content}`}>
            {children}
          </div>
        )}
        {action && (
          <div className="mt-3">
            {action}
          </div>
        )}
      </div>

      {/* Dismiss Button */}
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className={`
            flex-shrink-0 p-1 rounded-md transition-colors
            ${config.dismiss}
          `}
          aria-label={t('errors.dismissAlert')}
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Inline Alert - for form validation messages
export const InlineAlert = ({
  variant = 'error',
  children,
  className = '',
}) => {
  const variants = {
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    success: 'text-green-600 dark:text-green-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const icons = {
    error: InfoCircleIcon,
    warning: TriangleAlertIcon,
    success: FilledCheckedIcon,
    info: InfoCircleIcon,
  };

  const Icon = icons[variant];

  return (
    <div className={`flex items-center gap-1.5 text-xs ${variants[variant]} ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
};

// Banner Alert - for page-level notifications
export const BannerAlert = ({
  variant = 'info',
  children,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const variants = {
    info: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    error: 'bg-red-600',
  };

  return (
    <div className={`${variants[variant]} text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex-1 text-sm font-medium">
          {children}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            aria-label={t('errors.dismiss')}
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
