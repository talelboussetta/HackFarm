#!/usr/bin/env bash
set -euo pipefail

echo "VITE vars present: $(env | grep '^VITE_' | cut -d= -f1 | tr '\n' ' ')"
heroku config:set HEROKU_SLUG_COMMIT=$SOURCE_VERSION --app hackfarmer-api 2>/dev/null || true

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -d "$ROOT_DIR/frontend" ] && [ -f "$ROOT_DIR/frontend/package.json" ]; then
  echo "Building frontend from source..."
  pushd "$ROOT_DIR/frontend" >/dev/null
  npm ci
  npm run build
  echo "Frontend build complete — $(find "$ROOT_DIR/frontend/dist" -type f | wc -l) files in dist/"
  popd >/dev/null
elif [ -d "$ROOT_DIR/frontend/dist" ]; then
  echo "frontend/dist directory found, skipping build..."
else
  echo "frontend directory not found; skipping npm build (relying on committed artifacts or empty frontend)"
fi
