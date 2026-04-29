#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SERVICES=(
	"identity-service|http://127.0.0.1:3001/health"
	"project-service|http://127.0.0.1:3002/health"
	"observability-service|http://127.0.0.1:3003/health/live"
	"metrics-normalization-service|http://127.0.0.1:3004/health/live"
	"api-gateway-service|http://127.0.0.1:3005/health"
)

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

cd "$ROOT_DIR"
docker compose up -d --build

for entry in "${SERVICES[@]}"; do
	IFS='|' read -r name health_url <<<"$entry"
	wait_for_health "$name" "$health_url"
done

echo ""
echo "Compose stack is ready."
echo "Gateway: http://127.0.0.1:3005/health"
echo "Dashboard: http://127.0.0.1:4200"
