# Travel Ruter MCP Remote Server Dockerfile
# Build context: repo root (.)
# Runs the MCP server in streamable-http mode for remote Claude clients.

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install both root requirements (shared models/services)
COPY requirements.txt /app/root-requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r /app/root-requirements.txt

# ============================================
# Stage 2: Production
# ============================================
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl libgeos-dev libproj-dev libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages
COPY --from=builder /install /usr/local

# Copy MCP server and shared app code
COPY ./mcp_server /app/mcp_server/
COPY ./app /app/app/

# Create non-root user
RUN addgroup --gid 1001 appuser && \
    adduser --uid 1001 --gid 1001 --disabled-password appuser && \
    chown -R appuser:appuser /app

USER appuser

# Environment
ENV PYTHONPATH=/app
ENV MCP_HTTP_PORT=8002

EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Start the MCP server in HTTP mode
CMD ["python", "-m", "mcp_server", "--transport", "streamable-http"]
