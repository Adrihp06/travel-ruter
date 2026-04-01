/**
 * VoiceOrb - Animated audio visualization orb.
 * CSS-only (no canvas) with state-driven animations.
 */

import React from 'react';

const STATE_STYLES = {
  idle: {
    inner: 'scale-100 opacity-60',
    outer: 'scale-100 opacity-30',
    ring: 'opacity-0',
    label: null,
  },
  listening: {
    inner: 'scale-110 opacity-90',
    outer: 'scale-125 opacity-50',
    ring: 'opacity-0',
    label: 'Escuchando...',
  },
  processing: {
    inner: 'scale-95 opacity-70',
    outer: 'scale-100 opacity-40',
    ring: 'opacity-100 animate-spin',
    label: 'Pensando...',
  },
  speaking: {
    inner: 'scale-105 opacity-100',
    outer: 'scale-130 opacity-60',
    ring: 'opacity-0',
    label: 'Hablando...',
  },
};

const VoiceOrb = ({ state = 'idle' }) => {
  const styles = STATE_STYLES[state] || STATE_STYLES.idle;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Outer glow */}
        <div
          className={`
            absolute inset-0 rounded-full
            bg-gradient-to-br from-[#D97706]/30 to-[#EA580C]/10
            transition-all duration-700 ease-in-out
            ${styles.outer}
            ${state === 'idle' ? 'animate-pulse' : ''}
            ${state === 'listening' ? 'animate-pulse' : ''}
            ${state === 'speaking' ? 'animate-voice-speak' : ''}
          `}
          style={state === 'idle' ? { animationDuration: '3s' } : state === 'listening' ? { animationDuration: '1.5s' } : undefined}
        />

        {/* Processing ring */}
        <div
          className={`
            absolute inset-[-4px] rounded-full
            border-[3px] border-transparent border-t-[#D97706] border-r-[#EA580C]/50
            transition-opacity duration-300
            ${styles.ring}
          `}
          style={{ animationDuration: '1.2s' }}
        />

        {/* Inner orb */}
        <div
          className={`
            w-20 h-20 rounded-full
            bg-gradient-to-br from-[#D97706] to-[#EA580C]
            shadow-[0_0_40px_rgba(217,119,6,0.4)]
            transition-all duration-500 ease-in-out
            ${styles.inner}
          `}
        />
      </div>

      {/* State label */}
      {styles.label && (
        <span className="mt-4 text-sm text-gray-400 animate-fade-in">
          {styles.label}
        </span>
      )}

      {/* Inline keyframes for custom animations */}
      <style>{`
        @keyframes voice-speak {
          0%, 100% { transform: scale(1.1); opacity: 0.5; }
          25% { transform: scale(1.3); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 0.55; }
          75% { transform: scale(1.35); opacity: 0.65; }
        }
        .animate-voice-speak {
          animation: voice-speak 0.8s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default VoiceOrb;
