#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local-runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

SERVICES=(
  "identity-service|identity-service|3001|http://127.0.0.1:3001/health"
  "project-service|project-service|3002|http://127.0.0.1:3002/health"
  "observability-service|observability-service|3003|http://127.0.0.1:3003/health/live"
  "metrics-normalization-service|metrics-normalization-service|3004|http://127.0.0.1:3004/health/live"
  "api-gateway-service|api-gateway-service|3005|http://127.0.0.1:3005/health"
)

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

wait_for_health() {
  local name="$1"
  local url="$2"
  local attempts=30

  for _ in $(seq 1 "$attempts"); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      echo "PASS $name health check: $url"
      return 0
    fi
    sleep 1
  done

  echo "FAIL $name health check: $url"
  return 1
}

start_service() {
  local name="$1"
  local service_path="$2"
  local port="$3"
  local health_url="$4"
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if is_running "$existing_pid"; then
      echo "SKIP $name already running on pid $existing_pid"
      wait_for_health "$name" "$health_url"
      return 0
    fi
    rm -f "$pid_file"
  fi

  echo "START $name on port $port"
  (
    cd "$ROOT_DIR/$service_path"
    nohup npm start >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  wait_for_health "$name" "$health_url"
}

echo "Starting local backend stack from $ROOT_DIR"

for entry in "${SERVICES[@]}"; do
  IFS='|' read -r name service_path port health_url <<<"$entry"
  start_service "$name" "$service_path" "$port" "$health_url"
done

echo ""
echo "Backend stack is ready."
echo "Logs: $LOG_DIR"
echo "PIDs: $PID_DIR"