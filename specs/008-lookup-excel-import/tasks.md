# Tasks: Lookup Excel + CSV Import

**Input**: Design documents from `/specs/008-lookup-excel-import/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/import-orchestrator.md, quickstart.md

**Tests**: Per Constitution Principle II (NON-NEGOTIABLE), test tasks below are MANDATORY. Every user story includes test-first tasks for: business logic (failing test before implementation), each new UI component (render smoke + one user-interaction test + an a11y assertion via `jest-axe`), and the critical user journey (Playwright E2E). MSW for all network mocking; no live network. `.skip` / `.only` MUST NOT reach `main`. Coverage thresholds (CI): ≥ 80% statements, ≥ 75% branches, 100% on `import-runner` (it sits in the form-validation / mutation path).

**Organization**: Tasks are grouped by user story so each story (P1 → P2 → P3) can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = P1 bulk-load, US2 = P2 template download, US3 = P3 conflict resolution)
- All file paths are repo-root-relative

## Path Conventions

- Components: `frontend/src/features/admin/components/lookups/`
- Importer modules: `frontend/src/features/admin/api/lookup-import/`
- Tests: colocated next to source (`*.test.ts`, `*.test.tsx`)
- Playwright E2E: `frontend/e2e/`
- No `backend/` changes — the 21 lookup endpoints from spec 007 are reused verbatim

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the two parser libraries and create the empty module / component directories so all later tasks have well-defined homes.

- [ ] T001 Install runtime deps: `npm --prefix frontend i xlsx papaparse` and dev types `npm --prefix frontend i -D @types/papaparse` (SheetJS ships its own types). Confirm `xlsx` is recorded in `frontend/package.json` so the lazy-chunk import resolves.
- [ ] T002 [P] Create directory `frontend/src/features/admin/components/lookups/` (alongside any existing lookup components) — placeholder `.gitkeep` if empty.
- [ ] T003 [P] Create directory `frontend/src/features/admin/api/lookup-import/` with an empty `index.ts` barrel.
- [ ] T004 [P] Add the `import_completed` audit-action label to the action-label registry in `frontend/src/shared/lib/audit.ts` (Arabic display: `استيراد جماعي`). No emit yet — wiring happens in T035.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, the LookupKey discriminator, and the schema-map skeleton — everything every user story imports. No user-story task can begin until this phase is complete.

**⚠️ CRITICAL**: Blocks all three user-story phases.

- [ ] T005 Define the `LookupKey` union (21 members: `governorates`, `specializations`, `ranks`, `colleges`, `qualifications`, `nationalities`, `relationships`, `caseTypes`, `educationTypes`, `maritalStatuses`, `universities`, `faculties`, `specialties`, `specialtyTypes`, `degreeTypes`, `jobs`, `examTypes`, `examGroups`, `committeeTypes`, `rejectionReasons`, `notificationDepartments`) plus the `LOOKUP_PATHS: Record<LookupKey, string>` map (resource path per spec 007 split) in `frontend/src/features/admin/api/lookup-import/types.ts`.
- [ ] T006 [P] In the same `types.ts`, add the runtime enums + interfaces from data-model.md: `RowClassification`, `RowOutcome`, `ConflictResolution` (split per `active_collision` vs `archived_collision`), `RowError` (discriminated by `code`), `ImportRejection`, `ParsedRow`, `ConflictDescriptor`, `ImportSummary`, `ImportSession` (with the `'idle' | 'parsing' | 'preview' | 'committing' | 'done' | 'cancelled'` phase machine), `BackendPayload`, `EnumMap`, `ParentLookup`, `LookupSchema`. Strict TS — no `any`, no `!`.
- [ ] T007 Create the empty schema map skeleton in `frontend/src/features/admin/api/lookup-import/arabic-schema.ts`: `export const ARABIC_SCHEMAS: Record<LookupKey, LookupSchema> = { … }` with all 21 keys present but `mapRow` left throwing `not_implemented` for now. Compiles + typechecks; entries fill in during US1.
- [ ] T008 [P] Wire the `lookup-import` barrel `frontend/src/features/admin/api/lookup-import/index.ts` to re-export the public surface from contracts/import-orchestrator.md (`parseImportFile`, `classifyImportRows`, `createImportRunner`, `buildTemplate`, `ARABIC_SCHEMAS`, and all named types). Stubs throw `not_implemented` so the barrel typechecks before US1 lands.

**Checkpoint**: Foundation ready — all three user stories can start in parallel.

---

## Phase 3: User Story 1 — Bulk-load a lookup from a clean Excel/CSV (Priority: P1) 🎯 MVP

**Goal**: A super-admin opens any lookup tab, clicks **استيراد من ملف**, picks a clean `.xlsx` or `.csv` file matching the Arabic-header schema, sees a count of valid rows, clicks **استيراد**, and watches the table refresh with the imported rows.

**Independent Test**: On the *Nationalities* tab with 14 existing rows, import a 10-row Excel file with valid, unique keys → preview shows "10 valid · 0 conflicts" → commit → table refreshes to 24 active rows and a success toast confirms count.

### Tests for User Story 1 (REQUIRED — Constitution Principle II) ⚠️

> Write these tests FIRST and confirm they FAIL before implementation. UI components additionally require a render smoke test, one interaction test, and an `axe` assertion.

- [ ] T009 [P] [US1] Schema-map unit tests in `frontend/src/features/admin/api/lookup-import/arabic-schema.test.ts` — for each of the 21 lookups: required-headers list non-empty, `mapRow` round-trips an Arabic-header row to the expected `BackendPayload`, enum lookups bidirectional, hierarchical schemas reject unknown parent `key`s.
- [ ] T010 [P] [US1] xlsx-parser unit tests in `frontend/src/features/admin/api/lookup-import/xlsx-parser.test.ts` — fixtures: well-formed workbook → rows; multiple sheets → only first parsed; password-protected → `corrupted` rejection; > 1000 data rows → `too_many_rows`; > 5 MB → `too_large`.
- [ ] T011 [P] [US1] csv-parser unit tests in `frontend/src/features/admin/api/lookup-import/csv-parser.test.ts` — fixtures: plain UTF-8, UTF-8-with-BOM (stripped silently), Windows-1256 bytes (rejected as `unsupported_format`), mixed CRLF/LF, quoted field with embedded comma, quoted field with embedded newline, doubled-quote escape, trailing blank lines (no rows produced), empty file (`empty` rejection).
- [ ] T012 [P] [US1] conflict-detector unit tests in `frontend/src/features/admin/api/lookup-import/conflict-detector.test.ts` — fixtures: all-valid set; intra-file duplicate; FK not found; FK archived; everything-OK after shape pass. Mocks the `useLookupList` cache via TanStack Query test utilities.
- [ ] T013 [P] [US1] import-runner unit tests in `frontend/src/features/admin/api/lookup-import/import-runner.test.ts` using MSW — fixtures: all-create success, partial failure (3 of 10 rows return 500 → outcomes recorded as `errored`, run completes), abort mid-flight (in-flight rows complete; queued rows not started). Confirms the parallelism cap of 4.
- [ ] T014 [P] [US1] `ImportLookupModal` component test in `frontend/src/features/admin/components/lookups/ImportLookupModal.test.tsx` — render smoke (modal opens for `super_admin`), interaction (drag a fixture file onto the dropzone → preview phase reached), and `axe` assertion on the open modal.
- [ ] T015 [P] [US1] Playwright E2E in `frontend/e2e/lookup-import.spec.ts` — Governorates happy path: log in as super_admin → navigate to `/admin/reference-data/governorates` → click *استيراد من ملف* → upload `frontend/e2e/fixtures/governorates-27-rows.xlsx` → preview shows "27 صالحة · 0 تعارض" → click *استيراد* → table renders 27 rows.

### Implementation for User Story 1

- [ ] T016 [P] [US1] Fill in `ARABIC_SCHEMAS` entries for the 14 simple lookups (`governorates`, `specializations`, `ranks`, `colleges`, `qualifications`, `nationalities`, `relationships`, `caseTypes`, `educationTypes`, `maritalStatuses`, `jobs`, `committeeTypes`, `rejectionReasons`, `notificationDepartments`) in `frontend/src/features/admin/api/lookup-import/arabic-schema.ts`: required + optional Arabic headers, enum maps (forward + reverse), `mapRow` producing the backend payload that matches the existing service's `packRow` shape per lookup.
- [ ] T017 [P] [US1] Fill in `ARABIC_SCHEMAS` entries for the 7 typed / hierarchical lookups (`universities`, `faculties`, `specialties`, `specialtyTypes`, `degreeTypes`, `examTypes`, `examGroups`) — including `parentLookup` non-null for `faculties` (→ `universities`) and `specialties` (→ `specialtyTypes`); `mapRow` resolves the parent `المفتاح` to the parent's Guid via the supplied `ParentLookup`.
- [ ] T018 [US1] Implement `frontend/src/features/admin/api/lookup-import/xlsx-parser.ts` — dynamic `import('xlsx')` inside the parse function so the lookup-page bundle stays flat; reads first sheet only; enforces the file-size cap (5 MB) and row-count cap (1000) before parse; returns `{ rows, rejection }`. Depends on T010 passing.
- [ ] T019 [US1] Implement `frontend/src/features/admin/api/lookup-import/csv-parser.ts` — read file as a `Blob`, sniff and strip UTF-8 BOM (`0xEF 0xBB 0xBF`), decode with `new TextDecoder('utf-8', { fatal: true })`, hand the resulting string to PapaParse with `header: true` + `skipEmptyLines: true`. Same `{ rows, rejection }` shape. Depends on T011 passing.
- [ ] T020 [US1] Implement the `parseImportFile` orchestrator in `frontend/src/features/admin/api/lookup-import/parseImportFile.ts` (or co-located in `index.ts` — pick one and stick with it) — picks xlsx vs csv parser by file extension, validates the parsed header row against `ARABIC_SCHEMAS[key].requiredHeaders`, runs the schema's `mapRow` over each row to produce `payload` or `RowError`, returns the `ParsedRow[]` with shape-pass classification (`'valid'` / `'errored'`).
- [ ] T021 [US1] Implement `frontend/src/features/admin/api/lookup-import/conflict-detector.ts` exporting `classifyImportRows(rows, lookupKey)` — fetches destination rows (active + archived) via the existing lookup query with `staleTime: 0`; for hierarchical lookups also fetches the parent rows; partitions into `valid` / `active_collision` / `archived_collision` / `errored`; detects intra-file duplicates (second + occurrences become `errored` with `code: 'duplicate_in_file'`). Depends on T012 passing.
- [ ] T022 [US1] Implement `frontend/src/features/admin/api/lookup-import/import-runner.ts` exporting `createImportRunner(session, onProgress)` — parallelism-capped (default 4) worker pool; `'valid'` rows → `POST /admin/<lookup>`; per-row outcomes written back to the row and emitted via `onProgress`; returns the resolved `ImportSummary`. Update / restore paths are stubbed in US1 (treated as `errored` so the contract holds) and finished in T038/T039. Depends on T013 passing.
- [ ] T023 [US1] Wire the FR-012 summary audit in `import-runner.ts` — after the runner finishes, call `emitAudit({ action: 'import_completed', module: 'lookups', entityType: lookupKey, entityLabel: fileName, details: '<n> created, <m> updated, …' })` only when at least one mutating outcome occurred. (Per-row audit comes for free from the existing REST mutation pipeline — no extra emit.)
- [ ] T024 [P] [US1] Build `ImportLookupButton` in `frontend/src/features/admin/components/lookups/ImportLookupButton.tsx` — header-row trigger that opens the modal; renders only when the current user has the destination lookup's write permission (FR-016 defence-in-depth check at submit time too).
- [ ] T025 [P] [US1] Build `ImportLookupDropzone` in `frontend/src/features/admin/components/lookups/ImportLookupDropzone.tsx` — re-uses shared `<FileUpload>`; restricts to `.xlsx` / `.csv` extensions; surfaces the `ImportRejection` discriminator with the correct Arabic message per case (too_large / too_many_rows / unsupported_format / corrupted / empty / schema_mismatch).
- [ ] T026 [US1] Build `ImportLookupPreview` in `frontend/src/features/admin/components/lookups/ImportLookupPreview.tsx` — virtualised `<DataTable>` showing all parsed rows with their classification + Arabic counts header (`"X صالحة · Y تعارض نشط · Z تعارض مؤرشف · W خطأ"`). US1 scope: read-only counts + the *استيراد* button enabled only when `errored === 0 && conflicts === 0`. Conflict resolution UI is added by US3.
- [ ] T027 [US1] Build `ImportLookupResult` in `frontend/src/features/admin/components/lookups/ImportLookupResult.tsx` — post-commit summary panel with the five outcome counts, an expandable "show errored rows" section, and a *إغلاق* action that closes the modal and invalidates the lookup's TanStack Query cache so the table refreshes.
- [ ] T028 [US1] Build `ImportLookupModal` in `frontend/src/features/admin/components/lookups/ImportLookupModal.tsx` — the wizard host driving the `ImportSession` state machine through `idle → parsing → preview → committing → done` (and `cancelled` from any phase). Composes Dropzone → Preview → Result. Uses `parseImportFile`, `classifyImportRows`, `createImportRunner`. Depends on T024–T027.
- [ ] T029 [US1] Mount `ImportLookupButton` in the lookup page header on `frontend/src/features/admin/pages/ReferenceDataPage.tsx` (and any other lookup pages with their own headers — e.g., Universities/Faculties/Specialties stand-alone pages if they exist). Pass the current `lookupKey` so the modal targets the right schema + endpoint.

**Checkpoint**: US1 fully functional — bulk import on the happy path works end-to-end for every one of the 21 lookups. Demoable as MVP.

---

## Phase 4: User Story 2 — Download a per-lookup template (Priority: P2)

**Goal**: From the import modal, the admin clicks **تنزيل القالب** and receives an `.xlsx` whose first sheet has the Arabic-header schema for the current lookup plus a single example row.

**Independent Test**: On each of the 21 lookup tabs, click *تنزيل القالب* → file downloads → opening it in Excel shows the schema's headers and a sample row that, if uploaded unchanged, parses to "1 row valid · 0 conflicts".

### Tests for User Story 2 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T030 [P] [US2] template-writer unit tests in `frontend/src/features/admin/api/lookup-import/template-writer.test.ts` — fixture per lookup (21 cases): generated Blob is a valid xlsx, first sheet row 1 equals `[...requiredHeaders, ...optionalHeaders]` in canonical order, row 2 contains the per-schema sample with valid enum values.
- [ ] T031 [P] [US2] Interaction test in `ImportLookupModal.test.tsx` (extend the existing test file from T014) — clicking *تنزيل القالب* triggers a Blob download with the expected filename `<lookupKey>-template.xlsx`.

### Implementation for User Story 2

- [ ] T032 [US2] Implement `frontend/src/features/admin/api/lookup-import/template-writer.ts` exporting `buildTemplate(lookupKey): Blob` — dynamic `import('xlsx')` (re-uses the lazy chunk from xlsx-parser), assembles a workbook with the schema's headers and a per-lookup sample row, sets column widths to fit Arabic text, returns the Blob with the correct MIME type.
- [ ] T033 [US2] Wire **تنزيل القالب** in `ImportLookupModal.tsx` — secondary button next to *رفع ملف*, calls `buildTemplate(lookupKey)` and triggers download via a temporary anchor (`URL.createObjectURL` + click + revoke).

**Checkpoint**: Admins can self-serve the right schema for every lookup before uploading. US1 + US2 work independently.

---

## Phase 5: User Story 3 — Preview, resolve conflicts, partial-import (Priority: P3)

**Goal**: When the file has duplicate keys, missing cells, or unknown FKs, the preview lists every problem row with a per-conflict resolution control. The admin resolves each, commits, and sees the per-row outcomes in the result panel — including any *restored* rows from `archived_collision` resolutions.

**Independent Test**: Upload a 20-row file with 3 active-key collisions, 2 missing-required-cell rows, and 1 unknown-parent-key row → preview reports `14 صالحة · 3 تعارض نشط · 0 تعارض مؤرشف · 3 خطأ` → set every collision to *Skip* → commit inserts exactly the 14 valid rows. Repeat with an archived-collision fixture and verify *Restore + Update* yields `outcome: 'restored'`.

### Tests for User Story 3 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T034 [P] [US3] Conflict-detector tests in `conflict-detector.test.ts` (extend T012) — fixtures: active collision flagged with `existingId` + diff snapshot; archived collision flagged as distinct subtype with default `resolution: 'skip'`; rename-required path reclassifies after the key edit.
- [ ] T035 [P] [US3] import-runner tests in `import-runner.test.ts` (extend T013) — fixtures: `'update'` resolution → `PATCH`; `'restore_update'` → `POST .../restore` then `PATCH`; `'skip'` → no HTTP, outcome `'skipped'`; `'abort'` → global cancel before any writes.
- [ ] T036 [P] [US3] `ImportConflictRow` component test in `frontend/src/features/admin/components/lookups/ImportConflictRow.test.tsx` — render both variants (active vs archived), interaction (changing the resolution dropdown updates the parent state, *New Key Required* renders an inline editor and revalidates the row), `axe` assertion.
- [ ] T037 [P] [US3] Playwright E2E in `frontend/e2e/lookup-import-conflicts.spec.ts` — Faculties tab with a fixture file containing one archived-collision + one active-collision + one FK-not-found row → admin picks *Restore + Update* on the archived row, *Skip* on the active row, leaves the FK error row excluded → commits → table reflects exactly the expected post-state.

### Implementation for User Story 3

- [ ] T038 [US3] Build `ImportConflictRow` in `frontend/src/features/admin/components/lookups/ImportConflictRow.tsx` — discriminated on `ConflictDescriptor.type`: for `active_collision` renders the `Skip | Update | Abort` dropdown; for `archived_collision` renders `Skip (default) | Restore + Update | New Key Required`. *New Key Required* enables an inline `المفتاح` editor that triggers a re-classify of just that row on blur.
- [ ] T039 [US3] Extend `ImportLookupPreview` (from T026) — render `ImportConflictRow` for every row with `classification` in `{'active_collision', 'archived_collision'}`; gate the *استيراد* button until every conflict has a resolution and `errored === 0` for non-rename-required rows; surface *إلغاء* that transitions the session to `'cancelled'` without writing.
- [ ] T040 [US3] Extend `import-runner.ts` (from T022) — handle all four resolutions: `'update'` → `PATCH /admin/<lookup>/{id}`; `'restore_update'` → `POST /admin/<lookup>/{id}/restore` then `PATCH /admin/<lookup>/{id}`; `'skip'` → no HTTP, write `outcome: 'skipped'`; `'abort'` → cancel the whole run before any writes (returns an empty summary, no audit).
- [ ] T041 [US3] Add a `reclassifyRow(rowIndex, newKey, lookupKey)` helper to `conflict-detector.ts` — runs the collision pass for one row using the cached parent / destination snapshots so the *New Key Required* path resolves instantly without re-fetching.

**Checkpoint**: All three user stories independently functional. Feature is demo-complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification that ties everything together — coverage gates, bundle budget, a11y, and quickstart walkthrough.

- [ ] T042 [P] Confirm coverage gates per Principle II: ≥ 80% statements, ≥ 75% branches across the new modules; 100% on `import-runner.ts` (mutation path). Add targeted unit tests to close any gaps surfaced by `npm --prefix frontend run test -- --coverage`.
- [ ] T043 Bundle-size regression check: run `npm --prefix frontend run build` and confirm the lookup-page route stays ≤ 250 KB gzipped (per plan.md Performance Goals). Verify the `xlsx` chunk is lazy and only fetched when the modal opens — inspect the dist output for a separate `xlsx-*.js` chunk.
- [ ] T044 [P] Verify performance budgets on a mid-tier laptop fixture: parse + classify a 1000-row `.xlsx` ≤ 3 s; parse + classify a 1000-row `.csv` ≤ 1 s; commit of 100 rows ≤ 30 s with concurrency = 4. Record the numbers in `specs/008-lookup-excel-import/quickstart.md` developer-notes section.
- [ ] T045 [P] A11y sweep — keyboard-navigate the entire dropzone → preview → conflict-resolution → commit → result flow in RTL Arabic; confirm focus management, `axe` 0 violations on every phase, `prefers-reduced-motion` honoured on the progress bar.
- [ ] T046 Run the quickstart.md walkthrough against the dev server end-to-end on Governorates (US1), Faculties (US3 — archived collision + FK), and Specialties (US2 template download). Record any deltas in quickstart.md so it stays the operator source of truth.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1; BLOCKS all user-story phases.
- **User Stories (Phases 3 / 4 / 5)**: All depend on Phase 2. US1 is the MVP and unblocks demo; US2 + US3 can run in parallel with US1 once Phase 2 is done if staffed.
- **Polish (Phase 6)**: Depends on the user stories you intend to ship.

### Within Each User Story

- Tests are written and confirmed FAILING before implementation tasks for the same story land.
- Schema entries (T016 / T017) and parsers (T018 / T019) before the orchestrator (T020); orchestrator before the conflict detector (T021); detector before the runner (T022); runner before the modal (T028).
- US3's runner extension (T040) depends on US1's runner skeleton (T022). US3's preview extension (T039) depends on US1's preview shell (T026).

### Parallel Opportunities

- Phase 1: T002 / T003 / T004 are `[P]` — independent files.
- Phase 2: T006 / T008 are `[P]` (T008 only after T005/T007 stabilise the public surface).
- US1 tests T009–T015 are all `[P]` — each touches a distinct test file.
- US1 implementation: T016 + T017 (schema halves) + T024 + T025 are `[P]` — different files.
- US2 tests T030 + T031 are `[P]`.
- US3 tests T034–T037 are `[P]`.
- Polish: T042 / T044 / T045 are `[P]`.

---

## Parallel Example: User Story 1 (after Phase 2 completes)

```bash
# All US1 tests in parallel — failing before implementation:
Task: "Schema-map tests in frontend/src/features/admin/api/lookup-import/arabic-schema.test.ts"
Task: "xlsx-parser tests in frontend/src/features/admin/api/lookup-import/xlsx-parser.test.ts"
Task: "csv-parser tests in frontend/src/features/admin/api/lookup-import/csv-parser.test.ts"
Task: "conflict-detector tests in frontend/src/features/admin/api/lookup-import/conflict-detector.test.ts"
Task: "import-runner tests in frontend/src/features/admin/api/lookup-import/import-runner.test.ts"
Task: "ImportLookupModal test in frontend/src/features/admin/components/lookups/ImportLookupModal.test.tsx"
Task: "Playwright happy path in frontend/e2e/lookup-import.spec.ts"

# Schema halves + leaf components in parallel:
Task: "ARABIC_SCHEMAS entries for the 14 simple lookups"
Task: "ARABIC_SCHEMAS entries for the 7 typed/hierarchical lookups"
Task: "ImportLookupButton component"
Task: "ImportLookupDropzone component"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2 (Setup + Foundational).
2. Phase 3 (US1) end-to-end — happy-path bulk import.
3. **STOP**: run quickstart.md US1 walk-through on Governorates. If green, demo the MVP.

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 → demo bulk-import MVP.
3. US2 → demo template downloads (zero-friction onboarding).
4. US3 → demo conflict resolution + archived-collision restore.
5. Polish → coverage + bundle + a11y verified for CI.

### Parallel Team Strategy

- Phase 1 + Phase 2 done together (single dev pass — small).
- Once Phase 2 is done:
  - Dev A: US1 (the load-bearing story).
  - Dev B: US2 (small, independent — template generator + one button).
  - Dev C: US3 (conflict resolution + runner extension; coordinates with Dev A only on `import-runner.ts` line ownership).

---

## Notes

- `[P]` = different files, no dependencies.
- `[US#]` = traceability to the user story in spec.md.
- The 21 backend endpoints from spec 007 are unchanged; this feature is frontend-only.
- The `xlsx` library MUST stay behind a dynamic `import('xlsx')` — eager import in any non-import-modal file breaks the lookup-page bundle budget.
- Skipped (`.skip`) or focused (`.only`) tests MUST NOT reach `main` per Principle II.
- Commit cadence: one commit per task (or one per logical small group, e.g., T002 + T003 + T004 together). Stop at the checkpoint after each phase to validate before moving on.
