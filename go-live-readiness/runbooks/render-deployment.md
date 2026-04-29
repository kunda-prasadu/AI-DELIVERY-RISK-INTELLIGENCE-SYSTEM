# Render Deployment Runbook

This repository now includes a Render Blueprint at the repo root in `render.yaml`.

It prepares the platform for deployment without requiring a Render account yet.

## What the Blueprint Creates

The Blueprint defines these Render resources:

1. `ai-risk-identity-service`
2. `ai-risk-project-service`
3. `ai-risk-observability-service`
4. `ai-risk-metrics-service`
5. `ai-risk-api-gateway`
6. `ai-risk-dashboard`

All backend services are configured as Docker-based web services. The dashboard is configured as a static site.

## Why the Dashboard Is Static

The current Angular dashboard uses local storage and seeded in-memory risk data instead of live HTTP calls to the backend.

That means it can be deployed safely as a static site today. When the frontend is later wired to the gateway for live API traffic, you can revisit this and decide whether to keep it static with client-side API configuration or move it to a web service.

## Why the Gateway Uses `dockerCommand`

The gateway needs full upstream URLs with route prefixes:

- identity -> `/auth`
- project -> `/projects`
- metrics -> `/metrics`

Render Blueprints can reference another service's private-network `hostport`, but they do not support direct string interpolation inside YAML values. To avoid changing application code for Render only, the Blueprint sets service hostports as environment variables and composes the final URLs in the gateway's startup command.

## Deployment Steps Later

When you create a Render account, use this sequence:

1. Connect the GitHub repository to Render.
2. Create a new Blueprint deployment from the repository root.
3. Let Render read `render.yaml`.
4. Review the generated services.
5. Keep the default generated `JWT_SECRET` environment group value.
6. Start with the free plans for evaluation.

## Important Notes

1. Free web services can cold start and are suitable for prototype or demo use, not serious production traffic.
2. The Blueprint does not define a database because the current services are in-memory and do not require one.
3. The connector framework, release automation, and go-live readiness packages are not deployed as standalone Render services.
4. The gateway is the intended runtime entrypoint for backend APIs.

## Suggested First Validation on Render

After deployment, verify these in order:

1. Gateway `/health`
2. Identity `/health`
3. Project `/health`
4. Observability `/health/live`
5. Metrics `/health/live`
6. Dashboard static site load

Then adapt the existing remote validation profile with the real Render URLs.

## Post-Deploy Validation Commands

After setting URLs in `go-live-readiness/profiles/staging.env`, run from repository root:

1. `./scripts/validate-render-staging.sh`
2. `cd go-live-readiness && npm run check:staging`

Record outcomes in `go-live-readiness/reports/latest-readiness-evidence.md` and optionally copy a structured summary from `go-live-readiness/reports/staging-evidence-template.md`.
