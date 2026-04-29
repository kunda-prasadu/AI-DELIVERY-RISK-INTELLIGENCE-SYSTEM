# Monitoring And Alert Matrix

## Priority Alerts

| Alert | Source | Threshold | Initial Action | Owner |
|---|---|---|---|---|
| Gateway 5xx spike | `api-gateway-service` logs / metrics | > 2% for 5 min | Check gateway logs, downstream health, recent deploy delta | Platform |
| Auth failure surge | `identity-service` logs | > 20 failed logins / 5 min | Verify credential attack vs config regression | Security / Platform |
| Project API readiness down | `project-service` health | `/health` non-200 for 2 min | Check JWT config, process status, recent deploy | Backend |
| Observability readiness down | `observability-service` `/health/ready` | 503 for 2 min | Inspect dependency health checks and metrics exporter | Platform |
| Metrics pipeline degraded | `metrics-normalization-service` `/health/ready` | non-ready for 5 min | Check orchestrator status and ingestion backlog | Data / Platform |
| Dashboard unavailable | browser synthetic / SPA health | 2 failed runs | Check gateway routing, build artifact, CDN/static hosting | Frontend |

## Golden Signals

- Traffic: total requests at gateway and project APIs
- Errors: 4xx/5xx split by service and route
- Latency: gateway p95 and project risk endpoint latency
- Saturation: CPU/memory/container restarts in runtime platform

## Recommended Dashboards

- Release overview: health, readiness, 5xx, auth success/fail, project risk latency
- Metrics ingestion: events accepted/rejected, pipeline readiness, latest update timestamp
- User experience: login success, projects list success, dashboard page load status

## Escalation

1. On-call engineer triages within 5 minutes.
2. Incident commander engaged for Sev-1/Sev-2 conditions.
3. Rollback initiated if user-facing outage exceeds 15 minutes or error budget breach is sustained.
