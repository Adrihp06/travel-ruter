# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build arguments — only non-sensitive config baked at build time.
# VITE_MAPBOX_ACCESS_TOKEN is injected at runtime via entrypoint.sh
ARG VITE_API_URL
ARG VITE_ORCHESTRATOR_URL
ARG VITE_AUTH_ENABLED
ARG VITE_CF_ACCESS_ENABLED

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ORCHESTRATOR_URL=$VITE_ORCHESTRATOR_URL
ENV VITE_AUTH_ENABLED=$VITE_AUTH_ENABLED
ENV VITE_CF_ACCESS_ENABLED=$VITE_CF_ACCESS_ENABLED

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy runtime env injection script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Entrypoint generates env-config.js then starts nginx
ENTRYPOINT ["/entrypoint.sh"]
