# Live Validation Guide

Use this after services are deployed to staging or production.

## Preconditions

- Services are running on their configured ports or mapped hostnames.
- Environment variables match production intent.
- Observability and gateway endpoints are reachable from the validation host.

## Command

```bash
npm run check:live
```

## Expected Pass Conditions

- `identity-service` `/health` returns 200
- `project-service` `/health` returns 200
- `observability-service` `/health/live` returns 200
- `metrics-normalization-service` `/health/live` returns 200
- `api-gateway-service` `/health` returns 200

## If A Check Fails

- Confirm the service process is running.
- Confirm port binding and ingress routing.
- Confirm dependent services are up if readiness is used.
- Use [incident-response.md](incident-response.md) if the failure affects release timing.
