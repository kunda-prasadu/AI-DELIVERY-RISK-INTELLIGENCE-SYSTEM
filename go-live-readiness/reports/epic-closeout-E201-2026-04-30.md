# Epic Closeout: E-201 Anomaly Intelligence UI

- Epic: E-201
- Sprint: S3
- Closeout Date: 2026-04-30
- Final Completion Commit: `8a64d6e`
- Closeout Tag: `E201-complete-2026-04-30`

## Delivered Slices

| Commit | Description |
|--------|-------------|
| `a48e8dc` | Anomaly classification endpoints added to metrics-normalization-service |
| `4c67fa0` | Anomaly radar section on dashboard (live data) |
| `7eae49f` | Risk page anomaly drilldown list with View Details navigation |
| `d05a854` | Project anomaly detail route and component scaffolded |
| `ef763e9` | Dashboard anomaly View Details deep-link wired to detail route |
| `ca3aeae` | Project name/context sourced from ProjectsService on detail page |
| `182a6b7` | Severity timeline snapshot panel on detail page |
| `ad48c06` | Recommended next actions panel on detail page |
| `445c484` | Refactored guidance rules to shared utility `risk-guidance.ts` |
| `f692737` | Dashboard anomaly radar displays top action hint via shared utility |
| `8a64d6e` | Action hint made clickable; navigates to anomaly detail page |

## Validation Summary

- `risk-guidance.spec.ts`: PASS (2 tests)
- `risk-anomaly-detail.component.spec.ts`: PASS (2 tests)
- `risk.component.spec.ts`: PASS (3 tests)
- `dashboard.component.spec.ts`: PASS (5 tests)
- Dashboard shell production build: PASS (non-blocking 13 kB budget warning)

## Architecture Outcomes

- New backend route: `GET /api/metrics/projects/:projectId/anomalies`
- New backend route: `GET /api/metrics/anomalies` (portfolio-level)
- New frontend route: `/risk/anomalies/:projectId` (lazy-loaded)
- Shared utility: `src/app/shared/utils/risk-guidance.ts`
- Shared service method: `RiskService.getPortfolioAnomalies()`, `RiskService.getProjectAnomaly()`

## Residual Notes

- Bundle budget warning (513 kB vs 500 kB warning threshold) is non-blocking and stable.
- All anomaly data is derived at classify-time from existing metrics; no new persistence layer required.

## Outcome

- E-201 is complete.
- E-202 (Risk Trend Forecasting) is next.
