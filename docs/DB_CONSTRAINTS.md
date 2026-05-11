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
  year × gender × capacity × window dates.

Conflict codes thrown by the frontend mock service (and mirrored
verbatim in `errors.ts → ConflictCode`):

### 11.1 · `DUPLICATE_YEAR`

**Rule.** No two rows under the same `category_specialization_id` may
share the same `(graduation_year, gender_type)` pair.

**SQL Server.**

```sql
CREATE UNIQUE INDEX UX_AppSpecYear_Unique
  ON dbo.applicant_specialization_years
     (category_specialization_id, graduation_year, gender_type)
  WHERE is_deleted = 0;
```

### 11.2 · `OVERLAPPING_PERIOD`

**Rule.** No two rows under the same `(category_specialization_id,
gender_type)` may have overlapping `[application_start_date,
application_end_date]` windows.

**SQL Server.** INSTEAD-OF trigger on INSERT/UPDATE:

```sql
IF EXISTS (
  SELECT 1
  FROM dbo.applicant_specialization_years y
  JOIN inserted i
    ON i.category_specialization_id = y.category_specialization_id
   AND i.gender_type                = y.gender_type
   AND i.id                        <> y.id
   AND y.is_deleted = 0
  WHERE i.application_start_date <= y.application_end_date
    AND i.application_end_date   >= y.application_start_date
)
THROW 51100, 'OVERLAPPING_PERIOD', 1;
```

### 11.3 · `CAPACITY_NOT_POSITIVE`

**Rule.** Capacity must be a strictly positive integer.

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_Capacity CHECK (capacity > 0);
```

### 11.4 · `INVALID_DATE_RANGE`

**Rule.** `application_end_date >= application_start_date` AND
`academic_year_start_date >= application_end_date` — academic year must
start after the application window closes.

**SQL Server.**

```sql
ALTER TABLE dbo.applicant_specialization_years
  ADD CONSTRAINT CK_AppSpecYear_DateOrder CHECK (
    application_end_date     >= application_start_date AND
    academic_year_start_date >= application_end_date
  );
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

## Cross-reference

These constraints are referenced from `CLAUDE.md §6` (mock service
contracts → backend integration). When the backend team picks up
implementation, this doc is the single page that summarizes every
typed-error code the frontend already throws, so the integration tests
have a fixture to compare against.
