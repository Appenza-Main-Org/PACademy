# Phase 1 — Quickstart: Admission-Setup Wizard Persistence

**Branch**: `009-admission-setup-persistence` | **Date**: 2026-05-11

Operator's guide for running, migrating, and exercising the spec 009
feature locally end-to-end.

---

## 0. Prerequisites

- Backend foundation from specs 005–008 already on this branch
  (Modular monolith, lookup CRUD, identity, audit).
- SQL Server reachable (the existing `appsettings.json` connection
  string works — `Server=localhost,1433;Database=PAcademyDev;…`).
- Frontend dev server runs against the backend (`VITE_API_URL` left
  unset → defaults to `/api`; the frontend dev proxy / production
  build serves this).

---

## 1. Run the new migrations

Two new migrations are introduced. Both per-context, separate history
tables per the spec 005 FR-X01 pattern.

### Admissions module — `009_AdmissionSetupEntities`

Adds: 5 wizard entities + `wizard_step_statuses` + `cycle_exams` +
`rowversion` on `cycles` / `categories` / `admission_rules`.

```powershell
cd backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure
dotnet ef migrations add 009_AdmissionSetupEntities --context AdmissionsDbContext
dotnet ef database update --context AdmissionsDbContext
```

### Committees module — `009_CommitteesInitial`

New module, new context, new history table
(`__EFMigrationsHistory_Committees`).

```powershell
cd backend/src/Modules/Committees/PACademy.Modules.Committees.Infrastructure
dotnet ef migrations add 009_CommitteesInitial --context CommitteesDbContext
dotnet ef database update --context CommitteesDbContext
```

### Notifications module — `009_NotificationsInitial`

```powershell
cd backend/src/Modules/Notifications/PACademy.Modules.Notifications.Infrastructure
dotnet ef migrations add 009_NotificationsInitial --context NotificationsDbContext
dotnet ef database update --context NotificationsDbContext
```

**Verify** by querying `INFORMATION_SCHEMA.TABLES`:

```sql
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
  'committee_merge_split_rules', 'committee_score_thresholds',
  'exam_date_configs', 'total_score_configs', 'electronic_declarations',
  'wizard_step_statuses', 'cycle_exams',
  'committees', 'committee_members', 'committee_date_bindings',
  'committee_specializations',
  'notification_templates'
)
ORDER BY TABLE_NAME;
```

You should see all 12 rows.

---

## 2. Seed a test cycle (optional but recommended for first dev pass)

The existing `DemoDataSeeder` is extended with spec 009 fixtures
(idempotent — safe to re-run):

```powershell
# From repo root
dotnet run --project backend/src/PACademy.Api -- --seed
```

This will seed:
- 1 draft cycle: "دورة الاختبار 2026"
- 3 committees with chairs and members
- 1 publication-ready electronic declaration
- 1 exam-date config with 14 bookable days
- 1 total-score config per applicant stream
- 0 merge/split rules (admin creates these in-app)

---

## 3. Start the stack

Two terminals:

```powershell
# Terminal A — backend
dotnet run --project backend/src/PACademy.Api

# Terminal B — frontend
npm --prefix frontend run dev
```

Sign in as a super-admin via `/staff-login` (the demo seed includes
one). Navigate to `/admin/admission-setup/wizard/application-settings`.
(Cycle name / year / dates are now edited at `/admin/cycles/:id`, not
inside the wizard — see `AMENDMENT-001-wizard-step-count.md`.)

---

## 4. Walk through the four priority bands

### P1 — The 5 new entities

1. **Step 9 — Committee merge/split**: pick a cycle with ≥ 3 committees.
   Click "إنشاء قاعدة" → choose merge → pick 2 source committees + 1
   target → save. Refresh; the rule survives. Click "معاينة الأثر"
   → see the preview. Click "تطبيق" → applicants move and the rule
   flips to `applied` (immutable thereafter).
2. **Step 10 — Score thresholds**: set min=60 / max=100 for committee
   "لجنة 1" → save → refresh → values persist.
3. **Step 11 — Exam dates**: pick 14 bookable dates, blackout 2 of
   them → save → refresh → dates persist; the applicant portal's exam
   schedule view (Stage 8) now shows the same dates.
4. **Step 13 — Total-score weights**: set general stream (written 40,
   physical 30, interview 30) totalScoreOutOf=100 → save → refresh →
   values persist; the validation rejects saves where weights ≠ 100.
5. **Step 15 — Electronic declaration**: write a body in Arabic →
   save (creates draft v1) → publish → refresh → published version
   appears. Open the applicant portal's Stage 9 print-card → the
   published body is visible.

### P2 — The 4 mock-only services

6. **Step 7 — Exam plan**: reorder exams, toggle one to required →
   save → refresh → order persists.
7. **Step 8 — Committees**: create a new committee with a chair and
   3 members → save → refresh → committee appears in the standalone
   `/committees` view too.
8. **Step 12 — Date-committee binding**: bind committee "لجنة 2" to
   2026-06-15 with capacity 30 → save → refresh → binding persists.
9. **Step 14 — Notifications**: author a template "تم استلام طلبك" for
   trigger `application_received`, channel `sms` → publish → refresh
   → published flag set.

### P3 — Cycles + categories finish

10. **Step 1 — Cycle metadata**: edit cycle name, year, application
    open/close dates → save → refresh → all fields persist (closes
    any remaining gaps from prior partial wiring).
11. **Steps 2–6**: smoke-test edits on application settings, status,
    age rules, marital rules, fees → each should round-trip.

### P4 — Cross-cycle copy

12. Create a fresh draft cycle "دورة 2027 (مسودة)".
13. Open its admission-setup index → click "نسخ من دورة سابقة" → pick
    "دورة الاختبار 2026" → confirm.
14. Expect a green summary toast: "تم نسخ 12 خطوة بنجاح" with row
    counts.
15. Open each step on the new cycle → data is populated (except cycle
    name / year / dates which are blank for the admin to fill in).
16. Any broken references (e.g., a committee chair user who has left)
    are flagged in-line with an "مرجع غير صالح" warning indicator.

---

## 5. Verify the optimistic-locking 409 path

In one browser tab, open Step 10 for cycle X / committee Y → start
editing (don't save).

In a second tab (or a second browser session), open the same
(cycle, committee) score threshold → edit and save.

Switch back to the first tab → save. Expect:

- HTTP 409 from the PUT endpoint
- A blocking toast: "تم التعديل من قبل مستخدم آخر — يرجى تحديث الصفحة"
- A diff drawer showing your in-flight values vs. the server's current
  values, with a "Refresh and re-apply" button.

---

## 6. Verify the audit log

After exercising the steps above, navigate to `/admin/audit`. Filter
by `module=admin` or `entityType=CommitteeMergeSplitRule`. You should
see:

- One `create` entry per wizard row you saved.
- One `merge_rule_applied` entry per Apply you ran.
- One `notification_published` entry per declaration / notification
  published.
- One `wizard_step_completed` per step you marked complete.
- One `cycle_cloned` entry for the P4 copy you ran.

Click any entry to see actor, before/after snapshot, and timestamp.

---

## 7. Run the test suite

### Backend

```powershell
# From repo root
dotnet test backend/PACademy.sln
```

The new test projects (or extensions to existing ones) cover:
- Domain invariants (xUnit)
- Use-case happy-path + concurrency 409 (xUnit)
- Integration tests with Testcontainers SQL Server (xUnit)
- Architecture boundaries via NetArchTest

### Frontend

```powershell
cd frontend
npm run typecheck
npm run lint
npm run test -- --run
```

Vitest runs the migrated service tests and the new drawer component tests.

### E2E (Playwright)

```powershell
cd frontend
npm run e2e
```

The new `wizard-persistence.spec.ts` covers one happy path per priority
band (P1, P2, P3, P4) against a seeded backend.

---

## 8. Common pitfalls

- **Migration order matters.** Run Admissions before Committees if
  you're seeding fresh — the Committees module's foreign keys to
  `cycles.id` need that table to exist first.
- **`rowversion` on existing rows.** SQL Server auto-populates a
  rowversion for existing rows when the column is added. No data
  migration needed.
- **CrossModuleUnitOfWork** is the only sanctioned way to do
  cross-context transactions in this codebase. Do not use
  `TransactionScope` (DTC is not available in the Docker SQL Server
  setup — see spec 005 notes).
- **Permission policy seed.** The new policies
  (`admission-setup:read|write|apply|clone`) are wired by
  `RolePermissions.ForRole()` (per spec 007). Make sure your seed
  user has the relevant entries.
- **Cycle status gates writes.** Wizard writes against an `active` or
  `closed` cycle return 403. To test edits, ensure the cycle is in
  `draft` status.

---

## 9. Rolling back

Per-context migrations rollback via:

```powershell
cd backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure
dotnet ef database update PreviousMigrationName --context AdmissionsDbContext
```

This safely reverses the spec 009 migration while leaving other
modules' history tables intact.
