# =============================================================================
# Stage 1: Builder - Install build dependencies and create wheels
# =============================================================================
FROM python:3.11-slim AS builder

# Install build dependencies (these won't be in the final image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libspatialindex-dev \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL config for building geospatial packages
ENV GDAL_CONFIG=/usr/bin/gdal-config

WORKDIR /build

# Copy requirements and build wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /build/wheels -r requirements.txt

# =============================================================================
# Stage 2: Runtime - Minimal production image
# =============================================================================
FROM python:3.11-slim

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install only runtime dependencies (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgdal32 \
    libgeos-c1v5 \
    libproj25 \
    libspatialindex6 \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    GDAL_CONFIG=/usr/bin/gdal-config

WORKDIR /app

# Copy wheels from builder and install
COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy alembic configuration and migrations
COPY alembic.ini .
COPY ./alembic /app/alembic

# Copy application code
COPY ./app /app/app

# Copy and set up entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Set entrypoint and default command
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
