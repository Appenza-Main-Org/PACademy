# Tasks: Lookup Management Module

**Input**: Design documents from `/specs/010-lookup-management-module/`
**Prerequisites**: plan.md (required), spec.md, data-model.md, contracts/lookups-api.md, quickstart.md, research.md

**Tests**: Per Constitution Principle II (NON-NEGOTIABLE), test tasks below are MANDATORY. Every user story includes test-first tasks for: domain invariants, use-case happy + each-conflict-code path, integration round-trips (Testcontainers SQL Server), UI components, and Playwright E2E. MSW for all frontend network mocking. `.skip` / `.only` MUST NOT reach `main`. Coverage thresholds (CI): ≥ 80% statements, ≥ 75% branches; **100% on the bulk-import transaction path + data-migration script**.

**Organization**: Tasks grouped by user story for independent demo (US1 = P1 CRUD + invariants, US2 = P1 mappings, US3 = P2 import/export).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1 / US2 / US3
- All paths repo-root-relative

## Path Conventions

- Backend module: `backend/src/Modules/Lookups/PACademy.Modules.Lookups.{Domain,Application,Infrastructure,Public}/`
- Controllers: `backend/src/PACademy.Api/Controllers/Admin/AdminLookupsController.cs`, `.../AdminLookupMappingsController.cs`
- Middleware: `backend/src/PACademy.Api/Middleware/SqlConflictCodeMiddleware.cs` (extend existing from spec 011)
- Backend tests: `backend/tests/PACademy.Api.Tests/Lookups/`, `.../PACademy.Application.Tests/Lookups/`, `.../PACademy.Domain.Tests/Lookups/`, `.../PACademy.Architecture.Tests/`
- Frontend service: `frontend/src/features/lookups/api/lookups.service.ts`
- Frontend tests: colocated next to source
- Playwright E2E: `frontend/e2e/`

---

## Phase 1: Setup

**Purpose**: Extend the Lookups module (introduced by spec 011) with the new conflict codes, the type-registry skeleton, and the permission policies.

- [ ] T001 Extend `frontend/src/shared/lib/errors.ts` `ConflictCode` union with `UNKNOWN_TARGET`, `UNKNOWN_FACULTY`, `INVALID_EXTRAS_SHAPE`. (Existing main union already has `DUPLICATE_CODE`, `SELF_PARENT`, `CIRCULAR_HIERARCHY`, `PARENT_HAS_CHILDREN`, `IN_USE`, `INVALID_DATE_RANGE`, `DUPLICATE_MAPPING`.) Confirm typescript compiles.
- [ ] T002 [P] Add `lookups:read` + `lookups:write` permission policies to `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/RolePermissions.cs`. Assign `lookups:read` to `committee_admin`; `lookups:write` to super_admin only (via `*`). Restart-test the permission evaluator.
- [ ] T003 [P] Extend `backend/src/PACademy.Api/Middleware/SqlConflictCodeMiddleware.cs` (from spec 011) — add the 5 new error-number-to-code mappings (51200, 51210, 51220, 51230, 51240). Also extend the CHECK-constraint-name-to-code map for `CK_LookupItem_NotSelfParent` and `CK_LookupItem_DateRange`. Add unit tests for the new mappings.
- [ ] T004 [P] Add Arabic conflict-message registry `backend/src/Modules/Lookups/PACademy.Modules.Lookups.Application/ConflictMessages.cs` per NFR-005. One static `Dictionary<string, (string Ar, string En)>` keyed by conflict code. Used by `SqlConflictCodeMiddleware` (override per-code messages) and use cases.
- [ ] T005 [P] Audit: Confirm `module='lookups'` and `entityType='<TypeName>Row'` are accepted by the existing audit middleware. Add `entity_imported` and `entity_exported` to the audit-action labels in `frontend/src/shared/lib/audit.ts` `ACTION_FALLBACK` if not already present (merged from main).

---

## Phase 2: Foundational

**Purpose**: Domain entities, DbContext extension, the migration scaffold. All later phases depend on this.

**⚠️ CRITICAL**: Blocks all three user-story phases.

### Domain entities

- [ ] T006 [P] Implement `LookupItemType` entity in `backend/src/Modules/Lookups/PACademy.Modules.Lookups.Domain/LookupItemType.cs` per data-model.md. Factory `Create(...)` (used at seed time only). No mutating behavior — closed-extension.
- [ ] T007 [P] Implement `LookupItem` aggregate in `.../LookupItem.cs` per data-model.md. Factory `Create(...)` + `Update(...)` + `SoftDelete(reason, by)` + `Restore()` + `SetParent(...)`. Domain validation: `parent_id <> id`, `start_date <= end_date`.
- [ ] T008 [P] Implement type-specific `extras` POCOs in `.../LookupItemExtras/`. One file per type: `RelationshipExtras.cs`, `TestExtras.cs`, `NationalityExtras.cs`, `GovernorateExtras.cs`, `PoliceStationExtras.cs`, `QualificationExtras.cs`, `AnnouncementExtras.cs`, `CommitteeExtras.cs`, `TestResultExtras.cs`, `ApplicantCategoryExtras.cs`, `NidMissingReasonExtras.cs`, `RelationshipDegreeTierExtras.cs`. Marker interface `IExtras`. ~12 files total (5 types have empty extras).
- [ ] T009 [P] Implement mapping entities `CategorySpecialization`, `CategoryCommittee`, `CategoryTest`, `PeriodCategory` in `.../LookupMappings/`. Each is a sealed class with composite key `(CategoryId, TargetId)` and a factory `Create(categoryId, targetId, createdBy)`. No update behavior — mappings are add/remove only.

### Persistence

- [ ] T010 Extend `ILookupsDbContext` in `.../Application/ILookupsDbContext.cs` with new `DbSet<>` properties: `LookupItemTypes`, `LookupItems`, `CategorySpecializations`, `CategoryCommittees`, `CategoryTests`, `PeriodCategories`. (Spec 011's existing properties stay.)
- [ ] T011 [P] EF Core configurations for the new entities in `.../Infrastructure/Persistence/Configurations/`:
  - `LookupItemTypeConfiguration.cs` (table `lookup_item_types`, PK `code`)
  - `LookupItemConfiguration.cs` (table `lookup_items`, PK `id`, FK `parent_id` self, FK `faculty_code` partial, filtered unique on `(lookup_type_code, code) WHERE deleted_at IS NULL`, `IsRowVersion()`)
  - `CategorySpecializationConfiguration.cs` + 3 sibling mappings (composite PK, both FKs, `IsRowVersion()`)
- [ ] T012 Implement `ExtrasSerializer` in `.../Application/Lookups/ExtrasSerializer.cs` — `Dictionary<string, Func<JsonNode, IExtras>>` registry keyed by `lookup_type_code`. Handles round-trip JSON ↔ POCO. Throws `INVALID_EXTRAS_SHAPE` if required fields missing per type.
- [ ] T013 Extend `LookupsApiService` (spec 011's implementation of `ILookupsApi`) with the new lookup-existence methods used by other modules: `LookupItemExistsAsync(typeCode, code, ct)`, `MappingExistsAsync(mappingKey, categoryId, targetId, ct)`. Wire DI in `LookupsModule.cs`.

### Migration

- [ ] T014 Generate migration `010_LookupCatalogue` via `dotnet ef migrations add 010_LookupCatalogue --context LookupsDbContext --project src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure --startup-project src/PACademy.Api`. Manually augment `Up()` with all triggers + CHECK constraints + filtered unique indexes per data-model.md. Seed `lookup_item_types` (31 rows) and `lookup_items` (~1,500 rows from `LOOKUPS_SEED` — port the JSON literals from `frontend/src/features/lookups/mock/lookups.mock.ts`). Seed wrapped in `IF NOT EXISTS` for idempotency.
- [ ] T015 [P] Apply the migration to a fresh dev DB: `dotnet ef database update --context LookupsDbContext`. Verify the 5 tables, 31 type rows, ~1,500 item rows. Confirm all triggers + CHECK constraints exist via `sys.triggers` + `sys.check_constraints` queries.
- [ ] T016 [P] Architecture test extension `LookupsModuleStillRespectsBoundaries` in `backend/tests/PACademy.Architecture.Tests/LookupsModuleTests.cs` — re-runs after spec 010's additions; same boundary rules apply.

**Checkpoint**: Module extended, tables created, triggers in place. All three user-story phases can begin.

---

## Phase 3: User Story 1 — Typed CRUD with 7 invariants (Priority: P1) 🎯 MVP

### Tests for User Story 1 (REQUIRED) ⚠️

> Write these tests FIRST and confirm they FAIL before implementation.

#### Domain unit tests

- [ ] T017 [P] [US1] Domain tests for `LookupItem` in `backend/tests/PACademy.Domain.Tests/Lookups/LookupItemTests.cs`: factory rejects `parent_id == id`; rejects `start_date > end_date`; soft-delete sets `deleted_at`; restore clears it; update preserves immutable fields.
- [ ] T018 [P] [US1] Domain tests for the 12 `LookupItemExtras` POCOs — each validates its own required-field set. One test class per type code.

#### Integration tests

- [ ] T019 [P] [US1] HTTP integration test `backend/tests/PACademy.Api.Tests/Lookups/TypeRegistryIntegrationTests.cs`: `GET /admin/lookups/_types` returns 31 rows.
- [ ] T020 [P] [US1] HTTP integration test `.../LookupItemsCrudIntegrationTests.cs`: full CRUD for 3 representative types — `GOVERNORATES` (flat), `RELATIONSHIPS` (hierarchical), `SPECIALIZATIONS` (with `facultyCode` FK). Each test covers list, get, create, patch, soft-delete, restore, reorder.
- [ ] T021 [P] [US1] HTTP integration test `.../ConflictCodesIntegrationTests.cs` — one test per code: `DUPLICATE_CODE`, `SELF_PARENT`, `CIRCULAR_HIERARCHY`, `PARENT_HAS_CHILDREN`, `IN_USE`, `INVALID_DATE_RANGE`, `INVALID_EXTRAS_SHAPE`, `UNKNOWN_FACULTY`.
- [ ] T022 [P] [US1] HTTP integration test `.../OptimisticLockingIntegrationTests.cs`: stale rowVersion on PATCH returns 409 `ROW_VERSION_CONFLICT` with `currentRowVersion` echoed.

#### Frontend tests

- [ ] T023 [P] [US1] Service-layer tests in `frontend/src/features/lookups/api/lookups.service.test.ts` — extend the existing main tests to cover the real-API shape. MSW handlers stub each endpoint from contracts §2.

#### Playwright E2E

- [ ] T024 [P] [US1] Playwright E2E `frontend/e2e/lookups-p1.spec.ts` — super_admin → `/admin/lookups` → edit 3 lookup rows across 3 types → save → refresh → state matches.

### Backend implementation for User Story 1

- [ ] T025 [P] [US1] DTOs in `.../Application/Dtos/`: `LookupItemTypeDto`, `LookupItemDto`, `CreateLookupItemRequest`, `UpdateLookupItemRequest`, `ReorderLookupItemsRequest`, `LookupMappingDto`, `DeleteResultDto`. Match contracts verbatim.
- [ ] T026 [P] [US1] `LookupItemMapper` in `.../Application/Lookups/LookupItemMapper.cs` — entity → DTO with `extras` JSON flattened to top-level DTO fields per type code. Uses `ExtrasSerializer` (T012) for deserialization.
- [ ] T027 [P] [US1] Use case `ListLookupTypesUseCase` in `.../Application/Lookups/`.
- [ ] T028 [P] [US1] Use case `ListLookupItemsUseCase` — supports `?activeOnly`, `?includeDeleted`. Joins `lookup_item_types` for the labelAr field.
- [ ] T029 [P] [US1] Use case `GetLookupItemUseCase` — returns 404 on missing or soft-deleted (unless includeDeleted).
- [ ] T030 [US1] Use case `CreateLookupItemUseCase` — validates code uniqueness, generates code if omitted (next sequential), validates `extras` shape via mapper, validates `parent_id` (no self, parent must be live and same type), validates `faculty_code` for SPECIALIZATIONS, audit emission.
- [ ] T031 [US1] Use case `UpdateLookupItemUseCase` — partial update, validates rowVersion, re-validates invariants (cycle check is on the DB trigger side, validated at SaveChanges).
- [ ] T032 [US1] Use case `SoftDeleteLookupItemUseCase` — sets `deleted_at`. Triggers fire for `PARENT_HAS_CHILDREN` / `IN_USE`. Audit `soft_delete`. Returns `DeleteResult`.
- [ ] T033 [P] [US1] Use case `RestoreLookupItemUseCase` — super-admin only; clears `deleted_at`. Audit `restore`.
- [ ] T034 [P] [US1] Use case `ReorderLookupItemsUseCase` — accepts ordered code list, reassigns `sort_order` to 10, 20, 30, … in one transaction. Audit `update` (summary).
- [ ] T035 [US1] Controller `AdminLookupsController` in `backend/src/PACademy.Api/Controllers/Admin/AdminLookupsController.cs` — wires endpoints from contracts §1, §2.
- [ ] T036 [US1] Register all use cases in `LookupsModule.cs` DI.

### Frontend implementation for User Story 1

- [ ] T037 [US1] Swap `frontend/src/features/lookups/api/lookups.service.ts` from MOCK to real `apiClient`. Match contracts §1, §2 verbatim. Each method handles the conflict codes via the extended `ConflictCode` union (T001).
- [ ] T038 [US1] Verify all 15 consumer pages (per `docs/migration/lookups/REPORT.md` §4) work unchanged against the real backend. No edits expected.
- [ ] T039 [US1] Verify TypeScript compiles, lint passes (`npm --prefix frontend run typecheck && npm --prefix frontend run lint`).

**Checkpoint**: US1 functional — typed CRUD for all 17 admin-UI lookups with all 7 invariants enforced.

---

## Phase 4: User Story 2 — Cross-lookup mappings (Priority: P1)

### Tests for User Story 2 ⚠️

- [ ] T040 [P] [US2] HTTP integration test `.../MappingsIntegrationTests.cs` — for each of the 4 mappings: list (joined with target labels), POST happy, POST `DUPLICATE_MAPPING`, POST `UNKNOWN_TARGET`, DELETE happy.
- [ ] T041 [P] [US2] Frontend service tests for the mapping endpoints.
- [ ] T042 [P] [US2] Playwright E2E `frontend/e2e/lookups-mappings.spec.ts` — `/admin/lookups/mappings/category-specializations` → check 3 boxes in matrix → save → refresh → state matches.

### Backend implementation for User Story 2

- [ ] T043 [P] [US2] Use case `ListMappingsUseCase` — generic over the 4 mapping tables (parameterized by `mappingKey`).
- [ ] T044 [P] [US2] Use case `CreateMappingUseCase` — validates both FKs reference live rows of the right type code. Trigger throws `UNKNOWN_TARGET` if not. Audit `create`.
- [ ] T045 [P] [US2] Use case `DeleteMappingUseCase` — hard delete. Audit `delete`.
- [ ] T046 [US2] Controller `AdminLookupMappingsController` in `backend/src/PACademy.Api/Controllers/Admin/AdminLookupMappingsController.cs` — wires endpoints from contracts §3.

### Frontend implementation for User Story 2

- [ ] T047 [US2] Wire the 4 mapping screens on `origin/main` (`MappingMatrix` component) to the real endpoints. Currently they read from MOCK; swap to `apiClient`.
- [ ] T048 [US2] Verify the MappingMatrix UI correctly handles 409 DUPLICATE_MAPPING (renders a toast; matrix cell stays checked from server state).

**Checkpoint**: US2 functional — all 4 mappings persist via real backend.

---

## Phase 5: User Story 3 — Bulk import / export (Priority: P2)

### Tests for User Story 3 ⚠️

- [ ] T049 [P] [US3] Domain unit tests for `LookupSchemaRegistry` in `backend/tests/PACademy.Domain.Tests/Lookups/LookupSchemaRegistryTests.cs` — for each of the 17 admin-UI types, schema returns the expected columns + Arabic header labels in the right order.
- [ ] T050 [P] [US3] Integration test `.../ImportExportIntegrationTests.cs` — export `GOVERNORATES` as XLSX → parse the file in-process → counts match. Then import the same file in update-only mode → response shows `updated: 27, inserted: 0`.
- [ ] T051 [P] [US3] Integration test for import atomicity in `.../ImportAtomicityTests.cs` — submit a 50-row XLSX where row 30 violates `DUPLICATE_CODE`. Assert nothing committed; response carries per-row error map.
- [ ] T052 [P] [US3] Perf test in `.../BulkImportPerfTests.cs` — 1,000-row import completes within 5 s p95 on dev DB (NFR-002).
- [ ] T053 [P] [US3] Playwright E2E `frontend/e2e/lookups-import.spec.ts` — open `/admin/lookups/{type}` → click "استيراد" → drop an XLSX → confirm preview → assert post-import state.

### Backend implementation for User Story 3

- [ ] T054 [US3] `LookupSchemaRegistry` in `.../Application/BulkOps/LookupSchemaRegistry.cs` — per-type-code column registry (column key, Arabic header, validator). One row per admin-UI type code.
- [ ] T055 [P] [US3] `XlsxParser` in `.../Application/BulkOps/XlsxParser.cs` using OpenXML (already a dependency for export). Streams rows; emits per-row validation events.
- [ ] T056 [P] [US3] `CsvParser` in `.../Application/BulkOps/CsvParser.cs` — UTF-8 (BOM-aware), Arabic-safe.
- [ ] T057 [US3] Use case `ImportLookupItemsUseCase` — opens a transaction, parses the file, validates each row against the schema, runs `Create` or `Update` per row based on `mode`. Catches per-row `SqlException` and accumulates errors. On any error: ROLLBACK + return 422 with the error map. On success: COMMIT + emit one `entity_imported` summary audit + one row-level audit per change.
- [ ] T058 [US3] Use case `ExportLookupItemsUseCase` — produces an XLSX (or CSV) stream with the right column order per type. Audit `entity_exported` with row count.
- [ ] T059 [US3] Extend `AdminLookupsController` (T035) with the `/import` and `/export` endpoints per contracts §4. Multipart upload handling via ASP.NET form binding.

### Frontend implementation for User Story 3

- [ ] T060 [US3] Wire the existing `ImportDialog` (shared component, on main) to `POST /admin/lookups/{typeCode}/import`. The dialog already parses CSV/XLSX client-side for preview; on confirm, POST the original file to the server.
- [ ] T061 [US3] Wire the existing `ExportMenu` (shared component) to `GET /admin/lookups/{typeCode}/export?format=…`.

**Checkpoint**: US3 functional — Excel import/export round-trips for all 17 admin-UI lookups.

---

## Phase 6: Data migration from `reference_data_entries`

**Purpose**: Migrate live data from the legacy table into `lookup_items`, then drop the legacy table.

- [ ] T062 [P] Read the legacy `reference_data_entries` schema (`backend/src/Modules/ReferenceData/PACademy.Modules.ReferenceData.Domain/ReferenceDataEntry.cs`). Identify which of the 31 type codes correspond.
- [ ] T063 Author the data migration as part of `010_LookupCatalogue` migration's `Up()` method, BEFORE the seed step:
  ```sql
  INSERT INTO dbo.lookup_items (id, lookup_type_code, code, name_ar, name_en, is_active, sort_order, created_at, created_by, updated_at, updated_by, row_version)
    SELECT NEWID(), 
           CASE rde.tab
             WHEN 'governorates'     THEN 'GOVERNORATES'
             WHEN 'specializations'  THEN 'SPECIALIZATIONS'
             WHEN 'nationalities'    THEN 'NATIONALITIES_COUNTRIES'
             …
           END,
           rde.key, rde.label_ar, NULL, rde.is_active, rde.sort_order,
           rde.created_at, rde.created_by, rde.updated_at, rde.updated_by,
           NEWID() /* placeholder rowversion */
      FROM dbo.reference_data_entries rde
      WHERE NOT EXISTS (SELECT 1 FROM dbo.lookup_items li WHERE li.lookup_type_code = (…) AND li.code = rde.key);
  ```
- [ ] T064 Add a row-count assertion at the end of the data-migration SQL:
  ```sql
  IF (SELECT COUNT(*) FROM dbo.reference_data_entries) <> 
     (SELECT COUNT(*) FROM dbo.lookup_items WHERE lookup_type_code IN ('GOVERNORATES','SPECIALIZATIONS','NATIONALITIES_COUNTRIES','RELATIONSHIPS','CASE_TYPES','RANKS'))
    THROW 51299, 'DATA_MIGRATION_PARITY_FAIL', 1;
  ```
- [ ] T065 Test data migration on a fresh dev DB seeded from the legacy schema. Confirm parity.
- [ ] T066 Author a SEPARATE migration `010b_DropReferenceDataLegacy` that drops the legacy table. DO NOT include in `010_LookupCatalogue` — staging soak the migration first (1 week minimum).

---

## Phase 7: Hardening

- [ ] T067 [P] Performance verification: `GET /admin/lookups/POLICE_STATIONS` (~200 rows) returns within 100 ms p95 (NFR-001).
- [ ] T068 [P] Performance verification: `tr_LookupItem_NoCycles` trigger completes within 10 ms for a 6-level × 50-rows-per-level test tree (NFR-003).
- [ ] T069 [P] Coverage gate: `dotnet test --filter "FullyQualifiedName~Lookups"` must hit ≥ 80% / 75%; 100% on `ImportLookupItemsUseCase` and the data-migration SQL.
- [ ] T070 [P] Coverage gate: `npm --prefix frontend run test:coverage` on `lookups.service.ts` ≥ 80%.
- [ ] T071 [P] Bundle-size check: `npm --prefix frontend run build` — no regression > 5% from baseline.
- [ ] T072 [P] Axe E2E: `frontend/e2e/lookups-a11y.spec.ts` — zero violations on `/admin/lookups`, `/admin/lookups/RELATIONSHIPS` (tree mode), `/admin/lookups/GOVERNORATES` (grid mode), `/admin/lookups/mappings/category-specializations` (matrix mode).
- [ ] T073 [P] NetArchTest verification: `dotnet test --filter "FullyQualifiedName~Architecture"` passes. Spec 005 FR-M02 preserved.
- [ ] T074 Walk through [quickstart.md](./quickstart.md) end-to-end on a fresh dev DB. Confirm every step works.
- [ ] T075 [P] Update [CLAUDE.md](../../CLAUDE.md) §15 (Backend Architecture) — note Lookups is the 5th module, `ReferenceData` is deprecated, scheduled for drop via `010b_DropReferenceDataLegacy` after soak.
- [ ] T076 [P] Update `specs/008-lookup-excel-import/tasks.md` with a deprecation notice — spec 008 is superseded by spec 010 §5 (Bulk Import/Export). Mark all 008 tasks as `~~struck~~`.
- [ ] T077 [P] Update `docs/INTEGRATION_HANDOFF.md` — replace any references to `reference_data_entries` with `lookup_items` + the new typed shape. Note the closed-extension policy for new type codes.
- [ ] T078 [P] Update `docs/DB_CONSTRAINTS.md` §10 with the actual trigger error numbers (51200/51210/51220/51230/51240) — the doc currently uses placeholder error names that must match the migration SQL.
- [ ] T079 Final smoke check: `dotnet test` + `npm --prefix frontend run test` + `npm --prefix frontend run test:e2e` all green; zero `--no-verify` commits on the branch.
- [ ] T080 Cleanup task — after 1 week of staging soak, apply `010b_DropReferenceDataLegacy` migration in staging then prod. Document the operation in `docs/migration/lookups/REPORT.md`.

---

## Dependencies

```text
Phase 1 (T001–T005)
  └─→ Phase 2 (T006–T016)
        ├─→ Phase 3 (US1 — T017–T039) ──┐
        ├─→ Phase 4 (US2 — T040–T048) ──┤
        ├─→ Phase 5 (US3 — T049–T061) ──┤
        └─→ Phase 6 (Data migration — T062–T066) ─┤
                                              ↓
                                         Phase 7 (Hardening — T067–T080)
```

Phases 3, 4, 5, 6 can run in parallel after Phase 2 — they touch different use cases / endpoints / migration steps.

## Cross-spec dependencies

- **Spec 011 (Application Settings)** — Spec 011's FKs target `lookup_items.id` for type codes `APPLICANT_CATEGORIES` and `SPECIALIZATIONS`. Spec 011's migration `011_ApplicationSettings` runs AFTER spec 010's `010_LookupCatalogue` — order matters. Either: (a) develop on the same branch, (b) spec 010 ships first as a prerequisite.
- **Spec 009 (Admission-Setup)** — No direct dependency. Spec 009's Committees module has a `CommitteeKind` enum that overlaps with the `COMMITTEES` lookup type's `kind` extras field; future consolidation is out of scope.
- **Spec 005 (Modular Monolith)** — Lookups is now the 5th bounded-context module. `ReferenceData` module deprecates after the `010b` cleanup migration.
- **Spec 008 (Lookup Excel + CSV Import)** — Spec 008's 21-table backend is **superseded entirely**. The spec-009 merge-followup commit (`cda047a`) already removed the spec 008 frontend wizard code. Spec 010's `/import` + `/export` endpoints replace spec 008.

## Out of scope (deferred to follow-up specs)

- Admin UI for the 14 picker-only type codes (e.g., `MARITAL_STATUSES` row editing)
- Free-text search across lookups
- Per-cycle lookup overrides
- Lookup row versioning (history of edits beyond the audit trail)
- Full-text indexes on Arabic name fields
- Lookup-row import via paste-from-clipboard (only XLSX/CSV in V1)
