# Quickstart — Lookup Management Module

**Branch**: `010-lookup-management-module` | **Date**: 2026-05-12

This is the operator's walkthrough for getting spec 010 running end-to-end on a fresh dev environment, then exercising the three priority bands.

---

## 1. Prerequisites

- Spec 005 (modular monolith) on the working branch
- Spec 007 (auth + RBAC) — permission policy provider wired
- Spec 011's `Lookups` module skeleton (the module is created by spec 011 first; spec 010 extends it)
- SQL Server 2017+ running (dev: GCP-hosted per spec 006)
- `origin/main` frontend merged (`/admin/lookups` hub, `LookupTree`/`LookupGrid`/`MappingMatrix` components — all already shipped)

---

## 2. Apply migrations in order

Spec 010 ships `010_LookupCatalogue` BEFORE spec 011's `011_ApplicationSettings`:

```powershell
cd backend

# Step 1 — Spec 010: lookup catalogue + 4 mappings + data migration from legacy reference_data_entries
dotnet ef database update 010_LookupCatalogue `
  --project src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure `
  --startup-project src/PACademy.Api `
  --context LookupsDbContext

# Step 2 — Spec 011: application settings tables (FK to lookup_items)
dotnet ef database update 011_ApplicationSettings `
  --project src/Modules/Lookups/PACademy.Modules.Lookups.Infrastructure `
  --startup-project src/PACademy.Api `
  --context LookupsDbContext
```

What `010_LookupCatalogue` does:
- Creates `lookup_item_types` (31 rows seeded)
- Creates `lookup_items` (~1,500 rows seeded from `LOOKUPS_SEED`)
- Creates 4 mapping tables
- Adds 4 triggers + 2 CHECK constraints + 4 filtered unique indexes
- Migrates ~500 rows from legacy `reference_data_entries` into `lookup_items`
- Asserts row-count parity at the end

Verify:

```sql
-- Tables exist
SELECT name FROM sys.tables 
  WHERE name IN ('lookup_item_types', 'lookup_items', 
                 'category_specializations', 'category_committees',
                 'category_tests', 'period_categories');
-- Expect 6 rows.

-- Types seeded
SELECT COUNT(*) FROM dbo.lookup_item_types;             -- 31

-- Items seeded
SELECT lookup_type_code, COUNT(*) FROM dbo.lookup_items
  WHERE deleted_at IS NULL
  GROUP BY lookup_type_code
  ORDER BY 2 DESC;
-- Expect 17 admin-UI types with non-zero counts.

-- Triggers exist
SELECT name, type_desc FROM sys.triggers WHERE name LIKE 'tr_LookupItem%' OR name LIKE 'tr_Category%';
-- Expect 4+ triggers.
```

---

## 3. Apply the cleanup migration (later — after staging soak)

`010b_DropReferenceDataLegacy` drops the legacy `reference_data_entries` table. **Do NOT apply this immediately** — let `010_LookupCatalogue` soak in staging for at least 1 week, eyeball-spot-check the lookup data, confirm no consumer reads the legacy table.

When ready:

```powershell
dotnet ef database update 010b_DropReferenceDataLegacy `
  --project src/Modules/ReferenceData/PACademy.Modules.ReferenceData.Infrastructure `
  --startup-project src/PACademy.Api `
  --context ReferenceDataDbContext
```

This is the *only* migration on `ReferenceDataDbContext` after spec 010; the context itself is retired after this drop.

---

## 4. Walk through the three priority bands

Sign in as a super-admin via `/staff-login` (the demo seed includes one). Navigate to `/admin/lookups`.

### US1 — Typed CRUD with 7 invariants (P1)

1. Click "المحافظات" in the left rail → opens the `GOVERNORATES` lookup. Verify all 27 governorates render in `LookupGrid`.
2. Click "إضافة صف" → fill in `nameAr=محافظة جديدة`, `region=القاهرة الكبرى` → save. Verify:
   - `POST /admin/lookups/GOVERNORATES` returns 201 with auto-generated `code=GOV-28`.
   - The row appears in the grid.
3. Refresh → row still there.
4. **DUPLICATE_CODE**: Try to add another row with explicit `code=GOV-28`. Expect: 409, Arabic toast "الرمز مستخدم بالفعل في نفس النوع".
5. **INVALID_DATE_RANGE**: Open `ANNOUNCEMENTS` → add a row with `publishAt > expireAt`. Expect: 422, Arabic toast.
6. Switch to `RELATIONSHIPS` (hierarchical). Click "إضافة صف" → set `parentCode=REL-001` → save. Verify the tree updates.
7. **SELF_PARENT**: Try to edit a row to have `parentCode` = its own code. Expect: 422.
8. **CIRCULAR_HIERARCHY**: Construct A → B → C → A by editing parents. Expect: 409 on the last edit.
9. **PARENT_HAS_CHILDREN**: Try to soft-delete a parent row that has children. Expect: 409 with `referenceCount=N`.
10. Switch to `SPECIALIZATIONS` → add a row with `facultyCode=FAC-99` (non-existent). Expect: 422 `UNKNOWN_FACULTY`.

### US2 — Cross-lookup mappings (P1)

11. Navigate to `/admin/lookups/mappings/category-specializations` → opens `MappingMatrix` UI.
12. Tick the checkbox at `(CAT-02, SPC-03)` → save. Verify:
    - `POST /admin/lookup-mappings/category-specializations` returns 201.
    - The cell stays checked.
13. Refresh → cell still checked.
14. **DUPLICATE_MAPPING**: Click the same cell twice (the second click should be a delete, then re-add). Manually craft a request to POST the same pair again — server returns 409.
15. **IN_USE**: Go back to `SPECIALIZATIONS`, try to soft-delete `SPC-03`. Expect: 409 `IN_USE` with `referenceCount` ≥ 1 (the mapping you just created).
16. Untick the mapping cell, then retry the soft-delete. Should succeed.

### US3 — Bulk import/export (P2)

17. Navigate to `/admin/lookups/POLICE_STATIONS` (~200 rows).
18. Click "تصدير" → "XLSX". File downloads.
19. Open the file in Excel. Edit 3 rows: change one `nameAr`, soft-delete one row by setting `isActive=false`, add a new row at the bottom.
20. Back in the UI, click "استيراد" → drop the modified file. Preview opens, showing:
    - 2 updates (the `nameAr` change + the `isActive` flip)
    - 1 insert (the new row at the bottom)
    - 197 unchanged
21. Confirm. Expect: success toast "تم الاستيراد بنجاح: 1 جديد، 2 محدّث، 197 بدون تغيير".
22. Refresh the page → all changes visible.
23. **Bulk failure**: Open the file again, deliberately add a row with a duplicate code. Re-import. Preview flags the offending row red, "Confirm" disabled until you fix or remove it.
24. Try to bypass the preview (e.g., via direct API call with the bad XLSX). Expect: 422 `BULK_IMPORT_FAILED` with per-row error map; NOTHING committed.

---

## 5. Verify consumer pages still work

The lookup catalogue is read by ~15 consumer pages across the platform. Quick smoke check:

- Applicant portal Stage 3 (personal data) — relationship/nationality pickers populated
- Applicant portal Stage 4 (education) — qualification/school picker populated
- Admin admission rules — category/specialization/test picker populated
- Admin notifications — audience selector populated
- Admin committees management — specialization picker populated

If any picker is empty after spec 010 ships, check the `useLookup()` hook calls the right `typeCode`. The 14 picker-only types must be readable even though they don't have admin UI.

---

## 6. Reset for re-runs

To clear all lookup data (except the seeded `lookup_item_types`):

```sql
-- Drop in dependency order
DELETE FROM dbo.category_specializations;
DELETE FROM dbo.category_committees;
DELETE FROM dbo.category_tests;
DELETE FROM dbo.period_categories;

DELETE FROM dbo.lookup_items;

-- Re-seed via migration:
-- (the migration's INSERTs are idempotent — they only fire if the rows don't exist)
DELETE FROM dbo.__EFMigrationsHistory_Lookups
  WHERE migration_id LIKE '%010_LookupCatalogue';
-- Then:
dotnet ef database update 010_LookupCatalogue
```

(Or for a faster reset, drop and recreate the dev DB.)

---

## 7. Common issues

- **Migration row-count parity assertion fails**: The data migration found a `reference_data_entries` row whose `tab` value doesn't map to any of the 6 known type codes (governorates, specializations, nationalities, relationships, case-types, ranks). Inspect the failing row manually, decide whether to add a new mapping branch or skip with a flag.
- **`lookup_items` seed conflicts**: An earlier dev run partially seeded; the `IF NOT EXISTS` guard skips existing rows. Verify expected counts after the migration.
- **`tr_LookupItem_NoCycles` performance on imports**: The cycle trigger fires per-row on UPDATE — bulk-imports that touch `parent_id` may be slow. The bulk-import use case disables the trigger for the transaction and re-validates via a single recursive-CTE pass post-commit. Verify via SQL Profiler if perf test fails.
- **Frontend still uses mock**: Confirm `lookups.service.ts` no longer references `MOCK.lookups`. Search for `simulateLatency` — should be zero matches after T037.
- **Empty `extras` rows**: 5 type codes have empty extras (FACULTIES, JOBS, APPLICANT_DIVISIONS, SCHOOL_CATEGORIES, RELATIONSHIP_DEGREE_TIERS partially). Their `extras` column should be `{}`, not `NULL`. The seed enforces this.

---

## 8. CI verification

Pre-merge checks the spec-010 branch must pass:

```powershell
# Backend
cd backend
dotnet build
dotnet test --filter "FullyQualifiedName~Lookups"

# Frontend
cd ../frontend
npm run typecheck
npm run lint
npm run test
npm run test:e2e -- lookups
```

All must be green. Zero `--no-verify` commits on spec 010's branch.

---

## 9. Coordinated deployment with spec 011

If spec 010 and spec 011 ship together:

1. Apply `010_LookupCatalogue` migration
2. Verify the catalogue is populated
3. Apply `011_ApplicationSettings` migration (FKs to lookup_items now resolvable)
4. Run spec 011's quickstart §3 onward

If spec 010 ships first and spec 011 ships later:

1. Apply `010_LookupCatalogue` only
2. Verify the catalogue and the legacy data migration
3. Wait for spec 011 PR

The application-settings step 1 of the wizard will be backend-less between the two migrations (still mock-backed); the rest of the wizard works.
