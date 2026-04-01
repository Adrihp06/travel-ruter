/**
 * VoicePanel - Side panel voice agent interface.
 * Slides in from the right like AIChatSlideover.
 * Dark gradient background with orb, transcript, and mic button.
 * Handles frontend tool bridge (navigation, map, modals).
 */

import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, MapPin, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import useVoiceStore from '../../stores/useVoiceStore';
import VoiceOrb from './VoiceOrb';
import VoiceTranscript from './VoiceTranscript';
import VoiceMicButton from './VoiceMicButton';

const VoicePanel = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isConnected = useVoiceStore((s) => s.isConnected);
  const isSessionActive = useVoiceStore((s) => s.isSessionActive);
  const isListening = useVoiceStore((s) => s.isListening);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const isProcessing = useVoiceStore((s) => s.isProcessing);
  const connectionError = useVoiceStore((s) => s.connectionError);
  const transcript = useVoiceStore((s) => s.transcript);
  const activeToolCalls = useVoiceStore((s) => s.activeToolCalls);
  const tripContext = useVoiceStore((s) => s.tripContext);

  const connect = useVoiceStore((s) => s.connect);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const startListening = useVoiceStore((s) => s.startListening);
  const stopListening = useVoiceStore((s) => s.stopListening);
  const toggleOverlay = useVoiceStore((s) => s.toggleOverlay);

  // Set up navigation bridge for frontend tools
  useEffect(() => {
    window.__voiceNavigate = (page) => {
      navigate(page);
    };
    return () => {
      delete window.__voiceNavigate;
    };
  }, [navigate]);

  // Frontend tools now call Zustand stores directly — no CustomEvent listeners needed.

  // Send current page context to store before connecting
  useEffect(() => {
    useVoiceStore.getState().setCurrentPage(location.pathname);
  }, [location.pathname]);

  // Auto-connect when panel opens
  useEffect(() => {
    if (!isSessionActive && !connectionError) {
      useVoiceStore.getState().setCurrentPage(location.pathname);
      connect().catch((err) => {
        console.error('Voice connection failed:', err);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    disconnect();
    toggleOverlay();
  }, [disconnect, toggleOverlay]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Derive orb state
  const orbState = isListening
    ? 'listening'
    : isSpeaking
      ? 'speaking'
      : isProcessing
        ? 'processing'
        : 'idle';

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      }}
      role="complementary"
      aria-label="Voice agent"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-black/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className="text-[#D97706] font-semibold text-sm">
            Agente Canario
          </span>
        </div>

        <div className="flex items-center gap-2">
          {tripContext?.name && (
            <span className="flex items-center gap-1 bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded-full max-w-[120px] truncate">
              <MapPin className="w-3 h-3 text-[#D97706] flex-shrink-0" />
              {tripContext.name}
            </span>
          )}

          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
            aria-label="Close voice agent"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {connectionError && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 bg-red-900/40 border border-red-800/50 rounded-lg flex items-center gap-2 flex-shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-[11px]">{connectionError}</span>
        </div>
      )}

      {/* Orb visualization */}
      <VoiceOrb state={orbState} />

      {/* Transcript */}
      <VoiceTranscript
        transcript={transcript}
        activeToolCalls={activeToolCalls}
      />

      {/* Mic button */}
      <VoiceMicButton
        isListening={isListening}
        isProcessing={isProcessing}
        isConnected={isConnected}
        onStartListening={startListening}
        onStopListening={stopListening}
      />
    </div>
  );
};

export default VoicePanel;
