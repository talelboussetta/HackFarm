#!/usr/bin/env bash
set -euo pipefail

echo "VITE vars present: $(env | grep '^VITE_' | cut -d= -f1 | tr '\n' ' ')"

if [ -d "../frontend" ]; then
  cd ../frontend
  npm ci
  npm run build
else
  echo "frontend directory not found; skipping npm build"
fi
