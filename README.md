# Travel Ruter

A modern travel routing and planning application that helps users find optimal routes and plan their journeys.

## Overview

Travel Ruter is a full-stack application designed to provide intelligent travel routing solutions. The application consists of a Python FastAPI backend with SQLAlchemy (async) and PostgreSQL/PostGIS for geospatial routing.

## Project Structure

```
travel-ruter/
├── app/
│   ├── api/              # API routes
│   ├── core/             # Core configuration (database, settings)
│   ├── models/           # SQLAlchemy models
│   ├── services/         # Business logic
│   └── main.py           # FastAPI application entry point
├── alembic/              # Database migrations
├── requirements.txt      # Python dependencies
├── Dockerfile            # Backend container configuration
├── docker-compose.yml    # Docker services orchestration
├── .env.example          # Environment variables template
├── start.sh              # Quick start script
└── README.md             # This file
```

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** - Modern web framework
- **SQLAlchemy 2.0** - ORM with async support
- **PostgreSQL + PostGIS** - Database with geospatial extensions
- **Uvicorn** - ASGI server
- **GeoPandas, Shapely** - Geospatial data processing
- **Package management**: uv (optional)

### Infrastructure
- **Docker & Docker Compose** - Containerization

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local development)

### Setup with Docker

1. Clone the repository
2. Create environment file:
   ```bash
   cp .env.example .env
   ```

3. Start the services:
   ```bash
   ./start.sh
   # Or manually:
   docker-compose up --build
   ```

4. Access the API:
   - API: http://localhost:8000
   - Interactive API docs (Swagger UI): http://localhost:8000/docs
   - Alternative API docs (ReDoc): http://localhost:8000/redoc
   - Health check: http://localhost:8000/health

### Local Development

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your local database settings
   ```

4. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

## API Documentation

The API automatically generates interactive documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Database Migrations

To create and run database migrations using Alembic:

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Features

- Async SQLAlchemy for high performance
- PostGIS support for geospatial data
- Automatic API documentation (Swagger/OpenAPI)
- CORS middleware configured
- Docker containerization
- Environment-based configuration
- Health check endpoint
- Database migrations with Alembic

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
