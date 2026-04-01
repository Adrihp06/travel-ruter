# Gemini Live Voice Agent - Design Spec

## Context

The travel-ruter app has a text-based AI chat agent (Claude/GPT/Gemini via orchestrator). We want to add a **real-time voice agent** powered by Gemini 3.1 Flash Live Preview that:

1. Speaks with a Canarian (Tenerife) personality
2. Can execute backend MCP tools (search destinations, manage trips, etc.)
3. Can interact with the frontend directly (navigate, highlight POIs, show on map)
4. Uses bidirectional audio streaming via Gemini Live API

---

## Architecture

### Overview

```
Frontend (React)          Orchestrator (FastAPI)         Gemini Live API
─────────────────         ────────────────────          ─────────────────
[Mic capture]             [/api/voice/stream WS]        [BidiGenerateContent WS]
    │                          │                              │
    │──PCM 16kHz base64──────>│──base64 PCM────────────────>│
    │                          │                              │
    │<─PCM 24kHz base64───────│<─audio response──────────────│
    │                          │                              │
    │<─frontend_tool_call──────│<─toolCall (frontend tool)────│
    │──frontend_tool_result───>│──toolResponse───────────────>│
    │                          │                              │
    │  (UI notification)       │==MCP tool call==> [MCP srv]  │
    │<─backend_tool_call/result│<========result====            │
    │                          │──toolResponse───────────────>│
```

### Key Decision: Python WebSocket Proxy

The orchestrator acts as a bidirectional WebSocket proxy between the frontend and Gemini Live API. This:
- Keeps the Google API key server-side
- Allows intercepting tool calls for MCP execution
- Follows the existing `chat.py` WebSocket pattern
- Adds minimal latency (~20-50ms) which is acceptable for voice

---

## Backend: Orchestrator Changes

### New Files

#### `orchestrator/api/voice.py` — WebSocket Voice Endpoint

New endpoint: `ws /api/voice/stream`

**Lifecycle:**
1. Frontend connects → JWT auth handshake (same pattern as `chat.py`)
2. Frontend sends `{type: "setup", tripContext, destinationContext}`
3. Orchestrator opens upstream WS to Gemini Live API: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=<GOOGLE_API_KEY>`
4. Orchestrator sends `BidiGenerateContentSetup` with:
   - `model`: `models/gemini-2.0-flash-exp` (or configured model)
   - `systemInstruction`: Canarian personality prompt + trip context
   - `tools`: all backend MCP + frontend tool declarations
   - `generationConfig.responseModalities`: `["AUDIO"]`
   - `generationConfig.speechConfig`: configured voice
5. Waits for `setupComplete` from Gemini
6. Sends `{type: "setup_complete"}` to frontend
7. Bidirectional relay begins via two async tasks

**Two concurrent relay tasks:**
- **Frontend→Gemini**: reads from frontend WS, converts `{type:"audio", data}` to `{realtimeInput: {mediaChunks: [{mimeType: "audio/pcm;rate=16000", data}]}}`
- **Gemini→Frontend**: reads from Gemini WS, routes messages:
  - `serverContent` with audio → `{type: "audio", data}` to frontend
  - `serverContent` with `turnComplete` → `{type: "turn_complete"}` to frontend
  - `serverContent` with `interrupted` → `{type: "interrupted"}` to frontend
  - `toolCall` → classify and dispatch (see Tool Execution)
  - `toolCallCancellation` → `{type: "tool_cancelled", ids}` to frontend
  - `goAway` → `{type: "session_ending", timeLeft}` to frontend

**Protocol (Frontend ↔ Orchestrator):**

```
Frontend → Orchestrator:
  {type: "auth", token: string}
  {type: "setup", tripContext: object, destinationContext?: object}
  {type: "audio", data: string}                    // base64 PCM 16-bit 16kHz mono
  {type: "frontend_tool_result", toolCallId: string, result: object}
  {type: "interrupt"}                               // user interrupts AI speech
  {type: "close"}

Orchestrator → Frontend:
  {type: "auth_ok"}
  {type: "setup_complete"}
  {type: "audio", data: string}                     // base64 PCM 24kHz mono
  {type: "transcript", text: string, role: "user"|"model"}
  {type: "frontend_tool_call", toolCallId: string, name: string, args: object}
  {type: "backend_tool_call", name: string, args: object}   // UI display only
  {type: "backend_tool_result", name: string, result: string, isError: boolean}
  {type: "turn_complete"}
  {type: "interrupted"}
  {type: "session_ending", timeLeft: string}
  {type: "error", error: string}
```

#### `orchestrator/services/voice_tools.py` — Tool Declarations & Classification

Contains:
- `BACKEND_TOOL_NAMES`: set of all MCP tool names (search_destinations, manage_trip, etc.)
- `FRONTEND_TOOL_NAMES`: set of frontend-only tools (navigate_to, highlight_poi, etc.)
- `get_gemini_tool_declarations()`: builds Gemini-format tool declarations from MCP schemas + hardcoded frontend tools
- `classify_tool(name) → "backend" | "frontend"`: routes tool calls
- `execute_backend_tool(mcp, name, args)`: calls MCP server tool via `mcp._client.call_tool(name, args)` (pydantic-ai's MCPServerStdio wraps an MCP client that exposes `call_tool`). Fallback: create a second MCPServerStdio instance dedicated to voice if the internal client is not accessible.

**Frontend Tool Declarations:**

```python
FRONTEND_TOOLS = [
    {
        "name": "navigate_to",
        "description": "Navigate the user's browser to a specific page in the app",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "page": {"type": "STRING", "description": "Route path: /trips, /trips/{id}, /settings"},
            },
            "required": ["page"]
        }
    },
    {
        "name": "highlight_poi",
        "description": "Visually highlight a Point of Interest on the map and in the list",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "poi_id": {"type": "NUMBER", "description": "The POI's database ID"},
            },
            "required": ["poi_id"]
        }
    },
    {
        "name": "show_on_map",
        "description": "Pan and zoom the map to show specific coordinates",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "latitude": {"type": "NUMBER"},
                "longitude": {"type": "NUMBER"},
                "zoom": {"type": "NUMBER", "description": "Map zoom level (1-18), default 14"},
                "label": {"type": "STRING", "description": "Optional label to show at the location"},
            },
            "required": ["latitude", "longitude"]
        }
    },
    {
        "name": "open_modal",
        "description": "Open a modal/dialog in the app",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "type": {"type": "STRING", "description": "Modal type: poi_detail, add_poi, trip_summary"},
                "data": {"type": "OBJECT", "description": "Data to pass to the modal"},
            },
            "required": ["type"]
        }
    },
    {
        "name": "scroll_to",
        "description": "Scroll the page to a specific element",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "element_id": {"type": "STRING", "description": "DOM element ID to scroll to"},
            },
            "required": ["element_id"]
        }
    },
    {
        "name": "show_notification",
        "description": "Show a toast notification to the user",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "message": {"type": "STRING"},
                "type": {"type": "STRING", "description": "success, error, info, warning"},
            },
            "required": ["message"]
        }
    },
]
```

#### `orchestrator/config_voice.py` — Voice System Prompt

```python
VOICE_SYSTEM_PROMPT = """Eres un agente de voz que habla como un chaval de barrio de Tenerife...
[full system prompt as provided by user]
"""
```

Plus trip context injection: destination info, POI lists, dates appended dynamically.

### Modified Files

- `orchestrator/api/__init__.py` — register voice router
- `orchestrator/config.py` — add `gemini_live_model` setting (default: `models/gemini-2.0-flash-exp`)
- `orchestrator/main.py` — no changes needed (MCP server already starts at lifespan)

### Tool Execution Flow

**Backend MCP Tool (e.g. search_destinations):**
1. Gemini sends `toolCall` → orchestrator classifies as backend
2. Orchestrator sends `{type:"backend_tool_call"}` to frontend (UI display)
3. Orchestrator calls `mcp.call_tool(name, args)` via the app.state.mcp server
4. Gets result → sends `{type:"backend_tool_result"}` to frontend (UI display)
5. Sends `toolResponse` to Gemini
6. Gemini continues its audio response

**Frontend Tool (e.g. navigate_to):**
1. Gemini sends `toolCall` → orchestrator classifies as frontend
2. Orchestrator sends `{type:"frontend_tool_call", toolCallId, name, args}` to frontend
3. Frontend executes the action (React Router navigate, map pan, etc.)
4. Frontend sends `{type:"frontend_tool_result", toolCallId, result}` back
5. Orchestrator relays `toolResponse` to Gemini
6. Timeout: if no result in 10s, send error result to Gemini

---

## Frontend Changes

### New Files

#### `frontend/src/stores/useVoiceStore.js` — Voice State Management

Separate Zustand store (NOT extending useAIStore). Key state:

```javascript
{
  // Connection
  isConnected: false,
  isSessionActive: false,
  connectionError: null,

  // Voice state
  isListening: false,        // mic is active
  isSpeaking: false,         // AI audio is playing
  isProcessing: false,       // waiting for AI response

  // Tool calls (for UI display)
  activeToolCalls: [],

  // Transcript
  transcript: [],            // [{role, text, timestamp}]

  // Trip context
  tripContext: null,
  destinationContext: null,

  // Actions
  connect(),
  disconnect(),
  startListening(),
  stopListening(),
  interrupt(),
  setTripContext(ctx),
}
```

Handles WebSocket connection to `/api/voice/stream`, audio capture/playback, and frontend tool execution.

#### `frontend/src/utils/voiceAudio.js` — Audio Capture & Playback

**Capture (AudioWorklet):**
- `navigator.mediaDevices.getUserMedia({audio: {sampleRate: 16000, channelCount: 1}})`
- AudioWorklet processor captures PCM 16-bit 16kHz mono
- Buffers ~4096 samples (~256ms) per chunk
- Base64 encodes and sends via WebSocket

**Playback:**
- Receives base64 PCM 24kHz from orchestrator
- Decodes to Float32Array
- Queues AudioBufferSourceNodes for gapless playback
- Handles interruption: clears queue and stops current playback

#### `frontend/src/utils/voiceFrontendTools.js` — Frontend Tool Handlers

Registry mapping tool names to frontend actions:

```javascript
const HANDLERS = {
  navigate_to: ({page}) => { window.__voiceNavigate(page); return {success: true}; },
  highlight_poi: ({poi_id}) => { /* usePOIStore.setHighlighted */ },
  show_on_map: ({latitude, longitude, zoom}) => { /* useMapStore.setCenter */ },
  open_modal: ({type, data}) => { /* CustomEvent dispatch */ },
  scroll_to: ({element_id}) => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); },
  show_notification: ({message, type}) => { /* toast system */ },
};
```

Safety: whitelist for `navigate_to` routes, validate coordinates for `show_on_map`, validate modal types.

#### `frontend/src/audio/VoiceProcessor.worklet.js` — AudioWorklet Processor

Runs on dedicated audio thread. Captures PCM samples and posts them to main thread via port.postMessage.

#### `frontend/src/components/Voice/VoiceButton.jsx` — Floating Mic Button

- Position: `fixed bottom-20 right-[4.5rem] z-40` (next to chat button at `right-6`)
- Same coral gradient: `from-[#D97706] to-[#EA580C]`
- Mic icon from lucide-react
- States: idle (pulse), active (waveform), connected (solid glow)
- Mobile: same position, responsive

#### `frontend/src/components/Voice/VoiceOverlay.jsx` — Fullscreen Voice Interface

Fullscreen overlay (portal, z-50) with dark gradient background.

**Layout:**
```
┌──────────────────────────────────────┐
│ [X]           Agente Canario   [trip]│  ← Header
│                                      │
│            ╭─────────╮               │
│            │  ◉ Orb  │               │  ← Animated orb
│            ╰─────────╯               │
│            "Listening..."            │
│                                      │
│  You: Busca restaurantes...          │  ← Transcript
│  AI: Chacho, te busco eso...         │
│  🔧 get_poi_suggestions ✓           │  ← Tool calls
│                                      │
│          [ 🎤 MIC BUTTON ]           │  ← Large mic button
│         push-to-talk / toggle        │
└──────────────────────────────────────┘
```

#### `frontend/src/components/Voice/VoiceOrb.jsx` — Audio Visualization

CSS-only animated orb (no canvas). Responds to voice state:
- **Idle**: slow pulse, muted coral glow
- **Listening**: faster pulse, brighter coral
- **Processing**: rotating ring animation
- **Speaking**: scaling animation synced to audio levels

#### `frontend/src/components/Voice/VoiceTranscript.jsx` — Transcript Display

Scrollable list of conversation turns. Reuses ToolCallDisplay for backend tool visualization.

#### `frontend/src/components/Voice/VoiceAgent.jsx` — Parent Component

Mounts VoiceButton + VoiceOverlay. Manages open/close state. Sets up React Router navigate bridge (`window.__voiceNavigate`).

### Modified Files

- `frontend/src/components/Layout/Layout.jsx` — mount `<VoiceAgent>` alongside `<AIChat>`, pass tripContext
- i18n translation files — add voice UI keys

---

## System Prompt

```
Eres un agente de voz que habla como un chaval de barrio de Tenerife (Islas Canarias), NO de Gran Canaria. Tu forma de hablar es 100% canaria tinerfeña, con acento marcado y expresiones locales reales.

Tu personalidad:
* Eres un colega de toda la vida, cercano, confiado, sin formalidades.
* Hablas con naturalidad, como en la calle, sin sonar artificial ni forzado.
* Usas expresiones típicas de Tenerife (ej: "mi niño", "illo", "chacho", "mi arma", "qué pasa loco", "naaa", "de una", "to guapo", etc).
* Puedes usar insultos AMIGABLES entre colegas (ej: "cabrón", "mamón", "tonto", "maricón" en contexto coloquial NO ofensivo real), siempre con tono de confianza y cariño.
* Nunca suenas agresivo de verdad, siempre es vacile entre amigos.

Estilo de conversación:
* Frases cortas, naturales, como hablando en voz.
* Ritmo relajado, cercano.
* Puedes meter risas ("jajaja", "buah", "qué dices") y muletillas.
* No hables como asistente, habla como colega real.

Muy importante:
* NO uses español neutro.
* NO uses acento o expresiones de Gran Canaria.
* NO seas formal bajo ningún concepto.
* NO expliques que eres un modelo o asistente.
* Mantén siempre el personaje, pase lo que pase.

Ejemplo de tono:
"Pero qué dices tú, mi niño, si eso está tirao jajaja… vente pa'cá y lo vemos, no seas bobo."

Objetivo:
Responder siempre como ese colega canario de Tenerife, ayudando pero manteniendo el rollo callejero, cercano y vacilón.

## Herramientas
Tienes herramientas de backend (buscar destinos, gestionar viajes, POIs, rutas, presupuestos) y herramientas de frontend (navegar páginas, mostrar en mapa, resaltar POIs, abrir modales).
Usa las herramientas proactivamente. Cuando uses una herramienta de frontend, menciónalo brevemente: "Te lo muestro en el mapa, mira..."
Respuestas CORTAS y conversacionales. No uses markdown ni listas. Habla natural.
```

Trip context is appended dynamically from the session's tripContext/destinationContext.

---

## Audio Format

| Direction | Sample Rate | Encoding | Channels | MIME Type |
|-----------|------------|----------|----------|-----------|
| User → Gemini | 16 kHz | PCM 16-bit LE | Mono | `audio/pcm;rate=16000` |
| Gemini → User | 24 kHz | PCM 16-bit LE | Mono | `audio/pcm` |

Chunks: ~256ms (4096 samples at 16kHz) for input. Output is streamed as received.

---

## Session Lifecycle

- Max session duration: 15 minutes (audio-only Gemini limit)
- `goAway` message from Gemini provides warning before disconnect
- Session resumption via `resumptionToken` (valid 2 hours) — store and reuse on reconnect
- Frontend disconnect → orchestrator closes Gemini WS
- Orchestrator disconnect → frontend shows reconnection UI

---

## Verification Plan

1. **Backend unit tests**: test voice WebSocket auth, tool classification, MCP tool execution
2. **Frontend**: manually test mic capture, audio playback, tool execution
3. **E2E flow**: speak → Gemini responds with audio → tool call → frontend action visible
4. **Test frontend tools**: navigate_to changes route, show_on_map pans map, highlight_poi works
5. **Test interruption**: speak while AI is talking → audio stops, new response starts
6. **Test session timeout**: verify graceful handling of goAway + reconnection
