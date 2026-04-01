/**
 * VoiceMicButton - Large centered microphone button.
 * Push-to-talk: hold to speak, release to stop.
 * Toggle mode: tap once to start, tap again to stop.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

const VoiceMicButton = ({ isListening, isProcessing, isConnected, onStartListening, onStopListening }) => {
  const [holdMode] = useState(false); // TODO: could be a setting
  const holdTimerRef = useRef(null);
  const isHoldingRef = useRef(false);

  const handlePointerDown = useCallback(() => {
    if (!isConnected) return;

    if (holdMode) {
      isHoldingRef.current = true;
      // Small delay to avoid accidental taps
      holdTimerRef.current = setTimeout(() => {
        if (isHoldingRef.current) {
          onStartListening();
        }
      }, 100);
    }
  }, [holdMode, isConnected, onStartListening]);

  const handlePointerUp = useCallback(() => {
    if (holdMode) {
      isHoldingRef.current = false;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (isListening) {
        onStopListening();
      }
    }
  }, [holdMode, isListening, onStopListening]);

  const handleClick = useCallback(() => {
    if (!isConnected) return;
    if (holdMode) return; // handled by pointer events

    if (isListening) {
      onStopListening();
    } else {
      onStartListening();
    }
  }, [holdMode, isConnected, isListening, onStartListening, onStopListening]);

  const buttonClasses = isListening
    ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.5)] scale-110'
    : isProcessing
      ? 'bg-gray-600 cursor-wait'
      : isConnected
        ? 'bg-gradient-to-br from-[#D97706] to-[#EA580C] hover:from-[#B45309] hover:to-[#C2410C] shadow-[0_0_25px_rgba(217,119,6,0.4)] hover:scale-105'
        : 'bg-gray-700 cursor-not-allowed opacity-50';

  return (
    <div className="flex flex-col items-center gap-3 pb-6 pt-2">
      <button
        className={`
          w-16 h-16 rounded-full
          flex items-center justify-center
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-4 focus:ring-orange-300/50
          ${buttonClasses}
        `}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={!isConnected || isProcessing}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {isProcessing ? (
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        ) : isListening ? (
          <MicOff className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}

        {/* Recording pulse ring */}
        {isListening && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
        )}
      </button>

      <span className="text-[11px] text-gray-500">
        {!isConnected
          ? 'Conectando...'
          : isListening
            ? 'Toca para parar'
            : isProcessing
              ? 'Procesando...'
              : 'Toca para hablar'
        }
      </span>
    </div>
  );
};

export default VoiceMicButton;
