# Phase 1 — Data Model: Lookup Management Module

**Branch**: `010-lookup-management-module` | **Date**: 2026-05-12

This document specifies every persisted entity introduced by spec 010 — the closed-extension type registry, the single `lookup_items` workhorse table, four cross-lookup mapping tables, and all triggers + constraints + indexes that enforce the 7 invariants per `docs/DB_CONSTRAINTS.md §10`.

Type style mirrors the existing modular-monolith domain layer: sealed C# classes with private setters, factory `Create` methods, `RowVersion` as the EF-managed concurrency token. JSON extras are deserialized into per-type-code POCOs (one per `LookupKey`) via mappers in `Lookups.Application/Lookups/ExtrasSerializer.cs`.

---

## Module: Lookups (extends spec 011's existing module)

DbContext: `LookupsDbContext` (same context spec 011 introduced)
History table: `__EFMigrationsHistory_Lookups`
Migration: `010_LookupCatalogue` (this spec; ships BEFORE `011_ApplicationSettings`)
Follow-up: `010b_DropReferenceDataLegacy` (after staging soak)

---

## Type registry — `lookup_item_types`

Closed-extension parent table — defines the universe of valid `lookup_type_code` values. Seeded at migration time; never written via API (FR-021).

| Column           | Type             | Notes                                                            |
|------------------|------------------|------------------------------------------------------------------|
| `code`           | nvarchar(32)     | PK; e.g., `RELATIONSHIPS`, `FACULTIES`                          |
| `label_ar`       | nvarchar(100)    | Arabic display label (`'صلات القرابة'`)                          |
| `code_prefix`    | nvarchar(8)      | Code-generation prefix (`'REL'`, `'FAC'`)                       |
| `padding`        | tinyint          | Code-generation padding (3 → `REL-001`)                         |
| `is_hierarchical`| bit              | true → `parent_id` is meaningful                                |
| `has_dates`      | bit              | true → `start_date` / `end_date` are meaningful                 |
| `has_extras`     | bit              | true → `extras` JSON is non-empty                               |
| `section_key`    | nvarchar(32)     | UI grouping (`'kinship'`, `'process'`, `'geography'`)           |
| `sort_in_section`| smallint         | order within section                                            |
| `is_admin_ui`    | bit              | true → has rich admin UI; false → picker-only (14 of 31)        |

**Seed**: 31 rows at migration time. The 17 admin-UI types correspond to `LOOKUP_KEYS` in `frontend/src/features/lookups/types.ts`. The 14 picker-only types are: `EDUCATION_TYPES`, `MARITAL_STATUSES`, `SPECIALTIES`, `SPECIALTY_TYPES`, `DEGREE_TYPES`, `EXAM_TYPES`, `EXAM_GROUPS`, `COMMITTEE_TYPES`, `REJECTION_REASONS`, `NOTIFICATION_DEPARTMENTS`, `APPLICANT_SECTIONS`, `NATIONAL_ID_MISSING_REASONS`, `NATIONALITIES` (legacy alias), `CASE_TYPES`.

**Invariants**:
- `code` is UNIQUE and immutable post-seed.
- `code_prefix` is UNIQUE — prevents collision in code-generation.
- No FK from this table to anywhere; consumed read-only at runtime.

**No `row_version`** — table is effectively immutable; changes ship via migration only.

---

## Workhorse — `lookup_items`

Single table holding every lookup row across all 31 type codes. Discriminator column: `lookup_type_code`.

| Column            | Type             | Notes                                                                              |
|-------------------|------------------|------------------------------------------------------------------------------------|
| `id`              | uniqueidentifier | PK                                                                                |
| `lookup_type_code`| nvarchar(32)     | FK → `lookup_item_types.code`; NOT NULL                                           |
| `code`            | nvarchar(32)     | natural identifier within the type (e.g., `GOV-29`, `REL-007`); NOT NULL          |
| `name_ar`         | nvarchar(200)    | Arabic display name; NOT NULL; collated `Arabic_100_CI_AS_SC_UTF8`                |
| `name_en`         | nvarchar(200)    | nullable English name                                                             |
| `is_active`       | bit              | default `1`                                                                       |
| `sort_order`      | int              | default `0`; ascending; ties broken by `created_at`                                |
| `parent_id`       | uniqueidentifier | nullable; self-FK to `lookup_items.id` (only meaningful when `is_hierarchical`)   |
| `start_date`      | date             | nullable (only meaningful when `has_dates`)                                       |
| `end_date`        | date             | nullable                                                                          |
| `extras`          | nvarchar(max)    | JSON; per-type-code shape (see `ExtrasSerializer.cs`); empty object `{}` if none  |
| `faculty_code`    | nvarchar(32)     | nullable; SPC-only; FK to live FACULTIES row (FR-024)                             |
| `deleted_at`      | datetimeoffset   | nullable; tombstone marker                                                        |
| `deleted_by`      | uniqueidentifier | nullable; FK → `system_users.id`                                                  |
| `delete_reason`   | nvarchar(500)    | nullable                                                                          |
| `created_at`      | datetimeoffset   | NOT NULL                                                                          |
| `created_by`      | uniqueidentifier | NOT NULL; FK → `system_users.id`                                                  |
| `updated_at`      | datetimeoffset   | NOT NULL                                                                          |
| `updated_by`      | uniqueidentifier | NOT NULL                                                                          |
| `row_version`     | rowversion       | optimistic-locking token                                                          |

**Invariants** (per `docs/DB_CONSTRAINTS.md §10`):

- `DUPLICATE_CODE` (FR-002): filtered unique index `UX_LookupItem_TypeCode_Code (lookup_type_code, code) WHERE deleted_at IS NULL`.
- `SELF_PARENT` (FR-003): CHECK constraint `CK_LookupItem_NotSelfParent CHECK (parent_id IS NULL OR parent_id <> id)`.
- `CIRCULAR_HIERARCHY` (FR-004): AFTER UPDATE trigger `tr_LookupItem_NoCycles` with recursive CTE. Throws 51200.
- `PARENT_HAS_CHILDREN` (FR-005): INSTEAD OF UPDATE trigger `tr_LookupItem_BlockParentDelete` — when `deleted_at` flips from NULL to non-NULL, check `parent_id` references. Throws 51210.
- `IN_USE` (FR-006): INSTEAD OF UPDATE trigger `tr_LookupItem_BlockInUseDelete` — when `deleted_at` flips, check 4 mapping tables. Throws 51220.
- `INVALID_DATE_RANGE` (FR-007): CHECK constraint `CK_LookupItem_DateRange CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)`.

**Indexes**:
- `UX_LookupItem_TypeCode_Code` (filtered unique, above)
- `IX_LookupItem_Type_Active (lookup_type_code, is_active, deleted_at)` — list-fetch hot path
- `IX_LookupItem_Parent (parent_id, deleted_at)` — child enumeration for trigger
- `IX_LookupItem_Faculty (faculty_code, deleted_at)` WHERE `lookup_type_code = 'SPECIALIZATIONS'` — partial; FK enforcement target
- `IX_LookupItem_SortOrder (lookup_type_code, sort_order, created_at)` — sort hint

**FK constraints**:
- `parent_id` → `lookup_items.id` ON DELETE NO ACTION (handled by `PARENT_HAS_CHILDREN` trigger).
- `faculty_code` → `lookup_items.code` filtered on `lookup_type_code = 'FACULTIES' AND deleted_at IS NULL` (SQL Server doesn't directly support this; enforced via INSTEAD OF INSERT/UPDATE trigger `tr_LookupItem_FacultyFK` for SPECIALIZATIONS).

---

## `extras` JSON shapes per type code

The `extras` column holds per-type-code structured data as JSON. Domain mappers serialize/deserialize per type. The TS type unions in `frontend/src/features/lookups/types.ts` are the canonical shape — backend POCOs mirror them.

| `lookup_type_code` | `extras` shape | Notes |
|---|---|---|
| `RELATIONSHIPS` | `{ branch, gender, degree }` | branch ∈ `paternal|maternal|self|spouse|none`; gender ∈ `male|female|any`; degree ∈ `1..4` |
| `RELATIONSHIP_DEGREE_TIERS` | `{ degreeRange, maxDegree }` | both strings |
| `TESTS` | `{ kind, order, required }` | kind ∈ `physical|medical|interview|written|psych` |
| `TEST_RESULTS` | `{ outcome, tone }` | outcome ∈ `pass|fail|defer|withdrawn` |
| `COMMITTEES` | `{ kind, chairTitle }` | kind ∈ `primary|medical|final|capacities|traits|sports|interview` |
| `SPECIALIZATIONS` | `{}` | `facultyCode` is a top-level column, not in extras |
| `FACULTIES` | `{}` | (no extras) |
| `APPLICANT_CATEGORIES` | `{ genderScope, applicationMode }` | genderScope ∈ `male|female|any`; applicationMode ∈ `general|nomination` |
| `NATIONALITIES_COUNTRIES` | `{ iso2, isArab }` | iso2 = 2-letter ISO code |
| `GOVERNORATES` | `{ region }` | region ∈ Egyptian regions |
| `POLICE_STATIONS` | `{ governorateCode, kind }` | governorateCode = FK to GOVERNORATES.code; kind ∈ `قسم|مركز|بندر` |
| `JOBS` | `{}` | hierarchical via `parent_id` |
| `QUALIFICATIONS` | `{ level, track }` | level/track per the TS union |
| `ANNOUNCEMENTS` | `{ categoryCode, gender, divisionCode, publishAt, expireAt, body }` | publishAt/expireAt as ISO strings; `start_date` / `end_date` columns also populated |
| `APPLICANT_DIVISIONS` | `{}` | |
| `SCHOOL_CATEGORIES` | `{}` | |
| `NID_MISSING_REASONS` | `{ requiresUpload }` | bool |

Each shape has a corresponding C# POCO in `Lookups.Domain/LookupItemExtras/`. The `ExtrasSerializer` registers a `Dictionary<string, Func<JsonNode, IExtras>>` keyed by type code; the right deserializer is picked at read time.

**Validation**: At write time, the mapper for the row's `lookup_type_code` validates the JSON shape. Missing required fields → 422 `INVALID_EXTRAS_SHAPE` (new conflict code). Backend trusts the JSON to be well-formed JSON; structure validation is per-type.

---

## Mapping table — `category_specializations`

Which specializations are allowed per applicant category.

| Column         | Type             | Notes                                                            |
|----------------|------------------|------------------------------------------------------------------|
| `category_id`  | uniqueidentifier | PK part 1; FK → `lookup_items.id` (must be type `APPLICANT_CATEGORIES`) |
| `target_id`    | uniqueidentifier | PK part 2; FK → `lookup_items.id` (must be type `SPECIALIZATIONS`) |
| `sort_order`   | int              | default `0`                                                      |
| `created_at`   | datetimeoffset   | NOT NULL                                                         |
| `created_by`   | uniqueidentifier | NOT NULL                                                         |
| `row_version`  | rowversion       | optimistic-locking token                                         |

**Invariants**:
- `DUPLICATE_MAPPING` (FR-008): composite PK `(category_id, target_id)`.
- `UNKNOWN_TARGET` (FR-009): both FKs must reference live (non-deleted) rows. Enforced by INSTEAD OF INSERT trigger `tr_CategorySpecializations_ValidateRefs` that verifies type codes and `deleted_at IS NULL` on both target rows.

**No soft-delete on mapping rows** — mappings are admin-managed and removed via DELETE. Audit captures the deletion event.

---

## Mapping table — `category_committees`

Which committees serve each applicant category.

Same shape as `category_specializations`. Type-code constraints on FK targets: `APPLICANT_CATEGORIES` × `COMMITTEES`.

---

## Mapping table — `category_tests`

Which tests are required per applicant category.

Same shape. Type-code constraints: `APPLICANT_CATEGORIES` × `TESTS`.

---

## Mapping table — `period_categories`

Which categories are valid in each cycle period (e.g., "spring 2026 cycle accepts categories CAT-01, CAT-03, CAT-05").

Same shape. Type-code constraints: `CYCLE_PERIODS` × `APPLICANT_CATEGORIES`.

> Note: `CYCLE_PERIODS` is one of the 14 picker-only type codes (not in the 17 admin-UI set). Seeded with a small set (`spring`, `fall`, etc.). Editable via API but admin UI is deferred.

---

## Triggers (verbatim SQL — matches `docs/DB_CONSTRAINTS.md §10`)

### `tr_LookupItem_NoCycles` (AFTER UPDATE on `lookup_items`)

```sql
CREATE TRIGGER dbo.tr_LookupItem_NoCycles
ON dbo.lookup_items
AFTER UPDATE
AS BEGIN
  IF NOT UPDATE(parent_id) RETURN;

  ;WITH ancestors AS (
    SELECT i.id AS root, i.parent_id
      FROM inserted i
      WHERE i.parent_id IS NOT NULL
    UNION ALL
    SELECT a.root, p.parent_id
      FROM ancestors a
      JOIN dbo.lookup_items p ON p.id = a.parent_id
      WHERE p.parent_id IS NOT NULL
  )
  IF EXISTS (
    SELECT 1 FROM ancestors WHERE root = parent_id
  )
    THROW 51200, 'CIRCULAR_HIERARCHY', 1;
END;
```

### `tr_LookupItem_BlockParentDelete` (INSTEAD OF UPDATE on `lookup_items`)

Fires only when `deleted_at` flips from NULL to non-NULL. Checks for live children:

```sql
CREATE TRIGGER dbo.tr_LookupItem_BlockParentDelete
ON dbo.lookup_items
INSTEAD OF UPDATE
AS BEGIN
  IF EXISTS (
    SELECT 1 FROM inserted i
    JOIN deleted d ON d.id = i.id
    WHERE d.deleted_at IS NULL
      AND i.deleted_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM dbo.lookup_items c
        WHERE c.parent_id = i.id AND c.deleted_at IS NULL
      )
  )
    THROW 51210, 'PARENT_HAS_CHILDREN', 1;

  -- Pass-through UPDATE
  UPDATE dbo.lookup_items
    SET …  -- EF-generated column list
    FROM inserted i
    WHERE lookup_items.id = i.id;
END;
```

### `tr_LookupItem_BlockInUseDelete` (extension of `tr_LookupItem_BlockParentDelete`, same trigger)

Same INSTEAD OF UPDATE trigger above. Adds a second guard inside the IF block:

```sql
  -- IN_USE: row referenced in any of the 4 mapping tables
  IF EXISTS (
    SELECT 1 FROM inserted i
    JOIN deleted d ON d.id = i.id
    WHERE d.deleted_at IS NULL AND i.deleted_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM dbo.category_specializations m WHERE m.category_id = i.id OR m.target_id = i.id
        UNION ALL
        SELECT 1 FROM dbo.category_committees      m WHERE m.category_id = i.id OR m.target_id = i.id
        UNION ALL
        SELECT 1 FROM dbo.category_tests           m WHERE m.category_id = i.id OR m.target_id = i.id
        UNION ALL
        SELECT 1 FROM dbo.period_categories        m WHERE m.category_id = i.id OR m.target_id = i.id
      )
  )
    THROW 51220, 'IN_USE', 1;
```

The trigger throws `IN_USE` before `PARENT_HAS_CHILDREN` if both apply — the operator gets the most specific error.

### `tr_CategorySpecializations_ValidateRefs` (INSTEAD OF INSERT)

Verifies both FK targets are live and have the right type code:

```sql
CREATE TRIGGER dbo.tr_CategorySpecializations_ValidateRefs
ON dbo.category_specializations
INSTEAD OF INSERT
AS BEGIN
  IF EXISTS (
    SELECT 1 FROM inserted i
    LEFT JOIN dbo.lookup_items c ON c.id = i.category_id
                                 AND c.lookup_type_code = 'APPLICANT_CATEGORIES'
                                 AND c.deleted_at IS NULL
    LEFT JOIN dbo.lookup_items t ON t.id = i.target_id
                                 AND t.lookup_type_code = 'SPECIALIZATIONS'
                                 AND t.deleted_at IS NULL
    WHERE c.id IS NULL OR t.id IS NULL
  )
    THROW 51230, 'UNKNOWN_TARGET', 1;

  INSERT INTO dbo.category_specializations (...)
    SELECT ... FROM inserted;
END;
```

Three more identical triggers for the other 3 mapping tables, each with its own type-code pair.

### `tr_LookupItem_FacultyFK` (INSTEAD OF INSERT, UPDATE on `lookup_items`)

Enforces the partial FK for `SPECIALIZATIONS.faculty_code`:

```sql
CREATE TRIGGER dbo.tr_LookupItem_FacultyFK
ON dbo.lookup_items
INSTEAD OF INSERT, UPDATE
AS BEGIN
  IF EXISTS (
    SELECT 1 FROM inserted i
    WHERE i.lookup_type_code = 'SPECIALIZATIONS'
      AND i.faculty_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dbo.lookup_items f
        WHERE f.lookup_type_code = 'FACULTIES'
          AND f.code = i.faculty_code
          AND f.deleted_at IS NULL
      )
  )
    THROW 51240, 'UNKNOWN_FACULTY', 1;

  -- Pass-through INSERT/UPDATE (must mirror full column list)
  ...
END;
```

### CHECK constraints

```sql
ALTER TABLE dbo.lookup_items
  ADD CONSTRAINT CK_LookupItem_NotSelfParent
  CHECK (parent_id IS NULL OR parent_id <> id);

ALTER TABLE dbo.lookup_items
  ADD CONSTRAINT CK_LookupItem_DateRange
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
```

CHECK violations surface as SQL Server error 547 with constraint name embedded. `SqlConflictCodeMiddleware` maps:

| Constraint name                     | Conflict code         |
|-------------------------------------|-----------------------|
| `CK_LookupItem_NotSelfParent`       | `SELF_PARENT`         |
| `CK_LookupItem_DateRange`           | `INVALID_DATE_RANGE`  |

`DUPLICATE_CODE` (unique-index violation, error 2601/2627) maps via constraint name `UX_LookupItem_TypeCode_Code`. `DUPLICATE_MAPPING` (PK violation on mapping tables, error 2627) maps via PK names `PK_CategorySpecializations`, etc.

---

## Trigger error number → conflict code map (additions for `SqlConflictCodeMiddleware`)

| Error number | Conflict code           | HTTP status |
|--------------|-------------------------|-------------|
| `51200`      | `CIRCULAR_HIERARCHY`    | 409         |
| `51210`      | `PARENT_HAS_CHILDREN`   | 409         |
| `51220`      | `IN_USE`                | 409         |
| `51230`      | `UNKNOWN_TARGET`        | 422         |
| `51240`      | `UNKNOWN_FACULTY`       | 422         |

(Spec 011 introduced 51100, 51110, 51120, 51125. These ranges are non-overlapping.)

---

## Relationships diagram

```text
lookup_item_types  (seeded, 31 rows, FK target)
   │ FK lookup_type_code
   ▼
lookup_items       (single workhorse table)
   │ self-FK parent_id  ⟲ hierarchies (relationships, jobs)
   │ FK faculty_code   ──→ lookup_items (filtered: type=FACULTIES, deleted_at IS NULL)
   │ id
   ▼
   ├─→ category_specializations (category_id, target_id)
   ├─→ category_committees      (category_id, target_id)
   ├─→ category_tests           (category_id, target_id)
   └─→ period_categories        (category_id, target_id)

   And (from spec 011 — cross-spec FK):
   ├─→ applicant_category_configs.category_id   (when type = APPLICANT_CATEGORIES)
   └─→ applicant_category_specializations.specialization_id  (when type = SPECIALIZATIONS)
```

---

## Seed data (FR-020)

Migration `010_LookupCatalogue` seeds:

1. **`lookup_item_types`**: 31 rows, the 17 admin-UI types + 14 picker-only types, with their `code_prefix`, `padding`, `is_hierarchical`, `has_dates`, `has_extras` flags per the frontend's `LOOKUP_META` table.

2. **`lookup_items`**: ~1,500 rows from `frontend/src/features/lookups/mock/lookups.mock.ts` (the `LOOKUPS_SEED` constant). Per type code:
   - relationships: ~50 rows (4-degree tree)
   - relationship-degree-tiers: 4 rows
   - tests: ~10 rows
   - test-results: 5 rows
   - committees: ~10 rows
   - specializations: ~30 rows (with `faculty_code` populated)
   - faculties: ~12 rows
   - applicant-categories: 8 rows
   - nationalities-countries: ~100 rows
   - governorates: 27 rows (all Egyptian governorates)
   - police-stations: ~200 rows
   - jobs: ~80 rows (hierarchical)
   - qualifications: ~25 rows
   - announcements: ~10 rows
   - applicant-divisions: 6 rows
   - school-categories: 8 rows
   - nid-missing-reasons: 5 rows

3. **Mapping tables**: zero rows seeded — operators populate via UI.

Seed is idempotent: each INSERT is wrapped in `IF NOT EXISTS (SELECT 1 FROM lookup_items WHERE lookup_type_code = ? AND code = ?)`.

---

## Audit emissions

| Entity / endpoint                          | `action` keys                            | `entityType`                |
|--------------------------------------------|------------------------------------------|------------------------------|
| `POST /lookups/{typeCode}`                 | `create`                                 | `<TypeName>Row`              |
| `PATCH /lookups/{typeCode}/{code}`         | `update`                                 | `<TypeName>Row`              |
| `DELETE /lookups/{typeCode}/{code}`        | `soft_delete`                            | `<TypeName>Row`              |
| `POST /lookups/{typeCode}/{code}/restore`  | `restore`                                | `<TypeName>Row`              |
| `POST /lookups/{typeCode}/reorder`         | `update`                                 | `LookupReorder` (summary)    |
| `POST /lookup-mappings/{mappingKey}`       | `create`                                 | `<MappingName>`              |
| `DELETE /lookup-mappings/{mappingKey}/…`   | `delete`                                 | `<MappingName>`              |
| `POST /lookups/{typeCode}/import`          | `entity_imported` (summary) + one `create`/`update` per row | `<TypeName>Row` |
| `GET /lookups/{typeCode}/export`           | `entity_exported`                        | `<TypeName>Row`              |

All entries have `module = 'lookups'`. No new `AuditAction` values needed (`entity_imported`, `entity_exported` are already in main's union).

`<TypeName>Row` examples: `GovernorateRow`, `RelationshipRow`, `SpecializationRow`. The mapper produces the type name from the `lookup_type_code` (e.g., `GOVERNORATES` → `GovernorateRow`).

---

## Open questions

### 1. `CYCLE_PERIODS` admin UI

V1 has `period_categories` mapping but no admin UI for the `CYCLE_PERIODS` type code (it's in the 14 picker-only set). If a need arises, register `CYCLE_PERIODS` in the frontend's `LOOKUP_META` and add it to `LOOKUP_SECTIONS`. Trivial post-spec-010.

### 2. JSON extras schema enforcement at DB layer

V1 trusts the application layer to validate `extras` shape. A SQL Server CHECK constraint `CHECK (ISJSON(extras) = 1)` enforces basic JSON validity but not shape. Adding shape validation per type code would require per-type triggers — too much for V1.

### 3. `lookup_items.row_version` on mapping operations

Mappings have their own `row_version` per row. But adding/removing a mapping does NOT bump the parent `lookup_items.row_version`. If a downstream consumer (e.g., spec 011's eligibility engine) caches based on `lookup_items.row_version`, mappings changes are invisible. Document the workaround: consumers should also subscribe to the mapping table's events or refetch on a TTL.

### 4. SQL Server collation for Arabic search

V1 uses `Arabic_100_CI_AS_SC_UTF8` on `name_ar`. Free-text search across lookups (admin "find a row across all types") may want a full-text index. Out of scope for V1; lookup data is small enough that brute-force search via `LIKE N'%...%'` is acceptable.

### 5. Bulk operations performance under load

The bulk-import endpoint commits 1,000+ rows in one transaction. Other concurrent operations on `lookup_items` will queue behind the lock. Acceptable in admin-only flow (low concurrency); if frontend pickers compete for read access, consider `READ COMMITTED SNAPSHOT` isolation on `LookupsDbContext`.
