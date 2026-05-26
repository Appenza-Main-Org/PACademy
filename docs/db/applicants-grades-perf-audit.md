# Applicants and Grades Database Performance Audit

Date: 2026-05-26

## Executive Summary

Live staging was inspected read-only on 2026-05-26. The active UAT configuration points EF to schema `PACademy_staging_db`, not the code default `admin_v2`. The database also already contains real normalized `dbo.applicants` and `dbo.applicant_grades` tables.

That means there are two important realities:

1. The running admin API still reads and writes applicants/grades through the configured schema's `admin_records` JSON modules.
2. Real normalized tables already exist in `dbo`, but they are not fully reconciled with active staging `admin_records`.

Current active staging JSON modules:

- `module = 'applicants'` for applicants.
- `module = 'grades'` for applicant grades.

The only relational key on active admin JSON records is the composite primary key on `(module, id)`, plus a redundant single-column index on `module`. This keeps single-row lookups by module/id acceptable, but most real workload filters are inside `payload_json`, so SQL Server cannot seek on common predicates such as national ID, status, governorate, certificate type, school category, graduation year, branch, changed-only, or soft-delete state.

The hottest risk is grades import and lookup. `CommitV2` builds duplicate-detection maps by scanning all existing `grades` rows twice before processing each 500-row upload chunk, and the applicant eligibility endpoint performs a `JSON_VALUE(payload_json, '$.nid') = @nid` lookup with no supporting computed column/index. Applicant list, distribution, and NID collision checks are also module-wide scans followed by in-memory JSON parsing.

Live row-count summary:

| Source | Total rows | Live rows | Distinct live NIDs | Notes |
|---|---:|---:|---:|---|
| `PACademy_staging_db.admin_records` / `grades` | 23,337 | 10,143 | 10,143 | 13,194 soft-deleted rows; no live duplicate NID/seating-number groups. |
| `dbo.applicant_grades` | 10,000 | 10,000 | 10,000 | Already normalized; differs from active staging live count by 143 rows. |
| `PACademy_staging_db.admin_records` / `applicants` | 4 | 4 | 4 | All have national IDs. |
| `dbo.applicants` | 4 | 4 | 4 | Already normalized. |

## Current Schema, Indexes, Constraints

Current schema source:

- [AdminDbContext.cs](../../backend/admin/PACademy.Admin.Api/Persistence/AdminDbContext.cs)
- [20260521200238_InitialAdminSchema.cs](../../backend/admin/PACademy.Admin.Api/Persistence/Migrations/20260521200238_InitialAdminSchema.cs)

Relevant active-schema `admin_records` shape:

| Column | Type | Notes |
|---|---:|---|
| `module` | `nvarchar(96)` | Logical collection name. |
| `id` | `nvarchar(128)` | Logical row ID. Grades uses seat as ID. |
| `payload_json` | `nvarchar(max)` | Stores all applicant/grade fields. |
| `created_at` | `datetimeoffset` | Stored outside payload. |
| `updated_at` | `datetimeoffset` | Stored outside payload. |
| `row_version` | `rowversion` | EF concurrency token. |

Active-schema indexes and constraints:

- Primary key: `PK_admin_records` on `(module, id)` from the EF migration and live metadata.
- Secondary index: `ix_admin_records_module` on `(module)` from the EF migration and live metadata.
- EF config repeats the same primary key and module index at [AdminDbContext.cs lines 232-242](../../backend/admin/PACademy.Admin.Api/Persistence/AdminDbContext.cs).
- No FK, unique, check, filtered, computed-column, or JSON-path indexes exist for applicants or grades.

Observation: `ix_admin_records_module` is probably redundant because the primary key begins with `module`. SQL Server can use the leading key of `(module, id)` for module-only seeks/scans. Dropping it is destructive and should only happen after plan verification.

Existing normalized `dbo` tables:

| Table | Current live shape summary | Current indexes found |
|---|---|---|
| `dbo.applicants` | `id`, `national_id`, `phone_number`, `full_name`, demographics, timestamps, rowversion | PK on `id`; unique `UX_applicants_national_id`. |
| `dbo.applicant_grades` | `id`, `seat`, `seating_number`, `nid`, name, kind/gender/branch/school/category/year/region/round, total/max/override/change metadata, status, timestamps, rowversion | PK on `id`; unique `IX_applicant_grades_nid`; unique `IX_applicant_grades_seat`; indexes on `graduation_year` and `school_category_code`. |
| `dbo.applicant_grade_adjustments` | Adjustment rows linked to `applicant_grade_id` | PK on `id`; index on `applicant_grade_id`. |
| `dbo.grade_import_batches` / `dbo.grade_import_rows` | Import tracking tables | Present with small row counts. |

## Hot Query Inventory

### Applicant Paths

| Path | Code | Pattern | Cost Risk |
|---|---|---|---|
| Admin applicants list | [ApplicantsController.cs lines 27-28](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs) calls `records.PageAsync("applicants")`; [AdminRecordsService.cs lines 21-33](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Loads every applicant row, optionally searches full JSON string in memory, then paginates in memory. | High for admin list and search. Filters from frontend (`status`, `governorate`, `certType`) are passed but not applied server-side. |
| Recent applicants dashboard | [DashboardPage.tsx lines 79-85](../../frontend/src/features/admin/pages/DashboardPage.tsx) | Same list path with `page=1&pageSize=8`. | Medium. Fetches all applicants to return 8. |
| Applicant detail | [ApplicantsController.cs lines 55-60](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs), [AdminRecordsService.cs lines 36-39](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Seek by `(module, id)`. | Low. Covered by primary key. |
| Applicant timeline | [ApplicantsController.cs lines 63-95](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs) | Applicant by PK, then scans all `workflowTransitions` and filters by `applicantId` in memory. | Medium. N+1-like detail path if opened repeatedly. Needs workflow transition index/query later. |
| NID collision | [ApplicantsController.cs lines 98-103](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs) | Loads all applicants, parses JSON, checks `nationalId`. | High for create/edit validation. |
| Distribution | [ApplicantsController.cs lines 52-53](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs), [AdminRecordsService.cs lines 428-435](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Loads all applicants, groups on JSON field in memory. | Medium/high for dashboards and reports. |
| Create/update/transition | [ApplicantsController.cs lines 106-130](../../backend/admin/PACademy.Admin.Api/Controllers/ApplicantsController.cs), [AdminRecordsService.cs lines 42-69](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Upsert by `(module, id)`, full JSON overwrite. | Low per row, but lacks DB uniqueness on applicant national ID. |

Frontend consumers confirm common filters/search:

- Applicant list sends `page`, `pageSize`, `search`, `status`, `governorate`, `certType` from [ApplicantsPage.tsx lines 54-61](../../frontend/src/features/admin/pages/ApplicantsPage.tsx).
- Applicant API contract lists distribution, NID collision, workflow progress, transitions, and audit at [applicant.service.ts lines 1-20](../../frontend/src/features/applicants/api/applicant.service.ts).

### Grades Paths

| Path | Code | Pattern | Cost Risk |
|---|---|---|---|
| Paginated grades list | [GradesController.cs lines 26-65](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs), SQL builder at [lines 576-704](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Raw SQL filters with `JSON_VALUE`, `TRY_CONVERT`, `OPENJSON`, `ORDER BY`, `OFFSET`. | High on large grade sets because predicates and sort keys are computed from JSON without indexed computed columns. |
| Non-paginated grades list/export | [GradesController.cs lines 34-38](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs), [lines 68-75](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Loads all grades, filters/sorts in memory. | High. Export is expected to scan, but list without pagination should be avoided. |
| By national ID | [GradesController.cs lines 77-85](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Loads all grades, filters `nid` in memory. | High. Frontend contract includes `cycleId`, but backend ignores it. |
| Applicant eligibility grade lookup | [ApplicantEligibilityService.cs lines 152-176](../../backend/admin/PACademy.Admin.Api/Modules/Admissions/Eligibility/ApplicantEligibilityService.cs) | SQL Server path uses `JSON_VALUE(payload_json, '$.nid') = @nid` and `deletedAt IS NULL`. | High frequency read; no supporting index. |
| Stage import duplicate check | [GradesController.cs lines 132-150](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Loads all grades and builds NID set. | High during uploads. |
| Legacy import commit | [GradesController.cs lines 153-206](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Loads all grades, builds dictionary, upserts one row at a time. | High write amplification. |
| V2 import commit | [GradesController.cs lines 260-389](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Calls `GradesImportIndexAsync`, then `ListAsync("grades")`, then processes 500-row frontend chunks. | Very high. Each chunk scans all grades at least twice. |
| Grades import index | [AdminRecordsService.cs lines 72-93](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Streams every grade JSON payload to compute max seat and live NIDs. | High. Should be a SQL aggregate/seek over computed columns. |
| Delete selected seats | [GradesController.cs lines 105-129](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Loads all grades to map seats to ids, then soft-deletes by id. | Medium/high. Seat equals id today, so the scan is avoidable. |
| Clear all grades | [AdminRecordsService.cs lines 342-388](../../backend/admin/PACademy.Admin.Api/Modules/AdminRecords/AdminRecordsService.cs) | Batches through module rows with `Skip(offset)` while mutating rows. | High and correctness risk: offset pagination while updating can skip rows as the live/deleted subset changes semantically. |
| Adjustments / override max | [GradesController.cs lines 442-504](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | PK lookup by seat/id, then JSON overwrite. | Low per row. |
| Summary/facets | [GradesController.cs lines 739-793](../../backend/admin/PACademy.Admin.Api/Controllers/GradesController.cs) | Aggregates over all live grades with JSON extraction; cached for 10 minutes. | Medium. Cache helps, but cold start and invalidations after writes scan. |

Frontend confirms the list/filter workload:

- Query parameters include search, sort, gender, branch, graduation year, school category, changed-only, national ID, seating number, name, total/effective/percentage ranges, school, and graduation-year ranges at [grades.service.ts lines 98-136](../../frontend/src/features/applicant-grades/api/grades.service.ts).
- Main grades page sends these filters to `useApplicantGradesList` at [ApplicantGradesPage.tsx lines 273-290](../../frontend/src/features/applicant-grades/pages/ApplicantGradesPage.tsx).
- Import commit is chunked by the frontend into 500-row requests at [grades.service.ts lines 261-299](../../frontend/src/features/applicant-grades/api/grades.service.ts), which magnifies the server-side all-grades scans.

## Workload Categorization

### Read-heavy

- Applicant admin list: frequent, interactive, needs pagination/search/status/governorate/certType.
- Applicant dashboard distributions: repeated dashboard/report reads by governorate, certificate type, status.
- Applicant detail: frequent but covered by `(module, id)`.
- Applicant eligibility by national ID: high frequency during applicant start/login/category eligibility.
- Grades list: interactive, filterable, sortable, paginated.
- Grades by national ID: eligibility/admin lookups.
- Grades changed-only audit view: filter on `gradeChangedAt` or non-empty `log`.

### Write-heavy

- Grades import v2: bulk insert plus duplicate matching by `nid` and `seatingNumber`; current frontend chunks create repeated server scans.
- Grades replacements during import: per-row `UpsertAsync`.
- Grade recalculations/adjustments/override max: row-by-row update by seat/id.
- Grades clear/delete: soft-delete updates against many rows.
- Applicant create/update/transition: row-by-row JSON writes.

### Cost Ranking

1. `POST /api/grades/v2/commit`: repeated full-grade scans per 500-row chunk plus inserts.
2. `GET /api/grades?page=...` with filters/sorts: JSON extraction, numeric conversion, optional `OPENJSON`, sort/offset.
3. `GET /api/applicants?page=...`: loads all applicants before pagination.
4. `GET /api/applicants/{nationalId}/eligible-categories`: grade lookup by JSON `nid`.
5. `GET /api/v1/applicants/check-nid`: full applicant scan for uniqueness validation.

## N+1, Full Scans, and Redundant Indexes

N+1-like or repeated scan patterns:

- V2 import is chunked client-side in 500 rows, and every chunk calls server logic that scans all existing grades through `GradesImportIndexAsync` and `ListAsync("grades")`.
- Applicant detail timeline scans all workflow transitions for one applicant. This is outside the two requested logical tables, but it affects applicant detail latency.
- Dashboard currently calls stats, distributions, audit, and recent applicants separately; the distributions and recent applicants each scan applicant JSON.

Missing indexes:

- Grade `nid`, `seatingNumber`, `seat`, `deletedAt`/live flag, `kind`, `branch`, `schoolCategoryCode`, `graduationYear`, `gradeChangedAt`.
- Applicant `nationalId`, `status`, `governorate`, `certType`, `department`, possibly `cycleId` once applicant payloads consistently carry it.
- Workflow transition `applicantId` if timeline remains in `admin_records`.

Potentially redundant:

- `ix_admin_records_module` duplicates the leading key of `PK_admin_records(module, id)`. Keep until execution plans prove it is unused; dropping is destructive and requires approval.

## Recommended Changes

### Option A: Short-term, least disruptive computed columns on active-schema `admin_records`

This keeps the JSON-module architecture but exposes hot JSON properties as persisted computed columns and indexes them. This is the smallest migration surface and the likely first implementation pass.

Recommended computed columns:

| Column | Expression intent | Applies to |
|---|---|---|
| `json_national_id` | `JSON_VALUE(payload_json, '$.nationalId')` for applicants, `$.nid` for grades | applicants/grades |
| `json_grade_nid` | `JSON_VALUE(payload_json, '$.nid')` | grades |
| `json_grade_seating_number` | `JSON_VALUE(payload_json, '$.seatingNumber')` | grades |
| `json_grade_seat` | `TRY_CONVERT(int, JSON_VALUE(payload_json, '$.seat'))` | grades |
| `json_deleted_at` | `JSON_VALUE(payload_json, '$.deletedAt')` | grades |
| `json_is_deleted` | `JSON_VALUE(payload_json, '$.isDeleted')` | grades |
| `json_grade_kind` | `JSON_VALUE(payload_json, '$.kind')` | grades |
| `json_grade_branch` | `JSON_VALUE(payload_json, '$.branch')` | grades |
| `json_school_category_code` | `COALESCE(NULLIF(JSON_VALUE(... '$.schoolCategoryCode'), ''), NULLIF(JSON_VALUE(... '$.schoolCategory'), ''), CASE kind...)` | grades |
| `json_graduation_year` | `TRY_CONVERT(int, JSON_VALUE(payload_json, '$.graduationYear'))` | grades |
| `json_grade_changed_at` | `JSON_VALUE(payload_json, '$.gradeChangedAt')` | grades |
| `json_applicant_status` | `JSON_VALUE(payload_json, '$.status')` | applicants |
| `json_applicant_governorate` | `JSON_VALUE(payload_json, '$.governorate')` | applicants |
| `json_applicant_cert_type` | `JSON_VALUE(payload_json, '$.certType')` | applicants |
| `json_applicant_department` | `JSON_VALUE(payload_json, '$.department')` | applicants |
| `json_applicant_cycle_id` | `JSON_VALUE(payload_json, '$.cycleId')` | applicants, if present |

Recommended non-destructive indexes:

1. `ix_admin_records_grades_live_nid`
   - Keys: `(module, json_grade_nid)`
   - Include: `id`, `updated_at`
   - Filter: `module = 'grades' AND json_deleted_at IS NULL`
   - Covers eligibility and by-NID lookup.

2. `ix_admin_records_grades_live_seating_number`
   - Keys: `(module, json_grade_seating_number)`
   - Include: `id`
   - Filter: `module = 'grades' AND json_deleted_at IS NULL`
   - Covers import duplicate matching by seating number.

3. `ix_admin_records_grades_live_filters`
   - Keys: `(module, json_school_category_code, json_graduation_year, json_grade_branch, json_grade_kind, id)`
   - Include: `updated_at`
   - Filter: `module = 'grades' AND json_deleted_at IS NULL`
   - Covers common list filters. `module` is technically constant under the filter, but keeping it in the key makes EF/raw SQL predicate matching straightforward.

4. `ix_admin_records_grades_changed`
   - Keys: `(module, json_grade_changed_at, id)`
   - Filter: `module = 'grades' AND json_deleted_at IS NULL AND json_grade_changed_at IS NOT NULL`
   - Covers changed-only audit view. Rows with non-empty `log` but null `gradeChangedAt` still need JSON inspection unless a `json_has_adjustments` computed flag is added.

5. `ix_admin_records_grades_seat`
   - Keys: `(module, json_grade_seat)`
   - Include: `id`
   - Covers selected-seat delete if code keeps mapping by payload seat.

6. `ux_admin_records_applicants_national_id`
   - Keys: `(module, json_national_id)`
   - Unique filtered: `module = 'applicants' AND json_national_id IS NOT NULL`
   - Enforces applicant NID uniqueness and accelerates collision checks. This must first verify existing data has no duplicates.

7. `ix_admin_records_applicants_list`
   - Keys: `(module, json_applicant_status, json_applicant_governorate, json_applicant_cert_type, id)`
   - Include: `updated_at`
   - Covers admin list filters and dashboard slices.

8. `ix_admin_records_applicants_department_cycle`
   - Keys: `(module, json_applicant_cycle_id, json_applicant_department, json_applicant_status, id)`
   - Create only if payloads consistently include `cycleId`.

Do not add indexes for broad `%term%` search on name/NID/seating number unless prefix search is acceptable. Current `LIKE '%term%'` cannot seek on a normal b-tree. If fuzzy/global search is required at scale, use SQL Server full-text search or change UI/API to prefix search for NID/seating number.

### Option B: Medium-term normalize onto the existing real tables

Use the existing `dbo.applicants`, `dbo.applicant_grades`, `dbo.applicant_grade_adjustments`, and import tables as the target, or consciously recreate equivalent tables under `PACademy_staging_db` if schema separation is required. Do not create another uncoordinated applicant/grade table set without first choosing the canonical schema.

This is the right long-term model if backend work is moving beyond demo mode, but it requires a reconciliation/backfill and API read/write changes.

Existing `dbo.applicant_grades` already covers most proposed core columns:

- `id` uniqueidentifier primary key.
- `seat int` unique.
- `nid nvarchar(28)` unique.
- `seating_number nvarchar(64)` nullable.
- `name nvarchar(400)` not null.
- `school_category_code nvarchar(32)` not null.
- `kind nvarchar(16)` not null.
- `branch nvarchar(96)` null.
- `graduation_year int` not null.
- `school nvarchar(256)` null.
- `region nvarchar(128)` null.
- `exam_round nvarchar(64)` null.
- `total decimal(7,2)` not null.
- `import_max decimal(7,2)` not null.
- `override_max decimal(7,2)` null.
- `effective_total` persisted computed if adjustments are normalized, otherwise maintained column.
- `grade_changed_at datetimeoffset` null.
- `deleted_at datetimeoffset` null.
- `status`, timestamps, and rowversion.

Missing for the ideal target:

- `cycle_id` is not present on `dbo.applicant_grades`.
- Soft-delete fields are not present; active staging currently represents deletes inside JSON.
- Adjustment totals are stored separately in `dbo.applicant_grade_adjustments`, but the current admin API stores grade logs inside grade JSON.

Indexes:

- Unique live `(cycle_id, national_id)` where `deleted_at IS NULL` when cycle ID is available.
- Unique live `(cycle_id, seating_number)` where `deleted_at IS NULL AND seating_number IS NOT NULL`.
- `(cycle_id, school_category_code, graduation_year, branch, kind, seat)`.
- `(national_id) INCLUDE (cycle_id, seat, total, import_max, override_max, deleted_at)`.
- `(grade_changed_at, seat) WHERE deleted_at IS NULL AND grade_changed_at IS NOT NULL`.

Existing `dbo.applicants` already covers applicant identity basics:

- `id uniqueidentifier` primary key.
- `national_id nvarchar(28)` unique.
- `phone_number`, `full_name`, `email`, `gender`, `religion`, date/place of birth, source, timestamps, rowversion.

Missing for the ideal target:

- `cycle_id`, admin workflow/status fields, department/category/certificate filters, and nested form sections need either additional columns or child tables.
- `cycle_id nvarchar(96)` not null once cycles are mandatory.
- `national_id char(14)` not null.
- `status nvarchar(48)` not null.
- `department_id nvarchar(96)` or `department_code` depending lookup model.
- `governorate_code/name`, `cert_type`, `registered_at`, `updated_at`.
- JSON columns only for nested form sections that are not filtered.

Indexes:

- Unique `(cycle_id, national_id)`.
- `(cycle_id, status, department_id, id)`.
- `(cycle_id, governorate, cert_type, id)`.
- `(registered_at DESC, id)` for recent applicants.

Risks: this is larger than an index pass because controllers/services must write/read normalized columns and keep compatibility JSON in sync during migration.

## Query-Level Rewrite Recommendations

These should be flagged for a later application pass unless approved now:

1. Replace applicant `PageAsync` with SQL-backed pagination/filtering. Current code ignores status/governorate/certType filters and paginates after loading all rows.
2. Replace applicant NID collision with a direct SQL query against computed `json_national_id` or normalized `applicants.national_id`.
3. Replace grades by-NID lookup with a direct SQL query using the grade NID computed column; also either honor or remove the frontend `cycleId` contract.
4. Change `CommitV2` so a single upload sends one server request or a server-side import session caches/loads existing grade keys once. The current 500-row frontend chunking causes repeated all-table scans.
5. In `CommitV2`, replace `GradesImportIndexAsync` plus `ListAsync("grades")` with one SQL projection returning only `id`, `nid`, `seatingNumber`, `seat`, `deletedAt`, and `total`.
6. Replace selected grade delete scan with direct ID delete/update when `seat == id`, or a computed seat index lookup if that assumption is not guaranteed.
7. Fix `SoftDeleteModuleAsync` to avoid `Skip(offset)` while mutating rows. Use keyset batching (`WHERE module = @module AND id > @lastId`) or a set-based `ExecuteUpdateAsync` when audit requirements allow.
8. Narrow `SELECT` columns for count/facet/list metadata. Current paginated rows need full payload, but count/facet queries should use computed columns and avoid repeated JSON parsing.

## Expected Impact

Short-term computed-column indexes should:

- Turn grade by-NID and eligibility lookup from module scan + JSON_VALUE per row into index seek.
- Reduce grade list filtering cost for school category, graduation year, branch, kind, and changed-only views.
- Reduce applicant NID collision from full scan to seek and optionally enforce uniqueness.
- Reduce applicant list/distribution once queries are rewritten to use computed columns.
- Reduce import duplicate detection once code projects indexed keys instead of parsing every payload.

The largest gains require both indexes and query rewrites. Indexes alone will not help paths that call `records.ListAsync(...)` and filter in memory.

## Risks and Approval Points

- Persisted computed columns over `nvarchar(max)` JSON need validation on SQL Server. `JSON_VALUE` returns `nvarchar(4000)`; persisted/indexed computed expressions must be deterministic and should be cast to bounded types (`nvarchar(32)`, `int`, `decimal`) where possible.
- Unique applicant NID index can fail if current data contains duplicates. Run a duplicate scan first.
- Filtered indexes using computed columns must match query predicates closely. Query rewrites should reference computed columns directly, not re-expand `JSON_VALUE(...)`, for reliable plan selection.
- More indexes will slow bulk grade inserts. Keep the short-term set focused and measure import throughput before adding broad sort indexes.
- Dropping `ix_admin_records_module` could improve writes slightly but is destructive and should wait for observed index usage stats.
- Normalized tables would be the cleaner long-term fix, but they require application changes and data migration. That is outside this gated pass unless explicitly approved.

## Top Verification Queries

Live staging metadata and consistency checks were collected, but before/after `EXPLAIN ANALYZE` equivalent output was not collected because SQL Server uses actual execution plans plus `SET STATISTICS IO, TIME ON`, not PostgreSQL-style `EXPLAIN ANALYZE`. Run the following on staging with actual execution plan enabled before and after any approved migration/query rewrite.

Use these as the top five before/after checks:

1. Grade eligibility lookup:

```sql
SELECT TOP (1) [module], [id], [payload_json], [created_at], [updated_at], [row_version]
FROM [PACademy_staging_db].[admin_records]
WHERE [module] = N'grades'
  AND JSON_VALUE([payload_json], '$.nid') = @nid
  AND JSON_VALUE([payload_json], '$.deletedAt') IS NULL
ORDER BY [id];
```

2. Grades paginated list with school category + year + branch:

```sql
SELECT [module], [id], [payload_json], [created_at], [updated_at], [row_version]
FROM [PACademy_staging_db].[admin_records]
WHERE [module] = N'grades'
  AND JSON_VALUE([payload_json], '$.deletedAt') IS NULL
  AND COALESCE(NULLIF(JSON_VALUE([payload_json], '$.schoolCategoryCode'), N''), NULLIF(JSON_VALUE([payload_json], '$.schoolCategory'), N'')) = @schoolCategoryCode
  AND TRY_CONVERT(float, JSON_VALUE([payload_json], '$.graduationYear')) = @year
  AND JSON_VALUE([payload_json], '$.branch') = @branch
ORDER BY TRY_CONVERT(float, [id]) ASC
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

3. Applicant list page with common filters:

```sql
SELECT [module], [id], [payload_json], [created_at], [updated_at], [row_version]
FROM [PACademy_staging_db].[admin_records]
WHERE [module] = N'applicants'
  AND JSON_VALUE([payload_json], '$.status') = @status
  AND JSON_VALUE([payload_json], '$.governorate') = @governorate
  AND JSON_VALUE([payload_json], '$.certType') = @certType
ORDER BY [id]
OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
```

4. Applicant NID collision:

```sql
SELECT TOP (1) 1
FROM [PACademy_staging_db].[admin_records]
WHERE [module] = N'applicants'
  AND JSON_VALUE([payload_json], '$.nationalId') = @nationalId
  AND [id] <> @excludeId;
```

5. Grades import duplicate key projection:

```sql
SELECT
  [id],
  JSON_VALUE([payload_json], '$.nid') AS [nid],
  JSON_VALUE([payload_json], '$.seatingNumber') AS [seatingNumber],
  TRY_CONVERT(int, JSON_VALUE([payload_json], '$.seat')) AS [seat],
  JSON_VALUE([payload_json], '$.deletedAt') AS [deletedAt],
  TRY_CONVERT(float, JSON_VALUE([payload_json], '$.total')) AS [total]
FROM [PACademy_staging_db].[admin_records]
WHERE [module] = N'grades';
```

## Proposed Next Step

Recommended approval target: generate a non-destructive migration for Option A only:

- Add bounded computed columns to `admin_records`.
- Add filtered non-unique indexes for grades/applicants hot reads.
- Add the unique applicant NID filtered index only after a duplicate precheck, or leave it commented in the migration notes if you want zero risk.

Do not drop `ix_admin_records_module` or change column types in the first migration.
