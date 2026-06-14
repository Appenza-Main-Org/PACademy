# Phase 0 — Scope-Gate Audit Report
## Port Data Exchange Center: PACademy (cloud) → PACademy.Internal (on-prem)

**Date:** 2026-06-12 · **Status:** ⛔ GATE 0 — awaiting approval. No code written, edited, or deleted.

**Repos audited:**
- Source: `/Users/mohamedghareeb/Projects/PACademy/PACademy` (branch `staging`) — read-only for the entire port.
- Destination: `/Users/mohamedghareeb/Projects/PACademy.Internal/PACademy.Internal` (branch `dev_back_wired_init`, HEAD `4a30e60`; local is 1 commit behind origin — `843b514`, a style-only applicant-lookup change, irrelevant here).

**Headline findings (read these first):**

1. **The prompt's framing needs one correction:** PACademy.Internal's existing feature is *not* reading exam data from legacy buckets. Its export **already reads `applicant_tests` + `applicant_tests_results`** (`DataExchangeExportService.cs:78-80, 414-417`) and its import **already mirrors into them** via `EnsureApplicantTestsAsync` / `EnsureApplicantTestResultsAsync` (`DataExchangeImportService.cs:239-245, 1188-1330`). What is outdated is the **workbook contract**: the internal export emits legacy round-trip sheets (dynamic camelCase column unions + checksum/tracking columns) instead of the cloud's **curated snapshot** (fixed snake_case columns, stable per-row keys, cycle scoping), and the internal UI lacks the snapshot export, booked-roster panel, and applicants reconciliation surfaces.
2. **Neither repo builds xlsx on the backend.** Both exchange JSON sheet DTOs over HTTP and build/parse the workbook **in the frontend with SheetJS (`xlsx`)**. The prompt's stack assumption ".NET + ClosedXML" is wrong for the source: `PACademy.Admin.Api.csproj` has no Excel package at all. Internal has ClosedXML 0.104.2 referenced but **used nowhere** (leftover). → The port keeps the JSON-sheets + frontend-SheetJS pattern; **zero new dependencies needed**.
3. **No schema changes to `applicant_tests` / `applicant_tests_results` are needed.** Every column the workbook contract requires is either stored, derivable by join, or contractually-blank (see §5). No STOP-AND-ASK migration required.
4. A temporary dry-run harness already exists in the source repo (`backend/admin/PACademy.Admin.Api.Tests/TempWorkbookDryRunTests.cs`, untracked, marked "NOT FOR COMMIT") that replays a real internal workbook through the cloud import engine — a ready blueprint for the Phase 3 golden-file test.

---

## 1. Source feature inventory (PACademy — copy FROM)

### 1.1 Frontend — `frontend/src/features/data-exchange/` (11 files, ~3,366 LOC)

| File | Purpose |
|---|---|
| `index.ts` | Barrel — exports `DataExchangePage`, `SHEET_NAMES`, 7 public types |
| `types.ts` | LOCKED 18-tab `SHEET_NAMES` registry, `EXPORT_DOMAINS` (11 curated sheets), `DOMAIN_TITLES_AR`, 6-class import taxonomy, full reconciliation DTO set — mirrors backend `DataExchangeContracts.cs` |
| `api/dataExchange.service.ts` | 8 typed methods over `apiClient` (export, snapshot export, roster, import preview/apply, history, template, reconcile preview/commit) + seed-42 mock fallback |
| `api/queries.ts` | `dataExchangeKeys` factory, 2 queries (history, roster) + 6 mutations with invalidation |
| `lib/checksum.ts` | Frontend mirror of backend `RowChecksum` (mock-path only) |
| `lib/workbook.ts` | SheetJS (lazy `import('xlsx')`) build/parse, tab allow-list vs `SHEET_NAMES`, errors-workbook builder, `downloadBlob` |
| `pages/DataExchangePage.tsx` | Hub page — 3 tabs (export/import/history): presets, domain groups, layout/filter chips, roster panel, unique file naming from backend watermark; import → preview → reconciliation; paginated history |
| `components/DataExchangePreview.tsx` | 6-class change matrix, sheet filter, search, apply controls (`new-only`/`new-and-changed`, skip-conflicts, super-admin force-update), errors-xlsx download |
| `components/ApplicantReconciliationTable.tsx` | Per-applicant field-level diff review — expandable before/after rows, writeback summary, typed error badges, **bulk-only** approve/reject |
| `components/ApplicantRosterPanel.tsx` | Selectable booked-applicants list (multi-select DataTable, default-all-selected, NID/name/committee search) driving the Applicants export allow-list |
| `components/SectionErrorBoundary.tsx` | Scoped error boundary |

Route: `routes.tsx:273` — `<AuthGuard app="admin" perm="data-exchange:view">`; URL constant `config/routes.ts:65`; sidebar `AdminLayout.tsx:68` («استيراد وتصدير البيانات»). `?cycleId=` handled by the cross-feature hook `useAdmissionSetupCycle` (URL ↔ sessionStorage sync, defaults to active cycle).

**Cross-feature imports a port must replace or satisfy:** `useAdmissionSetupCycle` + `ApplicationSettingsCycleExportCard` (from `features/admin/admission-setup` — heaviest dependency; the card pulls the whole app-settings export pipeline), `useAuthStore` (super-admin check), `useLookup('tests')` (test-code → Arabic name), `emitAudit`, `apiClient`. Note: the cloud gate string `data-exchange:view` exists **nowhere** in the cloud permission matrix — only `super_admin`'s `*` passes it. The internal plane is actually better positioned (see §6-D).

**Dead surface in the source (do not port):** `exportData`/`useExportMutation` legacy round-trip export (unused by the page) and `dataExchangeService.template` (no hook, no caller).

### 1.2 Backend — `backend/admin/PACademy.Admin.Api/Modules/DataExchangeAdmin/`

| File | Purpose |
|---|---|
| `DataExchangeService.cs` (3,493 lines) | The whole engine: legacy round-trip export, **curated snapshot export incl. `CuratedSheets` registry / `CuratedRow` / `CuratedContext` / `CuratedExamResolver` (all nested in this file)**, roster, reconciliation, import preview/classify/apply, per-storage upserts, history, templates |
| `DataExchangeContracts.cs` | All DTOs, `ExchangeDomain`/`ExchangeStorage` enums, `DataExchangeRegistry` (18 domains), `CuratedSheetSpec`, reconciliation records |
| `DataExchangeAdminModule.cs` | DI: `services.AddScoped<DataExchangeService>()` |
| `JsonFlatten.cs` | Dotted-key flatten/unflatten for doc-store domains; type-preserving merge |
| `Controllers/DataExchangeController.cs` | REST surface `api/admin/data-exchange`, `[RequireBearerAuth]` |
| `…Shared.Persistence/ChangeTracking/RowChecksum.cs` + `IChangeTracked.cs` | Deterministic row checksum (change-detection contract) + 6 excluded tracking columns |
| `PACademy.Admin.Api.Tests/DataExchangeServiceTests.cs` | Unit tests (InMemory EF + real OperationalRecordsService) |

**Endpoints:** `GET /export`, `GET /export/snapshot` (the download button), `GET /applicants/roster?cycleId=`, `POST /applicants/reconcile/preview`, `POST /applicants/reconcile/commit`, `POST /import/preview`, `POST /import/apply`, `GET /history`, `GET /templates/{type}`.

**OperationalRecordsService touchpoints:** `ListAsync("applicants", enrichApplicantCommitteeNames: false)` (memoized via `ctx.ApplicantsAsync()` — the 16.6s→0.7s perf fix), `ListAsync("committeeInstances" | "admissionSetup.examScheduleDays" | "examPlans")`, `GetAsync("admissionSetup.applicationSettings.{cycleId}")`, `UpsertAsync(…)`, `ApplyApplicantExamReservationAsync`, `UpdateApplicantFollowUpAsync`, `EnsureCommitteeInstancePatchCategoryAsync`, `LoadCommitteeDirectoryAsync`. The internal repo has **no OperationalRecordsService** — these rewire to typed EF/raw-SQL reads (§5).

---

## 2. Destination outdated-feature inventory (PACademy.Internal — replace IN)

The screen is **«تحديث البيانات»** at **`/admin/data-exchange`** — confirmed as the screen the internal admin uses for the first import of the cloud workbook. Its parser already recognizes the cloud's PascalCase sheet registry and the snake_case "applicants-full" template.

### 2.1 Files to REPLACE (frontend, 9 files, ~1,604 LOC)

| File | Now | Port action |
|---|---|---|
| `frontend/src/features/data-exchange/pages/DataExchangePage.tsx` (511) | Export card + import card + history; internal file names (`صادر الأحوال-`/`internal-data-`) | Replace with ported hub page (3 tabs, presets, roster, reconciliation, cloud file naming) |
| `frontend/src/features/data-exchange/components/DataExchangePreview.tsx` (428) | 6-class matrix, source pills («وارد الأحوال»/«خارجي») | Replace with ported preview (keep internal source-pill behavior — §6 item 2) |
| `frontend/src/features/data-exchange/components/SectionErrorBoundary.tsx` (57) | Same as cloud | Replace (near-identical) |
| `frontend/src/features/data-exchange/api/dataExchange.service.ts` (125) | 4 live endpoints; imports from `@/shared/api` (NOT `@/shared/lib/api-client`) | Replace; adapt to internal apiClient path |
| `frontend/src/features/data-exchange/api/queries.ts` (51) | 4 hooks | Replace with 8-hook set |
| `frontend/src/features/data-exchange/lib/workbook.ts` (151) | SheetJS + civil-registry signature detection | Replace; **keep** civil-registry detection (§6 item 2) |
| `frontend/src/features/data-exchange/lib/checksum.ts` (76) | **Orphaned — zero importers** | **Delete** |
| `frontend/src/features/data-exchange/types.ts` (190) | 14-domain registry | Replace with cloud 18-tab registry + internal-only additions |
| `frontend/src/features/data-exchange/index.ts` (15) | Barrel | Replace |

New files ported in: `components/ApplicantReconciliationTable.tsx`, `components/ApplicantRosterPanel.tsx`.

### 2.2 Files to MODIFY (frontend touchpoints)

- `frontend/src/routes.tsx:217,322` — route registration (likely unchanged path; may add `perm` if AuthGuard gains it — see decision D1)
- `frontend/src/config/routes.ts:96` — unchanged (`/admin/data-exchange`)
- `frontend/src/features/admin/AdminLayout.tsx:74` — sidebar item (label decision D5), `permission: 'data_exchange:view'` stays
- `frontend/src/features/admin/users/lib/cloudPermissions.ts` — `data_exchange` module row already exists (lines 20, 90, 150, 247) — likely no change

Shared deps to keep untouched (used elsewhere): `shared/lib/xlsx-cell.ts`, `shared/lib/audit.ts`, `shared/api/`.

### 2.3 Backend files to REPLACE / MODIFY

| File | Now | Port action |
|---|---|---|
| `backend/src/PACademy.Api/Controllers/Admin/AdminDataExchangeController.cs` (89) | 4 endpoints, `[Authorize(Policy = "*")]` | Modify: add `/export/snapshot`, `/applicants/roster`, `/applicants/reconcile/preview`, `/applicants/reconcile/commit`; policy decision D1 |
| `backend/src/PACademy.Api/Modules/DataExchange/DataExchangeImportService.cs` (2,561) | Preview/apply engine + Ensure passes; contains **dead** `ExportAsync` + 86-column `ApplicantsStagingColumns` (no callers) | Modify: keep classification engine + Ensure passes; add reconciliation preview/commit; **delete dead exporter** |
| `backend/src/PACademy.Api/Modules/DataExchange/Export/DataExchangeExportService.cs` (581) | Legacy round-trip export (5 loaders + DeletedTests) | Replace with curated snapshot exporter (CuratedSheets registry + memoized context) reading internal tables |
| `backend/src/PACademy.Api/Modules/DataExchange/Export/RowChecksum.cs`, `JsonFlatten.cs` | Match cloud versions | Keep (verify byte-parity with cloud) |
| `backend/src/PACademy.Contracts/Admin/DataExchange/DataExchangeImportContracts.cs` | DTO records | Modify: add snapshot/roster/reconciliation DTOs |
| `backend/src/PACademy.Api/Program.cs:58-59` | DI registration | Modify if new service classes are added |
| `backend/src/PACademy.Api.Tests/` (or repo's test project) | — | Add Phase 3 tests |

### 2.4 NOT touched (explicitly out of scope)

- All migrations (historical), `CivilStatusRecord`/`CivilRegistryIncoming` entities, `ExamSlot` entity (orphaned but removal touches `PaDbContext` — parked), ClosedXML package ref (parked), `data_exchange_logs` schema, the sibling static pages `CivilStatusIncomingPage`/`CivilStatusOutgoingPage`, `applicant_management_records` plumbing, `TestResultEntryPage` (reuses the Excel-import pattern but is its own feature).
- **Downstream contract that must keep working:** Applicant Lookup (`frontend/src/features/admin/pages/applicant-lookup/`) reads what the import writes — `applicant_management_records`, `applicant_tests`, `applicant_tests_results`, payments ledger. The Ensure passes are load-bearing; the port must preserve their semantics.

---

## 3. Workbook contract dump (owned by the source — verified verbatim against `DataExchangeService.cs:2280-2324`)

Export = **curated snapshot**, 11 sheets in registry order, fixed columns, file name `data-exchange-{cycle}-{yyyyMMdd-HHmmss}.xlsx` (cycle label = cycle year → `info.cycleName` → cycleId; timestamp = backend export watermark, assembled in the frontend). `file-per-type` layout: `data-exchange-{sheet}-{cycle}-{stamp}.xlsx`. No `ExportInfo` metadata sheet (dropped 2026-06-10).

| # | Sheet | Unique key | Columns (exact, ordered) | Scope | Source (cloud) |
|---|---|---|---|---|---|
| 1 | `Applicants` | `applicant_id` (import business key = `nationalId`) | `applicant_id, national_id, full_name, gender, phone_number, email, date_of_birth, birth_governorate, qualification_type, university, faculty, specialization, graduation_year, grade, percentage, school_name, school_category, secondary_total_score, secondary_percentage, secondary_graduation_year, category, cycle_id, status` | cycle+person; **booked-only** | `ctx.ApplicantsAsync()` |
| 2 | `Relatives` | `relative_id` (member id, else `{nid}:{seq}`) | `relative_id, applicant_id, relation_type, relation_label, full_name, national_id, gender, qualification, occupation, phone, governorate, address` | cycle+person | applicant `family.*` explosion |
| 3 | `Exams` | `exam_id` | `exam_id, exam_name, cycle_id, scheduled_for, duration_minutes, question_count, status` | cycle (strict) | `db.Exams` |
| 4 | `ExamSchedules` | `slot_id` | `slot_id, exam_id, exam_name, category, date, committee_name, capacity, reserved` | cycle (strict) | committeeInstances ∪ examScheduleDays; exam via `CuratedExamResolver` |
| 5 | `ExamReservations` | `applicant_national_id\|exam_id` | `applicant_national_id, applicant_name, slot_id, exam_id, exam_name, appointment_date, appointment_time, committee_name, reservation_status` | cycle+person | applicant `examSlot` + `testSchedules[]`; `appointment_time` default `"08:00"`; status literal «محجوز» |
| 6 | `ExamResults` | `result_id` = `{nid}:{examCode}` | `result_id, applicant_id, exam_id, exam_name, result, score, committee, exam_date` | cycle+person | applicant `followUp` map; `applicant_id`=NID, `exam_id`=test code, `result`=outcome string, `score` always null |
| 7 | `AcquaintanceDocs` | `record_id` = docId or `{docId}:{sectionKey}` | `record_id, applicant_national_id, cycle_id, doc_status, version, opened_at, closed_at, last_autosaved_at, section_key, section_data, revision_count, last_revision_kind, last_revision_at` | cycle+person | typed acquaintance tables |
| 8 | `AdmissionConditions` | `condition_id` (wizard row id, fanned per grad-year `{id}:{gradYear}`) | `condition_id, category, category_name, faculty, specialization, academic_degree, graduation_year, gender, marital_status, min_age, max_age, age_reference_date, min_percentage, max_percentage, min_grade, max_grade, division, school_category, exam_round, committee, excellence_criterion, application_start_date, application_end_date, condition_status, is_active` | cycle (draft wins; normalized fallback) | app-settings draft + normalized tables |
| 9 | `LookupRows` | `lookup_row_id` = `{lookupKey}:{code}` | `lookup_row_id, lookup_key, code, name, is_active` | global | `db.LookupRows` |
| 10 | `GeneralSettings` | `settings_id` | `settings_id, exam_days_per_applicant, exam_slot_selection_window_days, acquaintance_documents_open_timing, acquaintance_documents_close_timing` | global | singleton |
| 11 | `Payments` | `payment_id` (`PAY-{fawryRef}` or ledger id) | `payment_id, applicant_id, national_id, applicant_name, amount, payment_status, payment_method, payment_date, fawry_reference, cycle_id` | cycle+person | ledger ∪ portal payments ∪ draft snapshot, deduped by Fawry ref |

**Import-only legacy sheets** (recognized by parse, NOT exported): `Committees`, `SystemCodes` (round-trip importable); `ApplicantCategories`, `Faculties`, `Notifications`, `WorkflowRecords`, `AuditEntries` (`ReadOnlyExport` — upsert throws, rows land in failedRows).

**Cycle scoping rules:** blank cycleId → active cycle. People sheets are **lenient** — drop only rows that positively declare a *different* cycle; blank/stale ids stay. Config sheets (Exams/ExamSchedules) are **strict**. Category second gate from the cycle's category-key union.

**Change filter:** `modifiedSinceCreation` → `UpdatedAt != CreatedAt` (the "updates qualify" rule); also `changedAfter` and `sinceLastExport` (audit-log watermark).

**Import classification (6-class):** `new / changed / skipped / outdated / conflict / invalid` via `RowChecksum` (SHA-256 over canonicalized name␟value pairs, 6 tracking columns excluded) + row_version/updated_at recency. Apply: transactional, per-row isolation, modes `new-only`/`new-and-changed`, `SkipConflicts`, super-admin `ForceUpdate`.

**Reconciliation:** preview diffs restricted to `EditableApplicantFields` (17 dotted paths: fullName, gender, phoneNumber, email, religion, birthDate, birthGovernorate/District, maritalStatus, governorate, city, address.*, …); writeback columns `result, next_exam_date, round, test_code` resolved via the `test-results` lookup reverse map (code / Arabic name / outcome → canonical); commit re-runs preview against live DB (concurrent-edit guard), writes only `AcceptedFields`, patches `followUp[testCode]` + `examSlot.date` for passed applicants. Errors: `APPLICANT_NID_UNMATCHED`, `RESULT_VALUE_UNKNOWN`, `WRITEBACK_NEXT_EXAM_MISSING`.

---

## 4. Internal schema audit (PACademy.Internal)

Owned by the Admissions modular-monolith module (`AdmissionsDbContext`, own migrations). Entities: `Modules/Admissions/…Domain/ApplicantTest.cs`, `ApplicantTestResult.cs`.

### `applicant_tests`

| column | type | null | notes |
|---|---|---|---|
| `id` | uniqueidentifier | NO | PK, app-generated |
| `applicant_id` | uniqueidentifier | NO | FK → `applicants(Id)` RESTRICT |
| `lookup_key` | nvarchar(64) | NO | constant `'tests'` |
| `test_code` | nvarchar(64) | NO | e.g. `TST-01`; composite FK `(lookup_key, test_code)` → `lookup_rows` |
| `test_date` | datetime2 | NO | day-granular |
| `attend` | bit | NO | default false |
| `attendance_time` | datetime2 | YES | |
| `created_at`/`created_by`/`updated_at`/`updated_by` | datetime2 / uniqueidentifier | NO | UTC; actor Guids unconstrained |
| `row_version` | rowversion | NO | concurrency token |

Indexes (all non-unique by design): `(applicant_id, test_code, test_date)`, `(applicant_id)`, `(test_code)`.

### `applicant_tests_results`

| column | type | null | notes |
|---|---|---|---|
| `id` | uniqueidentifier | NO | PK |
| `applicant_test_id` | uniqueidentifier | NO | FK → `applicant_tests(id)` CASCADE |
| `lookup_key` | nvarchar(64) | NO | constant `'test-results'` |
| `result_code` | nvarchar(64) | NO | `RES-01` ناجح / `RES-02` راسب / `RES-03` مؤجل / `RES-04` منسحب; composite FK → `lookup_rows` |
| `score` | decimal(9,2) | YES | null for non-scored outcomes |
| `reason` | nvarchar(512) | YES | free text |
| `is_approved` | bit | NO | default false (اعتماد النتيجة) |
| `approved_by` / `approved_date` | uniqueidentifier? / datetime2? | YES | |
| audit quartet + `row_version` | as above | NO | |

Indexes: `(applicant_test_id)`, `(result_code)` — **nothing enforces one result per test at DB level** (multiple results per applicant_test possible).

### Keying

- **Applicants:** Guid `Id` PK; NID is the business key, **UNIQUE per cycle** (`IX_applicants_cycle_national_id` on `(CycleId, NationalId)`). API paths key by NID and resolve to Guid at write time. ⚠️ `applicants` columns are **PascalCase** (`Id`, `NationalId`, `FullName`, `CycleId`…).
- **Cycles:** Guid `Id` PK; `NameAr`, `Year`, `Cohort` ('male'|'female'), unique filtered `(Year, Cohort) WHERE Active`. Legacy data-exchange tables carry cycle id as **string** (`exams.cycle_id` nvarchar(64), `applicant_management_records.cycle_id` nvarchar(96)). Existing import resolves `?cycleId=` → URL Guid → single active → most recent, deliberately ignoring the workbook's cycle slug — **keep this rule**.
- **Tests definition:** no exam table — tests are `lookup_rows` (`'tests'`: 15 rows `TST-01..15` with `payload_json.kind/order/required`; `'test-results'`: 4 rows `RES-01..04`). Plus `exam_tests` (flow ordering) and `cycle_exams` (per-cycle plan: `CycleId, CategoryId, ExamTypeKey, Order, IsRequired`, unique `(CycleId, Order)`).
- Related: `exam_attempts` (PascalCase, no unique business key — used to enrich committee/category/file-number by NID), `committees` (Guid, unique `(CycleId, Key)`), `committee_records` (module='committee_schedule'), `test_slot_capacity` (unique `(CycleId, CategoryKey, CommitteeName)`), `applicant_management_records` (composite PK `(module, id)`, payload_json — ported 1:1 from cloud), `data_exchange_logs`, `civil_status`, `applicant_deleted_tests`.

---

## 5. Mapping proposal — curated sheets ↔ internal tables (exam/results sheets)

**Conclusion up front: no column is missing that requires schema change.** All per-row unique keys are derivable. **No migration to `applicant_tests` / `applicant_tests_results` proposed.**

### 5.1 `ExamResults` sheet ← `applicant_tests_results` ⋈ `applicant_tests` ⋈ `applicants`

| Sheet column | Internal source | Gap / resolution |
|---|---|---|
| `result_id` | `{a.NationalId}:{at.test_code}` | derive — matches cloud key format exactly |
| `applicant_id` | `a.NationalId` | direct (cloud puts NID here) |
| `exam_id` | `at.test_code` | direct (`TST-xx` codes shared by both planes) |
| `exam_name` | `lookup_rows.name` for `('tests', test_code)` | lookup |
| `result` | `rs.result_code` → canonical outcome | **Decision D2**: resolve `RES-01..04` → the same canonical outcome strings the cloud emits (the cloud's reverse map already accepts code/Arabic/outcome on import, but emitting canonical avoids false diffs in reconciliation) |
| `score` | `rs.score` | direct (cloud emits null; a populated score is contract-legal — column exists) |
| `committee` | no column on `applicant_tests` | derive — reuse the existing `exam_attempts` OUTER-APPLY enrichment (same trick the current internal export uses); fallback blank-with-warning |
| `exam_date` | `at.test_date` (yyyy-MM-dd) | direct |

Multiplicity note: nothing enforces one result per test row → export takes the **latest result per (applicant_test) by `updated_at`** (deterministic; flag rows with >1 in a soft warning). `created_at`/`updated_at` for the change filter come from `rs.created_at`/`rs.updated_at` (already what the internal export does).

### 5.2 `ExamReservations` sheet ← `applicant_tests` ⋈ `applicants`

| Sheet column | Internal source | Gap / resolution |
|---|---|---|
| `applicant_national_id` | `a.NationalId` | direct |
| `applicant_name` | `a.FullName` | direct |
| `slot_id` | none | **leave blank** — cloud import matches by slot id *then* falls back to (committee/category, date); blank is tolerated by design. Optional later: derive from `committee_records (module='committee_schedule')` row id when resolvable |
| `exam_id` / `exam_name` | `at.test_code` / lookup name | direct / lookup |
| `appointment_date` | `at.test_date` | direct |
| `appointment_time` | none (day-granular both sides) | constant `"08:00"` — same default the cloud emits |
| `committee_name` | none on `applicant_tests` | derive via `exam_attempts` enrichment (existing pattern); fallback blank-with-warning |
| `reservation_status` | derive from `at.attend` | `attend=0` → «محجوز» (cloud's literal); `attend=1` → «محجوز» as well unless **Decision D3** says otherwise |

### 5.3 `Exams` sheet ← `cycle_exams` ⋈ `lookup_rows('tests')`

| Sheet column | Internal source | Gap / resolution |
|---|---|---|
| `exam_id` | `cycle_exams.ExamTypeKey` (= `TST-xx`) | direct |
| `exam_name` | lookup name | lookup |
| `cycle_id` | `cycle_exams.CycleId` | direct (Guid string) |
| `scheduled_for`, `duration_minutes`, `question_count` | none | **blank-with-warning** — internal plane has no per-exam schedule/duration/question-count; cloud import tolerates nulls (cells project to null) |
| `status` | derive from `IsRequired`/lookup `is_active` | propose `active` when the lookup row is active; flag in report |

### 5.4 Other sheets (import already works; export sources)

`Applicants`/`Relatives`/`Payments`/`AcquaintanceDocs` internal export reads the same stores today's import writes (`applicants` ⋈ `applicant_management_records` modules `applicants/contact/addresses/education/relatives`, payments ledger). `ExamSchedules` ← `committee_records (module='committee_schedule')` ∪ `test_slot_capacity`. `LookupRows` ← `lookup_rows`. `GeneralSettings` ← internal settings module (or blank sheet if absent — flag at Phase 1). `AdmissionConditions` ← the structured application-settings tables the import's `EnsureAdmissionConditionsAsync` writes.

**Memoized-context requirement:** the internal exporter gets a `CuratedContext` equivalent — applicants payload assembled **once per export** (the existing `LoadApplicantsAsync` UNION query is the expensive read), test-name map and committee enrichment built lazily once. Per-applicant lookups seek `IX_applicant_tests_applicant_id` / the NID indexes — never materialize whole tables per sheet.

---

## 6. Divergence list — internal-only behaviors (keep / drop / migrate)

| # | Item | Verdict | Justification |
|---|---|---|---|
| 1 | **DeletedTests sheet** («الاختبارات المحذوفة») always appended to every export (`applicant_deleted_tests`) | **Keep — make opt-in** (Decision D4) | Internal audit need; unknown to the cloud parser (would land in "rejected sheets" warnings on cloud import — soft, not breaking). Opt-in keeps the cloud-bound workbook clean |
| 2 | **CivilStatus / CivilRegistry thread** — `civil_status` export/import, «وارد من الأحوال» signature detection → `civil_registry_incoming`, source pills, `data_exchange_logs.Source` | **Keep verbatim** | Internal-only business flow (civil-registry feed); BRD-traceable; orthogonal to the cloud contract. Port must preserve the signature-column detection in `workbook.ts` and the source labels |
| 3 | Internal file names (`صادر الأحوال-…` / `internal-data-…`) | **Migrate** to `data-exchange-{cycle}-{stamp}.xlsx` for the exchange export; **keep** `صادر الأحوال-` for CivilStatus-only exports | The exchange contract owns the name; the civil-status feed is a different artifact |
| 4 | Export filters `all/changedAfter/modifiedSinceCreation/sinceLastExport` + log watermark | **Keep** — identical semantics to cloud | Same rule both sides |
| 5 | 6-class classification + super-admin force-update + skip-conflicts | **Keep** — identical to cloud | Same engine |
| 6 | 6 Ensure side-effect passes (applicant_tests, applicant_tests_results, management records, exam profile, payments, admission conditions) | **Keep — load-bearing** | Applicant Lookup reads these tables; they are the internal write contract |
| 7 | Per-sheet plan targets: `Exams`→`cycle_exams`, `ExamSchedules`→`committee_records`, `ExamReservations`→`applicant_tests`, `ExamResults`→`exam_attempts` + RES-code resolution, `Payments`→ledger, `SystemCodes/LookupRows`→`lookup_rows` | **Keep** (import side unchanged in spirit); **verify** ExamResults import also mirrors to `applicant_tests_results` (it does, via Ensure pass) | Round-trip invariant requires import landing where export reads |
| 8 | Cycle stamping: URL `?cycleId=` → active → most recent; workbook cycle slug ignored | **Keep** | Cloud cycle Guids ≠ internal cycle Guids; resolving locally is correct |
| 9 | Arabic status synonyms (منسحب/مؤجل, withdrawn→Failed, payment normalization) | **Keep** | Tolerant import is BRD-friendly; all soft |
| 10 | Unmapped-column whitelists + soft `DATA_EXCHANGE_UNMAPPED_COLUMNS` warnings; sheet aliases | **Keep** | Matches "no hard rejections not traceable to BRD" |
| 11 | `data_exchange_logs` history + actor resolution + `source` column | **Keep** | Internal audit trail; the ported history tab reads it |
| 12 | Dead code: import service's `ExportAsync` + `ApplicantsStagingColumns` (no callers); frontend `lib/checksum.ts` (no importers); `ExamSlot` entity (no service refs); unused ClosedXML ref | **Drop** dead exporter + orphan checksum.ts in this port; **park** ExamSlot entity + ClosedXML ref (out of declared scope) | Deletions listed in commit bodies per hard constraints |
| 13 | Internal snake_case "applicants-full" template sheets (`import_manifest, applicants, contact, …`) recognized by parser | **Keep** | Old workbooks must still parse (same courtesy the cloud extends to its legacy tabs) |

**What the old internal feature LACKS that the port adds:** curated snapshot export (fixed columns/keys/cycle scoping), booked-applicants roster panel + NID allow-list, applicants reconciliation (preview/commit, bulk approve, writeback), snapshot file naming, export presets/domain groups, `templates` endpoint backed by the server (currently a frontend mock).

---

## 7. Stack delta

| Layer | Source (cloud) | Internal | Delta |
|---|---|---|---|
| React / TS / Vite | 18.3 / 5.6 / 5.4 | ^18.3.1 / ^5.6.2 / ^5.4.8 | ✅ match |
| TanStack Query / Zustand / Tailwind / RR | 5 / 4.5 / 3.4 / 6.26 | ^5.59 / ^4.5.5 / ^3.4.13 / ^6.26.2 | ✅ match |
| Radix | 10-11 primitives | 11 primitives | ✅ match |
| `xlsx` (SheetJS) | ^0.18.x lazy-loaded | **^0.18.5 present** | ✅ no add |
| Backend | .NET (admin api) + EF Core, **no Excel lib** | **.NET 10**, EF Core 10, ClosedXML 0.104.2 referenced-unused, FluentValidation 11 | ✅ no add. Workbook stays frontend-built (matches the source's actual architecture) |
| API client | `@/shared/lib/api-client` | `@/shared/api` (client/errors/settings) + axios | adapt import paths in the port; no dep change |
| Conventions | sealed records/classes, ErrorCodes, FluentValidation, snake_case (new tables) | ✅ confirmed (`TestsSchedulingContracts.cs`, `CreateCycleUseCase.cs`, `ErrorCodes.cs`); ⚠️ legacy tables PascalCase — match per-table casing exactly | — |

**New dependencies required: NONE.**

---

## 8. File-scope freeze list (everything the port may touch — all in PACademy.Internal)

**Replace:** the 9 files under `frontend/src/features/data-exchange/` (§2.1) + `backend/src/PACademy.Api/Modules/DataExchange/Export/DataExchangeExportService.cs`.
**Add:** `frontend/src/features/data-exchange/components/ApplicantReconciliationTable.tsx`, `…/ApplicantRosterPanel.tsx`; backend reconciliation/roster/snapshot use-case file(s) under `backend/src/PACademy.Api/Modules/DataExchange/`; test files under the backend test project.
**Modify:** `frontend/src/routes.tsx`, `frontend/src/features/admin/AdminLayout.tsx`, `backend/src/PACademy.Api/Controllers/Admin/AdminDataExchangeController.cs`, `backend/src/PACademy.Api/Modules/DataExchange/DataExchangeImportService.cs`, `backend/src/PACademy.Contracts/Admin/DataExchange/DataExchangeImportContracts.cs`, `backend/src/PACademy.Api/Program.cs` (DI only).
**Delete:** `frontend/src/features/data-exchange/lib/checksum.ts`; dead `ExportAsync` + `ApplicantsStagingColumns` block inside `DataExchangeImportService.cs`.
**Read-only:** the entire source repo; everything else in PACademy.Internal.

---

## 9. Decisions needed at GATE 0 (answer to unblock Phase 1)

- **D1 — RBAC gate.** Internal matrix already has `data_exchange` (underscore) with a full action row; backend controller is `[Authorize(Policy="*")]` (super-admin only). Proposal: keep the internal `data_exchange:view` permission string for sidebar+route, and switch the controller policy from `*` to the module permission so the BRD System-Manager role owns it. **Recommended: switch.** (Never importing cloud `cloudPermissions.ts` — internal plane only.)
- **D2 — `result` cell format on internal export.** Emit canonical outcome strings (what the cloud emits from `followUp`) resolved from `RES-xx` via the test-results lookup, vs raw `RES-xx` codes (cloud import resolves both). **Recommended: canonical outcome** — avoids false diffs in cloud reconciliation.
- **D3 — `reservation_status` when `attend=1`.** Cloud only knows literal «محجوز». **Recommended: always «محجوز»** (attendance is conveyed by results, not reservation status).
- **D4 — DeletedTests sheet.** Always-appended today. **Recommended: opt-in checkbox** (like CivilStatus) so the cloud-bound workbook contains only contract sheets.
- **D5 — Sidebar label.** Keep internal «تحديث البيانات» or adopt cloud «استيراد وتصدير البيانات». **Recommended: adopt cloud label** (same screen, same name both planes).
- **D6 — `GeneralSettings` sheet on internal export.** Internal has no general-settings singleton equivalent confirmed. **Recommended: emit empty sheet (header row only)** — contract-legal; revisit if internal grows the table.

⛔ **GATE 0 — STOP.** Awaiting approval of this report (and answers to D1–D6) before any code is written.
