# Travel Bridge Orchestrator Dockerfile
# Build context: repo root (.)

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install both orchestrator and root requirements
COPY orchestrator/requirements.txt /app/orchestrator-requirements.txt
COPY requirements.txt /app/root-requirements.txt
RUN pip install --no-cache-dir --prefix=/install \
    -r /app/orchestrator-requirements.txt \
    -r /app/root-requirements.txt

# ============================================
# Stage 2: Production
# ============================================
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl libgeos-dev libproj-dev libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages
COPY --from=builder /install /usr/local

# Copy orchestrator, MCP server, and shared app code
COPY ./orchestrator /app/orchestrator/
COPY ./mcp_server /app/mcp_server/
COPY ./app /app/app/

# Create non-root user
RUN addgroup --gid 1001 appuser && \
    adduser --uid 1001 --gid 1001 --disabled-password appuser && \
    chown -R appuser:appuser /app

USER appuser

# Environment
ENV PYTHONPATH=/app
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the orchestrator
CMD ["python", "-m", "uvicorn", "orchestrator.main:app", "--host", "0.0.0.0", "--port", "3001"]
