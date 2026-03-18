#!/usr/bin/env bash
set -euo pipefail

echo "VITE vars present: $(env | grep '^VITE_' | cut -d= -f1 | tr '\n' ' ')"
heroku config:set HEROKU_SLUG_COMMIT=$SOURCE_VERSION --app hackfarmer-api 2>/dev/null || true

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
pushd "$ROOT_DIR/frontend" >/dev/null
npm ci
npm run build
echo "Frontend build complete — $(find "$ROOT_DIR/frontend/dist" -type f | wc -l) files in dist/"
popd >/dev/null
