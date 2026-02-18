# Copilot Instructions for Travel Ruter

## Architecture

Travel Ruter is a self-hosted, AI-powered travel planning application. The full stack runs via `docker compose up` with 5 services:

| Service | Technology | Port |
|---------|-----------|------|
| **Frontend** | React 19, Vite, Nginx | 80 |
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), Alembic | 8000 |
| **Orchestrator** | PydanticAI agent, WebSocket streaming | 3001 |
| **MCP Server** | Model Context Protocol tool layer | subprocess |
| **Database** | PostgreSQL + PostGIS (Kartoza image) | 5432 |

```
Frontend (React/Vite/Nginx) --> Backend (FastAPI/SQLAlchemy) <--> Orchestrator (PydanticAI) <--> MCP Server
                                         |
                                  PostgreSQL + PostGIS
```

## Project Structure & Patterns

### Frontend (`frontend/`)
- **React 19** SPA bundled with **Vite**, served by **Nginx**
- State management: **Zustand** stores (not Redux)
- Components organized by feature-folder: `src/components/{Map,Chat,Trip,POI,Schedule}/`
- Contexts: `src/contexts/{Auth,Map,Trip}Context`
- API clients: `src/services/`
- Styling: **Tailwind CSS** (no CSS modules, no styled-components)
- Internationalization: **i18next** (`src/i18n/`)
- **No TypeScript** — plain JavaScript with `.jsx` extensions
- Testing: **Vitest**

### Backend (`app/`)
- **FastAPI** with async endpoints
- Pattern: `api/routers/` -> `services/` -> `models/` -> `schemas/`
- ORM: **SQLAlchemy 2.0** async sessions
- Migrations: **Alembic** (`alembic/` at project root)
- Auth: OAuth (Google, GitHub) + JWT tokens
- Testing: **pytest**

### Orchestrator (`orchestrator/`)
- **PydanticAI** agent with multi-model support (Claude, GPT, Gemini)
- WebSocket streaming for chat responses
- Tool calling via MCP subprocess
- Key files: `agent.py`, `routes.py`, `session.py`, `config.py`

### MCP Server (`mcp_server/`)
- Model Context Protocol server exposing travel tools
- Tools: manage_trip, calculate_route, generate_schedule, manage_accommodations, search destinations
- Runs as subprocess spawned by the orchestrator

## Environment Variables

~40 environment variables configured via `.env` (see `.env.example`).

### Critical distinction: build-time vs runtime
- `VITE_*` variables are **baked into the frontend at build time** by Vite
- For runtime override in Docker, the frontend uses `env-config.js` generated at container start by Nginx
- Both `MAPBOX_ACCESS_TOKEN` (backend) and `VITE_MAPBOX_ACCESS_TOKEN` (frontend) must be set to the **same value**

### Required variables
- At least **one AI provider key**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`
- `MAPBOX_ACCESS_TOKEN` + `VITE_MAPBOX_ACCESS_TOKEN` for map rendering
- `SECRET_KEY` — **mandatory in production** for JWT signing. Defaults to a placeholder in dev

### Common pitfalls
- `SECRET_KEY` must be set explicitly; the default placeholder will cause auth issues in production
- Mapbox requires **two tokens** with the same value (backend + frontend VITE_ prefix)
- Kartoza PostgreSQL image uses `POSTGRES_PASS` (not `POSTGRES_PASSWORD`)
- Nginx rewrites `/api` -> `/api/v1` — backend endpoints are under `/api/v1/`
- `FERNET_KEY` needed for per-trip API key encryption (generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`)
- `CORS_ORIGINS` must include your `PUBLIC_URL` in production

## Code Style

- **No TypeScript** — all frontend code is plain JavaScript
- **Tailwind CSS** for all styling
- **i18next** for all user-facing strings
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.
- Python: follow existing FastAPI patterns (routers -> services -> models)
- JavaScript: functional components, hooks, Zustand stores

## Testing

- **Frontend**: Vitest (`npm test` inside `frontend/`)
- **Backend**: pytest (`pytest` inside project root with `app/` on path)

## Deployment

- **Docker Compose** with 5 services defined in `docker-compose.yml`
- Multi-stage Dockerfiles for frontend (build + nginx) and backend
- CI/CD: GitHub Actions -> Docker Hub -> NAS auto-pull
- Production profile: `docker compose --profile prod up -d` (adds Cloudflare Tunnel)
- Images published to Docker Hub: `adrihp06/travel-ruter-*`
