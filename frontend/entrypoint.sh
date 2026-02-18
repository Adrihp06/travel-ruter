#!/bin/sh
# Runtime environment injection for the frontend container.
# Generates env-config.js from environment variables so that secrets
# (like VITE_MAPBOX_ACCESS_TOKEN) are NOT baked into the Docker image.
# This script runs at container startup, before nginx serves any files.

CONFIG_FILE=/usr/share/nginx/html/env-config.js
INDEX_FILE=/usr/share/nginx/html/index.html

cat <<EOF > "$CONFIG_FILE"
window.__ENV__ = {
  VITE_MAPBOX_ACCESS_TOKEN: "${VITE_MAPBOX_ACCESS_TOKEN:-}",
};
EOF

# Cache-bust: append a unique query param so that Cloudflare (and any other
# CDN) treats it as a new URL on every container start and never serves a
# stale cached copy of env-config.js.
CACHE_BUST=$(date +%s)
sed -i "s|/env-config.js|/env-config.js?v=${CACHE_BUST}|" "$INDEX_FILE"

echo "env-config.js generated (cache-bust v=${CACHE_BUST})"

exec nginx -g 'daemon off;'
