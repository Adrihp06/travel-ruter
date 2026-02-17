#!/bin/sh
# Runtime environment injection for the frontend container.
# Generates env-config.js from environment variables so that secrets
# (like VITE_MAPBOX_ACCESS_TOKEN) are NOT baked into the Docker image.
# This script runs at container startup, before nginx serves any files.

CONFIG_FILE=/usr/share/nginx/html/env-config.js

cat <<EOF > "$CONFIG_FILE"
window.__ENV__ = {
  VITE_MAPBOX_ACCESS_TOKEN: "${VITE_MAPBOX_ACCESS_TOKEN:-}",
};
EOF

echo "env-config.js generated at $CONFIG_FILE"

exec nginx -g 'daemon off;'
