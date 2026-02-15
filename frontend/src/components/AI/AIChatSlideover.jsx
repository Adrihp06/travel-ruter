/**
 * AIChatSlideover - Claude-style AI chat panel
 * Clean, minimal design with clear tool transparency
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  Trash2,
  Send,
  Square,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Plus,
  User,
  Copy,
  Clock,
} from 'lucide-react';
import XIcon from '@/components/icons/x-icon';
import SparklesIcon from '@/components/icons/sparkles-icon';
import CheckedIcon from '@/components/icons/checked-icon';
import RefreshIcon from '@/components/icons/refresh-icon';
import useAIStore from '../../stores/useAIStore';
import TripSelector from './TripSelector';
import ToolCallDisplay from './ToolCallDisplay';
import ThinkingIndicator from './ThinkingIndicator';
import ConnectionStatus from './ConnectionStatus';
import ConversationHistory from './ConversationHistory';

// Claude AI avatar component
const ClaudeAvatar = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-[#D97706] to-[#EA580C] flex items-center justify-center flex-shrink-0 shadow-sm`}>
      <SparklesIcon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} style={{ color: 'white' }} />
    </div>
  );
};

// User avatar component
const UserAvatar = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`${sizes[size]} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0`}>
      <User className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} style={{ color: '#6B7280' }} />
    </div>
  );
};

// Typing indicator - uses ThinkingIndicator in minimal mode
const TypingIndicator = () => <ThinkingIndicator minimal />;

// Format markdown content to HTML (pure function, used by memoization)
const formatMarkdown = (content) => {
  if (!content) return '';
  let formatted = content;

  // Code blocks
  formatted = formatted.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    '<pre class="my-3 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-x-auto"><code class="text-sm font-mono text-gray-800 dark:text-gray-200">$2</code></pre>'
  );

  // Inline code
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-[#D97706]">$1</code>'
  );

  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Headers
  formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>');

  // Lists
  formatted = formatted.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');

  // Tables (basic support)
  formatted = formatted.replace(/\|([^|]+)\|/g, '<span class="inline-block px-2 py-1 border-b border-gray-200 dark:border-gray-700">$1</span>');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br />');

  // Sanitize to prevent XSS
  return DOMPurify.sanitize(formatted, {
    ALLOWED_TAGS: ['pre', 'code', 'strong', 'em', 'h2', 'h3', 'li', 'br', 'span', 'p', 'ul', 'ol'],
    ALLOWED_ATTR: ['class'],
  });
};

// Message component with Claude-style design
const ChatMessage = React.memo(({ message, agentName, onCopy, onRetry }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Memoize formatted content to avoid re-running regex on every render
  const formattedContent = useMemo(
    () => formatMarkdown(message.content),
    [message.content]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <div className={`group relative ${isUser ? 'ml-12' : 'mr-8'}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 pt-1">
            <ClaudeAvatar size="md" />
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
          {/* Name */}
          <div className={`text-xs font-medium mb-1 ${isUser ? 'text-gray-500 dark:text-gray-400' : 'text-[#D97706]'}`}>
            {isUser ? t('ai.you') : agentName || t('ai.travelAssistant')}
          </div>

          {/* Message bubble */}
          <div
            className={`inline-block text-left max-w-full ${
              isUser
                ? 'bg-[#D97706] text-white rounded-2xl rounded-tr-md px-4 py-2.5'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {/* Typing indicator for streaming with no content */}
            {isAssistant && message.isStreaming && !message.content && !message.toolCalls?.length && (
              <TypingIndicator />
            )}

            {/* Render parts in chronological order */}
            {isAssistant && message.parts?.length > 0 ? (
              <>
                {message.parts.map((part, idx) => {
                  if (part.type === 'text') {
                    const html = formatMarkdown(part.content);
                    return (
                      <div
                        key={`text-${idx}`}
                        className="text-[15px] leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    );
                  }
                  if (part.type === 'toolGroup') {
                    return (
                      <ToolCallDisplay
                        key={`tools-${idx}`}
                        toolCalls={part.toolCalls}
                        isStreaming={message.isStreaming}
                      />
                    );
                  }
                  return null;
                })}
                {/* Streaming cursor */}
                {message.isStreaming && message.content && (
                  <span className="inline-block w-1.5 h-5 ml-0.5 bg-[#D97706] animate-pulse rounded-sm" />
                )}
              </>
            ) : (
              <>
                {/* Fallback for messages without parts (e.g. non-streaming REST) */}
                {isAssistant && message.toolCalls?.length > 0 && (
                  <ToolCallDisplay
                    toolCalls={message.toolCalls}
                    isStreaming={message.isStreaming}
                    toolResults={message.toolResults}
                  />
                )}
                {message.content && (
                  <div
                    className={`text-[15px] leading-relaxed prose prose-sm max-w-none ${
                      isUser ? 'prose-invert' : 'dark:prose-invert'
                    }`}
                    dangerouslySetInnerHTML={{ __html: formattedContent }}
                  />
                )}
                {isAssistant && message.isStreaming && message.content && (
                  <span className="inline-block w-1.5 h-5 ml-0.5 bg-[#D97706] animate-pulse rounded-sm" />
                )}
              </>
            )}
          </div>

          {/* Action buttons for assistant messages */}
          {isAssistant && !message.isStreaming && message.content && (
            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckedIcon className="w-3.5 h-3.5" />
                    {t('ai.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {t('ai.copy')}
                  </>
                )}
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <RefreshIcon className="w-3.5 h-3.5" />
                  {t('ai.retry')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* User avatar */}
        {isUser && (
          <div className="flex-shrink-0 pt-1">
            <UserAvatar size="md" />
          </div>
        )}
      </div>
    </div>
  );
});

const AIChatSlideover = ({ isOpen, onClose, tripContext = null }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const {
    messages,
    isLoading,
    isConnected,
    connectionError,
    models,
    selectedModelId,
    selectModel,
    initialize,
    sendMessage,
    cancelResponse,
    clearMessages,
    setTripContext,
    selectTripForChat,
    connectWebSocket,
    disconnect,
    chatMode,
    selectedTripId,
    tripContext: currentTripContext,
    backToTripSelection,
    agentConfig,
    showHistory,
    toggleHistory,
    startNewConversation,
  } = useAIStore();

  // Initialize on mount and auto-select trip when context provided externally
  useEffect(() => {
    if (isOpen) {
      initialize();
      // Auto-select trip from Layout context (e.g. when on /trips/:id)
      if (tripContext && tripContext.id && !chatMode) {
        selectTripForChat(tripContext.id, tripContext);
      }
    }
  }, [isOpen, initialize, tripContext, chatMode, selectTripForChat]);

  // Connect WebSocket when panel opens and we're in chat mode
  useEffect(() => {
    if (isOpen && chatMode && !isConnected) {
      connectWebSocket();
    }
    return () => {
      if (!isOpen) disconnect();
    };
  }, [isOpen, chatMode, isConnected, connectWebSocket, disconnect]);

  // Track whether the user is near the bottom of the chat
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Consider "near bottom" if within 150px of the end
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  // Auto-scroll only when the user is already near the bottom
  useEffect(() => {
    if (isNearBottomRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when entering chat mode
  useEffect(() => {
    if (isOpen && chatMode) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, chatMode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-grow textarea
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // Get current model info
  const currentModel = models.find(m => m.id === selectedModelId);

  // Context-aware suggestions
  const getSuggestions = useCallback(() => {
    if (chatMode === 'new') {
      return [
        { text: 'Plan a week in Japan', emoji: '🇯🇵' },
        { text: 'Budget trip to Italy', emoji: '🇮🇹' },
        { text: 'Beach vacation in Greece', emoji: '🏖️' },
        { text: 'Road trip through Spain', emoji: '🚗' },
      ];
    }
    if (currentTripContext?.name) {
      return [
        { text: 'Find top attractions nearby', emoji: '📍' },
        { text: 'Create an optimized schedule', emoji: '📅' },
        { text: 'Suggest local restaurants', emoji: '🍽️' },
        { text: 'Calculate my trip budget', emoji: '💰' },
      ];
    }
    return [
      { text: 'Plan a trip to Paris', emoji: '🗼' },
      { text: 'Best time to visit Barcelona', emoji: '🌞' },
      { text: 'Create a 3-day Rome itinerary', emoji: '🏛️' },
      { text: 'Find hidden gems in Amsterdam', emoji: '💎' },
    ];
  }, [chatMode, currentTripContext?.name]);

  // Don't render any content when closed to avoid DOM bloat and background activity
  if (!isOpen) return null;

  return (
      <div
        className="w-full h-full bg-white dark:bg-gray-900 flex flex-col border-l border-gray-200 dark:border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {chatMode && (
              <button
                onClick={backToTripSelection}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title={t('ai.backToTripSelection')}
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <ClaudeAvatar size="lg" />
            <div>
              <h2 className="text-gray-900 dark:text-white font-semibold">
                {agentConfig.name || t('ai.travelAssistant')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1.5">
                {chatMode ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                    {currentModel?.name || t('ai.connecting')}
                  </>
                ) : (
                  t('ai.selectTripToStart')
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {chatMode && (
              <>
                <button
                  onClick={toggleHistory}
                  className={`p-2 rounded-lg transition-colors ${
                    showHistory
                      ? 'bg-[#D97706]/10 text-[#D97706]'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                  title={t('ai.conversationHistory')}
                  disabled={isLoading}
                >
                  <Clock className="w-5 h-5" />
                </button>
                <button
                  onClick={startNewConversation}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title={t('ai.newConversation')}
                  disabled={isLoading}
                >
                  <Plus className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={t('common.close')}
            >
              <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Trip Selection Screen */}
        {!chatMode && <TripSelector />}

        {/* Chat Interface */}
        {chatMode && (
          <>
            {/* Context bar */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
              {chatMode === 'new' ? (
                <div className="flex items-center text-xs bg-[#D97706]/10 text-[#D97706] px-2.5 py-1 rounded-full">
                  <Plus className="w-3 h-3 mr-1" />
                  {t('ai.newTrip')}
                </div>
              ) : currentTripContext?.name ? (
                <div className="flex items-center text-xs bg-[#D97706]/10 text-[#D97706] px-2.5 py-1 rounded-full">
                  <MapPin className="w-3 h-3 mr-1" />
                  {currentTripContext.name}
                </div>
              ) : null}

              {models.length > 1 && (
                <select
                  value={selectedModelId || ''}
                  onChange={(e) => selectModel(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Conversation History Panel */}
            {chatMode && showHistory && <ConversationHistory />}

            {/* Connection Error */}
            {connectionError && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 flex items-center justify-between text-red-700 dark:text-red-300 text-sm">
                <div className="flex items-center min-w-0">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{connectionError}</span>
                </div>
                <button
                  onClick={connectWebSocket}
                  className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-800/40 hover:bg-red-200 dark:hover:bg-red-800/60 rounded transition-colors flex-shrink-0"
                >
                  {t('ai.retry') || 'Retry'}
                </button>
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
              aria-live="polite"
              aria-label={t('ai.chatMessages') || 'Chat messages'}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <ClaudeAvatar size="lg" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
                    {chatMode === 'new' ? t('ai.planDreamTrip') : t('ai.letsPlanTrip', { name: currentTripContext?.name || t('ai.trip') })}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-xs">
                    {chatMode === 'new'
                      ? t('ai.tellMeWhereToGo')
                      : t('ai.helpDiscoverPlaces')}
                  </p>

                  <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                    {getSuggestions().map((suggestion) => (
                      <button
                        key={suggestion.text}
                        onClick={() => sendMessage(suggestion.text)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      >
                        <span className="text-base">{suggestion.emoji}</span>
                        <span className="truncate">{suggestion.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) =>
                  message.isContextChange ? (
                    <div key={message.id} className="flex items-center gap-2 py-2">
                      <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 whitespace-nowrap">
                        <MapPin className="w-3 h-3" />
                        {t('ai.nowViewing', { name: message.content })}
                      </span>
                      <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                    </div>
                  ) : (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      agentName={agentConfig.name}
                    />
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={chatMode === 'new' ? t('ai.whereToGo') : t('ai.askAboutTrip')}
                  disabled={isLoading}
                  rows={1}
                  className="w-full px-4 py-3 pr-24 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706] resize-none text-[15px] transition-shadow overflow-hidden"
                  style={{ minHeight: '52px', maxHeight: '120px' }}
                />

                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={cancelResponse}
                      className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors"
                      title={t('common.cancel')}
                    >
                      <Square className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputValue.trim()}
                      className="p-2 bg-[#D97706] hover:bg-[#B45309] disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 rounded-xl transition-colors disabled:cursor-not-allowed"
                      title={t('ai.sendMessage')}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </form>

              <div className="flex items-center justify-between mt-2 px-1">
                <ConnectionStatus isConnected={isConnected} isConnecting={!isConnected && !connectionError} error={null} />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('ai.sendHint')}</span>
              </div>
            </div>
          </>
        )}
      </div>
  );
};

export default AIChatSlideover;
