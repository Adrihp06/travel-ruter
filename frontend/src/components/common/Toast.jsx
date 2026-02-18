import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import XIcon from '@/components/icons/x-icon';
import FilledCheckedIcon from '@/components/icons/filled-checked-icon';
import InfoCircleIcon from '@/components/icons/info-circle-icon';
import TriangleAlertIcon from '@/components/icons/triangle-alert-icon';

// Toast context for global access
const ToastContext = createContext(null);

// Toast types with their styling
const toastTypes = {
  success: {
    icon: FilledCheckedIcon,
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500 dark:text-green-400',
    textColor: 'text-green-800 dark:text-green-200',
  },
  error: {
    icon: InfoCircleIcon,
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500 dark:text-red-400',
    textColor: 'text-red-800 dark:text-red-200',
  },
  warning: {
    icon: TriangleAlertIcon,
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    textColor: 'text-yellow-800 dark:text-yellow-200',
  },
  info: {
    icon: InfoCircleIcon,
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500 dark:text-blue-400',
    textColor: 'text-blue-800 dark:text-blue-200',
  },
};

// Single Toast component
const ToastItem = ({ toast, onDismiss }) => {
  const { t } = useTranslation();
  const [isExiting, setIsExiting] = useState(false);
  const config = toastTypes[toast.type] || toastTypes.info;
  const Icon = config.icon;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm w-full
        transform transition-all duration-200
        ${config.bgColor} ${config.borderColor}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />

      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`font-medium ${config.textColor}`}>
            {toast.title}
          </h4>
        )}
        {toast.message && (
          <p className={`text-sm ${config.textColor} ${toast.title ? 'mt-1' : ''} opacity-90`}>
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action.onClick();
              handleDismiss();
            }}
            className={`mt-2 text-sm font-medium ${config.iconColor} hover:underline`}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.dismissible !== false && (
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${config.textColor}`}
          aria-label={t('errors.dismissNotification')}
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Toast Container component
const ToastContainer = ({ toasts, onDismiss, position = 'bottom-right' }) => {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-24 sm:bottom-24 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-[100] flex flex-col gap-2 ${positionClasses[position] || positionClasses['bottom-right']}`}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// Toast Provider component
export const ToastProvider = ({ children, position = 'bottom-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      dismissible: true,
      ...toast,
    };

    setToasts((prev) => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const toast = useCallback((message, options = {}) => {
    return addToast({ message, ...options });
  }, [addToast]);

  toast.success = (message, options = {}) => addToast({ message, type: 'success', ...options });
  toast.error = (message, options = {}) => addToast({ message, type: 'error', ...options });
  toast.warning = (message, options = {}) => addToast({ message, type: 'warning', ...options });
  toast.info = (message, options = {}) => addToast({ message, type: 'info', ...options });

  const value = {
    toasts,
    toast,
    addToast,
    dismissToast,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} position={position} />
    </ToastContext.Provider>
  );
};

// Hook for using toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContainer;
