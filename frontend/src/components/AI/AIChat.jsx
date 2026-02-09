/**
 * AIChat - Main AI chat component combining button and side panel
 * This component should be included in the Layout for app-wide availability.
 * The panel sits in-flow (not floating) so the main content shrinks to make room.
 */

import React, { useEffect, useState } from 'react';
import AIChatButton from './AIChatButton';
import AIChatSlideover from './AIChatSlideover';
import useAIStore from '../../stores/useAIStore';

const SETTINGS_KEY = 'travel-ruter-settings';

const AIChat = ({ tripContext = null, isOpen, onToggle, onClose }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const { isLoading } = useAIStore();

  // Load enabled state from settings
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setIsEnabled(parsed.ai?.enabled !== false);
      }
    } catch {
      // Ignore parse errors, default to enabled
    }
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setIsEnabled(parsed.ai?.enabled !== false);
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Keyboard shortcut to toggle chat (Ctrl/Cmd + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        onToggle();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle, onClose]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating button - hidden when panel is open */}
      {!isOpen && (
        <AIChatButton
          isOpen={false}
          onClick={onToggle}
          hasUnread={false}
          isLoading={isLoading}
        />
      )}

      {/* Side panel - renders in-flow within the Layout flex container */}
      <div
        className={`flex-shrink-0 h-screen transition-[width] duration-300 ease-out overflow-hidden ${
          isOpen ? 'w-[420px]' : 'w-0'
        }`}
      >
        <div className="w-[420px] h-full">
          <AIChatSlideover
            isOpen={isOpen}
            onClose={onClose}
            tripContext={tripContext}
          />
        </div>
      </div>
    </>
  );
};

export default AIChat;
