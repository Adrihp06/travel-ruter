#!/bin/bash
set -e # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Travel Ruter Development Setup       ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check prerequisites
echo -e "${GREEN}[1/5] Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}Python3 is required but not installed. Aborting.${NC}" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed. Aborting.${NC}" >&2; exit 1; }

# Start Database
echo -e "${GREEN}[2/5] Starting Database container...${NC}"
if [ ! -f .env ]; then
    echo "Creating .env from .env.example"
    cp .env.example .env
fi

docker-compose up -d db

echo "Waiting for database to be ready..."
# Simple wait loop for Postgres
until docker exec travel_ruter_db pg_isready -U postgres > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo -e "\nDatabase is ready."

# Setup Backend
echo -e "${GREEN}[3/5] Setting up Backend...${NC}"
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

echo "Installing Python dependencies..."
if ! pip install -r requirements.txt > /dev/null; then
    echo -e "${RED}Failed to install Python dependencies.${NC}"
    echo "You might need system libraries for GeoPandas/PostGIS (e.g., gdal, libspatialindex)."
    echo "On macOS: brew install gdal spatialindex"
    echo "On Ubuntu: sudo apt install gdal-bin libgdal-dev libspatialindex-dev"
    exit 1
fi

# Export local DB URL for local python process (overrides .env for this session)
# Using localhost because we are running outside docker
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/travel_ruter"

# Run Migrations
echo -e "${GREEN}Running Database Migrations...${NC}"
# Attempt migration. If it fails, we warn but don't exit hard (user might want to debug)
if alembic upgrade head; then
    echo "Migrations applied successfully."
else
    echo -e "${RED}Warning: Migrations failed. Check database connection or alembic config.${NC}"
    # Continue? No, probably should stop if DB is broken.
    # But let's ask user or just fail.
    # set -e will cause exit.
fi

# Setup Frontend
echo -e "${GREEN}[4/5] Setting up Frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install > /dev/null
else 
    echo "node_modules exists. Skipping install (run 'npm install' manually if needed)."
fi
cd ..

# Run Servers
echo -e "${GREEN}[5/5] Starting servers...${NC}"

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${BLUE}Stopping servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM EXIT

# Start Backend
echo -e "${BLUE}Starting Backend on http://localhost:8000${NC}"
uvicorn app.main:app --reload &
BACKEND_PID=$!

# Start Frontend
echo -e "${BLUE}Starting Frontend on http://localhost:5173${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Development environment is running!${NC}"
echo -e "Backend: http://localhost:8000/docs"
echo -e "Frontend: http://localhost:5173"
echo -e "Press Ctrl+C to stop."

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
