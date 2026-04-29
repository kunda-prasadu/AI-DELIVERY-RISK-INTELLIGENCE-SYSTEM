#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROFILE_FILE="${1:-$ROOT_DIR/go-live-readiness/profiles/staging.env}"

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Staging profile not found: $PROFILE_FILE"
  echo "Create one from: go-live-readiness/profiles/staging.env.example"
  exit 1
fi

set -a
source "$PROFILE_FILE"
set +a

echo "Using profile: $PROFILE_FILE"

cd "$ROOT_DIR/go-live-readiness"
npm run check:live
npm run smoke
