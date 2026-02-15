/**
 * AI Chat Store - Manages AI chat sessions and model selection
 *
 * Uses WebSocket for streaming responses and REST for session management.
 * Persists conversations to localStorage for cross-session continuity.
 */

import { create } from 'zustand';
import usePOIStore from './usePOIStore';
import useDestinationStore from './useDestinationStore';
import useTripStore from './useTripStore';
import useAuthStore from './useAuthStore';
import authFetch from '../utils/authFetch';
import {
  saveConversation,
  loadConversation,
  listConversations,
  deleteConversation as deleteConversationStorage,
  getActiveConversationId,
  setActiveConversationId,
} from '../utils/conversationStorage';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

// Build WebSocket URL — handles both absolute (http://...) and relative (/chat) paths
let WS_URL;
if (ORCHESTRATOR_URL.startsWith('http')) {
  WS_URL = ORCHESTRATOR_URL.replace(/^http/, 'ws');
} else {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  WS_URL = `${wsProto}//${window.location.host}${ORCHESTRATOR_URL}`;
}
const SETTINGS_KEY = 'travel-ruter-settings';

// Tools that mutate data and require frontend store invalidation
const MUTATING_TOOLS = {
  manage_poi:          { stores: ['poi', 'trip'] },
  schedule_pois:       { stores: ['poi'] },
  manage_destination:  { stores: ['destination', 'trip'] },
  manage_trip:         { stores: ['trip'] },
};

// Default agent configuration
const DEFAULT_AGENT_CONFIG = {
  name: 'Travel Assistant',
  systemPrompt: '',
  appTools: {
    search_destinations: true,
    get_poi_suggestions: true,
    calculate_route: true,
    get_travel_matrix: true,
    manage_trip: true,
    manage_destination: true,
    manage_poi: true,
    schedule_pois: true,
    generate_smart_schedule: true,
    calculate_budget: true,
  },
  externalTools: {
    perplexity_search: true,
    web_search: true,
    weather_forecast: true,
    currency_conversion: true,
  },
};

/**
 * Message structure:
 * {
 *   id: string,
 *   role: 'user' | 'assistant' | 'system' | 'tool',
 *   content: string,
 *   timestamp: Date,
 *   toolCalls?: Array<{ id, name, arguments }>,
 *   toolResults?: Array<{ toolCallId, content, isError }>,
 *   isStreaming?: boolean,
 *   isContextChange?: boolean,  // Visual divider for destination switches
 * }
 */

// Load agent config from localStorage
const loadAgentConfig = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_AGENT_CONFIG, ...parsed.agentConfig };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_AGENT_CONFIG;
};

const useAIStore = create((set, get) => ({
  // Connection state
  isConnected: false,
  connectionError: null,

  // Session state
  sessionId: null,
  messages: [],
  isLoading: false,
  streamingMessageId: null,

  // Conversation persistence
  conversationId: null,
  conversations: [],
  showHistory: false,

  // Model selection
  models: [],
  selectedModelId: null,
  modelsLoading: false,

  // Trip context
  tripContext: null,
  destinationContext: null, // Rich context about current destination view
  selectedTripId: null, // Currently selected trip for chat context
  chatMode: null, // 'existing' | 'new' | null (selection screen)

  // Agent customization
  agentConfig: loadAgentConfig(),

  // WebSocket instance
  _ws: null,
  _messageIdCounter: 0,
  _reconnectAttempts: 0,
  _reconnectTimer: null,
  _maxReconnectAttempts: 5,
  _refetchTimer: null,

  // Actions

  /**
   * Initialize the AI store - fetch available models
   */
  initialize: async () => {
    set({ modelsLoading: true });

    try {
      const response = await authFetch(`${ORCHESTRATOR_URL}/api/models`);
      if (!response.ok) throw new Error('Failed to fetch models');

      const data = await response.json();
      const models = data.models || [];

      // Check localStorage for a user-saved default model
      let savedDefault = null;
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          savedDefault = parsed.ai?.defaultModel;
        }
      } catch { /* ignore */ }

      // Use saved default if it's a valid model, otherwise fall back to backend default
      const validSaved = savedDefault && models.some(m => m.id === savedDefault);
      const selectedModelId = validSaved ? savedDefault : (data.default || models[0]?.id);

      set({
        models,
        selectedModelId,
        modelsLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize AI store:', error);
      set({
        modelsLoading: false,
        connectionError: error.message,
      });
    }
  },

  /**
   * Select a model
   */
  selectModel: (modelId) => {
    const { models } = get();
    if (models.some(m => m.id === modelId)) {
      set({ selectedModelId: modelId });
    }
  },

  /**
   * Set trip context for the AI session
   */
  setTripContext: (context) => {
    set({ tripContext: context });
  },

  /**
   * Set rich destination context (POIs, accommodations, coordinates, dates).
   * Instead of clearing messages, PATCHes the backend session context and
   * inserts a visual divider so the user sees the switch inline.
   */
  setDestinationContext: (context) => {
    const { sessionId, tripContext, destinationContext: prev } = get();

    // If no session yet, just store context
    if (!sessionId) {
      set({ destinationContext: context });
      return;
    }

    // PATCH backend session context
    const enrichedContext = tripContext
      ? { ...tripContext, destination: context }
      : { destination: context };

    authFetch(`${ORCHESTRATOR_URL}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripContext: enrichedContext }),
    }).catch((err) => console.warn('Failed to PATCH session context:', err));

    // Insert a visual divider message if destination actually changed
    const prevName = prev?.name || prev?.city;
    const newName = context?.name || context?.city;
    if (prevName && newName && prevName !== newName) {
      const divider = {
        id: `ctx_${Date.now()}`,
        role: 'system',
        isContextChange: true,
        content: newName,
        timestamp: new Date(),
      };
      set((state) => ({
        destinationContext: context,
        messages: [...state.messages, divider],
      }));
    } else {
      set({ destinationContext: context });
    }
  },

  /**
   * Select a trip for the chat context.
   * Auto-saves the current conversation and attempts to restore the
   * most recent conversation for the target trip.
   */
  selectTripForChat: async (tripId, tripData = null) => {
    // Auto-save current conversation before switching
    await get()._autoSaveConversation();

    const chatMode = tripId ? 'existing' : 'new';

    // Check if there's a saved conversation for this trip
    const activeId = getActiveConversationId(tripId);
    if (activeId) {
      const saved = loadConversation(activeId);
      if (saved) {
        set({
          selectedTripId: tripId,
          tripContext: tripData,
          chatMode,
          conversationId: saved.id,
          messages: saved.messages || [],
          destinationContext: saved.destinationContext || null,
          sessionId: null, // Will create new backend session on next message
        });
        get().loadConversationsList();
        return;
      }
    }

    // No saved conversation — start fresh
    set({
      selectedTripId: tripId,
      tripContext: tripData,
      chatMode,
      messages: [],
      sessionId: null,
      conversationId: null,
    });
    get().loadConversationsList();
  },

  /**
   * Start a new trip planning session (fresh start)
   */
  startNewTripChat: () => {
    get()._autoSaveConversation();
    set({
      selectedTripId: null,
      tripContext: null,
      chatMode: 'new',
      messages: [],
      sessionId: null,
      conversationId: null,
    });
  },

  /**
   * Go back to trip selection — auto-save before leaving
   */
  backToTripSelection: () => {
    get()._autoSaveConversation();
    set({
      chatMode: null,
      showHistory: false,
    });
  },

  // ---------------------------------------------------------------------------
  // Conversation persistence actions
  // ---------------------------------------------------------------------------

  /**
   * Auto-save the current conversation to localStorage.
   * Fetches backend history for AI memory continuity when available.
   */
  _autoSaveConversation: async () => {
    const {
      messages, sessionId, selectedTripId, selectedModelId,
      tripContext, destinationContext,
    } = get();

    if (!messages.length) return;

    const convId = get().conversationId || crypto.randomUUID();
    if (!get().conversationId) {
      set({ conversationId: convId });
    }

    // Fetch backend history for AI memory
    let backendHistory = null;
    if (sessionId) {
      try {
        const res = await authFetch(`${ORCHESTRATOR_URL}/api/sessions/${sessionId}/history`);
        if (res.ok) {
          const data = await res.json();
          backendHistory = data.messageHistory;
        }
      } catch {
        // Non-critical — save without backend history
      }
    }

    saveConversation({
      id: convId,
      tripId: selectedTripId,
      messages,
      backendHistory,
      modelId: selectedModelId,
      tripContext,
      destinationContext,
    });

    setActiveConversationId(selectedTripId, convId);
  },

  /**
   * Load a saved conversation by ID. Creates a new backend session
   * with restored message history for AI memory continuity.
   */
  loadConversation: async (id) => {
    const saved = loadConversation(id);
    if (!saved) return;

    set({
      conversationId: saved.id,
      messages: saved.messages || [],
      destinationContext: saved.destinationContext || null,
      sessionId: null,
      showHistory: false,
    });

    // Create a new backend session pre-seeded with saved history
    if (saved.backendHistory?.length) {
      try {
        const { selectedModelId, tripContext, destinationContext, agentConfig, chatMode } = get();
        const enrichedContext = tripContext
          ? { ...tripContext, ...(destinationContext && { destination: destinationContext }) }
          : destinationContext ? { destination: destinationContext } : null;

        const res = await authFetch(`${ORCHESTRATOR_URL}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModelId,
            tripContext: enrichedContext,
            agentConfig: {
              name: agentConfig.name,
              systemPrompt: agentConfig.systemPrompt,
              enabledTools: [
                ...Object.entries(agentConfig.appTools || {}).filter(([, v]) => v).map(([k]) => k),
                ...Object.entries(agentConfig.externalTools || {}).filter(([, v]) => v).map(([k]) => k),
              ],
            },
            chatMode,
            messageHistory: saved.backendHistory,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          set({ sessionId: data.sessionId, connectionError: null });
        }
      } catch (err) {
        console.warn('Failed to restore backend session:', err);
      }
    }

    setActiveConversationId(saved.tripId, saved.id);
  },

  /**
   * Start a new conversation — saves current one first.
   */
  startNewConversation: async () => {
    await get()._autoSaveConversation();
    set({
      messages: [],
      sessionId: null,
      conversationId: null,
      showHistory: false,
    });
    get().loadConversationsList();
  },

  /**
   * Load the conversation list for the current trip from localStorage.
   */
  loadConversationsList: () => {
    const { selectedTripId } = get();
    const list = listConversations(selectedTripId);
    set({ conversations: list });
  },

  /**
   * Toggle the history panel visibility.
   */
  toggleHistory: () => {
    const { showHistory } = get();
    if (!showHistory) {
      get().loadConversationsList();
    }
    set({ showHistory: !showHistory });
  },

  /**
   * Load a conversation from the selection screen (before chat mode is set).
   * Restores chatMode, tripContext, and messages from the saved conversation.
   */
  loadConversationFromHistory: async (id) => {
    const saved = loadConversation(id);
    if (!saved) return;

    const chatMode = saved.tripId ? 'existing' : 'new';

    set({
      conversationId: saved.id,
      messages: saved.messages || [],
      destinationContext: saved.destinationContext || null,
      tripContext: saved.tripContext || null,
      selectedTripId: saved.tripId || null,
      chatMode,
      sessionId: null,
      showHistory: false,
    });

    // Create a new backend session pre-seeded with saved history
    if (saved.backendHistory?.length) {
      try {
        const { selectedModelId, tripContext, destinationContext, agentConfig } = get();
        const enrichedContext = tripContext
          ? { ...tripContext, ...(destinationContext && { destination: destinationContext }) }
          : destinationContext ? { destination: destinationContext } : null;

        const res = await authFetch(`${ORCHESTRATOR_URL}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModelId,
            tripContext: enrichedContext,
            agentConfig: {
              name: agentConfig.name,
              systemPrompt: agentConfig.systemPrompt,
              enabledTools: [
                ...Object.entries(agentConfig.appTools || {}).filter(([, v]) => v).map(([k]) => k),
                ...Object.entries(agentConfig.externalTools || {}).filter(([, v]) => v).map(([k]) => k),
              ],
            },
            chatMode,
            messageHistory: saved.backendHistory,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          set({ sessionId: data.sessionId, connectionError: null });
        }
      } catch (err) {
        console.warn('Failed to restore backend session:', err);
      }
    }

    setActiveConversationId(saved.tripId, saved.id);
    get().loadConversationsList();
  },

  /**
   * Remove a conversation from localStorage and state.
   */
  removeConversation: (id) => {
    deleteConversationStorage(id);

    const { conversationId } = get();
    if (conversationId === id) {
      set({ messages: [], sessionId: null, conversationId: null });
    }

    get().loadConversationsList();
  },

  // ---------------------------------------------------------------------------
  // Agent configuration
  // ---------------------------------------------------------------------------

  /**
   * Update agent configuration
   */
  updateAgentConfig: (updates) => {
    const newConfig = { ...get().agentConfig, ...updates };
    set({ agentConfig: newConfig });

    // Persist to localStorage
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.agentConfig = newConfig;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  },

  /**
   * Toggle a specific tool
   */
  toggleTool: (category, toolName) => {
    const { agentConfig } = get();
    const newConfig = {
      ...agentConfig,
      [category]: {
        ...agentConfig[category],
        [toolName]: !agentConfig[category]?.[toolName],
      },
    };
    get().updateAgentConfig(newConfig);
  },

  /**
   * Reset agent config to defaults
   */
  resetAgentConfig: () => {
    set({ agentConfig: DEFAULT_AGENT_CONFIG });
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.agentConfig = DEFAULT_AGENT_CONFIG;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  },

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Create a new chat session
   */
  createSession: async () => {
    const { selectedModelId, tripContext, destinationContext, agentConfig, chatMode } = get();

    // Merge destination context into trip context for the orchestrator
    const enrichedContext = tripContext
      ? { ...tripContext, ...(destinationContext && { destination: destinationContext }) }
      : destinationContext ? { destination: destinationContext } : null;

    try {
      const response = await authFetch(`${ORCHESTRATOR_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModelId,
          tripContext: enrichedContext,
          agentConfig: {
            name: agentConfig.name,
            systemPrompt: agentConfig.systemPrompt,
            enabledTools: [
              ...Object.entries(agentConfig.appTools || {}).filter(([, v]) => v).map(([k]) => k),
              ...Object.entries(agentConfig.externalTools || {}).filter(([, v]) => v).map(([k]) => k),
            ],
          },
          chatMode,
        }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();

      // Assign a conversation ID if we don't have one yet
      const convId = get().conversationId || crypto.randomUUID();

      set({
        sessionId: data.sessionId,
        conversationId: convId,
        connectionError: null,
      });

      return data.sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      set({ connectionError: error.message });
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  /**
   * Connect WebSocket for streaming with auto-reconnect
   */
  connectWebSocket: () => {
    const { _ws, _reconnectTimer } = get();

    // Clear any pending reconnect timer
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      set({ _reconnectTimer: null });
    }

    // Close existing connection
    if (_ws) {
      _ws.close();
    }

    const ws = new WebSocket(`${WS_URL}/api/chat/stream`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Send JWT auth handshake
      const token = useAuthStore?.getState()?.token;
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
      set({ isConnected: true, connectionError: null, _reconnectAttempts: 0 });
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code);
      set({ isConnected: false, _ws: null });

      // Auto-reconnect with exponential backoff (skip if intentional close)
      if (event.code !== 1000) {
        const { _reconnectAttempts, _maxReconnectAttempts, chatMode } = get();
        if (_reconnectAttempts < _maxReconnectAttempts && chatMode) {
          const delay = Math.min(1000 * Math.pow(2, _reconnectAttempts), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${_reconnectAttempts + 1})`);
          const timer = setTimeout(() => {
            const { chatMode, _reconnectAttempts: currentAttempts } = get();
            if (!chatMode) return; // Don't reconnect if chat closed
            set({ _reconnectAttempts: currentAttempts + 1 });
            get().connectWebSocket();
          }, delay);
          set({ _reconnectTimer: timer });
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      set({ connectionError: 'Connection lost. Reconnecting...' });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        get()._handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    set({ _ws: ws });
  },

  /**
   * Handle incoming WebSocket messages
   * Uses functional set() to avoid stale state during rapid streaming
   */
  _handleWebSocketMessage: (data) => {
    switch (data.type) {
      case 'start': {
        const newMessage = {
          id: data.messageId,
          role: 'assistant',
          content: '',
          parts: [],
          timestamp: new Date(),
          isStreaming: true,
        };
        set((state) => ({
          messages: [...state.messages, newMessage],
          streamingMessageId: data.messageId,
          isLoading: true,
        }));
        break;
      }

      case 'chunk': {
        set((state) => {
          const { streamingMessageId } = state;
          const messages = state.messages.map(m => {
            if (m.id !== streamingMessageId) return m;

            const updated = { ...m };
            const parts = [...(m.parts || [])];

            if (data.content) {
              updated.content = m.content + data.content;
              // Append to last text part or create a new one
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === 'text') {
                parts[parts.length - 1] = { ...lastPart, content: lastPart.content + data.content };
              } else {
                parts.push({ type: 'text', content: data.content });
              }
            }

            if (data.toolCall) {
              updated.toolCalls = [...(m.toolCalls || []), data.toolCall];
              // Group consecutive tool calls together
              const lastPart = parts[parts.length - 1];
              if (lastPart && lastPart.type === 'toolGroup') {
                parts[parts.length - 1] = {
                  ...lastPart,
                  toolCalls: [...lastPart.toolCalls, { ...data.toolCall, result: null }],
                };
              } else {
                parts.push({ type: 'toolGroup', toolCalls: [{ ...data.toolCall, result: null }] });
              }
            }

            if (data.toolResult) {
              const result = {
                toolCallId: data.toolResult.toolCallId,
                content: data.toolResult.content,
                isError: data.toolResult.isError || false,
              };
              updated.toolResults = [...(m.toolResults || []), result];
              // Find and update the matching tool call in its toolGroup
              for (let i = 0; i < parts.length; i++) {
                if (parts[i].type === 'toolGroup') {
                  const tcIdx = parts[i].toolCalls.findIndex(tc => tc.id === data.toolResult.toolCallId);
                  if (tcIdx !== -1) {
                    const newToolCalls = [...parts[i].toolCalls];
                    newToolCalls[tcIdx] = { ...newToolCalls[tcIdx], result };
                    parts[i] = { ...parts[i], toolCalls: newToolCalls };
                    break;
                  }
                }
              }
            }

            updated.parts = parts;
            return updated;
          });

          return { messages };
        });
        break;
      }

      case 'end': {
        // Collect which mutating tools were called successfully in this message
        const currentState = get();
        const streamMsg = currentState.messages.find(m => m.id === currentState.streamingMessageId);
        const storesToRefresh = new Set();

        if (streamMsg?.toolCalls) {
          for (const tc of streamMsg.toolCalls) {
            const toolConfig = MUTATING_TOOLS[tc.name];
            if (!toolConfig) continue;
            // Check if this tool call got a successful (non-error) result
            const result = streamMsg.toolResults?.find(r => r.toolCallId === tc.id);
            if (result && !result.isError) {
              toolConfig.stores.forEach(s => storesToRefresh.add(s));
            }
          }
        }

        set((state) => ({
          messages: state.messages.map(m =>
            m.id === state.streamingMessageId
              ? { ...m, isStreaming: false }
              : m
          ),
          streamingMessageId: null,
          isLoading: false,
        }));

        // Auto-save conversation after each completed exchange
        setTimeout(() => get()._autoSaveConversation(), 500);

        // Trigger refetches on affected stores (debounced to batch multiple tool calls)
        if (storesToRefresh.size > 0) {
          // Clear any pending refetch timer
          if (get()._refetchTimer) {
            clearTimeout(get()._refetchTimer);
          }
          const timer = setTimeout(() => {
            const { selectedTripId, destinationContext } = get();
            const destinationId = destinationContext?.id || destinationContext?.destinationId;

            if (storesToRefresh.has('poi') && destinationId) {
              usePOIStore.getState().fetchPOIsByDestination(destinationId);
            }
            if (storesToRefresh.has('destination') && selectedTripId) {
              useDestinationStore.getState().fetchDestinations(selectedTripId);
            }
            if (storesToRefresh.has('trip')) {
              useTripStore.getState().fetchTripsSummary();
              if (selectedTripId) {
                useTripStore.getState().fetchTripDetails(selectedTripId);
              }
            }
            set({ _refetchTimer: null });
          }, 300);
          set({ _refetchTimer: timer });
        }
        break;
      }

      case 'error': {
        console.error('Stream error:', data.error);
        set((state) => ({
          messages: state.messages.map(m =>
            m.id === state.streamingMessageId
              ? {
                  ...m,
                  content: m.content + `\n\n**Error:** ${data.error}`,
                  isStreaming: false,
                }
              : m
          ),
          streamingMessageId: null,
          isLoading: false,
          connectionError: data.error,
        }));
        break;
      }

      default:
        console.warn('Unknown message type:', data.type);
    }
  },

  /**
   * Send a message (streaming)
   */
  sendMessage: async (content) => {
    if (!content.trim()) return;

    const { sessionId, isConnected, _ws } = get();

    // Ensure we have a session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await get().createSession();
    }

    // Ensure WebSocket is connected
    if (!isConnected || !_ws) {
      get().connectWebSocket();
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        const checkConnection = setInterval(() => {
          if (get().isConnected) {
            clearInterval(checkConnection);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });
    }

    // Add user message using functional update to avoid stale state
    const userMessageId = `user_${get()._messageIdCounter}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      _messageIdCounter: state._messageIdCounter + 1,
      isLoading: true,
    }));

    // Send via WebSocket
    get()._ws.send(JSON.stringify({
      type: 'chat',
      sessionId: currentSessionId,
      message: content.trim(),
    }));
  },

  /**
   * Cancel current streaming response
   */
  cancelResponse: () => {
    const { _ws, sessionId, streamingMessageId, messages } = get();

    if (_ws && sessionId) {
      _ws.send(JSON.stringify({
        type: 'cancel',
        sessionId,
      }));
    }

    // Mark streaming message as cancelled
    if (streamingMessageId) {
      set({
        messages: messages.map(m =>
          m.id === streamingMessageId
            ? { ...m, content: m.content + '\n\n*[Cancelled]*', isStreaming: false }
            : m
        ),
        streamingMessageId: null,
        isLoading: false,
      });
    }
  },

  /**
   * Clear chat history
   */
  clearMessages: () => {
    set({ messages: [], sessionId: null, conversationId: null });
  },

  /**
   * Disconnect and cleanup — auto-save before closing
   */
  disconnect: () => {
    get()._autoSaveConversation();
    const { _ws, _reconnectTimer } = get();
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }
    if (_ws) {
      _ws.close(1000); // Normal closure - won't trigger reconnect
    }
    set({
      _ws: null,
      isConnected: false,
      sessionId: null,
      _reconnectTimer: null,
      _reconnectAttempts: 0,
    });
  },

  /**
   * Send a non-streaming message (for simple cases)
   */
  sendMessageSync: async (content) => {
    const { sessionId, messages, _messageIdCounter } = get();

    if (!content.trim()) return;

    // Ensure we have a session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await get().createSession();
    }

    // Add user message
    const userMessageId = `user_${_messageIdCounter}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    set({
      messages: [...messages, userMessage],
      _messageIdCounter: _messageIdCounter + 1,
      isLoading: true,
    });

    try {
      const response = await authFetch(`${ORCHESTRATOR_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: content.trim(),
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();

      // Add assistant message
      const assistantMessage = {
        id: `assistant_${get()._messageIdCounter}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        _messageIdCounter: state._messageIdCounter + 1,
        isLoading: false,
      }));

      // Auto-save after sync message
      setTimeout(() => get()._autoSaveConversation(), 500);

      return data.response;
    } catch (error) {
      console.error('Chat request failed:', error);
      set({
        isLoading: false,
        connectionError: error.message,
      });
      throw error;
    }
  },
}));

export default useAIStore;
