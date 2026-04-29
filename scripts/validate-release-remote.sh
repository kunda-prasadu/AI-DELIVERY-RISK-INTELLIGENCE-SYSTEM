#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/go-live-readiness/reports"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
REPORT_FILE="$REPORT_DIR/release-remote-$TIMESTAMP.md"

mkdir -p "$REPORT_DIR"

if [[ -z "${GATEWAY_BASE_URL:-}" ]]; then
  echo "GATEWAY_BASE_URL is required."
  echo "Example: GATEWAY_BASE_URL=https://staging.example.com ./scripts/validate-release-remote.sh"
  exit 1
fi

declare -a STEPS=()

run_step() {
  local name="$1"
  shift

  echo "==> $name"
  if "$@"; then
    STEPS+=("PASS $name")
    return 0
  fi

  STEPS+=("FAIL $name")
  return 1
}

OVERALL="PASS"

run_step "Static readiness check" bash -lc "cd '$ROOT_DIR/go-live-readiness' && npm run check >/dev/null" || OVERALL="FAIL"

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Live readiness check" bash -lc "cd '$ROOT_DIR/go-live-readiness' && npm run check:live >/dev/null" || OVERALL="FAIL"
fi

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Gateway smoke flow" bash -lc "cd '$ROOT_DIR/go-live-readiness' && GATEWAY_BASE_URL='$GATEWAY_BASE_URL' npm run smoke >/dev/null" || OVERALL="FAIL"
fi

{
  echo "# Remote Release Validation Report"
  echo ""
  echo "- Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- Overall: $OVERALL"
  echo "- Gateway Base URL: $GATEWAY_BASE_URL"
  echo ""
  echo "## Steps"
  echo ""
  for step in "${STEPS[@]}"; do
    echo "- $step"
  done
  echo ""
  echo "## Notes"
  echo ""
  echo "- This script validates readiness and smoke paths against a running remote environment."
  echo "- It does not start/stop services and does not run release-test-automation local harness tests."
  echo "- Run release-test-automation in CI/local separately as part of the full gate."
} >"$REPORT_FILE"

echo ""
echo "Remote release validation: $OVERALL"
echo "Report: $REPORT_FILE"

if [[ "$OVERALL" != "PASS" ]]; then
  exit 1
fi
