#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$ROOT_DIR/go-live-readiness/reports"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
REPORT_FILE="$REPORT_DIR/release-rehearsal-$TIMESTAMP.md"

mkdir -p "$REPORT_DIR"

declare -a STEP_NAMES=()
declare -a STEP_STATUS=()
declare -a STEP_DETAILS=()

record_step() {
  local name="$1"
  local status="$2"
  local detail="$3"
  STEP_NAMES+=("$name")
  STEP_STATUS+=("$status")
  STEP_DETAILS+=("$detail")
}

run_step() {
  local name="$1"
  shift

  echo "==> $name"
  if "$@"; then
    record_step "$name" "PASS" "Command succeeded"
    return 0
  fi

  record_step "$name" "FAIL" "Command failed"
  return 1
}

write_report() {
  local overall_status="$1"
  {
    echo "# Release Rehearsal Report"
    echo ""
    echo "- Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Overall: $overall_status"
    echo ""
    echo "## Steps"
    echo ""
    for i in "${!STEP_NAMES[@]}"; do
      echo "- ${STEP_STATUS[$i]} ${STEP_NAMES[$i]}: ${STEP_DETAILS[$i]}"
    done
    echo ""
    echo "## Commands Executed"
    echo ""
    echo "1. ./scripts/start-local-backend-stack.sh"
    echo "2. cd go-live-readiness && npm run check"
    echo "3. cd release-test-automation && npm test -- --silent"
    echo "4. cd go-live-readiness && npm run check:live"
    echo "5. cd go-live-readiness && npm run smoke"
    echo "6. ./scripts/stop-local-backend-stack.sh"
  } >"$REPORT_FILE"
}

cleanup() {
  if ./scripts/stop-local-backend-stack.sh >/dev/null 2>&1; then
    :
  fi
}

cd "$ROOT_DIR"

trap cleanup EXIT

OVERALL="PASS"

run_step "Start local backend stack" ./scripts/start-local-backend-stack.sh || OVERALL="FAIL"

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Static readiness check" bash -lc "cd '$ROOT_DIR/go-live-readiness' && npm run check >/dev/null" || OVERALL="FAIL"
fi

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Release automation suite" bash -lc "cd '$ROOT_DIR/release-test-automation' && npm test -- --silent >/dev/null" || OVERALL="FAIL"
fi

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Live readiness check" bash -lc "cd '$ROOT_DIR/go-live-readiness' && npm run check:live >/dev/null" || OVERALL="FAIL"
fi

if [[ "$OVERALL" == "PASS" ]]; then
  run_step "Gateway smoke flow" bash -lc "cd '$ROOT_DIR/go-live-readiness' && npm run smoke >/dev/null" || OVERALL="FAIL"
fi

run_step "Stop local backend stack" ./scripts/stop-local-backend-stack.sh || OVERALL="FAIL"

write_report "$OVERALL"

echo ""
echo "Release rehearsal: $OVERALL"
echo "Report: $REPORT_FILE"

if [[ "$OVERALL" != "PASS" ]]; then
  exit 1
fi
