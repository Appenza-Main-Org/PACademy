# Claude Code Prompt — Port Data Exchange Center from PACademy → PACademy.Internal

## Mission

Port the **current, production-grade Data Exchange center** from the cloud repo into the internal (on-prem) repo, **replacing the outdated copy** of the same feature there. The two repos must speak the **same workbook contract** so a file exported on one side imports cleanly on the other.

- **Source repo (canonical, copy FROM):** `https://github.com/Appenza-Main-Org/PACademy`
  - Frontend: `frontend/src/features/data-exchange/` (route `/admin/data-exchange`, supports `?cycleId=` query param)
  - Backend: `backend/admin/PACademy.Admin.Api/Modules/DataExchangeAdmin/` + the `CuratedSheets` registry / `CuratedContext` / `CuratedExamResolver`
- **Destination repo (outdated, replace IN):** `https://github.com/Appenza-Main-Org/PACademy.Internal`
  - Contains an older version of the same import/export feature. Locate it in Phase 0. Its UI surface and route must be **replaced in place** (same screen the internal admin already uses), not added as a parallel page.

## Business round-trip (the contract everything must satisfy)

1. **External (cloud) admin** exports the cycle workbook first: cycle settings + applicants + reservations/schedules sheets. File name pattern `data-exchange-{cycle}-{yyyyMMdd-HHmmss}.xlsx`, curated snapshot, fixed sheet names, stable per-row unique keys, strictly cycle-scoped.
2. **Internal admin** imports that exact workbook on the (newly ported) Data Exchange screen — cycle settings and applicants land in the internal DB.
3. **Internal admin** runs exams and records results. **In PACademy.Internal, applicant exam data lives in the DB tables `applicant_tests` and `applicant_tests_results`. These two tables are the single source of truth for the internal export.** All exam/exam-result sheets in the internal export MUST read from them — never from a legacy bucket, never from a mock, never from a re-imported copy of the cloud sheets.
4. **Internal admin** exports the updated workbook. It must be importable on the cloud side with the existing field-level reconciliation (per-applicant diffs, selective accept/reject before commit) working unchanged.

Round-trip invariant: `external export → internal import → internal updates → internal export → external import` must reconcile by the same per-row unique keys end-to-end. Row keys generated on export side A must survive side B's import/export untouched.

---

## Phase 0 — Scope gate (MANDATORY, no edits before report is approved)

Clone/read BOTH repos. Produce a written audit report and **STOP — do not write or edit any code until the report is reviewed and approved.**

The report must contain:

1. **Source feature inventory** — every file in `PACademy/frontend/src/features/data-exchange/` and `PACademy/backend/.../Modules/DataExchangeAdmin/` (+ `CuratedSheets`, `CuratedContext`, `CuratedExamResolver`, `OperationalRecordsService` touchpoints), with one-line purpose each.
2. **Destination outdated-feature inventory** — where the old import/export feature lives in `PACademy.Internal` (frontend route, components, services, backend module/endpoints), and which screen the internal admin currently uses for the first import. List every file that will be replaced, modified, or deleted.
3. **Workbook contract dump** — the exact current sheet registry from the source: sheet names, column lists, per-row unique key column for each sheet (`relative_id`, `result_id`, `condition_id`, `lookup_row_id`, …), which sheets are export-active vs import-only-legacy.
4. **Internal schema audit** — actual columns of `applicant_tests` and `applicant_tests_results` in PACademy.Internal (from EF entities/migrations or DB), plus how applicants and cycles are keyed internally (NID? applicant id? cycle id format?).
5. **Mapping proposal** — sheet-column ↔ `applicant_tests` / `applicant_tests_results` column mapping for the exam/results sheets, flagging every column with no direct counterpart. For each gap: propose resolution (derive, lookup, leave blank-with-warning). **Do not invent columns. Do not propose schema changes to `applicant_tests` / `applicant_tests_results` without an explicit STOP-AND-ASK.**
6. **Divergence list** — anything in the outdated internal feature that the new one does NOT cover (extra sheets, extra statuses, internal-only behaviors). Each item: keep / drop / migrate, with justification traceable to the BRD or current behavior.
7. **Stack delta** — confirm internal repo's frontend/backend stack versions match the source's assumptions (React 18 + TS + Vite + TanStack Query + Zustand + Tailwind + Radix; .NET + EF Core + ClosedXML). Flag any dependency the port would need to add. **Adding new dependencies requires approval.**

⛔ **GATE 0:** Post the report. Wait for approval.

---

## Phase 1 — Backend port (internal repo)

1. Port the `DataExchangeAdmin` module structure into PACademy.Internal's backend, preserving: curated snapshot export, fixed sheet names, per-row unique keys, cycle scoping, unique timestamped file names, the memoized per-export context pattern (`ctx.ApplicantsAsync()`-style — never re-query applicants per sheet inside loaders).
2. **Rewire data sources for the internal plane:**
   - Applicant exam sheets read from `applicant_tests`.
   - Exam-result sheets read from `applicant_tests_results`.
   - Joins to applicants/cycles use the internal keys identified in Phase 0.
   - Export change-filter: only rows where `updated_at <> created_at` qualify as "updates" for the exchange export (same rule as source).
3. **Import path:** importing the cloud workbook writes cycle settings + applicants into the internal tables; importing exam data (if present in an inbound file) follows the same reconciliation pattern — per-row diff, no silent overwrite. **No hard-rejection rules on import that aren't traceable to the BRD — anything else is a soft warning.**
4. Preserve all source conventions: snake_case columns, `sealed record` DTOs, `sealed class` use cases, `ErrorCodes.*` constants, FluentValidation, `created_at`/`updated_at`/`row_version`. Lookups-driven values only — **no new enums**.
5. If `applicant_tests` / `applicant_tests_results` lack a column the workbook contract needs (e.g., a stable per-row exchange key), STOP-AND-ASK with the exact proposed migration before writing it.

⛔ **GATE 1:** After the export endpoint produces its first internal workbook, post a summary (sheets produced, row counts, source tables hit per sheet) and wait for approval before the import path.

---

## Phase 2 — Frontend port (internal repo)

1. Port `features/data-exchange/` into the internal frontend, **replacing the outdated screen at its existing route** so internal admins land on the new UI where the first import previously occurred. Keep `?cycleId=` deep-link support.
2. Keep: per-domain layouts + filter chips, change-tracking views, reconciliation UX (bulk-approve, scrollable diff list), Arabic RTL labels («استيراد وتصدير البيانات»), Eastern Arabic numerals, logical CSS properties.
3. Wire to the internal backend endpoints via TanStack Query only (no `useEffect` fetching). Radix primitives go through the internal repo's `shared/components/` wrappers — if a wrapper is missing, create it there first.
4. RBAC: gate the screen with the **internal/on-prem RBAC plane** role that owns data exchange (System Manager per BRD §2.1). Never reference or import anything from the cloud `cloudPermissions.ts` model — the two planes must not cross-contaminate.
5. Delete the outdated feature's dead files once the replacement is verified — list deletions in the commit body.

---

## Phase 3 — Round-trip compatibility verification

1. **Golden-file test:** take a real export produced by the source repo's current code (or generate one against the source repo) and import it into the internal backend in a test. Acceptance: zero unknown-sheet errors, zero unknown-column hard failures, all applicants + cycle settings land, row keys preserved.
2. **Reverse test:** seed `applicant_tests` + `applicant_tests_results` with deterministic data (seed-42 LCG pattern), export from internal, and assert the workbook validates against the source contract: same sheet names, same column sets, per-row keys present and stable across two consecutive exports, `updated_at <> created_at` filter respected.
3. **Reconciliation test:** modify one result row internally, export, simulate cloud import diffing — the diff must isolate exactly the changed field on the changed applicant.
4. Anti-regression: run the internal repo's existing test suite + a smoke pass on the screens adjacent to the replaced route; nothing outside the declared file scope may change behavior.

⛔ **GATE 2:** Post verification results before final cleanup/merge.

---

## Hard constraints

- **File scope freeze:** Only files listed in the approved Phase 0 report may be touched. Everything else in PACademy.Internal is frozen. The source repo (`PACademy`) is **read-only** — zero edits there.
- **One conventional commit per file/page/fix**, grep-provable acceptance criteria in commit bodies (e.g., `grep -r "applicant_tests_results" Modules/DataExchange` proves the rewire).
- **No new enums. No new lookup seed rows requiring code changes. No new dependencies without approval.**
- **No schema changes to `applicant_tests` / `applicant_tests_results` without an explicit approved STOP-AND-ASK.**
- **Workbook contract is owned by the source repo.** If the port is tempted to change a sheet name, column, or key format, that is a STOP-AND-ASK — the cloud side will not be changing to match.
- Performance: reuse the memoized-context export pattern; per-applicant lookups must seek indexes, never materialize whole tables.
- All UI text Arabic RTL; no hex colors outside `tokens.css`; no `any`; no default exports.

## Deliverables

1. Phase 0 audit report (gate).
2. Internal backend `DataExchange` module reading from `applicant_tests` / `applicant_tests_results` (gate after export).
3. Internal frontend Data Exchange screen replacing the outdated one, on-prem RBAC-gated.
4. Round-trip verification report with golden-file + reverse + reconciliation test results (gate).
5. Deletion list of the outdated feature's files.
