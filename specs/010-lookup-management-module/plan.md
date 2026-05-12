# Implementation Plan: Lookup Management Module

**Branch**: `010-lookup-management-module` (off `009-admission-setup-persistence` after merge) | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)

## Summary

The lookup catalogue is the platform's single source of reference data — 31 type codes (17 with admin UI on `origin/main`, 14 picker-only), backing every dropdown, picker, and FK target across the system. Spec 010 stands up:

1. A single `lookup_items` table with `lookup_type_code` discriminator, plus a parent `lookup_item_types` registration table.
2. Four mapping tables (`category_specializations`, `category_committees`, `category_tests`, `period_categories`) with composite PK `(category_id, target_id)`.
3. Seven invariants enforced by DB triggers + CHECK constraints + filtered unique indexes.
4. REST surface mirroring the frontend `lookupsService` JSDoc INTEGRATION CONTRACT verbatim.
5. Bulk Excel/CSV import + export endpoints behind the `ImportDialog` + `ExportMenu` primitives already on main.
6. Data migration from the legacy `reference_data_entries` table, then drop the legacy table.

Spec 010 owns the `Lookups` module that spec 011 introduced — both specs co-develop the module. Spec 011's `category_id` and `specialization_id` foreign keys target `lookup_items.id` for type codes `APPLICANT_CATEGORIES` and `SPECIALIZATIONS` respectively.

## Approach

### 1. Single-table-with-discriminator strategy

**Why a single table instead of 17:**

- The 17 row shapes share ~80% of their columns (code, nameAr, nameEn, isActive, sortOrder, parent, dates, soft-delete metadata, audit fields).
- Type-specific extras (`branch`/`gender`/`degree` for relationships, `iso2`/`isArab` for nationalities, `kind` for tests, etc.) go into a JSON `extras` column.
- 17 separate tables would mean 17 sets of migrations, 17 sets of triggers, and 17 use cases per CRUD operation — multiplicative complexity.
- The DB_CONSTRAINTS doc already specifies the single-table approach (§10 preamble).
- Querying across types (e.g., the eligibility engine asking "is this code in any lookup?") is trivial against one table.

**Why JSON `extras` instead of sparse columns:**

- Sparse columns work for ~5 type-specific fields; with 17 shapes × 1–5 extras each = ~50 nullable columns. The table becomes hard to read.
- JSON is queryable in SQL Server via `JSON_VALUE()` for the rare cross-cutting queries.
- Domain mappers (one per type code) serialize/deserialize `extras`; the C# domain types are still strongly typed.

### 2. Module reuse from spec 011

Spec 011 already introduced the `Lookups` module skeleton + `LookupsDbContext` + history table `__EFMigrationsHistory_Lookups`. Spec 010 adds tables to the *same* context.

Spec ordering: Spec 011 and 010 are co-developed but spec 010's tables (`lookup_items`, `lookup_item_types`, 4 mappings) ship in migration `010_LookupCatalogue` BEFORE spec 011's migration `011_ApplicationSettings`. Spec 011's FKs (`category_id`, `specialization_id`) target `lookup_items` rows — they cannot exist before that table does.

### 3. Tables (per data-model.md)

| Table | Purpose | Rows |
|---|---|---|
| `lookup_item_types` | Closed-extension type registry | 31 (seeded) |
| `lookup_items` | All lookup rows across all types | ~1,500 at full seed |
| `category_specializations` | Mapping 1 of 4 | variable |
| `category_committees` | Mapping 2 of 4 | variable |
| `category_tests` | Mapping 3 of 4 | variable |
| `period_categories` | Mapping 4 of 4 | variable |

Note: `LookupItem.parent_id` is a self-FK enabling hierarchies (relationships, jobs). `specializations.facultyCode` is a column on `lookup_items` (extras-promoted to a top-level column for FK enforcement); other type-specific FKs live in `extras`.

### 4. Invariant enforcement

Per `docs/DB_CONSTRAINTS.md §10`:

| Invariant | Mechanism | Code |
|---|---|---|
| `DUPLICATE_CODE` | Filtered unique index `WHERE deleted_at IS NULL` | constraint violation 2601/2627 |
| `SELF_PARENT` | CHECK constraint `parent_id <> id` | constraint violation 547 |
| `CIRCULAR_HIERARCHY` | AFTER UPDATE trigger with recursive CTE | THROW 51200 |
| `PARENT_HAS_CHILDREN` | INSTEAD OF UPDATE trigger guard on soft-delete | THROW 51210 |
| `IN_USE` | INSTEAD OF UPDATE trigger checking 4 mapping tables | THROW 51220 |
| `INVALID_DATE_RANGE` | CHECK constraint `start_date IS NULL OR end_date IS NULL OR start_date <= end_date` | constraint violation 547 |
| `DUPLICATE_MAPPING` | Composite PK on each mapping table | constraint violation 2627 |
| `UNKNOWN_TARGET` (new) | FK on mapping rows + use-case-level liveness check | 422 from application layer |
| `ROW_VERSION_CONFLICT` | `rowversion` column + EF Core concurrency token | DbUpdateConcurrencyException (spec 009 middleware) |

The existing `SqlConflictCodeMiddleware` (from spec 011) is extended to map error numbers 51200, 51210, 51220 to the new codes. CHECK violation messages (547) are parsed for constraint name + mapped.

### 5. REST surface

Endpoints (full contract in `contracts/lookups-api.md`):

```text
# Lookup items
GET    /admin/lookups/{typeCode}                 ?includeDeleted=true       → LookupItemDto[]
GET    /admin/lookups/{typeCode}/{code}                                     → LookupItemDto
POST   /admin/lookups/{typeCode}                 body: create payload       → 201 LookupItemDto
PATCH  /admin/lookups/{typeCode}/{code}          body: partial + rowVersion → 200 LookupItemDto | 409
DELETE /admin/lookups/{typeCode}/{code}                                     → 200 { deleted: true } | 409 DeleteBlocked
POST   /admin/lookups/{typeCode}/reorder         body: { orderedCodes: string[] } → 200 LookupItemDto[]
POST   /admin/lookups/{typeCode}/{code}/restore                             → 200 LookupItemDto

# Mappings
GET    /admin/lookup-mappings/{mappingKey}                                  → LookupMappingDto[]
POST   /admin/lookup-mappings/{mappingKey}       body: { categoryId, targetId } → 201 LookupMappingDto
DELETE /admin/lookup-mappings/{mappingKey}/{categoryId}/{targetId}          → 204

# Bulk
POST   /admin/lookups/{typeCode}/import          multipart: file            → 200 ImportResult | 422
GET    /admin/lookups/{typeCode}/export          ?format=xlsx|csv           → file stream

# Catalogue metadata
GET    /admin/lookups/_types                                                 → LookupItemTypeDto[]
```

All endpoints require `lookups:read` (GET) or `lookups:write` (mutations). New policies added to spec 007's RolePermissions table.

### 6. Frontend integration

The frontend on `origin/main` is fully wired against the mock. Spec 010's frontend work:

- Swap `frontend/src/features/lookups/api/lookups.service.ts` from MOCK to real `apiClient`.
- Swap the 4 mapping screens' service calls from MOCK to real `apiClient`.
- Wire `ImportDialog` + `ExportMenu` per lookup to the new bulk endpoints.

The 31 type codes registered on the frontend (`LOOKUP_META` for 17, plus a smaller registry for the 14 picker-only) must mirror the backend's `lookup_item_types` seed exactly. Drift = silent bugs.

### 7. Data migration from `reference_data_entries`

The legacy `reference_data_entries` table (spec 002) holds ~6 type codes (governorates, nationalities, specializations, relationships, case-types, ranks) with simpler schemas. The `010_LookupCatalogue` migration:

1. Creates the new tables.
2. Reads `reference_data_entries` row-by-row, maps each to the corresponding `lookup_items` row with the right `lookup_type_code`.
3. Verifies row count parity (`SELECT COUNT(*) FROM reference_data_entries WHERE …` = `SELECT COUNT(*) FROM lookup_items WHERE lookup_type_code IN (the legacy 6)`).
4. Marks the migration complete.

A SEPARATE follow-up migration `010_DropReferenceDataLegacy` drops the legacy table after a soak period (1 week minimum in staging). This avoids the "no rollback" pain if the migration has a bug — the legacy table stays available for emergency reads.

### 8. EF Migrations

Two migrations on `LookupsDbContext` (in that order):

1. **`010_LookupCatalogue`** (this spec) — creates `lookup_item_types`, `lookup_items`, 4 mapping tables, all triggers + checks + indexes. Seeds `lookup_item_types` (31 rows) and `lookup_items` (~1,500 rows from `LOOKUPS_SEED`). Idempotent: each `CREATE` is wrapped in `IF NOT EXISTS`.

2. **`010b_DropReferenceDataLegacy`** (cleanup, separate migration applied after staging soak) — drops `reference_data_entries` table.

Spec 011's `011_ApplicationSettings` migration runs AFTER `010_LookupCatalogue` so its FKs to `lookup_items` are valid.

### 9. Tasks summary

See [tasks.md](./tasks.md). Sequencing:

```
Phase 1 (Setup)              → T001–T005     (extend Lookups module, new conflict codes)
Phase 2 (Foundational)       → T006–T020     (type registry, lookup_items table, mappings, triggers, migration)
Phase 3 (US1 — CRUD + invariants) → T021–T050  (17 type codes, use cases, controller, frontend flip)
Phase 4 (US2 — Mappings)     → T051–T060     (4 mapping endpoints, MappingMatrix wiring)
Phase 5 (US3 — Import/Export)→ T061–T075     (bulk endpoints, file parsers, transactional commits)
Phase 6 (Data migration)     → T076–T080     (reference_data_entries → lookup_items)
Phase 7 (Hardening)          → T081–T090     (perf, coverage, quickstart, NetArchTest, cleanup migration)
```

### 10. Test surface

| Suite | Coverage |
|---|---|
| Domain unit tests (xUnit) | Each LookupItem type-mapper validates `extras` shape; hierarchical types reject self-parent; mapping entities reject duplicate composite PK |
| Use-case tests (xUnit) | Each use case: happy path + permission deny + rowVersion conflict + each conflict code |
| Integration tests (Testcontainers SQL Server) | Full HTTP round-trips per endpoint; trigger fires for each of the 7 codes; bulk import atomicity; data-migration parity |
| Architecture tests (NetArchTest) | Lookups module respects FR-M02 (extends spec 011's existing test) |
| Frontend service tests (Vitest + MSW) | `lookupsService` parses each endpoint shape; throws `ConflictError` per code |
| Frontend component tests (Testing Library + jest-axe) | `LookupTree`, `LookupGrid`, `MappingMatrix`, `ImportDialog` — render smoke + interaction + axe |
| Playwright E2E | One happy-path: super_admin → `/admin/lookups` → edit 3 rows across 3 types + 1 mapping + 1 import → refresh → state matches |

Coverage gates (CI): ≥ 80% statements, ≥ 75% branches. **100% on the bulk-import transaction path + the data-migration script.**

## Module structure

```text
backend/src/Modules/Lookups/                          (extends spec 011's skeleton)
├── PACademy.Modules.Lookups.Domain/
│   ├── LookupItem.cs                                 (NEW — main aggregate)
│   ├── LookupItemType.cs                             (NEW — closed-extension parent)
│   ├── LookupItemExtras/                             (NEW — per-type-code POCOs serialized to JSON)
│   │   ├── RelationshipExtras.cs
│   │   ├── TestExtras.cs
│   │   ├── NationalityExtras.cs
│   │   ├── … (15 more)
│   │   └── IExtras.cs (marker interface)
│   ├── LookupMappings/                               (NEW)
│   │   ├── CategorySpecialization.cs
│   │   ├── CategoryCommittee.cs
│   │   ├── CategoryTest.cs
│   │   └── PeriodCategory.cs
│   └── (existing from spec 011): ApplicantCategoryConfig, etc.
├── PACademy.Modules.Lookups.Application/
│   ├── ILookupsDbContext.cs                          (EXTEND with new DbSet<>'s)
│   ├── Lookups/                                      (NEW)
│   │   ├── ListLookupItemsUseCase.cs
│   │   ├── GetLookupItemUseCase.cs
│   │   ├── CreateLookupItemUseCase.cs
│   │   ├── UpdateLookupItemUseCase.cs
│   │   ├── SoftDeleteLookupItemUseCase.cs
│   │   ├── RestoreLookupItemUseCase.cs
│   │   ├── ReorderLookupItemsUseCase.cs
│   │   ├── ListLookupTypesUseCase.cs
│   │   ├── LookupItemMapper.cs
│   │   └── ExtrasSerializer.cs                       (per-type-code JSON ↔ POCO)
│   ├── Mappings/                                     (NEW)
│   │   ├── ListMappingsUseCase.cs
│   │   ├── CreateMappingUseCase.cs
│   │   └── DeleteMappingUseCase.cs
│   ├── BulkOps/                                      (NEW)
│   │   ├── ImportLookupItemsUseCase.cs
│   │   ├── ExportLookupItemsUseCase.cs
│   │   ├── XlsxParser.cs / CsvParser.cs (or reuse OpenXML)
│   │   └── LookupSchemaRegistry.cs                   (per-type column mapping)
│   ├── ConflictMessages.cs                           (Arabic message registry — NFR-005)
│   └── Dtos/
│       ├── LookupItemDto.cs
│       ├── LookupItemTypeDto.cs
│       ├── LookupMappingDto.cs
│       ├── ImportResultDto.cs
│       └── DeleteResultDto.cs
├── PACademy.Modules.Lookups.Infrastructure/
│   ├── LookupsModule.cs                              (EXTEND DI registrations)
│   ├── LookupsApiService.cs                          (EXTEND with type-code FK checks)
│   └── Persistence/
│       ├── LookupsDbContext.cs                       (EXTEND with new DbSet<>'s)
│       ├── Migrations/
│       │   ├── 010_LookupCatalogue.cs
│       │   └── 010b_DropReferenceDataLegacy.cs       (follow-up)
│       └── Configurations/
│           ├── LookupItemConfiguration.cs
│           ├── LookupItemTypeConfiguration.cs
│           ├── CategorySpecializationConfiguration.cs
│           ├── CategoryCommitteeConfiguration.cs
│           ├── CategoryTestConfiguration.cs
│           └── PeriodCategoryConfiguration.cs
└── PACademy.Modules.Lookups.Public/
    └── ILookupsApi.cs                                (EXTEND — see plan.md spec 011 §2)

backend/src/PACademy.Api/
├── Controllers/Admin/AdminLookupsController.cs       (NEW)
├── Controllers/Admin/AdminLookupMappingsController.cs (NEW)
└── Middleware/SqlConflictCodeMiddleware.cs           (EXTEND — adds 51200, 51210, 51220 to map)
```

## Data model summary

See [data-model.md](./data-model.md) for full details. The key tables:

```text
lookup_item_types  (31 rows, seeded, closed-extension)
   ↓ FK lookup_type_code
lookup_items       (~1,500 rows, the workhorse)
   ↓ self-FK parent_id (hierarchies)
   ↓ extras JSON (per-type fields)
   ↓ optional facultyCode column (only for SPECIALIZATIONS type)

lookup_items.id ◄──────────── category_specializations.category_id / target_id
                              category_committees.category_id / target_id
                              category_tests.category_id / target_id
                              period_categories.category_id / target_id
```

## API contracts summary

See [contracts/lookups-api.md](./contracts/lookups-api.md). The endpoint set matches `lookupsService` on `origin/main` field-for-field plus the mapping endpoints + bulk import/export.

## Frontend integration

| File | V1 (mock) | After spec 010 |
|---|---|---|
| `lookups.service.ts` | reads `LOOKUPS_SEED` via `MOCK.lookups` | calls `apiClient` against `/admin/lookups/*` |
| `lookups.queries.ts` | TanStack Query hooks | **unchanged** |
| `LookupTree` / `LookupGrid` / `MappingMatrix` | rendered from mock data | **unchanged** |
| `ImportDialog` / `ExportMenu` per lookup | client-side parsing only | wires to `/import` + `/export` endpoints |
| `LookupRowDrawer` | edits in-memory rows | calls `PATCH /admin/lookups/{typeCode}/{code}` with rowVersion |
| 15 consumer pages (per `docs/migration/lookups/REPORT.md` §4) | read mock data via `useLookup()` | **unchanged** — hook reads through service which now hits real backend |

## Coordination with other specs

- **Spec 011 (Application Settings)**: Spec 011's FKs target `lookup_items.id`. Spec 010's `010_LookupCatalogue` migration MUST apply before spec 011's `011_ApplicationSettings` migration. Both specs land in the `Lookups` module on the same branch (or spec 010 ships first as a prerequisite).
- **Spec 009 (Admission-Setup Persistence)**: No direct dependency. Spec 009's Cycles, Categories, Committees data live in different modules; some of those may reference lookup type codes (e.g., committees have `kind ∈ CommitteeKind` which could be a lookup type post-spec-010). V1 keeps Committees' `kind` as a domain enum; future consolidation is out of scope.
- **Spec 008 (Lookup Excel + CSV Import)** — **superseded**. Spec 008's 21-table import wizard targeted the obsolete `lookup_items` shape that this spec restructures. Spec 010's import endpoints replace spec 008 entirely; the obsolete spec 008 backend code is removed in the spec-009 merge-followup commit (`cda047a`). Note this in `specs/008-lookup-excel-import/`'s tasks.md.
- **Spec 005 (Modular Monolith)** — Lookups is the 5th bounded-context module (after Audit, Identity, ReferenceData, Workflows, Admissions). Spec 010 retires `ReferenceData` once data migration completes.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| JSON `extras` schema drift between frontend and backend | Domain mappers (one per `lookup_type_code`) validate the shape before persist. Backend rejects with 422 `INVALID_EXTRAS_SHAPE` if a required field is missing. Integration tests assert the round-trip preserves every type's extras exactly. |
| Trigger performance on large bulk-imports | The `tr_LookupItem_NoCycles` trigger fires per-row on UPDATE. For inserts (most bulk-imports), the trigger doesn't fire (no `parent_id` change to validate). For 1,000-row imports with parent reassignments, the trigger fires 1,000 times — measure on perf test (NFR-002). If too slow, batch-disable the trigger during import and re-validate via a final recursive-CTE pass. |
| Data migration row-count mismatch | Migration includes a row-count assertion at the end. If parity fails, the migration ROLLS BACK and the legacy table is preserved. Operator inspects the diff manually before re-running. |
| `lookup_items.id` FK target rename if spec 010's `lookup_items` becomes split tables in the future | Unlikely (single-table strategy is intentional), but if it happened, every spec 011 FK + every mapping FK + every cross-module reference would migrate together. Worth noting; not a current concern. |
| 31 type codes is too few/too many | The 31 was determined by enumerating live frontend consumers on `origin/main`. New type codes are added via migration only (closed-extension). A new type requires: (1) row in `lookup_item_types`, (2) new domain `LookupItemExtras` POCO, (3) frontend `LookupKey` union extension, (4) UI registration in `LOOKUP_META` / `LOOKUP_SECTIONS`. The 4-step contract is non-trivial; encourages thoughtful additions. |
