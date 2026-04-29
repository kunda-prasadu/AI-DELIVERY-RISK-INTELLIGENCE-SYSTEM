#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STOP_SCRIPT="$ROOT_DIR/scripts/stop-compose-stack.sh"

cd "$ROOT_DIR"

cleanup() {
  "$STOP_SCRIPT" >/dev/null 2>&1 || true
}

trap cleanup EXIT

./scripts/start-compose-stack.sh

cd "$ROOT_DIR/go-live-readiness"
npm run check:live
GATEWAY_BASE_URL=http://127.0.0.1:3005 npm run smoke

echo ""
echo "Compose validation passed."
