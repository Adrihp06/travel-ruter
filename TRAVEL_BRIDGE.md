# The Travel Bridge: Multi-Model AI Orchestrator

Travel Bridge is an MCP-based AI orchestration system that enables multiple AI models (Claude, Gemini, Ollama) to assist with travel planning in the travel-ruter application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend                               │
│                   (ChatPanel component)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ WebSocket + REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              TRAVEL BRIDGE ORCHESTRATOR (Node.js)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Claude    │  │   Gemini    │  │   Ollama    │             │
│  │  Adapter    │  │   Adapter   │  │   Adapter   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         └────────────────┼────────────────┘                     │
│                          ▼                                       │
│              ┌───────────────────┐                              │
│              │    MCP Client     │                              │
│              └─────────┬─────────┘                              │
└────────────────────────┼────────────────────────────────────────┘
                         │ MCP Protocol (stdio)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MCP SERVER (Python/FastMCP)                     │
│  Tools: search_destinations, get_poi_suggestions,               │
│         generate_smart_schedule, calculate_route,               │
│         get_travel_matrix, manage_trip, calculate_budget        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Existing FastAPI Backend                           │
│  Services: TripService, GooglePlacesService,                    │
│           OpenRouteServiceService, GeocodingService             │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. MCP Server (Python)

Location: `/mcp_server/`

A FastMCP server that exposes travel planning tools to AI models:

| Tool | Description |
|------|-------------|
| `search_destinations` | Geocode and validate location names |
| `get_poi_suggestions` | Get POI recommendations near a location |
| `calculate_route` | Get directions between two points |
| `get_travel_matrix` | Calculate travel times between multiple locations |
| `manage_trip` | CRUD operations for trips |
| `generate_smart_schedule` | Distribute POIs across trip days |
| `calculate_budget` | Analyze trip costs |

**Running the MCP Server:**

```bash
cd /path/to/travel-ruter
python -m mcp_server
```

### 2. Orchestrator (Node.js)

Location: `/orchestrator/`

A Node.js service that:
- Routes requests to available AI providers (Claude, Gemini, Ollama)
- Manages chat sessions with conversation history
- Handles tool execution via MCP
- Provides WebSocket streaming for real-time responses

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List available AI models |
| `/api/sessions` | POST | Create a new chat session |
| `/api/sessions/:id` | GET | Get session details |
| `/api/chat` | POST | Non-streaming chat |
| `/api/chat/stream` | WS | WebSocket streaming chat |
| `/health` | GET | Health check |

**Running the Orchestrator:**

```bash
cd orchestrator
npm install
npm run dev
```

### 3. Frontend Components

Location: `/frontend/src/components/AI/`

- **ChatPanel**: Main chat interface with model selection
- **ModelSelector**: Dropdown for selecting AI model
- **StreamingMessage**: Displays messages with streaming support
- **useAIStore**: Zustand store for AI state management

## Setup

### Prerequisites

1. **Claude Authentication** (optional):
   ```bash
   claude login
   ```
   Creates session in `~/.claude/`

2. **Gemini Authentication** (optional):
   ```bash
   gcloud auth application-default login
   ```
   Creates credentials in `~/.config/gcloud/application_default_credentials.json`

3. **Ollama** (optional, local fallback):
   ```bash
   ollama pull llama3.2
   ```

### Environment Variables

Create a `.env` file:

```env
# Orchestrator
ORCHESTRATOR_PORT=3001
OLLAMA_HOST=http://localhost:11434

# API Keys (if not using session auth)
ANTHROPIC_API_KEY=your-key-here
GOOGLE_API_KEY=your-key-here

# Frontend
VITE_ORCHESTRATOR_URL=http://localhost:3001
```

### Docker Deployment

```bash
docker-compose up -d orchestrator
```

The orchestrator service will:
- Mount `~/.claude/` for Claude authentication
- Mount `~/.config/gcloud/` for Gemini authentication
- Connect to the backend via the Docker network

## AI Workflow

The AI assistant follows a phased approach:

### Discovery Phase (Always First)
1. `search_destinations` - Validate location names
2. `get_poi_suggestions` - Gather attractions, restaurants, etc.
3. Ask user to select preferred POIs

### Optimization Phase (After Discovery)
1. `get_travel_matrix` - Multi-point travel times
2. `generate_smart_schedule` - Distribute POIs across days
3. `calculate_route` - Specific directions
4. `calculate_budget` - Cost analysis

## Output Format

The AI presents schedules in this format:

```markdown
## Day 1 - 2024-03-15

**[Transport]**
- Mode: walking | From: Hotel → To: Prado Museum
- Distance: 1.2 km | Duration: 15 min

**[Activities]**
1. [09:00] - Prado Museum (Duration: 2h, Cost: €15)
2. [12:00] - Lunch at Mercado San Miguel (Duration: 1h, Cost: €25)

**[Day Cost]**
| Category | Amount |
|----------|--------|
| Transport | €0 |
| Activities | €40 |
| **Total** | **€40** |
```

## Development

### Testing the MCP Server

```bash
# Install MCP dev tools
pip install mcp[dev]

# Test with inspector
mcp dev mcp_server
```

### Testing the Orchestrator

```bash
cd orchestrator
npm test
```

### Adding a New Tool

1. Create schema in `/mcp_server/schemas/your_tool.py`
2. Implement tool in `/mcp_server/tools/your_tool.py`
3. Register in `/mcp_server/server.py`

## Troubleshooting

### MCP Server Not Starting

Check Python path:
```bash
export PYTHONPATH=/path/to/travel-ruter
python -m mcp_server
```

### WebSocket Connection Failed

Ensure orchestrator is running and CORS is configured:
```bash
curl http://localhost:3001/health
```

### No Models Available

Check provider authentication:
- Claude: `ls ~/.claude/`
- Gemini: `ls ~/.config/gcloud/application_default_credentials.json`
- Ollama: `ollama list`

## Files Reference

### MCP Server
- `/mcp_server/server.py` - FastMCP server
- `/mcp_server/tools/*.py` - Tool implementations
- `/mcp_server/schemas/*.py` - Pydantic schemas
- `/mcp_server/context.py` - Database/service context

### Orchestrator
- `/orchestrator/src/index.ts` - Entry point
- `/orchestrator/src/server.ts` - Express server
- `/orchestrator/src/providers/*.ts` - AI provider adapters
- `/orchestrator/src/mcp/client.ts` - MCP client
- `/orchestrator/src/session/manager.ts` - Session management

### Frontend
- `/frontend/src/stores/useAIStore.js` - AI state
- `/frontend/src/components/AI/ChatPanel.jsx` - Chat UI
- `/frontend/src/components/AI/ModelSelector.jsx` - Model dropdown
