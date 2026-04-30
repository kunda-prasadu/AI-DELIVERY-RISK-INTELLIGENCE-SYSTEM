# Epic Closeout: E-202 Risk Trend Forecasting

- Epic: E-202
- Sprint: S3
- Closeout Date: 2026-04-30
- Final Completion Commit: `17aefed`
- Closeout Tag: `E202-complete-2026-04-30`

## Delivered Slices

| Commit | Description |
|--------|-------------|
| `09a98a1` | Backend: `risk.trend.calculator.js` model + rolling 7-snapshot history in orchestrator + `GET /metrics/projects/:projectId/risk-trend` endpoint |
| `148afc5` | Frontend: `ProjectRiskTrend` types + `RiskService.getProjectRiskTrend()` + SVG sparkline on anomaly detail page |
| `17aefed` | Frontend: `trendDirection` input on `RiskScoreCardComponent` with ↑/↓/→ badge |

## Validation Summary

- `risk.trend.calculator.test.js`: PASS (13 tests)
- `metrics.routes.test.js`: PASS (11 tests — including 2 new risk-trend route tests)
- `pipeline.orchestrator.test.js`: PASS (6 tests — regression clean)
- `risk-anomaly-detail.component.spec.ts`: PASS (3 tests — including sparkline rendering)
- `risk-score-card.component.spec.ts`: PASS (6 tests — all trend badge states)
- Dashboard shell production build: PASS (non-blocking 13 kB budget warning)

## Architecture Outcomes

- New backend route: `GET /api/metrics/projects/:projectId/risk-trend`
- `PipelineOrchestrator` now maintains rolling `snapshotHistory` map (max 7 entries per project)
- `risk.trend.calculator.js`: pure functions `computeRiskScore`, `scoreToBand`, `deriveTrendDirection`, `buildRiskTrend`
- `RiskTrendSnapshot` and `ProjectRiskTrend` interfaces added to `risk.service.ts`
- Anomaly detail page: SVG sparkline, trend badge, delta score label
- `RiskScoreCardComponent`: new optional `@Input() trendDirection` — backward-compatible

## Residual Notes

- `trendDirection` on scorecard is optional; no callers currently pass it (wired in a future slice when portfolio trend data is fetched alongside risk scores)
- Bundle budget warning stable at ~13 kB over 500 kB warning threshold; non-blocking

## Outcome

- E-202 is complete.
- E-203 (Predictive Alert Thresholds) is next.
