# Implementation Plan: Application Settings Persistence

**Branch**: `011-application-settings-persistence` (off `009-admission-setup-persistence` after merge) | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)

## Summary

The admission-setup wizard's step 1 (`application_settings`) must read from and write to the database. Today the frontend ships a complete editor (12 components on `origin/main`) backed by an in-memory mock (`applicationSettingsService`). Spec 011 stands up the three SQL Server tables + two side tables that mirror the frontend's three-tier hierarchy, the REST surface that matches `applicationSettings.service.ts`'s INTEGRATION CONTRACT JSDoc, the bulk-save transaction, and the 7 typed conflict codes per `docs/DB_CONSTRAINTS.md §11`.

Application settings is **global master data, not cycle-scoped** (FR-020). The wizard-step pill state lives in `wizard_step_statuses` (owned by spec 009); spec 011's tables have no `cycle_id` column.

## Approach

### 1. New module: `Lookups` (host for spec 011 tables)

Spec 011's three tables are tightly bound to the lookup catalogue (categories + specializations as FKs). Two viable homes:

- **(A)** New `Lookups` module under `backend/src/Modules/Lookups/` — co-locates with the future spec 010 (Lookup Management Module) backend.
- **(B)** Extend the existing `ReferenceData` module under `backend/src/Modules/ReferenceData/`.

**Decision: (A) — new `Lookups` module.** Reasons:
1. Spec 010 (lookup-management backend) will land in `Lookups`. Co-locating spec 011's tables there avoids a future "split spec 011 between two modules" refactor.
2. `ReferenceData` is the legacy module name; the frontend has already renamed the user-facing domain to "lookups" (per `origin/main`'s migration report). Mirroring that on the backend keeps naming consistent.
3. Spec 005's modular monolith pattern (FR-M02) makes adding a module cheap (4 csproj files + DI registration).

The 3 spec-011 tables (`applicant_category_configs`, `applicant_category_specializations`, `applicant_specialization_years`) plus the 2 side tables live in `LookupsDbContext` with history table `__EFMigrationsHistory_Lookups`. Spec 010's 18 typed lookup tables + 4 mapping tables will join the same context when it ships.

### 2. Module boundary contract

`Lookups.Public/ILookupsApi.cs` exposes (for cross-module reads):
- `Task<bool> CategoryExistsAsync(string categoryCode, CancellationToken ct)` — for spec 009's eligibility engine reading
- `Task<bool> SpecializationExistsAsync(string specializationCode, CancellationToken ct)` — same

The Admissions module (spec 009 — wizard, eligibility) reads these to validate references. No other cross-module reads V1.

### 3. Tables (per data-model.md)

| Table | Tier | Notes |
|---|---|---|
| `applicant_category_configs` | 1 — config | FK `category_id` → `lookup_items` (spec 010) on string `code` |
| `applicant_category_specializations` | 2 — junction | FK `config_id` → tier-1; FK `specialization_id` → lookup `specializations` |
| `applicant_specialization_years` | 3 — leaf | FK `category_specialization_id` → tier-2 |
| `applicant_specialization_year_genders` | M-of-N | PK `(year_id, gender_type)`; required ≥1 (FR-004) |
| `applicant_specialization_year_marital_statuses` | M-of-N | PK `(year_id, marital_code)`; required ≥0 |

All tables carry `row_version rowversion NOT NULL` (FR-013). Tier-3 carries soft-delete columns.

### 4. Bulk-save transaction (the hot path)

`POST /admin/app-settings/bulk-save` receives `BulkYearChange[]`. Server-side:
1. Begin transaction at `Snapshot` isolation level (avoids phantom reads during the per-spec invariant joins).
2. For each change, switch on `kind`:
   - `create` → INSERT year + gender side rows + marital side rows
   - `update` → UPDATE year (rowVersion check) + DELETE+INSERT side rows
   - `delete` → soft-delete year (set `is_deleted=true`, stamp `deleted_at`, `deleted_by`)
3. Triggers fire per-row for `DUPLICATE_YEAR` / `OVERLAPPING_PERIOD` — caught at COMMIT.
4. On any failure: roll back, return 422 with per-row error map keyed by `BulkYearChange.id` (or array index for creates).
5. On success: emit one audit entry per change kind (sharing the same transaction timestamp); return `BulkSaveResult { created, updated, deleted }`.

The transaction is wrapped in EF Core's `IDbContextTransaction` — no cross-module work needed (spec 011's tables live in one context). `CrossModuleUnitOfWork` is NOT required here.

### 5. Invariant triggers

Per `docs/DB_CONSTRAINTS.md §11`, four INSTEAD-OF triggers + three CHECK constraints + one UPDATE-trigger:

| Invariant | Mechanism | Code |
|---|---|---|
| `DUPLICATE_YEAR` | INSTEAD OF INSERT/UPDATE on `applicant_specialization_years` | THROW 51120 |
| `OVERLAPPING_PERIOD` | INSTEAD OF INSERT/UPDATE on `applicant_specialization_years` | THROW 51100 |
| `INVALID_DATE_RANGE` | CHECK constraint `CK_AppSpecYear_DateOrder` | THROW via CHECK |
| `AGE_NOT_POSITIVE` | CHECK constraint `CK_AppSpecYear_MaxAge` | THROW via CHECK |
| `GRADE_RANGE_INVALID` | CHECK constraint `CK_AppSpecYear_GradeRange` | THROW via CHECK |
| `GENDER_REQUIRED` | Trigger on `applicant_specialization_year_genders` after-delete + on-year-insert | THROW 51125 |
| `CATEGORY_HAS_ACTIVE_YEARS` | Trigger on `applicant_category_configs` after-update of `is_active` | THROW 51110 |

A new ASP.NET middleware (`SqlConflictCodeMiddleware`) catches the `THROW` codes and converts them to HTTP 409/422 with the typed `ConflictErrorResult` body. The middleware lives in `PACademy.Api/Middleware/`. (Distinct from spec 009's `DbUpdateConcurrencyExceptionMiddleware`.)

### 6. REST surface

Endpoints (full contract in `contracts/app-settings-api.md`):

```text
GET    /admin/app-settings/category-configs                  → ApplicantCategoryConfigDto[]
PATCH  /admin/app-settings/category-configs/{id}             body: { isActive, rowVersion }
       → 200 | 409 CATEGORY_HAS_ACTIVE_YEARS

GET    /admin/app-settings/category-configs/{configId}/specializations
GET    /admin/app-settings/category-configs/{configId}/eligible-specializations
POST   /admin/app-settings/category-configs/{configId}/specializations
       body: { specializationId } → 201 | 409 SPECIALIZATION_NOT_MAPPED (reserved)
DELETE /admin/app-settings/specializations/{id}              → 204 (cascade delete years)

GET    /admin/app-settings/specializations/{csId}/years
POST   /admin/app-settings/specializations/{csId}/years      body: full year payload
PATCH  /admin/app-settings/years/{id}                        body: partial + rowVersion
DELETE /admin/app-settings/years/{id}                        → 204 (soft delete)
POST   /admin/app-settings/bulk-save                         body: BulkYearChange[]
                                                              → 200 BulkSaveResult | 422 per-row
```

All endpoints require `admission-setup:read` (GET) or `admission-setup:write` (mutating). No new permission policy (FR-019).

### 7. Frontend integration

The frontend already ships a fully-wired editor on `origin/main`. Spec 011's frontend work is **swap mock → real apiClient** in `applicationSettings.service.ts`. The 12 components, the `appSettingsDraft` Zustand store, the `appSettingsValidation` helpers, `StickyBulkSaveBar`, `UnsavedChangesPrompt` — all stay unchanged.

The mock file (`mock/appSettings.mock.ts`) survives **only** as fixture seed for tests; the service no longer reads from it.

### 8. EF Migration

Single migration: `011_ApplicationSettings` on the new `LookupsDbContext`. Includes:
- 3 main tables + 2 side tables
- 4 INSTEAD-OF triggers + 3 CHECK constraints + 1 update trigger
- Seed: zero rows (admin populates via UI). Optional dev-seed via `--seed-demo` adds the 8-config sample dataset from `appSettings.mock.ts`.
- Idempotent guards: each `CREATE TABLE`, `CREATE TRIGGER`, `ALTER TABLE ADD CONSTRAINT` wrapped in `IF NOT EXISTS` (dual UserManager / per-context history pattern from spec 007).

### 9. Tasks summary

See [tasks.md](./tasks.md) for the full breakdown. Sequencing:

```
Phase 1 (Setup)              → T001–T005   (module scaffold, permissions)
Phase 2 (Foundational)       → T006–T010   (LookupsDbContext, migration scaffold)
Phase 3 (US1 — Persistence)  → T011–T030   (entities + use cases + controller + frontend flip)
Phase 4 (US2 — Conflict codes)→ T031–T045  (triggers + middleware + integration tests)
Phase 5 (US3 — Audit)        → T046–T052   (audit emissions + verification)
Phase 6 (Hardening)          → T053–T060   (perf, coverage, quickstart, NetArchTest)
```

### 10. Test surface

| Suite | Coverage |
|---|---|
| Domain unit tests (xUnit) | Invariant enforcement on each domain entity (gender required, date range, grade range, age positive) |
| Use-case tests (xUnit) | Each use case: happy + permission deny + rowVersion conflict + each conflict code |
| Integration tests (Testcontainers SQL Server) | Full HTTP round-trips for each endpoint; trigger fires for each of the 7 conflict codes; bulk-save atomicity (one bad row → entire batch rolled back) |
| Architecture tests (NetArchTest) | `Lookups` module respects FR-M02 (only references Shared.Contracts + sibling `*.Public` projects) |
| Frontend service tests (Vitest + MSW) | `applicationSettings.service.ts` parses every endpoint shape; throws typed `ConflictError` on each of the 7 codes |
| Frontend component tests (Testing Library + jest-axe) | `YearTable`, `StickyBulkSaveBar`, `AttachSpecializationDialog` — render smoke + interaction + axe |
| Playwright E2E | One happy-path: super_admin → wizard step 1 → 4-change bulk-save → refresh → state matches |

Coverage gates (CI): ≥ 80% statements, ≥ 75% branches on the spec-011 surface. **100% on the bulk-save transaction path** (it sits in the mutation/payments line of the constitution).

## Module structure

```text
backend/src/Modules/Lookups/
├── PACademy.Modules.Lookups.Domain/
│   ├── ApplicantCategoryConfig.cs
│   ├── ApplicantCategorySpecialization.cs
│   ├── ApplicantSpecializationYear.cs
│   ├── ApplicantSpecializationYearGender.cs
│   ├── ApplicantSpecializationYearMaritalStatus.cs
│   └── GenderType.cs (enum: Male, Female)
├── PACademy.Modules.Lookups.Application/
│   ├── ILookupsDbContext.cs
│   ├── ApplicationSettings/
│   │   ├── ListCategoryConfigsUseCase.cs
│   │   ├── PatchCategoryConfigUseCase.cs
│   │   ├── AttachSpecializationUseCase.cs
│   │   ├── DetachSpecializationUseCase.cs
│   │   ├── ListYearsUseCase.cs
│   │   ├── CreateYearUseCase.cs
│   │   ├── UpdateYearUseCase.cs
│   │   ├── SoftDeleteYearUseCase.cs
│   │   ├── BulkSaveYearsUseCase.cs
│   │   └── ApplicationSettingsMapper.cs
│   └── Dtos/
│       ├── ApplicantCategoryConfigDto.cs
│       ├── ApplicantCategorySpecializationDto.cs
│       ├── ApplicantSpecializationYearDto.cs
│       ├── BulkYearChange.cs
│       └── BulkSaveResult.cs
├── PACademy.Modules.Lookups.Infrastructure/
│   ├── LookupsModule.cs
│   ├── LookupsApiService.cs                 (implements ILookupsApi)
│   └── Persistence/
│       ├── LookupsDbContext.cs
│       ├── Migrations/011_ApplicationSettings.cs
│       └── Configurations/
│           ├── ApplicantCategoryConfigConfiguration.cs
│           ├── ApplicantCategorySpecializationConfiguration.cs
│           ├── ApplicantSpecializationYearConfiguration.cs
│           ├── ApplicantSpecializationYearGenderConfiguration.cs
│           └── ApplicantSpecializationYearMaritalStatusConfiguration.cs
└── PACademy.Modules.Lookups.Public/
    └── ILookupsApi.cs

backend/src/PACademy.Api/
├── Controllers/Admin/AdminApplicationSettingsController.cs
└── Middleware/SqlConflictCodeMiddleware.cs
```

## Data model summary

See [data-model.md](./data-model.md) for full details. The 3 main tables follow the `frontend/src/features/admin/admission-setup/types.ts` shape:

```text
applicant_category_configs (id, category_id, is_active, sort_order, …, row_version)
       │
       ↓ FK config_id
applicant_category_specializations (id, config_id, specialization_id, is_active, …, row_version)
       │
       ↓ FK category_specialization_id
applicant_specialization_years (id, category_specialization_id, graduation_year, max_age,
                                min_grade, max_grade, application_start_date,
                                application_end_date, age_calc_date, is_active, is_deleted,
                                …, row_version)
       │
       ├─→ applicant_specialization_year_genders         (year_id, gender_type)         [≥1]
       └─→ applicant_specialization_year_marital_statuses (year_id, marital_code)        [≥0]
```

## API contracts summary

See [contracts/app-settings-api.md](./contracts/app-settings-api.md) for the full spec.

All endpoints prefixed `/admin/app-settings/`. Response shapes mirror the frontend's `applicationSettings.service.ts` JSDoc `INTEGRATION CONTRACT` verbatim — backend MUST match field-for-field.

## Frontend integration

| File | V1 (mock) | After spec 011 |
|---|---|---|
| `applicationSettings.service.ts` | reads `MOCK.applicantCategoryConfigs` etc., simulates latency | calls `apiClient.get/post/patch/delete` on `/admin/app-settings/*`. Maps server-thrown `ConflictError` codes to UI toasts via existing `errors.ts` normaliser |
| `applicationSettings.queries.ts` | TanStack Query hooks on the mock service | **unchanged** — hooks call the service which now hits real backend |
| `appSettingsDraft.ts` (Zustand) | client-side bulk-save buffer | **unchanged** — flushes through the service |
| `appSettingsValidation.ts` | client-side mirror of server rules | **unchanged** — the 7 conflict codes round-trip through this helper for instant feedback |
| Components (`YearTable`, `StickyBulkSaveBar`, `AttachSpecializationDialog`, …) | rendered against mock data | **unchanged** — same component contract; backend just makes data persist |

## Coordination with other specs

- **Spec 009 (Admission-Setup Wizard Persistence)** — Spec 009's wizard-step status interceptor (`WizardStatusInterceptor`) does *not* watch spec 011's tables (they're in a different DbContext). Instead, the frontend's `applicationSettings.service.ts` calls the spec 009 endpoint `POST /admin/admission-setup/cycles/{cycleId}/steps/application_settings/auto-promote` on first save for each cycle, to flip the pill from `not_started` to `in_progress`. The endpoint is added to spec 009's `AdminWizardStatusController` as a follow-up (small task — added to spec 009's tasks.md as T047a once spec 011 is approved).
- **Spec 010 (Lookup Management Module)** — Spec 011's FKs (`category_id`, `specialization_id`) target the lookup catalogue table that spec 010 owns. Until spec 010 ships, spec 011's V1 references the legacy `lookup_items` table seeded with the canonical 8 + 30 rows. Spec 010 will migrate that table; spec 011's FKs migrate with it (renamed if necessary).
- **Spec 007 (Auth + RBAC)** — Spec 011 reuses the existing `admission-setup:read` / `admission-setup:write` permissions. No new policy.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Triggers performance on large datasets | Triggers are row-by-row but inserts here are admin-driven (rare). Bulk-save of 50 rows in one transaction with triggers should complete < 1 s (NFR-002). Monitor on perf test. |
| Spec 010 not ready by integration time | V1 references `lookup_items` directly (the existing single-table). When spec 010 splits this into 18 typed tables, the FK targets shift. Migration handled as part of spec 010's data migration. |
| Frontend draft store divergence from server state during bulk-save | Optimistic-locking via rowVersion on every year row catches stale-state saves. Conflict response includes the current rowVersion; frontend re-fetches and re-applies via `RowVersionConflictDialog` (shared component from spec 009). |
| `SPECIALIZATION_NOT_MAPPED` never fires in V1 | Intentional. Frontend already handles the conditional code; backend reserves it in the response union. When the mapping ships, the attach endpoint switches without UI churn. |
