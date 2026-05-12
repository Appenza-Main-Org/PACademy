# Phase 1 — Data Model: Application Settings Persistence

**Branch**: `011-application-settings-persistence` | **Date**: 2026-05-12

This document specifies the persisted shape of every entity introduced by spec 011 — three main tables forming the category → specialization → year hierarchy, plus two side tables for the M-of-N gender and marital-status assignments. All tables are **global** (no `cycle_id` column) per FR-020.

Type style mirrors the existing modular-monolith domain layer: sealed C# classes with private setters, factory `Create` methods enforcing invariants, `RowVersion` as the EF-managed concurrency token.

---

## Module: Lookups (new — see plan.md §1)

DbContext: `LookupsDbContext`
History table: `__EFMigrationsHistory_Lookups`
Migration: `011_ApplicationSettings`

---

## Tier 1 — `applicant_category_configs`

Per applicant-category lookup row the admin chooses to surface in the admission funnel. One row per `(category_id)` — the lookup row is the natural unique key.

| Column         | Type             | Notes                                                            |
|----------------|------------------|------------------------------------------------------------------|
| `id`           | uniqueidentifier | PK                                                              |
| `category_id`  | nvarchar(32)     | FK → lookup `applicant-categories.code`; UNIQUE                 |
| `is_active`    | bit              | default `1`                                                     |
| `sort_order`   | int              | drives accordion order in the UI                                |
| `created_at`   | datetimeoffset   | not null                                                        |
| `updated_at`   | datetimeoffset   | not null                                                        |
| `row_version`  | rowversion       | optimistic-locking token                                        |

**Invariants** (FR-002):
- `category_id` must exist in the lookup catalogue. Enforced by FK + 422 at the use-case layer.
- `(category_id)` is UNIQUE — one config row per category.

**Deactivation guard** (FR-011): UPDATE trigger throws `CATEGORY_HAS_ACTIVE_YEARS` if `is_active` flips false while any descendant `applicant_specialization_years.is_active = 1 AND is_deleted = 0` exists.

**Indexes**: `UX_AppCatConfig_Category (category_id)`, `IX_AppCatConfig_SortOrder (sort_order, created_at)`.

No soft-delete — deactivation via `is_active=false` is the canonical "hide" mechanism.

---

## Tier 2 — `applicant_category_specializations`

Junction between a category config and a specialization lookup row.

| Column                | Type             | Notes                                                            |
|-----------------------|------------------|------------------------------------------------------------------|
| `id`                  | uniqueidentifier | PK                                                              |
| `config_id`           | uniqueidentifier | FK → `applicant_category_configs.id` ON DELETE CASCADE          |
| `specialization_id`   | nvarchar(32)     | FK → lookup `specializations.code`                              |
| `is_active`           | bit              | default `1`                                                     |
| `created_at`          | datetimeoffset   | not null                                                        |
| `row_version`         | rowversion       | optimistic-locking token                                        |

**Invariants**:
- `specialization_id` must exist in the lookup catalogue (FR-003). 422 on bad reference.
- `(config_id, specialization_id)` is UNIQUE — can't attach the same specialization twice to one category config.
- *Reserved* (FR-018): `(category_id, specialization_id)` must exist in `lookup_category_specialization_map` when that mapping ships (post spec 010). V1 does not enforce; `SPECIALIZATION_NOT_MAPPED` is reserved in the response union.

**Cascade behavior** (FR-015): hard-deleting a junction row cascades to all descendant `applicant_specialization_years` (with their gender + marital side rows) via FK CASCADE.

**Indexes**: `UX_AppCatSpec_ConfigSpec (config_id, specialization_id)`, `IX_AppCatSpec_Specialization (specialization_id)`.

---

## Tier 3 — `applicant_specialization_years`

Leaf row carrying the eligibility constraints per `(category_specialization, graduation_year, gender-set)`.

| Column                       | Type             | Notes                                                                |
|------------------------------|------------------|----------------------------------------------------------------------|
| `id`                         | uniqueidentifier | PK                                                                  |
| `category_specialization_id` | uniqueidentifier | FK → `applicant_category_specializations.id` ON DELETE CASCADE      |
| `graduation_year`            | int              | maximum acceptable graduation year                                  |
| `max_age`                    | int              | nullable; CHECK `max_age IS NULL OR max_age > 0`                    |
| `min_grade`                  | int              | nullable                                                            |
| `max_grade`                  | int              | nullable; CHECK `min_grade IS NULL OR max_grade IS NULL OR min_grade <= max_grade` |
| `application_start_date`     | date             | not null                                                            |
| `application_end_date`       | date             | not null; CHECK `application_end_date >= application_start_date`    |
| `age_calc_date`              | date             | not null — anchor used by eligibility to compute applicant age      |
| `is_active`                  | bit              | default `1` — distinct from `is_deleted` (active=usable, deleted=tombstone) |
| `is_deleted`                 | bit              | default `0`                                                         |
| `deleted_at`                 | datetimeoffset   | nullable                                                            |
| `deleted_by`                 | uniqueidentifier | nullable; FK → `system_users.id`                                    |
| `created_at`                 | datetimeoffset   | not null                                                            |
| `updated_at`                 | datetimeoffset   | not null                                                            |
| `row_version`                | rowversion       | optimistic-locking token                                            |

**Invariants** (FR-006, FR-007, FR-008, FR-009, FR-010):
- `DUPLICATE_YEAR`: two rows with the same `(category_specialization_id, graduation_year)` are permitted IFF their gender sets are disjoint. Enforced by INSTEAD-OF trigger joining the side table.
- `OVERLAPPING_PERIOD`: two rows under the same specialization with overlapping `[application_start_date, application_end_date]` are permitted IFF their gender sets are disjoint. Enforced by INSTEAD-OF trigger joining the side table.
- `INVALID_DATE_RANGE`: `application_end_date >= application_start_date`. CHECK constraint.
- `AGE_NOT_POSITIVE`: when `max_age` present, must be > 0. CHECK constraint.
- `GRADE_RANGE_INVALID`: when both `min_grade` and `max_grade` present, `min_grade <= max_grade`. CHECK constraint.
- `GENDER_REQUIRED`: at least one row in `applicant_specialization_year_genders` per year. Trigger.

**Soft-delete semantics**:
- `is_deleted=true` is the tombstone marker. Default reads filter `is_deleted = 0`.
- `is_active=false` is the "hide from eligibility but keep in history" marker (visible in admin views, filtered from eligibility-engine reads).
- The two flags are independent; `is_active` is typically used during in-flight editing, `is_deleted` is permanent.

**Indexes**:
- `IX_AppSpecYear_CategorySpec (category_specialization_id, is_deleted)`
- `IX_AppSpecYear_GraduationYear (category_specialization_id, graduation_year, is_deleted)` — supports duplicate-year join
- `IX_AppSpecYear_DateRange (category_specialization_id, application_start_date, application_end_date, is_deleted)` — supports overlap join
- `IX_AppSpecYear_Active (is_active, is_deleted)` — eligibility-engine read path

---

## Side table — `applicant_specialization_year_genders`

M-of-N for gender (≥ 1 row per year — FR-004).

| Column         | Type             | Notes                                                            |
|----------------|------------------|------------------------------------------------------------------|
| `year_id`      | uniqueidentifier | PK part 1; FK → `applicant_specialization_years.id` ON DELETE CASCADE |
| `gender_type`  | nvarchar(8)      | PK part 2; CHECK `gender_type IN ('male', 'female')`            |

**Invariants**:
- Composite PK `(year_id, gender_type)` — prevents duplicate gender rows per year.
- `gender_type` ∈ {`'male'`, `'female'`} (matches `Applicant.gender` union on the frontend).
- `GENDER_REQUIRED` (FR-004): at least one row per year. Enforced by AFTER-DELETE trigger on this side table that checks the count for the affected `year_id` and throws if it would drop to 0. Also checked at year-insert by joining inserted with this table.

**No `row_version`** — side rows are managed as atomic groups via DELETE+INSERT in bulk-save (FR-012). Optimistic locking is on the parent year row.

---

## Side table — `applicant_specialization_year_marital_statuses`

M-of-N for marital status (≥ 0 rows per year; empty set = "any marital status").

| Column         | Type             | Notes                                                            |
|----------------|------------------|------------------------------------------------------------------|
| `year_id`      | uniqueidentifier | PK part 1; FK → `applicant_specialization_years.id` ON DELETE CASCADE |
| `marital_code` | nvarchar(16)     | PK part 2; references the marital-status enum                   |

**Invariants**:
- Composite PK `(year_id, marital_code)` — prevents duplicate marital rows per year.
- `marital_code` references the marital-status enum (`MaritalStatus` union on frontend: `'أعزب' | 'متزوج' | 'مطلق' | 'أرمل'`). Backend stores the Arabic literal; alternative: introduce a `marital_statuses` lookup type as part of spec 010 and FK to it (deferred — see open questions §3).

**No `row_version`** — same rationale as the gender side table.

---

## Triggers (per DB_CONSTRAINTS.md §11, verbatim SQL)

### `tr_AppSpecYear_DuplicateYear` (INSTEAD OF INSERT, UPDATE on `applicant_specialization_years`)

```sql
CREATE OR ALTER TRIGGER dbo.tr_AppSpecYear_DuplicateYear
ON dbo.applicant_specialization_years
INSTEAD OF INSERT, UPDATE
AS BEGIN
  IF EXISTS (
    SELECT 1
    FROM dbo.applicant_specialization_years y
    JOIN dbo.applicant_specialization_year_genders yg ON yg.year_id = y.id
    JOIN inserted i ON i.category_specialization_id = y.category_specialization_id
                   AND i.graduation_year             = y.graduation_year
                   AND i.id                         <> y.id
    JOIN dbo.applicant_specialization_year_genders ig ON ig.year_id = i.id
                                                    AND ig.gender_type = yg.gender_type
    WHERE y.is_deleted = 0
  )
    THROW 51120, 'DUPLICATE_YEAR', 1;

  -- Pass-through INSERT/UPDATE
  INSERT INTO dbo.applicant_specialization_years (…) SELECT … FROM inserted;
END
```

> NOTE: INSTEAD-OF triggers in SQL Server replace the original DML. The pass-through INSERT/UPDATE must mirror the original column set. The actual migration will use the EF-generated column list.

### `tr_AppSpecYear_OverlappingPeriod` (INSTEAD OF INSERT, UPDATE on `applicant_specialization_years`)

```sql
IF EXISTS (
  SELECT 1
  FROM dbo.applicant_specialization_years y
  JOIN dbo.applicant_specialization_year_genders yg ON yg.year_id = y.id
  JOIN inserted i ON i.category_specialization_id = y.category_specialization_id
                 AND i.id                         <> y.id
  JOIN dbo.applicant_specialization_year_genders ig ON ig.year_id = i.id
                                                  AND ig.gender_type = yg.gender_type
  WHERE y.is_deleted = 0
    AND i.application_start_date <= y.application_end_date
    AND i.application_end_date   >= y.application_start_date
)
  THROW 51100, 'OVERLAPPING_PERIOD', 1;
```

### `tr_AppSpecYearGender_RequireOne` (AFTER DELETE on `applicant_specialization_year_genders`)

```sql
IF EXISTS (
  SELECT 1 FROM deleted d
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.applicant_specialization_year_genders g
    WHERE g.year_id = d.year_id
  )
  AND EXISTS (
    SELECT 1 FROM dbo.applicant_specialization_years y
    WHERE y.id = d.year_id AND y.is_deleted = 0
  )
)
  THROW 51125, 'GENDER_REQUIRED', 1;
```

### `tr_AppCatConfig_CategoryHasActiveYears` (AFTER UPDATE on `applicant_category_configs`)

```sql
IF UPDATE(is_active) AND EXISTS (
  SELECT 1
  FROM inserted i
  JOIN dbo.applicant_category_specializations s
    ON s.config_id = i.id
  JOIN dbo.applicant_specialization_years y
    ON y.category_specialization_id = s.id
  WHERE i.is_active = 0
    AND y.is_active = 1
    AND y.is_deleted = 0
)
  THROW 51110, 'CATEGORY_HAS_ACTIVE_YEARS', 1;
```

### CHECK constraints

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_DateOrder
  CHECK (application_end_date >= application_start_date);

ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_MaxAge
  CHECK (max_age IS NULL OR max_age > 0);

ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_GradeRange
  CHECK (min_grade IS NULL OR max_grade IS NULL OR min_grade <= max_grade);
```

The CHECK violations surface as SQL Server error 547 (`The INSERT statement conflicted with the CHECK constraint …`). The `SqlConflictCodeMiddleware` (plan.md §5) maps each constraint name to its conflict code per the table below:

| CHECK constraint            | Conflict code           |
|-----------------------------|-------------------------|
| `CK_AppSpecYear_DateOrder`  | `INVALID_DATE_RANGE`    |
| `CK_AppSpecYear_MaxAge`     | `AGE_NOT_POSITIVE`      |
| `CK_AppSpecYear_GradeRange` | `GRADE_RANGE_INVALID`   |

---

## Relationships diagram

```text
lookup_items (spec 010)
   │                       │
   │ code (category)       │ code (specialization)
   ▼                       ▼
applicant_category_configs  ◄────── PATCH /category-configs/{id}
   │
   ▼ FK config_id (CASCADE)
applicant_category_specializations  ◄────── POST /…/specializations
   │
   ▼ FK category_specialization_id (CASCADE)
applicant_specialization_years  ◄────── POST /…/years, bulk-save
   │
   ├─→ applicant_specialization_year_genders         [≥1]
   └─→ applicant_specialization_year_marital_statuses [≥0]
```

---

## Audit emissions

| Entity                              | Actions emitted                         |
|-------------------------------------|------------------------------------------|
| ApplicantCategoryConfig             | `update`                                 |
| ApplicantCategorySpecialization     | `create` `delete`                        |
| ApplicantSpecializationYear         | `create` `update` `soft_delete` `restore`|

No new `AuditAction` values needed — all 4 used values (`create`, `update`, `soft_delete`, `restore`) already exist in `shared/types/domain.ts`.

`module = 'lookups'` on every entry (the AuditModule taxonomy already has this key on main).

---

## Open questions

### 1. Marital-status side-table FK target

The side-table column `marital_code` currently stores the literal Arabic string (`'أعزب'`, `'متزوج'`, etc.). Two paths:

- **(a) V1: literal**. Backend accepts the Arabic literals as-is. Pro: zero coupling to lookup catalogue. Con: typos / translation drift not caught at FK time.
- **(b) Add `marital_statuses` lookup type as part of spec 010**. Backend FK's to `lookup_items.code` filtered on `lookup_type='MARITAL_STATUSES'`. Pro: typed FK. Con: requires spec 010 to ship first; introduces a 4-row lookup type that already exists as a TS union.

**Recommendation: (a) for V1**. The 4-row enum is stable; introducing a lookup type just for FK referential integrity is overkill. Revisit when spec 010 ships if there's a broader argument to consolidate.

### 2. Pluggable category source

Today the frontend reads `LOOKUPS_SEED['applicant-categories']` (lookup-module data). The legacy `MOCK.categories` 7-row enum is still alive elsewhere (applicant flow, eligibility engine, admission rules). Two parallel applicant-category sources isn't reconciled — see [docs/migration/application-settings/REPORT.md §3](../../docs/migration/application-settings/REPORT.md) which calls this out.

Spec 011 references the lookup-catalogue table. Reconciliation of the legacy `MOCK.categories` enum is **out of scope for spec 011**. Tracked separately.

### 3. Bulk-save concurrency under high contention

If two admins bulk-save simultaneously and their changes affect overlapping year rows, the second commit will get `ROW_VERSION_CONFLICT` on the year rows it tried to update. The bulk-save transaction rolls back atomically. Frontend's `RowVersionConflictDialog` surfaces the conflict.

For brand-new year rows (creates) in the same batch, there's no rowVersion conflict — but the `DUPLICATE_YEAR` / `OVERLAPPING_PERIOD` triggers catch any genuine overlap. Considered safe.

### 4. Eligibility-engine read path

The downstream consumer (cycle eligibility check, applicant portal stages) needs to read `applicant_category_configs` + descendants when evaluating "can this applicant apply?". That read isn't part of spec 011 — it's a future spec (likely tied to applicant-portal API). For spec 011, the data is *available* via the same DB tables; the engine will read directly via EF Core from its own DbContext.
