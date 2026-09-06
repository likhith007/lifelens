#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start Python API
(
  cd "$ROOT/backend"
  if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
) &

# Start React dev server
(
  cd "$ROOT/frontend"
  if [ -f "$ROOT/.env" ]; then set -a; source "$ROOT/.env"; set +a; fi
  npm run dev
) &

wait
