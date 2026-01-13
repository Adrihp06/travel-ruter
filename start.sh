#!/bin/bash

echo "Starting Travel Ruter API..."

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Start Docker containers
echo "Starting Docker containers..."
docker-compose up --build

# Note: To run in detached mode, use: docker-compose up -d --build
