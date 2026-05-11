# Implementation Plan: Lookup Excel + CSV Import

**Branch**: `008-lookup-excel-import` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-lookup-excel-import/spec.md`

## Summary

Bulk-load any of the 21 lookup tables from an `.xlsx` or `.csv` file. The flow
is upload → preview → resolve conflicts → commit, with per-row outcomes
audited as if they were hand-edits.

**Technical approach** (validated against the four clarifications resolved in
spec session 2026-05-11):

1. **Frontend-only feature.** No new backend endpoints. The importer
   orchestrates per-row calls against the dedicated lookup REST resources
   wired in spec 007 (`/admin/governorates`, `/admin/faculties`, …).
2. **Parsing happens client-side** in the user's browser. `.xlsx` via
   SheetJS (`xlsx`) — lazy-loaded so the lookup pages keep their per-route
   bundle budget intact. `.csv` via `papaparse` — small enough to load
   eagerly. UTF-8 enforced on CSV (BOM stripped silently).
3. **Arabic headers map to backend fields via a static schema** per
   lookup type. The schema is colocated with the importer (one file, 21
   entries) and is the single source of truth for the template generator,
   the parser, and the validator.
4. **Two-pass conflict detection.** First pass: validate row shapes
   in-memory. Second pass: fetch the current rows of the destination
   lookup once (re-using the page's TanStack Query cache when available)
   and partition incoming rows into `valid`, `active_collision`,
   `archived_collision`, `errored`. Both conflict subtypes get separate
   resolution UI per FR-008/FR-008a.
5. **Commit is per-row, best-effort.** A sequenced runner walks the
   accepted rows, calls the appropriate `POST` / `PATCH` /
   `POST .../restore` endpoint, and records each outcome. Failures don't
   abort the run; they are reported in the per-row summary.
6. **Audit is hybrid** (FR-012 / FR-012a): the per-row endpoints already
   emit hand-edit audit entries by virtue of going through the normal
   write path, so per-row audit comes "for free". The importer adds one
   `import_completed` summary entry at the end via the existing audit
   helper.

## Technical Context

**Language/Version**: TypeScript 5.6, strict mode (no `any`, no `!`, no
`@ts-ignore` — `@ts-expect-error` with rationale only). React 18.
**Primary Dependencies**:
- **SheetJS / xlsx** ≥ 0.20 — `.xlsx` parsing in the browser. The
  community-edition tree-shaken build is ~190 KB gzipped of the
  ~430 KB full bundle. Lazy-loaded via dynamic `import('xlsx')` from
  the import modal so the lookup page itself absorbs zero of this
  cost. **Requires Principle I dependency-justification entry** — see
  Complexity Tracking.
- **papaparse** ≥ 5.4 — battle-tested CSV parser, ~7 KB gzipped.
  Eager-loaded; well inside the 30 KB threshold.
- All other infrastructure (TanStack Query 5, react-hook-form, axios via
  `@/shared/api/client`, Tailwind, shared `<DataTable>` / `<Modal>` /
  `<Drawer>` / `<Toast>`) already in place.

**Storage**: None new. Imports write through the 21 dedicated REST
resources already backed by SQL Server tables (`governorates`,
`faculties`, …) — see spec 005 / spec 007 follow-up table split.

**Testing**:
- **Vitest** + **@testing-library/react** + **@testing-library/jest-dom**
  for unit + component tests (already used elsewhere in the repo).
- **jest-axe** for the accessibility assertion in every new component
  (per Principle II).
- **Playwright** for one E2E covering User Story 1 (P1) happy path on
  the Governorates tab, gated by the existing pre-commit + CI flow.
- All HTTP is mocked with **MSW** — no live network calls per
  Principle II.

**Target Platform**: Modern evergreen browsers (Chrome / Edge / Firefox /
Safari current releases). The product is RTL Arabic-first.

**Project Type**: Web application — frontend + existing backend. This
feature is implemented entirely under `frontend/`; no `backend/` changes
are required.

**Performance Goals**:
- Parse + preview a 1000-row `.xlsx` (Sprint 7's exam-types-like volume)
  in **≤ 3 s** on a mid-tier laptop.
- Parse + preview a 1000-row `.csv` in **≤ 1 s**.
- Commit 100 rows in **≤ 30 s** end-to-end (SC-001), driven by sequential
  HTTP per the 21-endpoint design with a small parallelism cap
  (default 4).
- The import modal MUST NOT block the rest of the page during parsing —
  use a queued `requestIdleCallback` chunking strategy if a Web Worker
  proves too heavy for the SheetJS import.

**Constraints**:
- File size ≤ **5 MB**, data rows ≤ **1000** (FR-004).
- CSV files MUST be **UTF-8** (FR-003a); other encodings rejected.
- Per-route bundle for any lookup page MUST stay ≤ **250 KB gzipped**
  after this feature lands. `xlsx` lazy-import is non-negotiable.
- Arabic strings only in admin-facing UI; centralised in the existing
  `@/shared/lib/strings` registry (Principle III).

**Scale/Scope**:
- 21 lookup types, each with a distinct Arabic-header schema.
- Typical import: 10–100 rows. Outliers up to 1000 rows
  (governorates → faculties → specialties cycle setup).
- Single concurrent admin per lookup expected; concurrent-import
  collisions are tolerated via the backend's per-row uniqueness
  guarantees (spec edge case).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify the plan against `.specify/memory/constitution.md` v1.1.0.

- **I. Code Quality & Maintainability** — TypeScript strict; no `any`,
  no `!`, no `@ts-ignore`. Single-responsibility components:
  `ExcelImportButton`, `ImportPreviewDrawer`, `ImportConflictRow`,
  `ImportRunner` (orchestrator). Soft target ≤ 150 lines per file; the
  per-lookup schema map will be split across the importer if it grows
  past the ceiling. Data fetching: TanStack Query (re-uses the existing
  `useLookupList(key)` cache). Named exports only. JSDoc on every public
  function. **Two new dependencies (xlsx, papaparse) declared in
  Complexity Tracking** because `xlsx` is > 30 KB.
  **PASS** with one approved exception (see Complexity Tracking row 1).

- **II. Testing Standards (NON-NEGOTIABLE)** — Test-first:
  - The Arabic-header → backend-field mapper has unit tests per lookup
    (21 fixture-driven specs).
  - The CSV parser path has fixture tests for UTF-8 BOM, mixed CRLF/LF,
    quoted fields with embedded commas, malformed quotes, empty rows.
  - The two-pass conflict detector has unit tests for: pure valid,
    active collision, archived collision, FK-not-found, intra-file
    duplicate, all error categories.
  - `ImportRunner` has unit tests with MSW for success / partial / all-fail.
  - `ImportPreviewDrawer` has a smoke + interaction + jest-axe test.
  - One Playwright E2E (Governorates happy path).
  - No `.skip` / `.only`. MSW-only network. Pre-commit hook + CI run.
  **PASS**.

- **III. UX Consistency** — Importer reuses shared `<Modal>`,
  `<Drawer>`, `<Button>`, `<DataTable>`, `<Toast>`, `<FileUpload>` from
  `frontend/src/shared/components`. No new design tokens; consumes
  `var(--accent-*)` via the page's `data-app="admin"` scope. RTL via
  logical properties only (`ms-*` / `me-*` / `text-start`). All four
  async states explicitly designed: idle (drop zone), loading (parsing
  spinner + progress bar during commit), empty (zero parsed rows shown
  with an informational empty state), error (rejection messages in
  Arabic for unsupported encoding, malformed file, schema mismatch).
  Reduced-motion respected on the parsing spinner. Responsive at
  ≤ 480 / ~768 / ≥ 1024 px — the conflict-resolution table degrades to
  a stacked card layout on narrow screens. **PASS**.

- **IV. Performance Requirements** — `xlsx` is loaded only inside the
  import modal via dynamic import; lookup pages themselves cost zero
  bytes for this feature. `papaparse` adds ~7 KB to the lookup-pages
  bundle — well inside the 250 KB per-route budget. The preview table
  virtualises if > 100 rows (re-uses the existing `<DataTable>`
  virtualisation primitive). The commit phase batches at most 4
  concurrent requests to avoid head-of-line blocking on the dev API.
  No `useMemo` / `useCallback` added speculatively. `font-display:
  swap` and `preconnect` already in place. **PASS**.

- **V. Spec-Driven Discipline** — `spec.md` stays tech-free; this
  plan owns all tech decisions. The PR will link back to
  `specs/008-lookup-excel-import/spec.md`. The Clarifications session
  is preserved in `spec.md` as part of the audit trail. **PASS**.

Violations: 1, justified — see **Complexity Tracking** below.

### Post-design re-check (after Phase 1)

All five principles re-checked against the structures in `data-model.md`,
`contracts/import-orchestrator.md`, and `quickstart.md`:

- **I. Code Quality**: 6 new components + 7 new util modules, each
  ≤ 200 lines target. Strict TS throughout. JSDoc covers the public
  surface listed in the contract. `arabic-schema.ts` exports a static
  typed map; no `any`. **Confirmed PASS.**
- **II. Testing**: data-model identifies 5 unit-test suites
  (schema, csv-parser, conflict-detector, runner, modal) plus 1
  Playwright E2E. Coverage budgets met by construction since every
  branch in `RowClassification` / `RowOutcome` / `ConflictResolution`
  is exhaustively tested. **Confirmed PASS.**
- **III. UX**: Quickstart walks through idle / loading / preview /
  committing / done / cancelled — the four async states are now
  enumerated as `ImportSession.phase` values. RTL-only Arabic copy. All
  components reuse shared library primitives. **Confirmed PASS.**
- **IV. Performance**: Dynamic-import for `xlsx` keeps lookup-page bundles
  flat. `papaparse` cost (~7 KB) is well inside per-route budget.
  Runner concurrency cap of 4 caps backend load. **Confirmed PASS.**
- **V. Spec discipline**: `spec.md` was re-checked end-to-end after
  this plan was drafted — no tech terms leaked back. **Confirmed PASS.**

No new violations surfaced during design; Complexity Tracking still has
exactly the one `xlsx` row.

## Project Structure

### Documentation (this feature)

```text
specs/008-lookup-excel-import/
├── plan.md                       # This file
├── research.md                   # Phase 0 — library choices + parsing strategy
├── data-model.md                 # Phase 1 — ImportSession, ConflictType, RowOutcome, schema map
├── quickstart.md                 # Phase 1 — operator's guide
├── contracts/
│   └── import-orchestrator.md    # Internal contract: ImportRunner + LookupSchemaMap interfaces
├── checklists/
│   └── requirements.md           # already exists from /speckit.specify + /speckit.clarify
└── tasks.md                      # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── features/
│   │   └── admin/
│   │       ├── components/
│   │       │   └── lookups/
│   │       │       ├── ImportLookupButton.tsx          # NEW — page-header trigger
│   │       │       ├── ImportLookupModal.tsx           # NEW — wizard host
│   │       │       ├── ImportLookupDropzone.tsx        # NEW — file picker + initial reject
│   │       │       ├── ImportLookupPreview.tsx         # NEW — parsed rows + conflict UI
│   │       │       ├── ImportConflictRow.tsx           # NEW — per-row resolution control
│   │       │       └── ImportLookupResult.tsx          # NEW — post-commit summary panel
│   │       └── api/
│   │           ├── lookup-import/
│   │           │   ├── arabic-schema.ts                # NEW — 21 lookup schemas
│   │           │   ├── xlsx-parser.ts                  # NEW — lazy-imported SheetJS wrapper
│   │           │   ├── csv-parser.ts                   # NEW — papaparse wrapper, UTF-8 enforcement
│   │           │   ├── conflict-detector.ts            # NEW — two-pass detection
│   │           │   ├── import-runner.ts                # NEW — sequenced commit orchestrator
│   │           │   ├── types.ts                        # NEW — ImportSession, RowOutcome, etc.
│   │           │   └── index.ts                        # NEW — barrel
│   │           └── (existing service files — no changes)
│   └── shared/
│       └── lib/
│           └── audit.ts                                # Add `import_completed` action label
└── (tests colocated next to source: *.test.ts, *.test.tsx)

backend/  (NO CHANGES — reuses existing 21 dedicated lookup endpoints)
```

**Structure Decision**: Web application (frontend + backend) layout from
the repo root. This feature lives entirely under
`frontend/src/features/admin/`. No backend files are touched; the 21 new
lookup endpoints from spec 007 are sufficient for create / update /
restore. The importer is colocated under `features/admin/api/lookup-import/`
rather than `shared/` because it's domain-specific to the admin lookup
pages — moving it to `shared/` would invert the architecture's import
direction (shared cannot import from features, per CLAUDE.md §3 / Principle V
of CLAUDE.md `Architecture rules`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **Dependency > 30 KB** — `xlsx` (SheetJS) at ~190 KB gzipped (tree-shaken community edition; ~430 KB full bundle) | `.xlsx` is a binary format (Open XML — zipped XML parts). Parsing it in the browser requires either SheetJS or ExcelJS; there is no smaller library and writing one in-house is out of scope. Spec FR-003 mandates `.xlsx` support. | Server-side parsing (avoid the dep in the browser) was considered and rejected: spec assumes client-side parsing (Assumption section), and adding a backend `POST /admin/<lookup>/import-file` endpoint that proxies xlsx + multipart would be a bigger change than this whole feature. **Mitigation**: lazy-loaded inside the import modal so it never reaches the lookup-page bundle. **Expiry**: re-evaluate once Sprint-10 bundle-budget CI lands and the lazy-chunk cost is measured. |
