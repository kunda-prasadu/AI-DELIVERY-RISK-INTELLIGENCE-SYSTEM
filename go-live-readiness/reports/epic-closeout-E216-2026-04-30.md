# Epic Closeout: E-216 View-Scoped Telemetry Timeline

- Epic: E-216
- Sprint: S3
- Report Date: 2026-04-30
- Status: Final
- Final Completion Commit: `8c868f1`
- Closeout Tag: `E216-complete-2026-04-30`

## Delivered Slices

| Commit | Description |
|--------|-------------|
| `8c868f1` | feat(e216): align telemetry timeline with chart view |

## Validation Summary

- Action Center component tests: PASS (28/28 tests)
- Full dashboard test suite: PASS (74/74 tests)
- Dashboard shell production build: PASS (529.02 kB, within 530 kB budget)
- Localhost UI sanity check: PASS for `7d` + `4x` older-pan timeline alignment using browser-local telemetry seed on `http://localhost:4200`

## E-216 Feature Scope

**Functionality**:
- Replaced the live-edge-only telemetry list with a view-scoped timeline derived from the current chart range
- Kept the timeline synchronized with the same point set used by the chart and active tooltip state
- Ensured older/newer pan actions update both the chart and the visible timeline together
- Preserved the existing seven-row compact timeline presentation

**UI Components**:
- The telemetry history list now reflects the currently viewed chart slice instead of always showing the latest persisted snapshots
- Older panned views now display matching timeline rows for the currently highlighted historical point
- No new controls or layout sections were required for this slice

**Data and Behavior**:
- Timeline rows are now built from `getTelemetryWindowPoints()` instead of the full retained telemetry history
- The list still shows at most seven rows, reversed so the latest point in the current view stays first
- This change improves coherence between chart, tooltip, and textual telemetry history without altering storage or chart controls

## Architecture Notes

- The fix was implemented as a small helper layered directly on the existing chart view model, avoiding a parallel timeline state path
- The timeline now consumes the same filtered point set as the chart, reducing UI drift risk during future pan/zoom work
- No backend, persistence schema, or bundle budget changes were required for this slice

## Bundle Impact

- Initial bundle: 529.02 kB (within 530 kB warning budget)
- Action Center lazy chunk: 106.26 kB
- No build budget threshold changes required

## Files Touched in E-216

- `dashboard-shell/src/app/features/dashboard/actions.component.ts`: View-scoped telemetry timeline helper and template binding update
- `dashboard-shell/src/app/features/dashboard/actions.component.spec.ts`: Timeline alignment coverage during older/newer pan transitions
- `go-live-readiness/reports/epic-closeout-E216-2026-04-30.md`: Epic closeout report

## Residual Notes

- Live backend endpoints for projects/anomalies were still returning 404 during browser verification, so UI sanity validation used browser-local telemetry data on `http://localhost:4200`
- Telemetry remains browser-local and user-session scoped
- The timeline remains a compact textual companion to the chart rather than a separate interactive navigator

## Exit Criteria Met

- ✓ Telemetry timeline now follows the currently viewed chart slice
- ✓ Older/newer pan actions keep chart and timeline aligned
- ✓ New E-216 coverage added and passing
- ✓ Full dashboard suite passing (74/74)
- ✓ Production build validated within current budget
