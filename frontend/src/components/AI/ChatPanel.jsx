/**
 * ChatPanel - Main AI chat interface component
 *
 * Can be used as a collapsible sidebar or modal.
 */

import React, { useState, useEffect, useRef } from 'react';
import useAIStore from '../../stores/useAIStore';
import ModelSelector from './ModelSelector';
import StreamingMessage from './StreamingMessage';
import './ChatPanel.css';

const ChatPanel = ({
  isOpen = true,
  onClose,
  tripContext = null,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    messages,
    isLoading,
    isConnected,
    connectionError,
    initialize,
    sendMessage,
    cancelResponse,
    clearMessages,
    setTripContext,
    connectWebSocket,
  } = useAIStore();

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Set trip context when provided
  useEffect(() => {
    if (tripContext) {
      setTripContext(tripContext);
    }
  }, [tripContext, setTripContext]);

  // Connect WebSocket when panel opens
  useEffect(() => {
    if (isOpen && !isConnected) {
      connectWebSocket();
    }
  }, [isOpen, isConnected, connectWebSocket]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter, allow Shift+Enter for newlines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`chat-panel ${className}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">&#x1F916;</span>
          <span>Travel AI Assistant</span>
        </div>
        <div className="chat-actions">
          <ModelSelector />
          <button
            className="btn-icon"
            onClick={clearMessages}
            title="Clear chat"
            disabled={isLoading}
          >
            &#x1F5D1;
          </button>
          {onClose && (
            <button className="btn-icon btn-close" onClick={onClose} title="Close">
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Connection status */}
      {connectionError && (
        <div className="connection-error">
          <span>&#x26A0;</span> {connectionError}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">&#x1F30D;</div>
            <h3>Plan your perfect trip</h3>
            <p>Ask me about destinations, attractions, schedules, and more!</p>
            <div className="suggestions">
              <button
                className="suggestion-chip"
                onClick={() => sendMessage('What attractions are there in Paris?')}
              >
                Attractions in Paris
              </button>
              <button
                className="suggestion-chip"
                onClick={() => sendMessage('Help me plan a 3-day trip to Rome')}
              >
                3-day Rome trip
              </button>
              <button
                className="suggestion-chip"
                onClick={() => sendMessage('What are the best restaurants near the Eiffel Tower?')}
              >
                Restaurants near Eiffel Tower
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <StreamingMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about destinations, attractions, schedules..."
            disabled={isLoading}
            rows={1}
            className="chat-input"
          />
          {isLoading ? (
            <button
              type="button"
              className="btn-send btn-cancel"
              onClick={cancelResponse}
              title="Cancel"
            >
              &#x25A0;
            </button>
          ) : (
            <button
              type="submit"
              className="btn-send"
              disabled={!inputValue.trim()}
              title="Send"
            >
              &#x27A4;
            </button>
          )}
        </div>
        <div className="input-hint">
          {isConnected ? (
            <span className="status-connected">&#x2022; Connected</span>
          ) : (
            <span className="status-disconnected">&#x2022; Connecting...</span>
          )}
          <span className="hint-text">Press Enter to send, Shift+Enter for new line</span>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
