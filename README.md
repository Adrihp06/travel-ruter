# Travel Ruter

A modern travel routing and planning application that helps users find optimal routes and plan their journeys.

## Overview

Travel Ruter is a full-stack application designed to provide intelligent travel routing solutions. The application consists of a Python backend API and a modern frontend interface, containerized with Docker for easy deployment.

## Project Structure

```
travel-ruter/
├── backend/          # Python backend API (using uv)
├── frontend/         # Frontend application
├── docker/           # Docker configuration files
├── docs/             # Architecture and API documentation
├── README.md         # This file
└── .gitignore        # Git ignore rules
```

## Tech Stack

### Backend
- Python 3.11+
- Package management: uv
- Framework: (to be determined)

### Frontend
- (to be determined)

### Infrastructure
- Docker & Docker Compose
- (additional services to be added)

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Node.js 18+ and npm/yarn
- Docker and Docker Compose
- uv (Python package manager)

### Installation

#### Backend Setup

```bash
cd backend
# uv will be used for dependency management
uv sync
```

#### Frontend Setup

```bash
cd frontend
npm install
```

#### Docker Setup

```bash
# Build and run all services
docker-compose up --build
```

## Development

### Running Locally

#### Backend
```bash
cd backend
uv run <command>
```

#### Frontend
```bash
cd frontend
npm run dev
```

## Documentation

Detailed documentation can be found in the `docs/` directory:

- [Architecture Overview](docs/architecture.md)
- API Documentation (coming soon)
- Deployment Guide (coming soon)

## Contributing

Guidelines for contributing will be added soon.

## License

(License to be determined)

## Contact

(Contact information to be added)
