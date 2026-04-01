/**
 * VoiceButton - Floating microphone button for the voice agent.
 * Positioned next to the existing AIChatButton (left of it).
 * Same coral gradient styling.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff } from 'lucide-react';
import useVoiceStore from '../../stores/useVoiceStore';

const VoiceButton = () => {
  const { t } = useTranslation();
  const isOverlayOpen = useVoiceStore((s) => s.isOverlayOpen);
  const isSessionActive = useVoiceStore((s) => s.isSessionActive);
  const isListening = useVoiceStore((s) => s.isListening);
  const toggleOverlay = useVoiceStore((s) => s.toggleOverlay);

  return (
    <button
      onClick={toggleOverlay}
      className={`
        fixed bottom-20 right-[4.5rem] z-40
        sm:bottom-6
        w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-out
        ${isOverlayOpen
          ? 'bg-gray-500 hover:bg-gray-600 scale-90'
          : isListening
            ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-xl shadow-red-500/25'
            : 'bg-gradient-to-br from-[#D97706] to-[#EA580C] hover:from-[#B45309] hover:to-[#C2410C] hover:scale-110 hover:shadow-xl hover:shadow-orange-500/25'
        }
        focus:outline-none focus:ring-4 focus:ring-orange-300/50 dark:focus:ring-orange-600/30
      `}
      aria-label={isOverlayOpen ? t('voice.close', 'Close voice agent') : t('voice.open', 'Open voice agent')}
      title={isOverlayOpen ? t('voice.close', 'Close voice agent') : t('voice.agentName', 'Agente Canario')}
    >
      {isOverlayOpen ? (
        <MicOff className="w-6 h-6 text-white" />
      ) : (
        <Mic className="w-6 h-6 text-white" />
      )}

      {/* Active session indicator */}
      {!isOverlayOpen && isSessionActive && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
      )}

      {/* Listening pulse */}
      {!isOverlayOpen && isListening && (
        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
      )}

      {/* Idle pulse animation */}
      {!isOverlayOpen && !isListening && !isSessionActive && (
        <span
          className="absolute inset-0 rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] animate-pulse opacity-50"
          style={{ animationDuration: '3s' }}
        />
      )}
    </button>
  );
};

export default VoiceButton;
