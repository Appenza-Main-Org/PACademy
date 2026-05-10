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

## Cross-reference

These constraints are referenced from `CLAUDE.md §6` (mock service
contracts → backend integration). When the backend team picks up
implementation, this doc is the single page that summarizes every
typed-error code the frontend already throws, so the integration tests
have a fixture to compare against.
