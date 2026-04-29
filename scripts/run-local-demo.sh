#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODE="full"

usage() {
  cat <<'EOF'
Usage: ./scripts/run-local-demo.sh [--backend-only]

Options:
  --backend-only   Start only backend services and open the gateway health endpoint
  --help           Show this help text
EOF
}

open_url() {
  local url="$1"

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

case "${1:-}" in
  --backend-only)
    MODE="backend"
    ;;
  --help)
    usage
    exit 0
    ;;
  "")
    ;;
  *)
    usage
    exit 1
    ;;
esac

cd "$ROOT_DIR"

if [[ "$MODE" == "backend" ]]; then
  ./scripts/start-compose-backend-stack.sh
  open_url "http://127.0.0.1:3005/health"
  echo ""
  echo "Backend demo is ready."
  echo "Gateway health: http://127.0.0.1:3005/health"
  exit 0
fi

./scripts/start-compose-stack.sh
open_url "http://127.0.0.1:4200"
open_url "http://127.0.0.1:3005/health"

echo ""
echo "Local demo is ready."
echo "Dashboard: http://127.0.0.1:4200"
echo "Gateway health: http://127.0.0.1:3005/health"
