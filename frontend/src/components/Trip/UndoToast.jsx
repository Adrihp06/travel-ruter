import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowBackUpIcon from '@/components/icons/arrow-back-up-icon';
import XIcon from '@/components/icons/x-icon';

const UndoToast = ({ message, onUndo, onDismiss, duration = 5000 }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isVisible, setIsVisible] = useState(true);
  const [isEntering, setIsEntering] = useState(true);

  useEffect(() => {
    // Clear entering state after animation completes
    const enterTimer = setTimeout(() => setIsEntering(false), 350);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    const timeout = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 250); // Allow fade out animation
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      clearTimeout(enterTimer);
    };
  }, [duration, onDismiss]);

  const handleUndo = () => {
    setIsVisible(false);
    setTimeout(onUndo, 250);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 250);
  };

  const progress = (timeLeft / duration) * 100;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 ${
        isEntering ? 'toast-enter' : isVisible ? '' : 'toast-exit'
      }`}
    >
      <div className="bg-stone-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[340px] border border-stone-700/50">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-medium">{message}</span>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleUndo}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-semibold shadow-sm btn-interactive btn-ripple"
            >
              <ArrowBackUpIcon className="w-4 h-4 icon-hover-bounce" />
              <span>{t('common.undo')}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors press-effect"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-stone-700">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 ease-linear progress-bar-animated"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default UndoToast;
