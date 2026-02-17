# Travel Ruter

An AI-powered travel planning app with interactive maps, smart scheduling, and multi-provider AI assistants.

**Runs anywhere Docker runs** — laptop, VPS, Raspberry Pi, Synology NAS, or cloud VM. The entire stack (database, backend, AI orchestrator, frontend) is containerized in a single `docker compose up`. No managed services, no vendor lock-in.

**Designed for free tiers.** Every external API the app uses offers a free tier that's more than enough for personal use. You can run a fully functional instance — maps, routing, AI chat, hotel search — without spending anything beyond compute.

| Service | Free Tier | What It Gives You |
|---------|-----------|-------------------|
| **Mapbox** | 50k map loads + 100k directions/month | Interactive maps & geocoding |
| **OpenRouteService** | 2,000 requests/day | Real road-network routing |
| **Google Maps** | $200/month credit | Transit & public transport routing |
| **Amadeus** | Self-Service tier (test environment) | Hotel search & availability |
| **Perplexity** | Limited free requests | AI-powered POI research |
| **Google OAuth** | Free | User login via Google |

For AI providers, you need at least one key — pick whichever you prefer:

| AI Provider | Free Tier | Notes |
|-------------|-----------|-------|
| **Anthropic** (Claude) | No free tier | Recommended default |
| **OpenAI** (GPT) | Trial credits for new accounts | |
| **Google** (Gemini) | $300 free credits via Vertex AI | |

Open Source Flexibility: As an open-source project, Travel Ruter is built to be modular. You can toggle services on or off depending on your needs or privacy preferences.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Frontend   │────>│   Backend    │<───>│   Orchestrator   │<───>│   MCP Server   │
│  React/Vite  │     │   FastAPI    │     │   PydanticAI     │     │  (Tool layer)  │
│   (Nginx)    │     │  SQLAlchemy  │     │   Agent + WS     │     │                │
└─────────────┘     └──────┬───────┘     └──────────────────┘     └────────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL  │
                    │   + PostGIS  │
                    └──────────────┘
```

- **Frontend** — React SPA with Mapbox GL maps, trip management UI, and a streaming AI chat panel
- **Backend** — FastAPI with async SQLAlchemy, OAuth login, trip/POI/accommodation CRUD, and route calculation
- **Orchestrator** — PydanticAI agent that streams responses over WebSocket, with tool calling via MCP
- **MCP Server** — Model Context Protocol server exposing travel tools (search destinations, manage trips, calculate routes, generate schedules, manage accommodations)
- **Database** — PostgreSQL with PostGIS for geospatial queries

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Setup

1. Clone and configure:
   ```bash
   git clone https://github.com/Adrihp06/travel-ruter.git
   cd travel-ruter
   cp .env.example .env
   ```

2. Edit `.env` with your API keys. At minimum you need:
   ```bash
   # One AI provider (pick one)
   ANTHROPIC_API_KEY=sk-ant-...

   # Maps (free tier)
   MAPBOX_ACCESS_TOKEN=pk.ey...
   VITE_MAPBOX_ACCESS_TOKEN=pk.ey...  # same value
   ```

3. Start everything:
   ```bash
   docker compose up --build
   ```

4. Open http://localhost in your browser.

### Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 80 | http://localhost |
| Backend API | 8000 | http://localhost:8000/docs |
| Orchestrator | 3001 | http://localhost:3001/health |
| PostgreSQL | 5432 | — |

### Production Deployment

For exposing to the internet via Cloudflare Tunnel:

```bash
# Set CLOUDFLARE_TUNNEL_TOKEN in .env, then:
docker compose --profile prod up -d
```

## Project Structure

```
travel-ruter/
├── app/                    # Backend (FastAPI)
│   ├── api/                # REST endpoints & dependencies
│   ├── core/               # Config, database, security
│   ├── models/             # SQLAlchemy models (User, Trip, POI, ...)
│   ├── services/           # Business logic (routing, geocoding, AI providers)
│   └── main.py             # FastAPI entrypoint
├── orchestrator/           # AI Orchestrator (PydanticAI)
│   ├── agent.py            # Agent builder & model resolution
│   ├── routes.py           # REST + WebSocket streaming endpoints
│   ├── session.py          # Chat session management
│   └── config.py           # Orchestrator settings & model registry
├── mcp_server/             # MCP Tool Server
│   ├── server.py           # Tool definitions (manage_trip, calculate_route, ...)
│   └── config.py           # MCP server settings
├── frontend/               # React SPA (Vite)
│   ├── src/components/     # Map, Chat, Trip, POI, Schedule components
│   ├── src/contexts/       # Auth, Map, Trip contexts
│   └── src/services/       # API clients
├── alembic/                # Database migrations
├── docker-compose.yml      # Full stack orchestration
├── Dockerfile              # Backend container
├── orchestrator/Dockerfile # Orchestrator container
├── frontend/Dockerfile     # Frontend container (multi-stage + nginx)
└── .env.example            # All configuration options
```

## Features

- **AI Travel Assistant** — multi-model chat (Claude, GPT, Gemini) with streaming responses and tool calling
- **Interactive Maps** — Mapbox GL with POI markers, route visualization, and destination exploration
- **Smart Scheduling** — auto-generate optimized daily itineraries based on POI locations and travel times
- **Multi-modal Routing** — walking, driving, cycling, and public transit via OpenRouteService and Google Maps
- **Trip Management** — full CRUD for trips, destinations, POIs, and accommodations
- **Budget Tracking** — cost breakdown and analysis per trip
- **Hotel Search** — Amadeus integration for availability and pricing
- **OAuth Login** — Google and GitHub authentication (optional, can run without auth)
- **Per-trip API Keys** — teams can use their own AI provider keys per trip, encrypted at rest
- **Document Storage** — upload and attach travel documents to trips
- **NAS-friendly** — configurable data paths for Synology/QNAP/NFS storage

## Environment Variables

All configuration is done through environment variables. See `.env.example` for the full list with descriptions.

**Required:**
- `MAPBOX_ACCESS_TOKEN` / `VITE_MAPBOX_ACCESS_TOKEN` — map rendering
- At least one AI provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`)

**Optional but recommended:**
- `OPENROUTESERVICE_API_KEY` — real road-network routing (free, 2k req/day)
- `GOOGLE_MAPS_API_KEY` — public transit routing ($200/month free credit)
- `SECRET_KEY` — JWT signing (defaults to a placeholder, generate a real one for production)
- `FERNET_KEY` — encryption for per-trip API keys

**Optional:**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth login
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth login
- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` — hotel search
- `PERPLEXITY_API_KEY` — AI-powered POI research
- `CLOUDFLARE_TUNNEL_TOKEN` — production tunnel deployment

## Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Mapbox GL, Zustand, i18next |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic |
| AI | PydanticAI, MCP (Model Context Protocol) |
| Database | PostgreSQL + PostGIS |
| Infrastructure | Docker Compose, Nginx, Cloudflare Tunnel |

## License

This project is licensed under the [MIT License](LICENSE) with the [Commons Clause](https://commonsclause.com/) restriction.

**You can** freely use, modify, and distribute this software for personal, educational, or internal purposes.

**You cannot** sell this software or offer it as a paid product or service.
