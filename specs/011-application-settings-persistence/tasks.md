# Tasks: Application Settings Persistence

**Input**: Design documents from `/specs/011-application-settings-persistence/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), data-model.md, contracts/app-settings-api.md, quickstart.md

**Tests**: Per Constitution Principle II (NON-NEGOTIABLE), test tasks below are MANDATORY. Every user story includes test-first tasks for: domain invariants (xUnit), use-case happy + each conflict-code path (xUnit), integration round-trips (Testcontainers SQL Server), new UI component contracts already on `origin/main` (Vitest re-runs after service flip), and one Playwright E2E. MSW for all frontend network mocking; no live network. `.skip` / `.only` MUST NOT reach `main`. Coverage thresholds (CI): ≥ 80% statements, ≥ 75% branches; **100% on the bulk-save transaction path**.

**Organization**: Tasks are grouped by user story so each story (P1 → P3) can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared-file dependencies)
- **[Story]**: Which user story this task belongs to (US1 = P1 three-tier persistence, US2 = P1 conflict codes, US3 = P2 audit trail)
- All file paths are repo-root-relative

## Path Conventions

- Backend module: `backend/src/Modules/Lookups/PACademy.Modules.Lookups.{Domain,Application,Infrastructure,Public}/`
- Controllers: `backend/src/PACademy.Api/Controllers/Admin/AdminApplicationSettingsController.cs`
- New middleware: `backend/src/PACademy.Api/Middleware/SqlConflictCodeMiddleware.cs`
- Backend tests: `backend/tests/PACademy.Api.Tests/`, `.../PACademy.Application.Tests/`, `.../PACademy.Domain.Tests/`, `.../PACademy.Architecture.Tests/`
- Frontend service: `frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts`
- Frontend tests: colocated next to source (`*.test.ts`, `*.test.tsx`)
- Playwright E2E: `frontend/e2e/`

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Add the new `Lookups` module skeleton, the SQL-conflict middleware, and the conflict-code error shape. Provides the home for everything that follows.

- [ ] T001 [P] Create the `Lookups` module skeleton: `backend/src/Modules/Lookups/PACademy.Modules.Lookups.{Domain,Application,Infrastructure,Public}/` with empty `.csproj` files following the existing module conventions (see spec 005 FR-M02). Wire all 4 projects into `backend/PACademy.slnx`.
- [ ] T002 [P] Define the shared conflict-error shape `ConflictErrorResult` in `backend/src/Shared/PACademy.Shared.Contracts/Errors/ConflictErrorResult.cs` (record with `Code`, `MessageAr`, `MessageEn`, `FieldErrors?`). Used by `SqlConflictCodeMiddleware` + every use case that throws domain conflicts.
- [ ] T003 [P] Add `SqlConflictCodeMiddleware` in `backend/src/PACademy.Api/Middleware/SqlConflictCodeMiddleware.cs` — catches `SqlException` with error numbers `51100`, `51110`, `51120`, `51125` and constraint-name-based CHECK violations (547), maps each to a typed `ConflictErrorResult` body and the appropriate HTTP status (409 for trigger-thrown conflicts, 422 for CHECK violations + lookup-FK violations). Register in `Program.cs` after `DbUpdateConcurrencyExceptionMiddleware` (spec 009).
- [ ] T004 Add `LookupsModule.cs` skeleton in `backend/src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure/` exposing `AddLookupsModule(this IServiceCollection, IConfiguration)`. Calls `AddDbContext<LookupsDbContext>(...)` with history table `__EFMigrationsHistory_Lookups`. Wire into `Program.cs`'s module-registration chain after `AddAdmissionsModule`.
- [ ] T005 Update `backend/src/PACademy.Api/PACademy.Api.csproj` to reference `PACademy.Modules.Lookups.Infrastructure.csproj`. Verify build succeeds.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Domain entities, the EF DbContext, the migration scaffold. All later phases depend on this.

**⚠️ CRITICAL**: Blocks all three user-story phases.

### Domain entities

- [ ] T006 [P] Implement `GenderType` enum (`Male`, `Female`) in `backend/src/Modules/Lookups/PACademy.Modules.Lookups.Domain/GenderType.cs`. The DB column stores lowercase string via EF Core conversion.
- [ ] T007 [P] Implement `ApplicantCategoryConfig` aggregate in `.../Domain/ApplicantCategoryConfig.cs` per data-model.md tier 1. Factory `Create(categoryId, sortOrder)` + `Deactivate()` / `Activate()` / `UpdateSortOrder(int)`. RowVersion property.
- [ ] T008 [P] Implement `ApplicantCategorySpecialization` aggregate in `.../Domain/ApplicantCategorySpecialization.cs` per data-model.md tier 2. Factory `Create(configId, specializationId)`. Field `_years` private list + readonly `Years` property for navigation.
- [ ] T009 [P] Implement `ApplicantSpecializationYear` aggregate in `.../Domain/ApplicantSpecializationYear.cs` per data-model.md tier 3. Factory `Create(...)` + `Update(...)` + `SoftDelete(deletedBy)` + `Restore()`. Validates `application_end >= application_start`, `max_age > 0`, `min_grade <= max_grade` at the domain layer (defense in depth — DB triggers are the source of truth).
- [ ] T010 [P] Implement `ApplicantSpecializationYearGender` + `ApplicantSpecializationYearMaritalStatus` side-table entities in `.../Domain/`. Composite-key value-style classes with no behavior beyond construction.

### Persistence

- [ ] T011 [P] Implement `ILookupsDbContext` in `.../Application/ILookupsDbContext.cs` exposing `DbSet<>` properties for all 5 entities + `SaveChangesAsync`. Lives in Application layer per Clean Arch.
- [ ] T012 [P] Implement EF Core configurations for all 5 entities in `.../Infrastructure/Persistence/Configurations/`. Each config sets `ToTable`, primary key, UNIQUE constraints, indexes per data-model.md, and `IsRowVersion()` on the rowVersion property.
- [ ] T013 Implement `LookupsDbContext` in `.../Infrastructure/Persistence/LookupsDbContext.cs`. Applies all configurations, exposes `DbSet<>` per `ILookupsDbContext`.
- [ ] T014 Implement `ILookupsApi` in `.../Public/ILookupsApi.cs` (per plan.md §2): `CategoryExistsAsync(string code, CancellationToken)` and `SpecializationExistsAsync(string code, CancellationToken)`. Implement `LookupsApiService` in `.../Infrastructure/LookupsApiService.cs`. Wire DI in `LookupsModule.cs`.
- [ ] T015 Generate the EF migration `011_ApplicationSettings` via `dotnet ef migrations add 011_ApplicationSettings --project src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure --startup-project src/PACademy.Api --context LookupsDbContext` from `backend/`. The generated migration creates the 5 tables; manually augment the `Up()` method to add the 4 triggers + 3 CHECK constraints per data-model.md (the SQL is provided verbatim there). Run via `dotnet ef database update --context LookupsDbContext` against the dev DB. Verify the snapshot.
- [ ] T016 [P] Architecture test `LookupsModuleRespectsBoundaries` in `backend/tests/PACademy.Architecture.Tests/LookupsModuleTests.cs` (NetArchTest): Lookups.Domain references only `Shared.Contracts`; Lookups.Application references only `Domain`, `Public`, `Shared.Contracts`, `Audit.Public`, `Identity.Public`; Lookups.Infrastructure references all of the above. No sibling-module `*.Domain` references.

**Checkpoint**: New module exists, migration applied, all 5 tables + triggers + checks in place. All three user-story phases can begin.

---

## Phase 3: User Story 1 — Three-tier persistence end-to-end (Priority: P1) 🎯 MVP

**Goal**: An admin configures categories → specializations → years, hits Save, refreshes, sees exactly the saved state.

**Independent Test**: Per spec.md Story 1 Acceptance — configure one category → two specializations → six years across distinct gender/marital/age/grade values. Reload. Open from a different machine signed in as a different super-admin. State matches.

### Tests for User Story 1 (REQUIRED — Constitution Principle II) ⚠️

> Write these tests FIRST and confirm they FAIL before implementation.

#### Backend domain unit tests (xUnit, no DB)

- [ ] T017 [P] [US1] Domain tests for `ApplicantCategoryConfig` invariants in `backend/tests/PACademy.Domain.Tests/Lookups/ApplicantCategoryConfigTests.cs`: factory rejects empty `categoryId`; `Deactivate()` then `Activate()` round-trip; `UpdateSortOrder` is monotonic.
- [ ] T018 [P] [US1] Domain tests for `ApplicantCategorySpecialization` in `.../ApplicantCategorySpecializationTests.cs`: factory rejects empty `specializationId`; junction can hold multiple years.
- [ ] T019 [P] [US1] Domain tests for `ApplicantSpecializationYear` in `.../ApplicantSpecializationYearTests.cs`: factory rejects `application_end_date < application_start_date`; rejects `maxAge <= 0`; rejects `minGrade > maxGrade`; gender set must have ≥1 entry; soft-delete sets `is_deleted=true`; restore reverses.

#### Backend integration tests (xUnit + Testcontainers SQL Server)

- [ ] T020 [P] [US1] HTTP integration tests for category-config endpoints in `backend/tests/PACademy.Api.Tests/ApplicationSettings/CategoryConfigsIntegrationTests.cs`: List sorted by `sort_order`; PATCH happy path; PATCH stale rowVersion → 409 ROW_VERSION_CONFLICT.
- [ ] T021 [P] [US1] HTTP integration tests for specialization-junction endpoints in `.../SpecializationsIntegrationTests.cs`: attach happy path; list returns expected shape with joined lookup labels; DELETE cascade-deletes descendant years.
- [ ] T022 [P] [US1] HTTP integration tests for year endpoints in `.../YearsIntegrationTests.cs`: POST happy path with full payload (genders + marital + age + grade + window); PATCH happy path; soft-delete via DELETE; reads filter `is_deleted=0` by default.
- [ ] T023 [P] [US1] HTTP integration tests for bulk-save in `.../BulkSaveIntegrationTests.cs`: 4-change batch (1 create, 2 updates, 1 delete) commits atomically; result.created/updated/deleted match; all 4 audit entries present within the same txn timestamp window.

#### Frontend tests (Vitest + MSW + Testing Library)

- [ ] T024 [P] [US1] Service-layer tests in `frontend/src/features/admin/admission-setup/api/applicationSettings.service.test.ts` — MSW handlers stub each endpoint from contracts/app-settings-api.md; service methods (`listCategoryConfigs`, `patchCategoryConfig`, `attachSpecialization`, `createYear`, `updateYear`, `softDeleteYear`, `bulkSave`) parse responses correctly. Existing `applicationSettings.service.test.ts` on main covers the mock surface — extend to cover the real-API shape.

#### Playwright E2E

- [ ] T025 [P] [US1] Playwright E2E `frontend/e2e/application-settings-p1.spec.ts` — log in as super_admin → navigate to `/admin/admission-setup/wizard/application-settings` → enable one category → attach two specializations → add three year rows to each → click Save → refresh → assert every field matches.

### Backend implementation for User Story 1

- [ ] T026 [P] [US1] DTOs in `.../Application/Dtos/`: `ApplicantCategoryConfigDto`, `ApplicantCategorySpecializationDto`, `ApplicantSpecializationYearDto`, `BulkYearChange`, `BulkSaveResult`, `BulkSavePayload`. Match the contract shape verbatim.
- [ ] T027 [P] [US1] Use case `ListCategoryConfigsUseCase` in `.../Application/ApplicationSettings/ListCategoryConfigsUseCase.cs` — joins `lookup_items` for the `categoryLabelAr` field; sorts by `sort_order ASC, created_at ASC` (FR-017).
- [ ] T028 [P] [US1] Use case `PatchCategoryConfigUseCase` — flips `isActive`, validates rowVersion, throws `CATEGORY_HAS_ACTIVE_YEARS` (the trigger fires; middleware translates).
- [ ] T029 [P] [US1] Use case `ListSpecializationsUseCase` + `ListEligibleSpecializationsUseCase` — second returns lookup `specializations` rows NOT attached to the config; reserved for SPC × CAT mapping filter post-spec-010.
- [ ] T030 [P] [US1] Use case `AttachSpecializationUseCase` + `DetachSpecializationUseCase` — attach validates uniqueness; detach cascade-deletes years via FK CASCADE.
- [ ] T031 [P] [US1] Use cases for years: `ListYearsUseCase`, `GetYearUseCase`, `CreateYearUseCase`, `UpdateYearUseCase`, `SoftDeleteYearUseCase`. Each is a sealed class with `ExecuteAsync`.
- [ ] T032 [US1] Use case `BulkSaveYearsUseCase` — opens a transaction at `Snapshot` isolation; switches on `kind` per change; rolls back on any single failure; emits per-change audit entries with the same txn timestamp. Returns `BulkSaveResult`.
- [ ] T033 [US1] Mapper `ApplicationSettingsMapper` — maps each entity → DTO with lookup joins. Used by all read use cases.
- [ ] T034 [US1] Controller `AdminApplicationSettingsController` in `backend/src/PACademy.Api/Controllers/Admin/AdminApplicationSettingsController.cs` — wires all 13 endpoints from contracts §1–4. Each endpoint annotated with the correct `[Authorize(Policy = "admission-setup:read|write")]`.
- [ ] T035 [US1] Register all use cases in `LookupsModule.cs` DI.

### Frontend implementation for User Story 1

- [ ] T036 [US1] Swap `frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts` from MOCK to real `apiClient`. Match the contract from `contracts/app-settings-api.md` §§1–4 verbatim. Each method handles conflict codes via existing `RowVersionConflictError` + extended `ConflictError` (see T039).
- [ ] T037 [US1] Verify `applicationSettings.queries.ts` and the Zustand `appSettingsDraft` store work unchanged against the real backend. No edits expected.
- [ ] T038 [US1] Verify TypeScript compiles, lint passes (`npm --prefix frontend run typecheck && npm --prefix frontend run lint`).

**Checkpoint**: US1 functional — three-tier hierarchy persists end-to-end. Demoable.

---

## Phase 4: User Story 2 — Conflict codes enforced (Priority: P1)

**Goal**: All 7 conflict codes round-trip from DB triggers/CHECKs → middleware → API response → frontend toast + inline hints.

**Independent Test**: Submit a deliberately-conflicting payload for each of the 7 codes; assert response carries the exact code per contracts §5.

### Tests for User Story 2 (REQUIRED) ⚠️

- [ ] T039 [P] [US2] Extend `frontend/src/shared/lib/errors.ts` `ConflictCode` union with the 7 spec-011 codes (already mostly present on main; verify completeness: `DUPLICATE_YEAR`, `OVERLAPPING_PERIOD`, `INVALID_DATE_RANGE`, `AGE_NOT_POSITIVE`, `GRADE_RANGE_INVALID`, `GENDER_REQUIRED`, `CATEGORY_HAS_ACTIVE_YEARS`, `SPECIALIZATION_NOT_MAPPED`). Add tests in `errors.test.ts` verifying `normaliseError` parses each.
- [ ] T040 [P] [US2] Integration test in `backend/tests/PACademy.Api.Tests/ApplicationSettings/ConflictCodesIntegrationTests.cs` — one test per code, asserting:
  - `DUPLICATE_YEAR` 409 when two rows under same `(category_specialization_id, graduation_year)` with overlapping genders
  - `OVERLAPPING_PERIOD` 409 when two rows have overlapping windows with overlapping genders
  - `INVALID_DATE_RANGE` 422 when `applicationEndDate < applicationStartDate`
  - `AGE_NOT_POSITIVE` 422 when `maxAge <= 0`
  - `GRADE_RANGE_INVALID` 422 when `minGrade > maxGrade`
  - `GENDER_REQUIRED` 422 when `genderTypes` empty
  - `CATEGORY_HAS_ACTIVE_YEARS` 409 when deactivating a category with active descendant years
- [ ] T041 [P] [US2] Concurrency test in `.../OptimisticLockingIntegrationTests.cs` — two clients PATCH the same year row; second returns 409 `ROW_VERSION_CONFLICT` with `currentRowVersion` echoed.
- [ ] T042 [P] [US2] Bulk-save atomicity test in `.../BulkSaveAtomicityTests.cs` — submit a batch where row 3 of 5 violates `DUPLICATE_YEAR`; assert nothing committed; response carries the per-row error map.

### Backend implementation for User Story 2

- [ ] T043 [US2] Wire `SqlConflictCodeMiddleware` (T003) to recognize the trigger error numbers (51100 OVERLAPPING_PERIOD, 51110 CATEGORY_HAS_ACTIVE_YEARS, 51120 DUPLICATE_YEAR, 51125 GENDER_REQUIRED) and the constraint-name-based CHECK violations (547) per the mapping table in data-model.md. Each maps to the typed `ConflictErrorResult` with appropriate Arabic messages.
- [ ] T044 [US2] Bulk-save use case (T032) catches each `SqlException` from per-row commits, accumulates them in a `Dictionary<string, string>` keyed by `BulkYearChange.id` (or array index for creates), then rolls back the transaction and returns the accumulated error map. (Alternative: let SQL Server throw on the first conflict and roll back — simpler but the admin sees only the first error. Decision: first error only for V1; multi-error accumulation is a follow-up.)

### Frontend implementation for User Story 2

- [ ] T045 [US2] Verify the existing `applicationSettings.queries.ts` `onError` handlers correctly map each of the 7 codes to its Arabic toast. Already implemented on main against the mock — confirm parity against the real backend.
- [ ] T046 [US2] Verify the existing `YearTable` component renders inline error hints from `fieldErrors` (e.g., a red border on `graduationYear` when `DUPLICATE_YEAR`). Already implemented on main — confirm against the real backend.

**Checkpoint**: US2 functional — every conflict surfaces correctly to the admin.

---

## Phase 5: User Story 3 — Audit trail (Priority: P2)

**Goal**: Every mutation emits one audit entry through the existing middleware.

### Tests for User Story 3 (REQUIRED) ⚠️

- [ ] T047 [P] [US3] Audit-emission test in `.../ApplicationSettings/AuditIntegrationTests.cs` — for each mutation kind, assert one audit row with the expected `action`, `entityType`, `module='lookups'`, `before`/`after` snapshots, and actor.
- [ ] T048 [P] [US3] Bulk-save audit test — 4-change batch produces 4 audit rows with the same transaction timestamp.

### Backend implementation for User Story 3

- [ ] T049 [US3] Wire audit emissions in each use case via the existing `IAuditApi` (spec 005). Each use case calls `await auditApi.AppendAsync(...)` after the SaveChangesAsync; the audit shim shares the txn (or a chained one — depending on the audit module's contract).
- [ ] T050 [US3] Verify the audit-action labels for `create`, `update`, `delete`, `soft_delete`, `restore` render correctly on `/admin/audit?module=lookups`. No new audit-action keys needed (FR-NFR-004).

### Frontend verification

- [ ] T051 [P] [US3] E2E `frontend/e2e/application-settings-audit.spec.ts` — perform a 4-change bulk-save, navigate to `/admin/audit?module=lookups`, assert 4 rows with chronological timestamps and correct entity types.

**Checkpoint**: US3 functional — full audit trail.

---

## Phase 6: Hardening

**Purpose**: Performance verification, coverage gates, quickstart walkthrough, architecture-test fences.

- [ ] T052 [P] Performance test in `.../ApplicationSettings/PerfTests.cs` — bulk-save of 50 changes completes within 1 s p95 on the dev DB (NFR-002).
- [ ] T053 [P] `List` endpoint p95 < 200 ms for the canonical 8-config dataset (NFR-001) verified via repeat-measure perf test.
- [ ] T054 [P] Coverage gate: `dotnet test` on the Lookups suite must hit ≥ 80% statements / 75% branches. The bulk-save transaction path MUST be 100% (mutation/payments line of the constitution).
- [ ] T055 [P] Coverage gate: `npm --prefix frontend run test:coverage` on `applicationSettings.service.ts` + `appSettingsValidation.ts` must hit ≥ 80%.
- [ ] T056 [P] Bundle-size check: `npm --prefix frontend run build` then verify no bundle-size regression from baseline (>+5% requires a written justification).
- [ ] T057 [P] Axe E2E: `frontend/e2e/application-settings-a11y.spec.ts` — load the page, run axe, assert zero violations on the editor surface (CategoryAccordion, YearTable, AttachSpecializationDialog).
- [ ] T058 [P] Walk through [quickstart.md](./quickstart.md) end-to-end on a fresh dev DB. Confirm every step works as documented.
- [ ] T059 [P] Update [CLAUDE.md](../../CLAUDE.md) §15 (Backend Architecture) — add Lookups module to the bounded-context list. Add spec 011 to the §14 doc index.
- [ ] T060 NetArchTest verification: `dotnet test --filter "FullyQualifiedName~Architecture"` passes after T016 lands. Spec 005 FR-M02 is preserved.

---

## Dependencies

```text
Phase 1 (T001–T005)
  └─→ Phase 2 (T006–T016)
        └─→ Phase 3 (US1 — T017–T038) ──┐
        └─→ Phase 4 (US2 — T039–T046) ──┼─→ Phase 6 (Hardening — T052–T060)
        └─→ Phase 5 (US3 — T047–T051) ──┘
```

Phases 3, 4, 5 can run in parallel after Phase 2 completes (they touch different use cases / endpoints / tests). Phase 6 closes once all three priority bands are demoable.

## Cross-spec dependencies

- **Spec 009 follow-up T047a** (not in this list): Add `POST /admin/admission-setup/cycles/{cycleId}/steps/application_settings/auto-promote` endpoint to spec 009's `AdminWizardStatusController`, called by `applicationSettings.service.ts` on first save per cycle to flip the wizard step pill from `not_started` to `in_progress`. To be added to spec 009's tasks.md once spec 011 ships.
- **Spec 010 (Lookup Management Module)**: Spec 011's FKs (`category_id`, `specialization_id`) target the lookup catalogue table. V1 references the existing `lookup_items` table; spec 010 may rename or split it. Any rename requires a coordinated migration with spec 010.

## Out of scope (deferred to follow-up specs)

- Per-cycle overrides of application settings (V1 is global)
- Application-settings clone / export / import
- `SPECIALIZATION_NOT_MAPPED` enforcement (reserved — fires post-spec-010)
- Eligibility-engine read path consumer (separate spec, applicant-portal API)
- Multi-error accumulation in bulk-save (V1 returns first error only)
