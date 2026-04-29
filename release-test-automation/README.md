# Release 1 Test Automation Pack (E-109)

This package provides release-gate automation across services through the API gateway.

## Coverage

- Integration flow: auth -> projects -> risk -> metrics -> observability
- Contract validation: required response fields and types
- Baseline load smoke: concurrent traffic success-rate and latency guardrail

## Run

```bash
npm install
npm test
```

## Optional targeted runs

```bash
npm run test:integration
npm run test:contract
npm run test:baseline
```

## Environment

Copy values from `.env.example` when running against different ports.

Key variables:

- `JWT_SECRET`
- `TEST_GATEWAY_PORT`
- `TEST_IDENTITY_PORT`
- `TEST_PROJECT_PORT`
- `TEST_OBSERVABILITY_PORT`
- `TEST_METRICS_PORT`
