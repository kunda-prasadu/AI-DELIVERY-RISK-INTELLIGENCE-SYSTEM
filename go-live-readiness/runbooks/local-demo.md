# Local Demo Runbook

Use this runbook when you want to present the platform locally without needing any cloud account or remote environment.

## Recommended Demo Path

Start the full local demo stack:

```bash
./scripts/run-local-demo.sh
```

This starts the Docker Compose deployment, waits for backend readiness, and opens:

- Dashboard: `http://127.0.0.1:4200`
- Gateway health: `http://127.0.0.1:3005/health`

If you only need the APIs and validation tooling:

```bash
./scripts/run-local-demo.sh --backend-only
```

## Demo Checklist

1. Confirm Docker Desktop is running.
2. Run `./scripts/run-local-demo.sh`.
3. Wait for `Compose stack is ready.` and `Local demo is ready.`
4. Open the dashboard in the browser if it did not open automatically.
5. Keep the terminal open while the demo is running.

## Suggested Walkthrough

1. Show gateway health at `http://127.0.0.1:3005/health` to confirm the platform entrypoint is live.
2. Open the dashboard at `http://127.0.0.1:4200`.
3. Explain the platform layout: identity, project, observability, metrics normalization, and API gateway.
4. Highlight that the stack is running in a production-like local container deployment.
5. If needed, run the validation flow to show operational readiness:

```bash
./scripts/validate-compose-stack.sh
```

## Demo Recovery

If the dashboard does not load or health checks fail:

```bash
./scripts/stop-compose-stack.sh
./scripts/start-compose-stack.sh
```

If you want to inspect container state:

```bash
docker compose ps
docker compose logs --tail=100
```

## Demo Shutdown

Stop the demo stack cleanly:

```bash
./scripts/stop-compose-stack.sh
```

After shutdown, `npm run check:live` will fail until the local stack is started again. That is expected.
