#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_NAME="${1:-}"
PROFILE_PATH="${2:-}"

if [[ -z "$PROFILE_NAME" && -z "$PROFILE_PATH" ]]; then
  echo "Usage: ./scripts/validate-release-profile.sh <profile-name|profile-path>"
  echo "Examples:"
  echo "  ./scripts/validate-release-profile.sh staging"
  echo "  ./scripts/validate-release-profile.sh production"
  echo "  ./scripts/validate-release-profile.sh /abs/path/to/profile.env"
  exit 1
fi

resolve_profile() {
  local input="$1"
  if [[ -f "$input" ]]; then
    echo "$input"
    return 0
  fi

  local candidate="$ROOT_DIR/go-live-readiness/profiles/$input.env"
  if [[ -f "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi

  return 1
}

if [[ -n "$PROFILE_PATH" ]]; then
  TARGET_PROFILE="$PROFILE_PATH"
else
  TARGET_PROFILE="$PROFILE_NAME"
fi

if ! PROFILE_FILE="$(resolve_profile "$TARGET_PROFILE")"; then
  echo "Profile not found: $TARGET_PROFILE"
  echo "Create one from:"
  echo "  go-live-readiness/profiles/staging.env.example"
  echo "  go-live-readiness/profiles/production.env.example"
  exit 1
fi

set -a
source "$PROFILE_FILE"
set +a

echo "Using profile: $PROFILE_FILE"
"$ROOT_DIR/scripts/validate-release-remote.sh"
