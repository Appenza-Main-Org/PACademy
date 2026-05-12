# Feature Specification: Lookup Management Module

**Feature Branch**: `010-lookup-management-module` (to be created off `009-admission-setup-persistence` after merge)
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "Persist the 17 typed admin-managed reference lists (`relationships`, `faculties`, `specializations`, `tests`, `governorates`, `jobs`, …) and the 4 cross-lookup mapping tables that the frontend ships on `origin/main` as `lookupsService` mock. Replaces the legacy `reference_data_entries` system. Owns the lookup catalogue that spec 011 (Application Settings) and the future eligibility engine FK against."

## Clarifications

### Session 2026-05-12

- Q: One table or 17 tables for the lookup data? → A: **One `lookup_items` table with a `lookup_type_code` discriminator column.** Rationale: the 17 row shapes share ~80% of their columns (code, nameAr, nameEn, isActive, sortOrder, parentCode, dates, soft-delete metadata). The remaining 20% (type-specific extras like `branch`/`gender`/`degree` for relationships, `iso2`/`isArab` for nationalities) goes into a JSON `extras` column. Per `docs/DB_CONSTRAINTS.md §10` preamble, which already specifies this shape.
- Q: How many type codes does the backend accept? → A: **31 type codes**, of which 17 power the rich admin UI on `origin/main`. The other 14 (e.g., `EDUCATION_TYPES`, `MARITAL_STATUSES`, `EXAM_GROUPS`, `REJECTION_REASONS`) are simple code+label lookups consumed by non-admin pickers (applicant flow, category builder, audience selector). The data model treats them identically; only the admin UI registers 17.
- Q: Does the lookup catalogue replace the legacy `reference_data_entries` table? → A: **Yes, fully.** Spec 005's `ReferenceDataDbContext` and its `reference_data_entries` table are deprecated. Spec 010 migrates the data into `lookup_items`, then drops the legacy table in a separate cleanup migration (`010_DropReferenceDataLegacy`).
- Q: How do hierarchical lookups (relationships, jobs) prevent cycles? → A: **AFTER UPDATE trigger** doing a recursive-CTE ancestor walk. A row is rejected if it appears in its own ancestor chain. Same pattern as the existing `tr_LookupItem_NoCycles` SQL in `docs/DB_CONSTRAINTS.md §10.3`.
- Q: Soft-delete semantics? → A: **Tombstone via `deleted_at IS NOT NULL`**. Default reads filter out tombstones. The unique-code constraint is a *filtered* unique index `WHERE deleted_at IS NULL` so the same code can be re-used after deletion. Mappings to a soft-deleted lookup row are blocked via `IN_USE` conflict (FR-013).
- Q: Mapping tables — separate or part of `lookup_items`? → A: **Separate tables.** Four junction tables (`category_specializations`, `category_committees`, `category_tests`, `period_categories`) with composite PK `(category_id, target_id)`. Type-specific because each has different FK targets and audit semantics.
- Q: Bulk Excel/CSV import — in spec 010 scope? → A: **Yes (P2).** The frontend on `origin/main` ships `ImportDialog` + `ExportMenu` shared primitives ready for any lookup. Spec 010's import endpoint accepts the same Excel/CSV layout the spec 008 (now-obsolete) import wizard targeted, but re-aligned to the new lookup catalogue shape.
- Q: Specialization-faculty mapping — junction or FK? → A: **Direct FK** on `specializations.facultyCode`. The frontend on `origin/main` collapsed the prior `specialization-faculty-map` junction into a direct FK (`refactor(admin/lookups): collapse specialization-faculty-map junction into direct facultyCode FK`). The backend mirrors that — specializations carry a nullable `facultyCode` column, not a junction row.

## User Scenarios & Testing *(mandatory)*

The Lookup Management Module is the operator's single source of truth for **what** reference data the admission system uses — every dropdown, every picker, every FK target across the platform reads from it. Today the frontend ships a complete editor (the `/admin/lookups` hub on `origin/main`, plus 4 mapping screens, plus deep integration into every form picker) backed by an in-memory mock (`MOCK.lookups`, ~600 lines of seed data). Nothing survives a process restart. Spec 010 makes the catalogue durable.

### User Story 1 — Typed CRUD with 7 invariants enforced (Priority: P1) 🎯 MVP

A super-admin opens `/admin/lookups`, picks a lookup section from the left rail (e.g., "الجنسيات والدول"), edits a row's `nameAr`, adds a new row with a fresh `code`, soft-deletes another row, and clicks save. They refresh and see the changes intact. They attempt a few operations that violate invariants (duplicate code, self-parent, circular hierarchy, parent-with-children deletion, in-use deletion, invalid date range, duplicate mapping) and see typed Arabic error toasts.

**Why this priority**: 31 type codes × hundreds of rows = ~1,000+ reference entries that drive *every* picker in the platform. Until the catalogue persists, no admin form can be filled out reliably — the second a row is added, a refresh erases it. The 7 invariants are non-negotiable for data integrity; bypassing any one creates silent data corruption (orphan FKs, infinite trees, ghost references).

**Independent Test**: Configure a hierarchical lookup (relationships, 4 degrees), a flat lookup (faculties), and a lookup with a FK to another lookup (specializations.facultyCode). Submit deliberately-violating payloads for each of the 7 invariants. Each produces the right typed error. Re-fetch — state is unchanged on conflict, durably persisted on success.

**Acceptance Scenarios**:

1. **Given** an admin adds a new row to `governorates` with code `GOV-29`, **When** they refresh, **Then** the row appears in the table with the saved fields.
2. **Given** an admin attempts to add a second row with code `GOV-29` to `governorates`, **When** the save lands, **Then** the server returns `409 DUPLICATE_CODE` and the original row is unchanged.
3. **Given** an admin attempts to set a `relationships` row's `parentCode` to its own `code`, **When** the save lands, **Then** the server returns `422 SELF_PARENT`.
4. **Given** an admin attempts to set a `relationships` row's `parentCode` such that it would create a cycle (A→B→C→A), **When** the save lands, **Then** the server returns `409 CIRCULAR_HIERARCHY`.
5. **Given** an admin attempts to soft-delete a parent `jobs` row that has live child rows, **When** the delete lands, **Then** the server returns `409 PARENT_HAS_CHILDREN`.
6. **Given** an admin attempts to soft-delete a `specializations` row that's referenced from `category_specializations`, **When** the delete lands, **Then** the server returns `409 IN_USE` with `referenceCount` populated.
7. **Given** an admin submits an `announcements` row with `publishAt > expireAt`, **When** the save lands, **Then** the server returns `422 INVALID_DATE_RANGE`.
8. **Given** the admin reorders rows via drag-and-drop (the `LookupTree` UI's `@dnd-kit` reorder), **When** the order changes commit, **Then** the new `sortOrder` values persist and the next list-fetch returns rows in the new order.

### User Story 2 — Cross-lookup mapping management (Priority: P1)

An admin manages the 4 cross-lookup junction tables via the `MappingMatrix` UI on `origin/main`. They open `/admin/lookups/mappings/category-specializations`, tick a checkbox in the matrix to attach a `specialization` to a `category`, untick another to remove an attachment, save, and refresh. State persists.

**Why this priority**: The 4 mapping tables drive critical features: which specializations are allowed per applicant category, which committees serve each category, which tests are required per category, and which categories are valid per cycle period. Without them, the admin can configure individual lookups but cannot wire them together — making the whole catalogue partially unusable.

**Independent Test**: Use the matrix UI to attach 5 specializations to 3 categories. Refresh. All 5 attachments persist. Attempt to attach a pair that already exists — server returns `409 DUPLICATE_MAPPING`. Attempt to attach a specialization whose lookup row is soft-deleted — server returns `422 UNKNOWN_TARGET`.

**Acceptance Scenarios**:

1. **Given** an admin attaches specialization `SPC-03` to category `CAT-02`, **When** they refresh, **Then** the matrix cell `(CAT-02, SPC-03)` is checked.
2. **Given** an admin attempts to attach `(CAT-02, SPC-03)` again, **When** the save lands, **Then** the server returns `409 DUPLICATE_MAPPING`.
3. **Given** an admin detaches `(CAT-02, SPC-03)`, **When** they refresh, **Then** the cell is unchecked AND spec 011's `applicant_category_specializations` referencing the same `(CAT-02, SPC-03)` pair is now stale (handled by spec 011's `SPECIALIZATION_NOT_MAPPED` warning post-spec-010 wiring).
4. **Given** an admin attempts to attach a soft-deleted specialization to a category, **When** the save lands, **Then** the server returns `422 UNKNOWN_TARGET`.

### User Story 3 — Excel/CSV import + export for any lookup (Priority: P2)

An admin clicks the "استيراد" button on a lookup table, drops an Excel or CSV file matching the lookup's schema, sees a preview with per-row validation status, confirms, and the import commits atomically. Conversely they click "تصدير" and download the current lookup as Excel/CSV.

**Why this priority**: The Egyptian Police Academy operator imports lookup data in bulk from Excel files maintained by other ministry departments (nationalities from a central registry, police-stations from interior ministry, etc.). Hand-editing 200+ rows in the UI is impractical. The frontend's `ImportDialog` + `ExportMenu` primitives are already shipped; spec 010's backend wires the bulk endpoints behind them.

**Independent Test**: Export `governorates` as XLSX. Edit 3 rows in Excel. Import the file. Preview shows 3 updates and 25 unchanged. Confirm — server commits the 3 updates atomically; any single-row validation failure rolls back the entire batch and returns a per-row error map.

**Acceptance Scenarios**:

1. **Given** an admin exports `nationalities-countries` as XLSX, **When** the file downloads, **Then** it contains every active row with columns matching the lookup's schema (code, nameAr, nameEn, iso2, isArab, isActive, sortOrder).
2. **Given** an admin imports an XLSX with 100 rows where row 47 has a duplicate code, **When** the preview renders, **Then** row 47 is flagged red and the "Confirm" button is disabled until the admin fixes or removes the conflict.
3. **Given** an admin confirms a clean 50-row import, **When** the import lands, **Then** the server commits atomically (all 50 in one transaction), emits 50 audit entries with the same transaction timestamp, and returns `{ inserted: 30, updated: 20, errors: [] }`.
4. **Given** an admin imports an XLSX that mid-stream violates `CIRCULAR_HIERARCHY` on row 30 of 50, **When** the import lands, **Then** the server rolls back all 50 rows, returns 422 with `fieldErrors[30] = 'CIRCULAR_HIERARCHY'`, and no row is persisted.

### Edge Cases

- **Soft-deleted then re-created code.** Filtered unique index `WHERE deleted_at IS NULL` permits re-use of a code after its prior row is tombstoned. Admin sees the re-created row as fresh; the tombstone survives in `?includeDeleted=true` queries.
- **Concurrent edits to the same row.** Optimistic locking via `rowVersion` — same pattern as specs 009 and 011. Stale rowVersion returns 409 `ROW_VERSION_CONFLICT`.
- **Cycle-detection performance on deep trees.** The recursive-CTE in the trigger walks ancestors. Worst case: a 4-level relationship tree (4 hops). Performance is bounded by tree depth, which is admin-controlled (typically ≤ 6 levels). Acceptable.
- **Mapping table cascades.** Mappings do NOT auto-cascade when the target lookup row is soft-deleted (FR-013: `IN_USE` blocks the delete entirely). The admin must manually remove mappings first. This is intentional — silent cascade would create orphan FKs downstream.
- **Specialization `facultyCode` orphan.** If a faculty is hard-deleted (rare; usually soft-delete), specializations with that `facultyCode` become orphans. FK constraint prevents — faculty hard-delete is blocked unless no specialization references it.
- **`lookup_type_code` registration.** New type codes are NOT created via API — they're declared in the `lookup_item_types` parent table seeded at migration time. Adding a new type code requires a code change (new type + frontend UI + migration). The catalogue is closed-extension by design.
- **JSON `extras` schema drift.** The `extras` column has no enforced schema in V1. The frontend's TypeScript discriminated union (`LookupRowMap`) is the *de facto* schema; backend validates basic structure (`extras` is a JSON object, not an array) and trusts the frontend to write well-formed shapes. Spec 010's domain-layer mappers verify the shape per type code before persist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist a single `lookup_items` table containing all 17 typed-UI lookup rows + the 14 simple lookups (31 total `lookup_type_code` values), survival across process restarts and admin sessions.
- **FR-002**: System MUST enforce unique `(lookup_type_code, code)` on non-deleted rows via filtered unique index (`UX_LookupItem_TypeCode_Code WHERE deleted_at IS NULL`). Violation returns `409 DUPLICATE_CODE`.
- **FR-003**: System MUST reject `parent_id = id` via CHECK constraint `CK_LookupItem_NotSelfParent`. Violation returns `422 SELF_PARENT`.
- **FR-004**: System MUST detect cycles in `parent_id` chains via AFTER UPDATE trigger `tr_LookupItem_NoCycles` using a recursive CTE. Violation returns `409 CIRCULAR_HIERARCHY`.
- **FR-005**: System MUST block soft-deletion of a `lookup_items` row that has live children (rows referencing it via `parent_id`). Returns `409 PARENT_HAS_CHILDREN`.
- **FR-006**: System MUST block soft-deletion of a `lookup_items` row that appears in any of the 4 mapping tables. Returns `409 IN_USE` with `referenceCount` populated from a union-count across the 4 mappings.
- **FR-007**: System MUST enforce `start_date <= end_date` (when both present) via CHECK constraint. Returns `422 INVALID_DATE_RANGE`.
- **FR-008**: System MUST enforce composite PK `(category_id, target_id)` on each of the 4 mapping tables. Duplicate insert returns `409 DUPLICATE_MAPPING`.
- **FR-009**: System MUST validate that both `category_id` and `target_id` in any mapping row reference live (non-deleted) `lookup_items` rows. Returns `422 UNKNOWN_TARGET` if either ref is stale.
- **FR-010**: System MUST expose `GET /admin/lookups/{typeCode}` returning all live rows of the type, with optional `?includeDeleted=true` query param (super-admin only).
- **FR-011**: System MUST expose `POST /admin/lookups/{typeCode}` accepting `Omit<LookupRow<K>, 'code'> & { code?: string }`. If `code` is omitted, the server generates it from the type's `codePrefix` + next sequential integer padded to the type's `padding` width (e.g., `GOV-29`).
- **FR-012**: System MUST expose `PATCH /admin/lookups/{typeCode}/{code}` accepting partial row updates + rowVersion. Returns `409 ROW_VERSION_CONFLICT` on stale version.
- **FR-013**: System MUST expose `DELETE /admin/lookups/{typeCode}/{code}` performing soft-delete (set `deleted_at`, `deleted_by`, `delete_reason`). Returns either `{ deleted: true }` (200) or `{ deleted: false, reason, referenceCount }` (409) with one of `PARENT_HAS_CHILDREN` / `IN_USE`.
- **FR-014**: System MUST expose `POST /admin/lookups/{typeCode}/reorder` accepting `{ orderedCodes: string[] }` and reassigning `sortOrder` to 10, 20, 30, ….
- **FR-015**: System MUST expose mapping endpoints `GET /admin/lookup-mappings/{mappingKey}`, `POST /admin/lookup-mappings/{mappingKey}` (body: `{ categoryId, targetId }`), and `DELETE /admin/lookup-mappings/{mappingKey}/{categoryId}/{targetId}` for each of the 4 mappings.
- **FR-016**: System MUST expose `POST /admin/lookups/{typeCode}/import` accepting a multipart upload (XLSX or CSV), parsing rows into the type's schema, and committing atomically. Per-row validation runs before COMMIT; any failure rolls back the entire batch. Response: `{ inserted: int, updated: int, errors: { row: int, code: ConflictCode, field?: string }[] }`.
- **FR-017**: System MUST expose `GET /admin/lookups/{typeCode}/export?format=xlsx|csv` streaming the current live rows with columns matching the type's schema.
- **FR-018**: System MUST emit one audit entry per mutating call (`create`, `update`, `soft_delete`, `restore`), keyed `module='lookups'`, `entityType=<TypeName>Row` (e.g., `GovernorateRow`), `entityId=<code>`. Bulk imports emit one audit entry per row + one summary entry per import.
- **FR-019**: System MUST require `lookups:read` permission for GETs and `lookups:write` for mutations. New policies added to spec 007's RolePermissions: `super_admin` gets `*` (covers both); `committee_admin` gets `lookups:read` only.
- **FR-020**: System MUST seed the `lookup_items` table at migration time with the canonical seed dataset from `frontend/src/features/lookups/mock/lookups.mock.ts` (`LOOKUPS_SEED`). Seed is idempotent — re-applying the migration does not duplicate rows.
- **FR-021**: System MUST seed `lookup_item_types` at migration time with all 31 type codes (17 admin-UI types + 14 picker-only types). New type codes require a new migration (closed-extension policy).
- **FR-022**: System MUST migrate existing `reference_data_entries` data into `lookup_items` via the same migration. Drop the legacy table after data migration is verified.
- **FR-023**: System MUST persist `extras` per row as a JSON column (`nvarchar(max)` serialized JSON). Domain mappers serialize/deserialize per type code; no DB-level schema enforcement on `extras` shape.
- **FR-024**: System MUST persist hierarchical structure via `parent_id` self-FK. UI-level `parentCode` strings are resolved to `parent_id` UUIDs at the application layer.
- **FR-025**: System MUST carry `row_version` on every `lookup_items` row + every mapping row.

### Non-Functional Requirements

- **NFR-001**: `GET /admin/lookups/{typeCode}` MUST return within 100 ms p95 for any lookup with ≤ 500 rows (typical max — governorates ≈ 27, police-stations ≈ 200).
- **NFR-002**: Bulk import of 1,000 rows MUST complete within 5 s p95 on the dev DB.
- **NFR-003**: The cycle-detection trigger MUST complete within 10 ms for trees up to 6 levels deep × 50 rows per level.
- **NFR-004**: The `IN_USE` reference-count query MUST be a single union-count over 4 mapping tables; total response time ≤ 50 ms p95.
- **NFR-005**: All Arabic conflict messages MUST come from a single Arabic-message registry in `Lookups.Application/ConflictMessages.cs` — no string concatenation in middleware or use cases.
- **NFR-006**: Lint + typecheck + xUnit + Vitest MUST pass on every commit. Zero `--no-verify` commits on the 010 branch.

### Key Entities

- **`LookupItemType`** (closed-extension parent table): one row per `lookup_type_code` ∈ 31 known codes. Fields: `code, label_ar, code_prefix, padding, is_hierarchical, has_dates, has_extras`. Seeded at migration; never written via API.
- **`LookupItem`** (the workhorse): single table holding all rows across all type codes. Fields: `id, lookup_type_code (FK→types), code, name_ar, name_en, is_active, sort_order, parent_id (self-FK), start_date, end_date, extras (JSON), deleted_at, deleted_by, delete_reason, created_at, created_by, updated_at, updated_by, row_version`. Triggers enforce `SELF_PARENT`, `CIRCULAR_HIERARCHY`, `PARENT_HAS_CHILDREN`, `IN_USE`. Filtered unique index enforces `DUPLICATE_CODE`. CHECK constraints enforce `INVALID_DATE_RANGE`.
- **`SpecializationFaculty`** (NOT a junction — direct FK): special case where `specializations.extras.facultyCode` references `faculties.code`. Persisted as a nullable column `faculty_code nvarchar(32)` on `lookup_items` rows of type `SPECIALIZATIONS`. FK constraint to a partial index on `lookup_items (code) WHERE lookup_type_code='FACULTIES' AND deleted_at IS NULL`.
- **`CategorySpecializations`** (mapping 1 of 4): `(category_id uniqueidentifier, target_id uniqueidentifier)` composite PK; both columns FK `lookup_items.id`.
- **`CategoryCommittees`** (mapping 2 of 4): same shape, FK targets to `category` and `committee` type codes.
- **`CategoryTests`** (mapping 3 of 4): same shape, FK targets to `category` and `test` type codes.
- **`PeriodCategories`** (mapping 4 of 4): same shape, FK targets to `cycle-period` and `category` type codes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 7 conflict-code integration tests pass (one per code: DUPLICATE_CODE, SELF_PARENT, CIRCULAR_HIERARCHY, PARENT_HAS_CHILDREN, IN_USE, INVALID_DATE_RANGE, DUPLICATE_MAPPING).
- **SC-002**: The Playwright E2E (super_admin → `/admin/lookups` → edit 3 lookup rows across 3 types → save → refresh → state matches) completes in < 30 s on CI.
- **SC-003**: All `useLookup()` consumer pages (15 sites enumerated in `docs/migration/lookups/REPORT.md` §4) render correctly against the real backend with zero TS/lint errors.
- **SC-004**: The `010_DropReferenceDataLegacy` cleanup migration succeeds on a fresh dev DB seeded from the old data, with row count parity (`SELECT COUNT(*) FROM reference_data_entries` BEFORE = `SELECT COUNT(*) FROM lookup_items WHERE lookup_type_code IN (the legacy 6 types)` AFTER).
- **SC-005**: Bulk-import perf (NFR-002): 1,000 rows in < 5 s p95.
- **SC-006**: Zero `--no-verify` commits on the 010 branch.
