#!/bin/bash
set -e

echo "Waiting for database..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h db -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-travel_ruter} -c '\q' 2>/dev/null; do
  sleep 2
done

echo "Running migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
