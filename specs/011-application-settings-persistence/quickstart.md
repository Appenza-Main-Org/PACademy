# Quickstart — Application Settings Persistence

**Branch**: `011-application-settings-persistence` | **Date**: 2026-05-12

This is the operator's walkthrough for getting spec 011 running end-to-end on a fresh dev environment, then exercising the four user-story acceptance paths.

---

## 1. Prerequisites

- Spec 005 (modular monolith) on the working branch
- Spec 007 (auth + RBAC) — `admission-setup:read|write` policies wired
- Spec 009 (admission-setup persistence) merged or co-developed — provides the `WizardStepStatuses` table that the application-settings step's pill writes to
- SQL Server 2017+ running (dev: GCP-hosted per spec 006, or local Docker)
- `origin/main` frontend merged (the `Application Settings` page, `appSettingsDraft` store, `appSettingsValidation` helpers — all already shipped)

---

## 2. Apply the migration

```powershell
cd backend
dotnet ef database update --context LookupsDbContext `
  --project src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure `
  --startup-project src/PACademy.Api
```

What this does:
- Creates 5 tables (`applicant_category_configs`, `applicant_category_specializations`, `applicant_specialization_years`, `applicant_specialization_year_genders`, `applicant_specialization_year_marital_statuses`)
- Creates 4 triggers (`tr_AppSpecYear_DuplicateYear`, `tr_AppSpecYear_OverlappingPeriod`, `tr_AppSpecYearGender_RequireOne`, `tr_AppCatConfig_CategoryHasActiveYears`)
- Adds 3 CHECK constraints (`CK_AppSpecYear_DateOrder`, `CK_AppSpecYear_MaxAge`, `CK_AppSpecYear_GradeRange`)
- Adds the history table `__EFMigrationsHistory_Lookups`

Verify the migration applied:

```sql
SELECT * FROM dbo.__EFMigrationsHistory_Lookups;
-- Expect one row: 20260512xxxxxx_011_ApplicationSettings
```

Verify the tables exist:

```sql
SELECT name FROM sys.tables WHERE name LIKE 'applicant_%';
-- Expect 5 tables.
```

Verify the triggers exist:

```sql
SELECT name, type_desc FROM sys.triggers WHERE name LIKE 'tr_App%';
-- Expect 4 triggers (INSTEAD_OF_TRIGGER + AFTER_TRIGGER mix).
```

---

## 3. Seed dev data (optional)

The `--seed-demo` flag adds an 8-config sample dataset:

```powershell
dotnet run --project src/PACademy.Api --seed-demo
```

Expected after seed:

```sql
SELECT COUNT(*) FROM dbo.applicant_category_configs;             -- 8
SELECT COUNT(*) FROM dbo.applicant_category_specializations;     -- ~20
SELECT COUNT(*) FROM dbo.applicant_specialization_years;         -- ~60
```

(The seed dataset comes from `frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts`. Backend seeder reads the same canonical fixture so dev and integration tests share the same data.)

---

## 4. Walk through the three priority bands

### US1 — Three-tier persistence (P1)

Sign in as a super-admin via `/staff-login` (the demo seed includes one). Navigate to `/admin/admission-setup/wizard/application-settings`.

1. Click an inactive category in the accordion → flip its toggle to "active" → click "Save changes" in the sticky bar. Verify:
   - Browser network panel shows `PATCH /admin/app-settings/category-configs/{id}` with 200.
   - Page refresh shows the toggle still active.
2. Expand the active category → click "Add specialization" → pick a specialization from the dropdown → confirm. Verify:
   - `POST /admin/app-settings/category-configs/{configId}/specializations` with 201.
   - The new specialization shows under the category accordion with an empty `YearTable`.
3. In the new specialization's `YearTable`, click "Add year". Fill in:
   - Graduation year: 2026
   - Genders: [male]
   - Marital statuses: [أعزب]
   - Max age: 22
   - Min grade: 85, max grade: 100
   - Application window: 2026-07-01 → 2026-08-15
   - Age calc date: 2026-09-01
   - Save.
4. Add a second year row for the same specialization with `genders=[female]` and the same graduation year (2026). The DUPLICATE_YEAR rule does NOT fire because gender sets are disjoint.
5. Refresh the page → assert both year rows are visible and the form fields are intact.

### US2 — Conflict codes (P1)

Run each of these to see the conflict messages surface as Arabic toasts + inline hints:

6. **DUPLICATE_YEAR**: Add a third year row with `genders=[male]` and `graduationYear=2026` under the same specialization. Expect: 409, Arabic toast "يوجد بالفعل صف لسنة التخرج هذه يشترك في نفس النوع", red border on `graduationYear` field.
7. **OVERLAPPING_PERIOD**: Add a year with `genders=[male]`, `graduationYear=2025`, and window 2026-07-15 → 2026-08-01 (overlaps with the existing male row's 2026-07-01 → 2026-08-15). Expect: 409, Arabic toast, red borders on the date pickers.
8. **INVALID_DATE_RANGE**: Try to save a year with `applicationEndDate < applicationStartDate`. Expect: 422.
9. **AGE_NOT_POSITIVE**: Try `maxAge=0`. Expect: 422.
10. **GRADE_RANGE_INVALID**: Try `minGrade=80, maxGrade=60`. Expect: 422.
11. **GENDER_REQUIRED**: Clear the gender checkboxes and try to save. Expect: 422.
12. **CATEGORY_HAS_ACTIVE_YEARS**: Try to deactivate the parent category (toggle it off in the accordion header). Expect: 409, Arabic toast "لا يمكن إيقاف الفئة — توجد سنوات نشطة".
13. **ROW_VERSION_CONFLICT**: Open the same year row in two tabs. Edit and save in tab A. Edit a different field in tab B and try to save. Expect: 409 in tab B, the `RowVersionConflictDialog` opens, click "Refresh and re-apply" to reload tab B's state.

### US3 — Audit trail (P2)

14. Navigate to `/admin/audit?module=lookups` after performing the steps above. Verify the audit rows reflect each mutation with correct `before` / `after` snapshots and the actor.

---

## 5. Verify the wizard-step pill

The wizard's `AdmissionSetupIndexPage` shows a status pill for step 1 (`application_settings`). The pill state lives in `wizard_step_statuses` (owned by spec 009).

After the first save in step 4 above:

```sql
SELECT * FROM dbo.wizard_step_statuses
WHERE cycle_id = '<your-test-cycle-id>'
  AND step_key = 'application_settings';
-- Expect status = 'in_progress'.
```

Click "Mark step complete" in the wizard sidebar:

```sql
-- Expect status = 'complete' after the click.
```

The pill is per-cycle (each cycle has its own row), even though the underlying application settings data is global.

---

## 6. Reset for re-runs

To clear all spec-011 data without dropping the schema:

```sql
DELETE FROM dbo.applicant_specialization_year_marital_statuses;
DELETE FROM dbo.applicant_specialization_year_genders;
DELETE FROM dbo.applicant_specialization_years;
DELETE FROM dbo.applicant_category_specializations;
DELETE FROM dbo.applicant_category_configs;
```

Then re-run `--seed-demo` (step 3) to repopulate.

---

## 7. Common issues

- **Migration fails with "table already exists"**: An earlier dev migration was applied. Inspect `__EFMigrationsHistory_Lookups` — if you see a prior `011_*` entry, mark this one as applied via `INSERT INTO __EFMigrationsHistory_Lookups ...` or drop and recreate the dev DB.
- **`SqlConflictCodeMiddleware` not catching trigger errors**: Verify the middleware is registered in `Program.cs` *after* `DbUpdateConcurrencyExceptionMiddleware` but *before* `UseAuthorization`. Order matters — auth runs after error mapping.
- **Frontend still uses mock**: Ensure `applicationSettings.service.ts` no longer references `MOCK.*` arrays after T036. Search the file for `simulateLatency` — should be zero matches.
- **Audit entries missing**: Verify the use case's `IAuditApi.AppendAsync` call runs *inside* the same transaction as the data mutation. Spec 005's audit module shares the connection; cross-context boundaries are not needed here (Lookups + Audit live in the same DB, different DbContexts — see `CrossModuleUnitOfWork` if needed).

---

## 8. CI verification

Pre-merge checks the spec-011 branch must pass:

```powershell
# Backend
cd backend
dotnet build
dotnet test --filter "FullyQualifiedName~Lookups|FullyQualifiedName~ApplicationSettings"

# Frontend
cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run test:e2e -- application-settings
```

All must be green. The two `--no-verify` commits authorized during the spec-009 merge (the merge + the cleanup) do NOT carry over — spec 011's commits MUST honor the hook.
