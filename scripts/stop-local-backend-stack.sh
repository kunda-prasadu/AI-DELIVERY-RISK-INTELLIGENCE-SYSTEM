#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT_DIR/.local-runtime/pids"

SERVICES=(
  "identity-service"
  "project-service"
  "observability-service"
  "metrics-normalization-service"
  "api-gateway-service"
)

if [[ ! -d "$PID_DIR" ]]; then
  echo "No PID directory found at $PID_DIR"
  exit 0
fi

for name in "${SERVICES[@]}"; do
  pid_file="$PID_DIR/$name.pid"
  if [[ ! -f "$pid_file" ]]; then
    echo "SKIP $name not running"
    continue
  fi

  pid="$(cat "$pid_file")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "STOP $name pid $pid"
    kill "$pid"
    for _ in $(seq 1 10); do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "KILL $name pid $pid"
      kill -9 "$pid"
    fi
  else
    echo "SKIP $name stale pid $pid"
  fi

  rm -f "$pid_file"
done

echo "Local backend stack stopped."