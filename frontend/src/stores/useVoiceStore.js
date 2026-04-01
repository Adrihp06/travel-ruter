/**
 * Voice Store – Zustand state for the Gemini Live voice agent.
 *
 * DIRECT CONNECTION: The frontend connects to Gemini Live API directly
 * (no orchestrator WebSocket proxy). Tool calls are handled locally:
 *   - Frontend tools → executed instantly in the browser
 *   - Backend tools  → REST call to orchestrator /api/voice/tool
 *
 * Architecture:
 *   Frontend mic → Gemini WS (direct)
 *   Frontend tool calls → executed locally (instant)
 *   Backend tool calls  → REST POST /api/voice/tool → result → Gemini
 */

import { create } from 'zustand';
import useAuthStore from './useAuthStore';
import {
  executeFrontendTool,
  FRONTEND_TOOL_NAMES,
} from '../utils/voiceFrontendTools';
import {
  BACKEND_TOOL_NAMES,
  TOOL_DECLARATIONS,
  buildSystemPrompt,
} from '../utils/voiceConfig';

// ---------------------------------------------------------------------------
// Orchestrator URL for REST calls (voice/config, voice/tool)
// ---------------------------------------------------------------------------

const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

const API_BASE = ORCHESTRATOR_URL.startsWith('http')
  ? ORCHESTRATOR_URL
  : ORCHESTRATOR_URL;

console.log('[VoiceStore] Orchestrator API base:', API_BASE);

// ---------------------------------------------------------------------------
// Helper: get auth token
// ---------------------------------------------------------------------------

function getAuthToken() {
  return (
    useAuthStore.getState()?.accessToken ||
    useAuthStore.getState()?.getToken?.() ||
    localStorage.getItem('accessToken')
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useVoiceStore = create((set, get) => ({
  // -- Connection -----------------------------------------------------------
  isConnected: false,
  isSessionActive: false,
  connectionError: null,

  // -- Voice state ----------------------------------------------------------
  isListening: false,
  isSpeaking: false,
  isProcessing: false,

  // -- UI -------------------------------------------------------------------
  isOverlayOpen: false,

  // -- Tool calls (for visual feedback) ------------------------------------
  activeToolCalls: [],

  // -- Transcript -----------------------------------------------------------
  transcript: [], // { role: 'user'|'model'|'tool', text, timestamp, toolCall? }

  // -- Trip context ---------------------------------------------------------
  tripContext: null,
  destinationContext: null,
  currentPage: null,

  // -- Internal (prefixed _) ------------------------------------------------
  _ws: null,
  _audioCapture: null,
  _playbackEngine: null,
  _connectTimeout: null,

  // =========================================================================
  // Actions
  // =========================================================================

  toggleOverlay: () => {
    set((state) => ({ isOverlayOpen: !state.isOverlayOpen }));
  },

  setTripContext: (ctx) => set({ tripContext: ctx }),
  setDestinationContext: (ctx) => set({ destinationContext: ctx }),
  setCurrentPage: (page) => set({ currentPage: page }),

  // -------------------------------------------------------------------------
  // Connection lifecycle — DIRECT to Gemini Live API
  // -------------------------------------------------------------------------

  connect: () =>
    new Promise((resolve, reject) => {
      const { _ws } = get();
      if (_ws) {
        try {
          _ws.close();
        } catch {
          /* ignore */
        }
      }

      set({
        isConnected: false,
        isSessionActive: false,
        connectionError: null,
      });
      console.log('[VoiceStore] Starting direct Gemini connection...');

      // --- 10s timeout for entire handshake ---
      const timeout = setTimeout(() => {
        console.error('[VoiceStore] Connection timed out after 10s');
        set({ connectionError: 'Connection timed out. Try again.' });
        reject(new Error('Connection timeout'));
      }, 10000);

      set({ _connectTimeout: timeout });

      // Step 1: Fetch Gemini config (wsUrl + model) from orchestrator REST
      (async () => {
        let token = getAuthToken();
        if (!token) {
          await new Promise((r) => setTimeout(r, 500));
          token = getAuthToken();
        }

        if (!token) {
          clearTimeout(timeout);
          console.error('[VoiceStore] No auth token found');
          set({ connectionError: 'No auth token. Please login first.' });
          reject(new Error('No auth token available'));
          return;
        }

        let configData;
        try {
          console.log('[VoiceStore] Fetching voice config from orchestrator...');
          const resp = await fetch(`${API_BASE}/api/voice/config`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) {
            throw new Error(`Config fetch failed: ${resp.status} ${resp.statusText}`);
          }
          configData = await resp.json();
          console.log('[VoiceStore] Voice config received, model:', configData.model);
        } catch (err) {
          clearTimeout(timeout);
          console.error('[VoiceStore] Failed to fetch voice config:', err);
          set({ connectionError: `Config error: ${err.message}` });
          reject(err);
          return;
        }

        const { wsUrl, model } = configData;
        if (!wsUrl || !model) {
          clearTimeout(timeout);
          const errMsg = 'Invalid voice config: missing wsUrl or model';
          console.error('[VoiceStore]', errMsg);
          set({ connectionError: errMsg });
          reject(new Error(errMsg));
          return;
        }

        // Step 2: Open WebSocket directly to Gemini Live API
        console.log('[VoiceStore] Connecting to Gemini Live WS...');
        let ws;
        try {
          ws = new WebSocket(wsUrl);
        } catch (err) {
          clearTimeout(timeout);
          console.error('[VoiceStore] WebSocket creation failed:', err);
          set({ connectionError: `WebSocket error: ${err.message}` });
          reject(err);
          return;
        }

        let setupSent = false;

        ws.onopen = () => {
          console.log('[VoiceStore] Gemini WS opened, sending setup...');

          // Build system prompt with trip context
          const { tripContext, destinationContext, currentPage } = get();
          const systemPrompt = buildSystemPrompt(
            tripContext,
            destinationContext,
            currentPage || window.location.pathname,
          );

          // Send BidiGenerateContentSetup
          const setupMessage = {
            setup: {
              model,
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede',
                    },
                  },
                },
              },
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              tools: TOOL_DECLARATIONS,
            },
          };

          try {
            ws.send(JSON.stringify(setupMessage));
            setupSent = true;
            console.log('[VoiceStore] Setup message sent to Gemini');
          } catch (err) {
            clearTimeout(timeout);
            console.error('[VoiceStore] Failed to send setup:', err);
            set({ connectionError: `Setup send failed: ${err.message}` });
            reject(err);
          }
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log(
            '[VoiceStore] Gemini WS closed:',
            event.code,
            event.reason,
          );
          const wasConnected = get().isConnected;
          set({ isConnected: false, isSessionActive: false, _ws: null });

          if (!wasConnected && setupSent) {
            set({
              connectionError: `Connection closed: ${event.reason || 'unknown'}`,
            });
            reject(
              new Error(event.reason || 'WebSocket closed during handshake'),
            );
          }
        };

        ws.onerror = (err) => {
          console.error('[VoiceStore] Gemini WS error:', err);
          // onclose will fire after this, so we just log here
        };

        ws.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            console.error('[VoiceStore] Failed to parse Gemini message');
            return;
          }

          // --- setupComplete: handshake done ---
          if ('setupComplete' in data) {
            clearTimeout(timeout);
            console.log(
              '[VoiceStore] Gemini setup complete! Voice session active.',
            );
            set({
              isConnected: true,
              isSessionActive: true,
              connectionError: null,
            });
            resolve();
            return;
          }

          // --- Normal message handling ---
          get()._handleGeminiMessage(data);
        };

        set({ _ws: ws });
      })();
    }),

  disconnect: () => {
    const { _ws, _audioCapture, _playbackEngine, _connectTimeout } = get();

    if (_connectTimeout) clearTimeout(_connectTimeout);

    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.close(1000, 'User disconnected');
    }

    if (_audioCapture) _audioCapture.cleanup();
    if (_playbackEngine) _playbackEngine.cleanup();

    set({
      isConnected: false,
      isSessionActive: false,
      connectionError: null,
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      activeToolCalls: [],
      transcript: [],
      _ws: null,
      _audioCapture: null,
      _playbackEngine: null,
      _connectTimeout: null,
    });
    console.log('[VoiceStore] Disconnected');
  },

  // -------------------------------------------------------------------------
  // Microphone capture — sends audio DIRECTLY to Gemini
  // -------------------------------------------------------------------------

  startListening: async () => {
    let { _audioCapture, _ws } = get();

    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      console.error(
        '[VoiceStore] Cannot start listening: WS not open. readyState:',
        _ws?.readyState,
      );
      set({
        connectionError: 'Not connected. Close and reopen voice panel.',
      });
      return;
    }

    console.log(
      '[VoiceStore] startListening called, _audioCapture:',
      !!_audioCapture,
    );

    // Lazy-init capture pipeline
    if (!_audioCapture) {
      try {
        console.log('[VoiceStore] Initializing audio capture...');
        const { initAudioCapture } = await import('../utils/voiceAudio.js');

        let chunkCount = 0;
        _audioCapture = await initAudioCapture((base64Chunk) => {
          const ws = get()._ws;
          if (ws && ws.readyState === WebSocket.OPEN) {
            // Send audio directly to Gemini in the realtimeInput format
            const msg = {
              realtimeInput: {
                audio: {
                  data: base64Chunk,
                  mimeType: 'audio/pcm;rate=16000',
                },
              },
            };
            ws.send(JSON.stringify(msg));
            chunkCount++;
            if (chunkCount === 1)
              console.log('[VoiceStore] First audio chunk sent to Gemini!');
            if (chunkCount % 20 === 0)
              console.log(`[VoiceStore] Audio chunks sent: ${chunkCount}`);
          }
        });
        set({ _audioCapture });
        console.log('[VoiceStore] Audio capture initialized successfully');
      } catch (err) {
        console.error('[VoiceStore] Failed to init audio capture:', err);
        set({ connectionError: `Microphone error: ${err.message}` });
        return;
      }
    }

    await _audioCapture.start();
    set({ isListening: true });
    console.log('[VoiceStore] Listening started — speak into your mic');
  },

  stopListening: () => {
    const { _audioCapture } = get();
    if (_audioCapture) _audioCapture.stop();
    set({ isListening: false });
    console.log('[VoiceStore] Listening stopped');
  },

  // -------------------------------------------------------------------------
  // Interrupt
  // -------------------------------------------------------------------------

  interrupt: () => {
    const { _playbackEngine } = get();
    // Gemini handles interruption via VAD — just stop local playback
    if (_playbackEngine) _playbackEngine.stop();
    set({ isSpeaking: false });
  },

  // -------------------------------------------------------------------------
  // Incoming Gemini message router
  // -------------------------------------------------------------------------

  _handleGeminiMessage: async (data) => {
    // --- Server content (audio, text, turn signals) ---
    const serverContent = data.serverContent;
    if (serverContent !== undefined) {
      await get()._handleServerContent(serverContent);
      return;
    }

    // --- Tool calls ---
    const toolCall = data.toolCall;
    if (toolCall !== undefined) {
      await get()._handleToolCalls(toolCall);
      return;
    }

    // --- Go away (session expiring) ---
    const goAway = data.goAway;
    if (goAway !== undefined) {
      const timeLeft = goAway.timeLeft || 'unknown';
      console.warn('[VoiceStore] Gemini session ending: timeLeft=', timeLeft);
      set({
        connectionError: `Voice session ending soon (${timeLeft}).`,
      });
      return;
    }

    console.warn(
      '[VoiceStore] Unhandled Gemini message keys:',
      Object.keys(data),
    );
  },

  // -------------------------------------------------------------------------
  // Handle serverContent (audio, text, turn signals)
  // -------------------------------------------------------------------------

  _handleServerContent: async (serverContent) => {
    // Turn complete
    if (serverContent.turnComplete) {
      console.log('[VoiceStore] Turn complete');
      set({ isSpeaking: false, isProcessing: false });
      return;
    }

    // Interrupted
    if (serverContent.interrupted) {
      console.log('[VoiceStore] Interrupted by user');
      const { _playbackEngine } = get();
      if (_playbackEngine) _playbackEngine.stop();
      set({ isSpeaking: false });
      return;
    }

    // Model turn parts (audio and text)
    const modelTurn = serverContent.modelTurn;
    if (!modelTurn) return;

    const parts = modelTurn.parts || [];
    for (const part of parts) {
      // Audio data
      const inlineData = part.inlineData;
      if (inlineData && inlineData.data) {
        let { _playbackEngine } = get();
        if (!_playbackEngine) {
          const { createPlaybackEngine } = await import(
            '../utils/voiceAudio.js'
          );
          _playbackEngine = createPlaybackEngine();
          set({ _playbackEngine });
          console.log('[VoiceStore] Playback engine initialized');
        }
        _playbackEngine.playChunk(inlineData.data);
        set({ isSpeaking: true });
      }

      // Text transcript
      if (part.text) {
        console.log(
          '[VoiceStore] Transcript:',
          part.text.substring(0, 50),
        );
        set((state) => ({
          transcript: [
            ...state.transcript,
            { role: 'model', text: part.text, timestamp: new Date() },
          ],
        }));
      }
    }
  },

  // -------------------------------------------------------------------------
  // Handle tool calls from Gemini — THE KEY CHANGE
  //
  // Frontend tools: executed INSTANTLY (no network)
  // Backend tools:  REST POST to orchestrator /api/voice/tool
  // -------------------------------------------------------------------------

  _handleToolCalls: async (toolCall) => {
    const functionCalls = toolCall.functionCalls || [];
    const functionResponses = [];

    console.log(
      '[VoiceStore] Received',
      functionCalls.length,
      'tool call(s) from Gemini',
    );

    for (const fc of functionCalls) {
      const callId = fc.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = fc.name || '';
      const args = fc.args || {};

      console.log('[VoiceStore] Tool call:', name, JSON.stringify(args).substring(0, 200));

      // Add to active tool calls for UI
      set((state) => ({
        activeToolCalls: [
          ...state.activeToolCalls,
          { id: callId, name, args, status: 'running' },
        ],
        isProcessing: true,
      }));

      let response;

      if (FRONTEND_TOOL_NAMES.has(name)) {
        // --- Frontend tool: execute INSTANTLY (no network) ---
        console.log('[VoiceStore] Executing frontend tool:', name);
        const result = await executeFrontendTool(name, args);
        response = { result: JSON.stringify(result) };

        // Update active tool calls
        set((state) => ({
          activeToolCalls: state.activeToolCalls.map((tc) =>
            tc.id === callId
              ? { ...tc, status: 'complete', result }
              : tc,
          ),
        }));

        // Add to transcript
        set((state) => ({
          transcript: [
            ...state.transcript,
            {
              role: 'tool',
              text: `${name}: ${result.success ? 'OK' : result.error}`,
              timestamp: new Date(),
              toolCall: { id: callId, name, args, result },
            },
          ],
        }));
      } else if (BACKEND_TOOL_NAMES.has(name)) {
        // --- Backend tool: REST call to orchestrator ---
        console.log('[VoiceStore] Executing backend tool via REST:', name);
        try {
          const token = getAuthToken();
          const resp = await fetch(`${API_BASE}/api/voice/tool`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, args }),
          });

          if (!resp.ok) {
            throw new Error(`Tool REST call failed: ${resp.status}`);
          }

          const toolResult = await resp.json();
          console.log('[VoiceStore] Backend tool result for', name, ':', JSON.stringify(toolResult).substring(0, 200));

          response = {
            result: typeof toolResult.result === 'string'
              ? toolResult.result
              : JSON.stringify(toolResult.result || toolResult),
          };

          // Update active tool calls
          set((state) => ({
            activeToolCalls: state.activeToolCalls.map((tc) =>
              tc.id === callId
                ? { ...tc, status: 'complete', result: toolResult }
                : tc,
            ),
          }));

          // Add to transcript
          set((state) => ({
            transcript: [
              ...state.transcript,
              {
                role: 'tool',
                text: `${name}: ${toolResult.isError ? 'Error' : 'OK'}`,
                timestamp: new Date(),
                toolCall: { id: callId, name, args, result: toolResult },
              },
            ],
          }));
        } catch (err) {
          console.error('[VoiceStore] Backend tool error:', name, err);
          response = { result: JSON.stringify({ error: err.message }) };

          set((state) => ({
            activeToolCalls: state.activeToolCalls.map((tc) =>
              tc.id === callId
                ? { ...tc, status: 'error', result: { error: err.message } }
                : tc,
            ),
          }));
        }
      } else {
        // --- Unknown tool ---
        console.warn('[VoiceStore] Unknown tool:', name);
        response = { result: JSON.stringify({ error: `Unknown tool: ${name}` }) };

        set((state) => ({
          activeToolCalls: state.activeToolCalls.map((tc) =>
            tc.id === callId
              ? { ...tc, status: 'error', result: { error: `Unknown tool: ${name}` } }
              : tc,
          ),
        }));
      }

      functionResponses.push({
        id: callId,
        name,
        response,
      });
    }

    // Send ALL tool responses back to Gemini
    if (functionResponses.length > 0) {
      const toolResponseMsg = {
        toolResponse: {
          functionResponses,
        },
      };

      const { _ws } = get();
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        try {
          _ws.send(JSON.stringify(toolResponseMsg));
          console.log(
            '[VoiceStore] Sent',
            functionResponses.length,
            'tool response(s) to Gemini',
          );
        } catch (err) {
          console.error(
            '[VoiceStore] Failed to send tool responses to Gemini:',
            err,
          );
        }
      }
    }

    set({ isProcessing: false });
  },
}));

export default useVoiceStore;
