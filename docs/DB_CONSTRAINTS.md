# DB Constraints — SQL Server expectations + frontend mirrors

> **Source:** `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md` Gap M.
> **Purpose:** Document every invariant the admin gap closure work assumed
> on the data layer, paired with the frontend mirror that already enforces
> it (zod / service guard / typed error). Backend implements the SQL
> Server side at integration time; the frontend will not relax these
> rules — they are the contract.

The frontend is currently mock-backed (see `CLAUDE.md §6` and the
`INTEGRATION CONTRACT` JSDoc on every `*.service.ts`). When the backend
team picks this up, the SQL Server expressions below are what production
must enforce so the integration passes without frontend churn.

---

## 1 · One active cycle only

**Rule.** At most one row in `admission_cycles` can carry `status = 'active'`
or `status = 'extended'` at any time.

**Frontend mirror.** `cyclesService.activate(id)` throws
`ConflictError('ACTIVE_CYCLE_EXISTS', { activeCycleId })` when another
cycle is already active or extended. `CycleDetailPage` surfaces the
typed error as a destructive toast and does not flip the local state.

**SQL Server.** Filtered unique index:

```sql
CREATE UNIQUE INDEX UX_AdmissionCycle_OnlyOneActive
  ON dbo.admission_cycles (status)
  WHERE status IN (N'active', N'extended');
```

---

## 2 · Unique applicant per (nationalId, cycleId)

**Rule.** A national ID can apply to a given cycle only once. Re-applying
to the *next* cycle is allowed.

**Frontend mirror.** `applicantService.create()` (existing) rejects with a
typed `ConflictError('NID_CYCLE_DUPLICATE', { nationalId, cycleId })`
when a duplicate is detected. The Stage 1 phone-auth flow performs the
check before issuing the SMS so the applicant gets early feedback.

**SQL Server.**

```sql
ALTER TABLE dbo.applicants
  ADD CONSTRAINT UX_Applicant_Nid_Cycle UNIQUE (national_id, cycle_id);
```

---

## 3 · Category belongs to exactly one cycle

**Rule.** Each `applicant_category` row has a single owning `cycle_id`
(via the `cycle_open_categories` junction). Cross-cycle reuse copies the
row, it does not share it.

**Frontend mirror.** `cyclesService.toggleCategory(cycleId, key, config)`
writes into `cycle.openCategories[key]` — keyed under one cycle. The
`Category Edit` page displays per-cycle status without splitting the
category record itself.

**SQL Server.**

```sql
ALTER TABLE dbo.cycle_open_categories
  ADD CONSTRAINT UX_CycleCategory UNIQUE (cycle_id, category_key);
ALTER TABLE dbo.cycle_open_categories
  ADD CONSTRAINT FK_CycleCategory_Cycle FOREIGN KEY (cycle_id) REFERENCES dbo.admission_cycles (id);
```

---

## 4 · Fee belongs to its cycle

**Rule.** `cycle_fees.cycle_id` is required and not nullable; the
application/deposit/late/replacement amounts can never float free.

**Frontend mirror.** The `CycleFees` type is shaped under `AdmissionCycle`
in `shared/types/domain.ts`; service guards return 409 if `cycle_id` is
absent.

**SQL Server.**

```sql
ALTER TABLE dbo.cycle_fees
  ALTER COLUMN cycle_id BIGINT NOT NULL;
ALTER TABLE dbo.cycle_fees
  ADD CONSTRAINT FK_CycleFees_Cycle FOREIGN KEY (cycle_id) REFERENCES dbo.admission_cycles (id);
```

---

## 5 · Exam order unique per (categoryId, cycleId)

**Rule.** Within a cycle-category exam plan, no two rows share the same
`order` integer.

**Frontend mirror.** `examPlansService.savePlan()` validates uniqueness
client-side and throws `ConflictError('EXAM_ORDER_DUPLICATE', {
cycleId, categoryId, order })` when a duplicate is submitted. The
`ExamPlanEditor` reorder buttons always rewrite to `(idx + 1) * 10` so
duplicates require a deliberate manual edit.

**SQL Server.**

```sql
ALTER TABLE dbo.cycle_category_exam_plan
  ADD CONSTRAINT UX_ExamPlan_Order
  UNIQUE (cycle_id, category_id, exam_order);
```

---

## 6 · Committee daily attendance ≤ capacity

**Rule.** A committee can schedule at most `capacity_per_day` applicants
on any single calendar day. Beyond the cap, scheduling is rejected.

**Frontend mirror.** `committeeService.scheduleSlot()` throws
`ConflictError('COMMITTEE_AT_CAPACITY', { committeeId, dateIso,
capacityPerDay, current })` when the in-memory daily counter would
exceed the cap.

**SQL Server.** Trigger or app-level transaction:

```sql
CREATE TRIGGER tr_CommitteeSlot_CapacityGuard
  ON dbo.committee_slots
  AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1
      FROM inserted i
      JOIN dbo.committees c ON c.id = i.committee_id
     WHERE c.capacity_per_day IS NOT NULL
       AND (
         SELECT COUNT(*) FROM dbo.committee_slots s
           WHERE s.committee_id = i.committee_id
             AND CAST(s.date_iso AS DATE) = CAST(i.date_iso AS DATE)
       ) > c.capacity_per_day
  )
  BEGIN
    RAISERROR (N'COMMITTEE_AT_CAPACITY', 16, 1);
    ROLLBACK TRANSACTION;
  END
END;
```

---

## 7 · Cannot delete parent with children

**Rule.** Soft-delete must be rejected when child rows reference the
parent. (Hard delete is not exposed in admin surfaces.)

**Frontend mirror.** Each entity service exposes `getDependencies(id)`
returning `DependencyResult`; `softDelete()` calls it and throws
`DependencyBlockedError` with formatted Arabic copy when blocking.
`<SoftDeleteDialog>` displays the dependency counts and disables Confirm.

**SQL Server.** Foreign keys with `ON DELETE NO ACTION`, plus filtered
soft-delete columns:

```sql
ALTER TABLE dbo.admission_cycles
  ADD deleted_at DATETIMEOFFSET NULL,
      deleted_by NVARCHAR(64) NULL,
      delete_reason NVARCHAR(500) NULL;

ALTER TABLE dbo.applicant_categories
  ADD deleted_at DATETIMEOFFSET NULL,
      deleted_by NVARCHAR(64) NULL,
      delete_reason NVARCHAR(500) NULL;
-- (and equivalent on committees, lookup_rows, admin_notifications, role_definitions)

-- Foreign-key clauses use NO ACTION so a soft-delete with live
-- children is rejected at the application layer (not DB-level cascades).
```

---

## 8 · Soft-delete filters applied by default

**Rule.** Every `list()` query excludes rows with `deleted_at IS NOT NULL`
by default. An opt-in `include_deleted=true` request flag (super-admin
only) flips them back into view, never into use.

**Frontend mirror.** Each `list()` accepts `{ includeDeleted?: boolean }`
and routes through `filterDeleted()` from `shared/lib/soft-delete`. The
super-admin "إظهار المحذوف" toggle on CategoriesListPage / RolesPage /
LookupTab passes the flag.

**SQL Server.** Stored-procedure pattern:

```sql
CREATE PROCEDURE dbo.sp_AdmissionCycle_List
  @IncludeDeleted BIT = 0
AS
BEGIN
  SELECT * FROM dbo.admission_cycles
   WHERE @IncludeDeleted = 1 OR deleted_at IS NULL
   ORDER BY year DESC;
END;
```

---

## 9 · Audit append-only

**Rule.** `audit_entries` accepts `INSERT` only. No `UPDATE` or `DELETE`
is permitted on the table — the audit log is the source of truth for
forensic and compliance review.

**Frontend mirror.** `auditService` exposes only `list` / `getById` /
`getDiff` / `exportCsv` / `getEntityTypes` / `getModules` / `getRoles` /
`getUsers`. There is intentionally no mutation method. Emissions go
through `emitAudit()` which `unshift`s into `MOCK.audit`.

**SQL Server.** Per-table grants + an `AFTER UPDATE / DELETE` trigger
that raises an error:

```sql
DENY UPDATE, DELETE ON dbo.audit_entries TO db_app_user;

CREATE TRIGGER tr_Audit_AppendOnly
  ON dbo.audit_entries
  INSTEAD OF UPDATE, DELETE
AS
BEGIN
  RAISERROR (N'AUDIT_APPEND_ONLY', 16, 1);
END;
```

---

## 10 · Lookups — invariants

The Lookup Management Module (`features/lookups/`) consolidates ~31
admin-managed reference lists into a single shape (`lookup_items` keyed
by `lookup_type_code`). The seven invariants below are enforced by
`lookupsService` (typed `ConflictError(<code>, payload)`) and must be
mirrored by the backend.

### 10.1 · `DUPLICATE_CODE`

**Rule.** Within a single `lookup_type_code`, `code` is unique across
non-soft-deleted rows.

**SQL Server.** Filtered unique index:

```sql
CREATE UNIQUE INDEX UX_LookupItem_TypeCode_Code
  ON dbo.lookup_items (lookup_type_code, code)
  WHERE deleted_at IS NULL;
```

### 10.2 · `SELF_PARENT`

**Rule.** `parent_id` cannot equal `id`.

**SQL Server.**

```sql
ALTER TABLE dbo.lookup_items
  ADD CONSTRAINT CK_LookupItem_NotSelfParent
  CHECK (parent_id IS NULL OR parent_id <> id);
```

### 10.3 · `CIRCULAR_HIERARCHY`

**Rule.** No row may appear in its own ancestor chain. The frontend
walks `parent_id` up to the root and rejects if the candidate id is hit.

**SQL Server.** Trigger or recursive CTE-based check on UPDATE:

```sql
CREATE TRIGGER tr_LookupItem_NoCycles
  ON dbo.lookup_items
  AFTER UPDATE
AS
BEGIN
  IF EXISTS (
    WITH ancestors AS (
      SELECT id, parent_id FROM dbo.lookup_items WHERE id IN (SELECT id FROM inserted)
      UNION ALL
      SELECT li.id, p.parent_id
        FROM ancestors a
        JOIN dbo.lookup_items li ON li.id = a.parent_id
        JOIN dbo.lookup_items p  ON p.id  = li.parent_id
    )
    SELECT 1 FROM ancestors a JOIN inserted i ON i.id = a.parent_id
  ) RAISERROR (N'CIRCULAR_HIERARCHY', 16, 1);
END;
```

### 10.4 · `PARENT_HAS_CHILDREN`

**Rule.** A parent row cannot be soft-deleted while any non-deleted
child references it via `parent_id`.

**SQL Server.** Mirror of §7 (cannot delete parent with children) —
either an INSTEAD-OF trigger on UPDATE or an application-level check
before the soft-delete UPDATE runs.

### 10.5 · `IN_USE`

**Rule.** A row cannot be soft-deleted while it appears in any of the
four mapping tables (`category_specializations`, `category_committees`,
`category_tests`, `period_categories`).

**SQL Server.** Trigger-based check on UPDATE that compares
`(id IN SELECT target_id FROM …)` across the four junction tables and
raises `IN_USE`. Foreign-key cascades are intentionally *not* used —
mappings must be removed first so the operator sees the dependency.

### 10.6 · `INVALID_DATE_RANGE`

**Rule.** When both `start_date` and `end_date` are present, `start_date
<= end_date`.

**SQL Server.**

```sql
ALTER TABLE dbo.lookup_items
  ADD CONSTRAINT CK_LookupItem_DateRange
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
```

### 10.7 · `DUPLICATE_MAPPING`

**Rule.** Each of the four mapping tables has a composite PK on
`(category_id, target_id)`; insert of an existing pair is rejected.

**SQL Server.**

```sql
ALTER TABLE dbo.category_specializations
  ADD CONSTRAINT PK_CategorySpecializations PRIMARY KEY (category_id, target_id);

ALTER TABLE dbo.category_committees
  ADD CONSTRAINT PK_CategoryCommittees PRIMARY KEY (category_id, target_id);

ALTER TABLE dbo.category_tests
  ADD CONSTRAINT PK_CategoryTests PRIMARY KEY (category_id, target_id);

ALTER TABLE dbo.period_categories
  ADD CONSTRAINT PK_PeriodCategories PRIMARY KEY (category_id, target_id);
```

---

## 11 · Admission Setup — Application Settings invariants

Application Settings is global master data (not cycle-scoped). Three new
tables back the three-tier editor:

- `dbo.applicant_category_configs` — one row per `applicant-categories`
  lookup item the admin chooses to surface.
- `dbo.applicant_category_specializations` — junction between a config
  row and a `specializations` lookup item.
- `dbo.applicant_specialization_years` — leaf row carrying graduation
  year × gender(s) × marital status(es) × division(s) × age cap × grade
  gate × window dates. Gender, marital status, and division are
  many-to-many; the canonical representation is three side-tables
  (`applicant_specialization_year_genders`,
  `applicant_specialization_year_marital_statuses`,
  `applicant_specialization_year_divisions`) keyed by `(year_id, code)`.
  The grade gate is a discriminated branch on `grade_kind`
  (`'GRADES'` → `min_percentage` column; `'TAGDIR'` → `academic_grade_id`
  column FK → `academic-grades` lookup). The parent category's submission
  type determines which branch applies — see §11.4e.

Conflict codes thrown by the frontend mock service (and mirrored
verbatim in `errors.ts → ConflictCode`):

### 11.1 · `DUPLICATE_YEAR`

**Rule.** No two rows under the same `category_specialization_id` may
share the same `graduation_year` while having *any* overlapping gender
in their gender sets. Two rows with disjoint gender sets and the same
graduation year are permitted.

**SQL Server.** INSTEAD-OF trigger on INSERT/UPDATE that joins the
gender side-table and rejects intersection on `(year, gender)`:

```sql
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
```

### 11.2 · `OVERLAPPING_PERIOD`

**Rule.** No two rows for the same specialization with overlapping
gender sets may have overlapping `[application_start_date,
application_end_date]` windows.

**SQL Server.** INSTEAD-OF trigger on INSERT/UPDATE:

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

### 11.3 · `AGE_NOT_POSITIVE`

**Rule.** When supplied, `max_age` must be a positive integer.

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_MaxAge
  CHECK (max_age IS NULL OR max_age > 0);
```

### 11.4 · `INVALID_DATE_RANGE`

**Rule.** `application_end_date >= application_start_date`.
`age_reference_date` is required and must be a parseable date; the
column-ordering constraint relative to the application window is
enforced separately (§11.4d).

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_DateOrder
  CHECK (application_end_date >= application_start_date);
```

### 11.4b · `PERCENTAGE_OUT_OF_RANGE`

**Rule.** GRADES-branch rows (`grade_kind = 'GRADES'`) must carry a
`min_percentage` in `[0, 100]`. TAGDIR-branch rows leave the column
NULL.

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_Percentage
  CHECK (
    (grade_kind = 'GRADES' AND min_percentage BETWEEN 0 AND 100)
    OR (grade_kind = 'TAGDIR' AND min_percentage IS NULL)
  );
```

### 11.4d · `AGE_REFERENCE_AFTER_START`

**Rule.** The age-reference anchor (`age_reference_date`, used by
eligibility to compute applicant age) must be on or before
`application_start_date`. Anchoring on a date past the open of the
application window would let an applicant who was under-age at submit
time become eligible mid-window — operationally non-sensical.

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_AgeRef
  CHECK (age_reference_date <= application_start_date);
```

### 11.4e · `GRADE_MODE_MISMATCH`

**Rule.** The row's `grade_kind` must equal the parent category's
submission-type `grading_mode`. Resolution chain:

```
applicant_specialization_year.category_specialization_id
  → applicant_category_specialization.config_id
  → applicant_category_config.category_id
  → applicant_categories[code].submission_type_code
  → submission_types[code].grading_mode
```

If an admin re-points a category at a different submission-type after
year rows already exist, the existing rows whose `grade_kind` no longer
matches must be deleted and recreated. The frontend surfaces the drift
via a banner at the top of the application-settings page and disables
bulk save until resolved.

**SQL Server.** Enforced by a trigger on INSERT/UPDATE of
`applicant_specialization_years`:

```sql
IF EXISTS (
  SELECT 1
  FROM inserted i
  JOIN dbo.applicant_category_specializations s
    ON s.id = i.category_specialization_id
  JOIN dbo.applicant_category_configs c
    ON c.id = s.config_id
  JOIN dbo.applicant_categories cat
    ON cat.code = c.category_id
  JOIN dbo.submission_types st
    ON st.code = cat.submission_type_code
  WHERE st.grading_mode <> i.grade_kind
)
THROW 51130, 'GRADE_MODE_MISMATCH', 1;
```

### 11.4c · `GENDER_REQUIRED`

**Rule.** Every year row must carry at least one gender — the side
table must have at least one row keyed to it.

**SQL Server.** Enforced by trigger on row-create (and on delete from
the side table when it would drop count to 0):

```sql
IF EXISTS (
  SELECT y.id FROM dbo.applicant_specialization_years y
  LEFT JOIN dbo.applicant_specialization_year_genders g ON g.year_id = y.id
  WHERE y.id IN (SELECT id FROM inserted)
  GROUP BY y.id HAVING COUNT(g.gender_type) = 0
)
THROW 51125, 'GENDER_REQUIRED', 1;
```

### 11.5 · `SPECIALIZATION_NOT_MAPPED`

**Rule.** Reserved for the day the backend ships a
`category_specializations` junction in the lookup catalogue (see §10.7
which already PKs `category_specializations (category_id, target_id)`).
At that point, inserts into `applicant_category_specializations` must
verify the `(category_id, specialization_id)` pair exists in the lookup
mapping. The frontend already throws this code conditionally so the
service contract is forward-compatible; V1 mock data does not enforce
the filter because no `category_specializations` mapping exists in
`MOCK.lookups` today.

### 11.6 · `CATEGORY_HAS_ACTIVE_YEARS`

**Rule.** A config row cannot be deactivated while any descendant
`applicant_specialization_years.is_active = 1`. Caller must deactivate
the years first.

**SQL Server.** Trigger on UPDATE of `applicant_category_configs`:

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

---

## 12 · Exam Schedule — invariants

Per-category calendar of WORKING / OFF days. Each row is scoped to a
single `(cycle_id, applicant_category_id, date)` tuple. There is no
capacity field — the schedule is a pure calendar.

### 12.1 · `DUPLICATE_DATE`

**Rule.** Unique `(cycle_id, applicant_category_id, date)`. The same
calendar date CAN exist across different categories — each category's
schedule is independent.

**SQL Server.**

```sql
ALTER TABLE dbo.exam_schedule_days
ADD CONSTRAINT UQ_exam_schedule_days_cycle_cat_date
  UNIQUE (cycle_id, applicant_category_id, date);
```

### 12.2 · `DATE_OUT_OF_CYCLE_WINDOW`

**Rule.** Each `date` must satisfy
`date BETWEEN cycle.open_date AND cycle.close_date`.

**SQL Server.** CHECK constraint via scalar function or trigger
(CHECK cannot dereference another table directly):

```sql
CREATE OR ALTER TRIGGER trg_exam_schedule_days_cycle_window
ON dbo.exam_schedule_days
AFTER INSERT, UPDATE
AS
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN dbo.admission_cycles c ON c.id = i.cycle_id
    WHERE i.date < CAST(c.open_date AS DATE)
       OR i.date > CAST(c.close_date AS DATE)
  )
    THROW 51120, 'DATE_OUT_OF_CYCLE_WINDOW', 1;
END;
```

### 12.3 · `INVALID_DATE_RANGE`

**Rule.** Bulk-generate input must satisfy `end_date >= start_date`.

**SQL Server.** Validated at the stored-procedure entry point for the
bulk-generate endpoint (no table constraint — this is a request-shape
invariant):

```sql
IF @end_date < @start_date
  THROW 51121, 'INVALID_DATE_RANGE', 1;
```

### 12.4 · `CATEGORY_NOT_ACTIVE`

**Rule.** `applicant_category_id` must resolve to a row in
`applicant_category_configs` with `is_active = 1`. Categories
deactivated in Step 1 of the wizard cannot have new schedule rows
written.

**SQL Server.**

```sql
CREATE OR ALTER TRIGGER trg_exam_schedule_days_active_category
ON dbo.exam_schedule_days
AFTER INSERT, UPDATE
AS
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inserted i
    LEFT JOIN dbo.applicant_category_configs c
      ON c.category_id = i.applicant_category_id
    WHERE c.id IS NULL OR c.is_active = 0
  )
    THROW 51122, 'CATEGORY_NOT_ACTIVE', 1;
END;
```

---

## Cross-reference

These constraints are referenced from `CLAUDE.md §6` (mock service
contracts → backend integration). When the backend team picks up
implementation, this doc is the single page that summarizes every
typed-error code the frontend already throws, so the integration tests
have a fixture to compare against.
