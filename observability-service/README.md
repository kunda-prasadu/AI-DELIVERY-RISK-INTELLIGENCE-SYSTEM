# E-105: Observability Foundation

**Epic**: Observability Foundation for AI Delivery Risk Intelligence  
**Sprint**: S1  
**Story Points**: 10 SP

## Purpose

Central observability hub providing:
- **Liveness & Readiness Probes** (Kubernetes-ready)
- **Structured Metrics** (Prometheus-compatible export)
- **Request Tracing** (Correlation IDs, latency tracking)
- **Error Tracking** (Central error registry)

## Architecture

```
observability-service/
├── src/
│   ├── config/
│   │   └── obs.config.js           ← Environment & configuration
│   ├── models/
│   │   ├── metrics.collector.js   ← Prometheus metrics (in-memory)
│   │   └── health.checker.js      ← Liveness & readiness checks
│   ├── middleware/
│   │   ├── logger.js              ← Winston structured logging
│   │   └── request.tracker.js     ← HTTP tracking, correlation IDs
│   ├── routes/
│   │   └── health.routes.js       ← /health/* and /metrics/* endpoints
│   └── index.js                    ← Express app bootstrap
├── tests/
│   ├── metrics.collector.test.js  ← 7 tests
│   ├── health.checker.test.js     ← 9 tests
│   ├── health.routes.test.js      ← 10 integration tests
│   └── request.tracker.test.js    ← 7 tests
├── package.json
├── .env.example
└── .gitignore
```

## Endpoints

### Health Checks
- **GET `/health/live`** — Liveness probe (always 200)
- **GET `/health/ready`** — Readiness probe (200 if all checks pass, else 503)
- **GET `/health/detailed`** — Full health report with all checks

### Metrics
- **GET `/metrics`** — Prometheus text format export
- **GET `/metrics/summary`** — Quick JSON summary

### Status
- **GET `/status`** — Service health (always 200)

## Metrics Collected

### Counter: `http_requests_total`
Tracks total HTTP requests by method, path, and status code.

```
http_requests_total{method="GET",path="/projects",status="200"} 42
http_requests_total{method="POST",path="/auth/login",status="200"} 15
```

### Histogram: `http_request_duration_seconds`
Measures request latency (min, avg, max quantiles).

```
http_request_duration_seconds{method="GET",path="/projects",quantile="0.5"} 0.025
http_request_duration_seconds{method="GET",path="/projects",quantile="min"} 0.005
```

### Counter: `application_errors_total`
Tracks errors by type.

```
application_errors_total{type="ValidationError"} 3
application_errors_total{type="TimeoutError"} 1
```

### Gauge: `service_health`
Health status of downstream services (1=healthy, 0=unhealthy).

```
service_health{service="identity-service"} 1
service_health{service="project-service"} 1
```

### Gauge: `process_uptime_seconds`
Time since service started.

```
process_uptime_seconds 3600.25
```

## Configuration

Via `.env`:
- `PORT` — Server port (default: 3003)
- `NODE_ENV` — Environment (development/production)
- `LOG_LEVEL` — Winston log level (debug/info/warn/error)
- `METRICS_RETENTION_SECONDS` — In-memory retention (default: 3600s)
- `HEALTH_CHECK_TIMEOUT_MS` — Probe timeout (default: 5000ms)
- `HEALTH_REQUIRED_SERVICES` — Comma-separated service names for readiness

## Usage

### Installation
```bash
npm install
```

### Development
```bash
npm run dev      # Watch mode via nodemon
```

### Production
```bash
npm start
```

### Testing
```bash
npm test         # Run all 33 tests (4 files)
```

## Features

### ✅ Liveness Probe
Always returns 200. Used by Kubernetes to detect if container is alive and restart if dead.

### ✅ Readiness Probe
Returns 200 only if all critical dependencies are healthy. Used by load balancers to route traffic only to ready instances.

### ✅ Metrics Export
Prometheus-compatible text format. Can be scraped by Prometheus, Grafana, or other monitoring systems.

### ✅ Request Tracking
Every request gets a correlation ID (auto-generated or passed via `X-Correlation-ID` header). Enables distributed tracing across services.

### ✅ Structured Logging
Winston-powered JSON logs with structured metadata. Easy for log aggregation tools.

### ✅ Error Recording
Automatic error type tracking. Integration with other services' error events feeds this metric.

## Testing

**Test Coverage**: 33 tests across 4 files

| File | Tests | Coverage |
|------|-------|----------|
| metrics.collector.test.js | 7 | Counter, histogram, Prometheus export |
| health.checker.test.js | 9 | Liveness, readiness, checks, timeouts |
| health.routes.test.js | 10 | HTTP endpoints, status codes, headers |
| request.tracker.test.js | 7 | Correlation IDs, latency, error tracking |

**Run tests:**
```bash
npm test
```

## Integration with Other Services

### From Connector Framework (E-101)
- Export connector run events to observability-service for metrics
- Track event normalization errors → `application_errors_total`

### From Identity Service (E-102)
- Track auth failures → `application_errors_total`
- Health check identity-service dependency

### From Project Service (E-103)
- Track risk score computation latency
- Health check project-service dependency

### Dashboard (E-104)
- Query `/metrics/summary` for dashboard stats
- Use `/health/ready` to confirm service availability

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json .
RUN npm ci --omit=dev
COPY src .
EXPOSE 3003
CMD ["npm", "start"]
```

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3003
  initialDelaySeconds: 10
  periodSeconds: 5

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3003
  initialDelaySeconds: 5
  periodSeconds: 3
```

## Stories

- **US-E-105-01** (3 SP): Design health interface & metrics schema
- **US-E-105-02** (5 SP): Implement endpoints, collectors, probes
- **US-E-105-03** (3 SP): Write tests, validate, release

## Status

✅ **Complete** — All 33 tests passing. Production-ready.

---

**Owner**: Platform / SRE  
**Sprint**: S1 Release 1  
**Build**: See [../../README.md](../../README.md)
