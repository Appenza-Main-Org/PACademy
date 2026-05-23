# Reports Command Center

## Scope

Implemented `/admin/reports` as the super-admin command center using the existing six-section dashboard structure:

1. Cycle overview: active cycle, application tempo, acceptance rate, capacity, and category windows.
2. Pipeline funnel: the 11 applicant stages, stage drop-off, and average time at stage.
3. Department breakdown: category distribution, eligibility pass rate, and top rejection reasons.
4. Test results: per-test pass/fail/pending cards and governorate by test-kind `HeatmapChart`.
5. Operational live status: active committees, medical queues, board sessions, and live exam sessions.
6. Governance and compliance: audit volume, high-sensitivity activity, anomaly signals, and integration health.

The design handoff also called for executive-only operational signals, so the page now includes an additional signal band above the six sections.

## Data Sources

- `MOCK.applicants`: cycle totals, registration tempo, stage funnel, category assignment, eligibility signals, and test pass/fail/pending counts.
- `MOCK.cycles` and `MOCK.categories`: active cycle metadata, capacity, dates, and open category state.
- `MOCK.committeeInstances`, `MOCK.medicalStations`, `MOCK.boardSessions`, and `MOCK.liveExamSessions`: live operational status.
- `MOCK.audit`: hourly governance activity, high-sensitivity operations, and anomaly candidates.
- `MOCK.adminPayments`, `MOCK.barcodeScans`, and biometric seeds: integration-health call volume context.

Backend integration contracts remain unchanged. In backend-enabled mode, the existing `/api/admin/reports/*` endpoints are still used; in explicit mock mode, reports derive from the seed-42 frontend corpus.

## Gaps Filled

- SLA breaches: bottleneck stages where average time exceeds the administrative threshold are surfaced in the new signal band.
- Stalled applicants: applicants currently sitting inside those bottleneck stages are counted explicitly.
- Reviewer load imbalance: committee queue spread and committees without same-day sign-off are highlighted.
- Medical pressure: medical stations exceeding the waiting-time threshold are counted.
- Audit anomalies: high-sensitivity audit volume and anomaly count are pulled forward instead of living only inside the governance section.

## Notes

- No new backend dependency was introduced.
- No chart library was added; all visuals continue to use existing inline-SVG report components.
- The implementation preserves RTL layout, admin accent theming, and the existing export/print affordances.
