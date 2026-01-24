import React, { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';

const UndoToast = ({ message, onUndo, onDismiss, duration = 5000 }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
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
      setTimeout(onDismiss, 300); // Allow fade out animation
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [duration, onDismiss]);

  const handleUndo = () => {
    setIsVisible(false);
    onUndo();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const progress = (timeLeft / duration) * 100;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-stone-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[340px] border border-stone-700/50">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-medium">{message}</span>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={handleUndo}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg transition-all text-sm font-semibold shadow-sm press-effect"
            >
              <Undo2 className="w-4 h-4" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-stone-700">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default UndoToast;
