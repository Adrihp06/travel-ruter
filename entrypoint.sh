#!/bin/bash
set -e

echo "=== Travel Ruter Backend Startup ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h db -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-travel_ruter}" -c '\q' 2>/dev/null; then
        echo "PostgreSQL is ready!"
        break
    fi
    retry_count=$((retry_count + 1))
    echo "PostgreSQL is unavailable - waiting... ($retry_count/$max_retries)"
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "ERROR: Could not connect to PostgreSQL after $max_retries attempts"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

echo "Migrations complete!"
echo "Starting application..."

# Execute the CMD passed to the container
exec "$@"
