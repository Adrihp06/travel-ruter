# Travel Ruter Backend

Backend API service for Travel Ruter - intelligent travel routing and planning application.

## Overview

This is the Python backend API built with modern best practices, using `uv` for package management and dependency resolution.

## Project Structure

```
backend/
├── src/
│   ├── api/              # API routes and controllers
│   │   └── __init__.py
│   ├── services/         # Business logic services
│   │   └── __init__.py
│   ├── models/           # Database models
│   │   └── __init__.py
│   ├── schemas/          # Pydantic schemas for request/response
│   │   └── __init__.py
│   ├── utils/            # Utility functions and helpers
│   │   └── __init__.py
│   ├── config/           # Configuration management
│   │   └── __init__.py
│   └── __init__.py
├── tests/                # Test files
│   └── __init__.py
├── main.py              # Application entry point
├── pyproject.toml       # Project configuration and dependencies
├── .python-version      # Python version specification
└── README.md           # This file
```

## Prerequisites

- Python 3.11 or higher
- uv (Python package manager)

## Installation

### Install uv

If you haven't installed uv yet:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Setup Project

```bash
# Navigate to backend directory
cd backend

# Create virtual environment and install dependencies
uv sync

# Install development dependencies
uv sync --extra dev
```

## Development

### Running the Application

```bash
# Run the main application
uv run python main.py
```

### Running Tests

```bash
# Run all tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=src --cov-report=html

# Run specific test file
uv run pytest tests/test_specific.py
```

### Code Quality

```bash
# Format code with black
uv run black src/ tests/

# Lint code with ruff
uv run ruff check src/ tests/

# Type checking with mypy
uv run mypy src/
```

### Adding Dependencies

```bash
# Add a runtime dependency
uv add <package-name>

# Add a development dependency
uv add --dev <package-name>

# Add a specific version
uv add <package-name>==1.2.3
```

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```bash
# Application
APP_ENV=development
DEBUG=true
SECRET_KEY=your-secret-key-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/travel_ruter

# Redis
REDIS_URL=redis://localhost:6379/0

# API Keys (example)
MAP_API_KEY=your-map-api-key
```

## API Documentation

Once the API framework is chosen and implemented, API documentation will be available at:

- Swagger UI: `http://localhost:8000/docs` (if using FastAPI)
- ReDoc: `http://localhost:8000/redoc` (if using FastAPI)

## Testing Strategy

- **Unit Tests**: Test individual functions and methods in isolation
- **Integration Tests**: Test interactions between components
- **API Tests**: Test HTTP endpoints and responses
- **Coverage Goal**: Maintain >80% code coverage

## Code Style

This project follows:

- **PEP 8**: Python style guide
- **Black**: Code formatting (line length: 88)
- **Ruff**: Fast Python linter
- **MyPy**: Static type checking

## Contributing

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass and coverage is maintained
4. Format and lint your code
5. Submit a pull request

## Next Steps

1. Choose and implement web framework (FastAPI/Django/Flask)
2. Set up database models and migrations
3. Implement authentication system
4. Create API endpoints
5. Add comprehensive tests
6. Set up CI/CD pipeline

## Useful Commands

```bash
# Update all dependencies
uv sync --upgrade

# Show dependency tree
uv tree

# Lock dependencies
uv lock

# Run Python REPL with project context
uv run python

# Run a script
uv run python scripts/your_script.py
```

## License

(License to be determined)
