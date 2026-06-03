#!/bin/sh
# Genererer /usr/share/nginx/html/assets/config.json fra container env-vars.
# Køres af nginx:alpine's standard entrypoint før nginx starter.
set -eu

TEMPLATE=/usr/share/nginx/html/assets/config.template.json
OUTPUT=/usr/share/nginx/html/assets/config.json

if [ ! -f "$TEMPLATE" ]; then
  echo "[runtime-config] Template not found: $TEMPLATE — skipping" >&2
  exit 0
fi

export NEXUS_TOKEN="${NEXUS_TOKEN:-dev-token-change-in-production}"
export REGISTRY_URL="${REGISTRY_URL:-/api}"

envsubst < "$TEMPLATE" > "$OUTPUT"

echo "[runtime-config] Generated $OUTPUT with:"
echo "  NEXUS_TOKEN=<redacted>"
echo "  REGISTRY_URL=$REGISTRY_URL"
