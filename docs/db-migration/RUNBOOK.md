# Migration Runbook

> Environment separation: schema-based (`[PACademy].[admin_v2]` /
> `[PACademy].[PACademy_staging_db]`) → database-based
> (`[DB_PAcademy_Prod].[dbo]` / `[DB_PAcademy_Staging].[dbo]`).
>
> Read `00_OVERVIEW.md` first. This runbook is an **ordered, gated** procedure. Do not
> skip a gate. Every live-DB command is **operator-run** on a network that can reach
> `34.17.135.245:1433` — the authoring machine cannot. Passwords are masked as
> `<secret>`; the real values live only in the Railway service secrets.

## Conventions

- **GATE** — a checkpoint that must pass before continuing. If it fails, stop and roll back.
- Phases **1, 2, 5** are `DESTRUCTIVE / REQUIRES APPROVAL` — get explicit sign-off and a
  fresh, restorable backup (Phase 0) before running them.
- All `dotnet ef` commands run from `backend/admin/PACademy.Admin.Api/` unless noted.
- `sqlcmd` examples use `-v Name="Value"` for `:setvar` substitution.
- "Source schema" = the live schema being copied **from** (`admin_v2` for prod,
  `PACademy_staging_db` for staging). "Target DB" = the new database being copied **into**.

## Pre-requisites

- An operator workstation/jump host with `sqlcmd` (or Azure Data Studio) that can reach
  `34.17.135.245,1433` and the `sa` (or an equivalent sysadmin) login.
- The .NET SDK + `dotnet-ef` tool **only** if regenerating the EF scripts in Phase 1
  (the generated `.sql` files can instead be produced once and committed, then the
  operator just runs the SQL).
- The Railway CLI authenticated against project `eadfbf1c-8500-49cb-a53b-0824cdaf72df`
  (Phase 5 only).
- Off-hours maintenance window agreed (Phases 1–2 and the Phase 5 cutover).

---

## Phase 0 — PRE-FLIGHT (no changes)

**Goal:** a restorable backup of `[PACademy]` and a captured inventory baseline. Nothing
is modified.

### 0.1 Full backup of `[PACademy]`

```sql
BACKUP DATABASE [PACademy]
    TO DISK = N'/var/opt/mssql/backup/PACademy_premigration.bak'
    WITH COPY_ONLY, INIT, COMPRESSION, CHECKSUM, STATS = 10;
```

> `COPY_ONLY` so the regular backup/log chain is undisturbed. `CHECKSUM` so the restore
> verify can detect corruption.

### 0.2 Verify the backup is restorable

```sql
RESTORE VERIFYONLY
    FROM DISK = N'/var/opt/mssql/backup/PACademy_premigration.bak'
    WITH CHECKSUM;
```

If you can afford it, do a real trial restore into a throwaway DB name and confirm it
mounts (this is the only way to be sure):

```sql
RESTORE DATABASE [PACademy_restore_probe]
    FROM DISK = N'/var/opt/mssql/backup/PACademy_premigration.bak'
    WITH MOVE N'<PACademy_data_logical>' TO N'/var/opt/mssql/data/PACademy_restore_probe.mdf',
         MOVE N'<PACademy_log_logical>'  TO N'/var/opt/mssql/data/PACademy_restore_probe_log.ldf',
         RECOVERY, CHECKSUM, STATS = 10;
-- get the logical names first:
RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/PACademy_premigration.bak';
-- then drop the probe:
-- DROP DATABASE [PACademy_restore_probe];
```

### 0.3 Capture the live inventory baseline

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' -d PACademy \
  -i docs/db-migration/sql/00_live_inventory_scan.sql \
  -o inventory_baseline.txt
```

Save the raw output alongside this runbook (e.g. `inventory_baseline.txt`) for the record,
and transcribe the relevant figures into the structural rows of
`docs/db-migration/04_VALIDATION_REPORT_TEMPLATE.md` — this is the **pre-migration**
reference for both environments. (The static repo-derived inventory lives in
`01_INVENTORY.md` / `02_DISCOVERED_TABLES.md`; this step captures the **live** baseline.)

This scan must enumerate, **per schema** (`admin_v2`, `PACademy_staging_db`) **and**
confirm `dbo` presence of the six module tables (`faculties`, `applicants`,
`applicant_grades`, `applicant_grade_adjustments`, `grade_import_batches`,
`grade_import_rows`):
- table / column / FK / index / view / proc / function / trigger counts;
- the four `__EFMigrationsHistory_*` tables and their applied migration ids;
- the drift markers: duplicate `[users]`; whether `applicant_portal_records` /
  `exam_slots` exist under each schema; whether `general_settings` exists on staging.

> **GATE 0:** backup exists, `RESTORE VERIFYONLY` (and ideally a trial restore) passes,
> inventory captured. Do **not** proceed otherwise.

**ROLLBACK (Phase 0):** none required — no changes were made. If anything looks wrong,
stop here; the live DB is untouched.

---

## Phase 1 — CREATE the new databases + `dbo` schema  `DESTRUCTIVE / REQUIRES APPROVAL`

**Goal:** two empty databases, each with the full canonical structure under `dbo` and a
seeded `__EFMigrationsHistory_*` per context. Run off-hours.

> Destructive because `sql/01_create_databases.sql` may `DROP DATABASE` a pre-existing
> target of the same name. Confirm `DB_PAcademy_Prod` / `DB_PAcademy_Staging` do not
> already hold data you care about.

### 1.1 Create the databases

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' \
  -i docs/db-migration/sql/01_create_databases.sql
```

Creates `[DB_PAcademy_Prod]` and `[DB_PAcademy_Staging]` (no app objects yet).

### 1.2 Generate the four idempotent EF schema scripts (schema = `dbo`)

Run from `backend/admin/PACademy.Admin.Api/`. Setting `ADMIN_DB_SCHEMA=dbo` forces
`AdminDbContext` to emit `dbo` (it overrides `Database:Schema` and the `admin_v2`
default). The three module contexts ignore the var but already default to `dbo`. The
`--idempotent` flag makes each script safe to run against a fresh DB **and** writes the
`INSERT INTO __EFMigrationsHistory_*` rows for every applied migration — so the apps
(running `SkipMigrationsAndSeed=true`) will consider the DB fully migrated without us
hand-counting migration ids.

```bash
# 1) AdminDbContext  → 24 core tables + __EFMigrationsHistory_AdminApi
ADMIN_DB_SCHEMA=dbo dotnet ef migrations script --idempotent \
  --context AdminDbContext \
  -o ../../../docs/db-migration/sql/02_build_dbo_schema_admin.sql

# 2) LookupsAdminDbContext  → faculties + __EFMigrationsHistory_LookupsAdmin
ADMIN_DB_SCHEMA=dbo dotnet ef migrations script --idempotent \
  --context LookupsAdminDbContext \
  -o ../../../docs/db-migration/sql/02_build_dbo_schema_lookups.sql

# 3) ApplicantGradesAdminDbContext  → 4 grade tables + __EFMigrationsHistory_ApplicantGradesAdmin
ADMIN_DB_SCHEMA=dbo dotnet ef migrations script --idempotent \
  --context ApplicantGradesAdminDbContext \
  -o ../../../docs/db-migration/sql/02_build_dbo_schema_grades.sql

# 4) IdentityApplicantAdminDbContext  → applicants + __EFMigrationsHistory_IdentityApplicant
ADMIN_DB_SCHEMA=dbo dotnet ef migrations script --idempotent \
  --context IdentityApplicantAdminDbContext \
  -o ../../../docs/db-migration/sql/02_build_dbo_schema_identity.sql
```

> If the EF scripts are generated once and committed, the operator does **not** need the
> .NET SDK and can skip straight to 1.3.
>
> **Drift caveat for the AdminDbContext script:** `20260525120424_AddApplicantPortal`
> hardcodes `admin_v2` for `applicant_portal_records` / `exam_slots`, and
> `20260526194218_PendingModelChanges` encodes the schema-rename. Apply the Phase 4 code
> fix **before** generating these scripts (preferred) so the generated SQL targets `dbo`
> cleanly. If you generate first, inspect `02_build_dbo_schema_admin.sql` for any literal
> `admin_v2` / `PACademy_staging_db` and replace with `dbo` before running, and make sure
> **no** rename step survives. (Phase 4 documents the source fix.)

### 1.3 Build `dbo` in BOTH new databases

Run all four scripts against **each** new DB (8 executions). Order within a DB:
AdminApi first (it owns the bulk and the shared `lookup_rows`), then the three modules.

```bash
for DB in DB_PAcademy_Prod DB_PAcademy_Staging; do
  for F in admin lookups grades identity; do
    sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' -d "$DB" \
      -i "docs/db-migration/sql/02_build_dbo_schema_${F}.sql"
  done
done
```

> **GATE 1:** both DBs contain all 30 application tables under `dbo`
> (24 AdminApi + `faculties` + 4 grade + `applicants`) plus the four
> `__EFMigrationsHistory_*` tables, each populated with its migration ids, and the five
> real FKs exist. Spot-check with `sql/05_validate.sql` (structural rows only — counts
> will be zero before Phase 2).

**ROLLBACK (Phase 1):** run `sql/06_rollback.sql` (drops `[DB_PAcademy_Prod]` and
`[DB_PAcademy_Staging]`). The live `[PACademy]` DB and its two schemas are untouched —
nothing has been cut over, so the system keeps running on the old layout.

---

## Phase 2 — DATA  `DESTRUCTIVE / REQUIRES APPROVAL`

**Goal:** copy data from each live schema into the matching new DB's `dbo`, then force
lookup/config parity, then confirm migration history is seeded. Run off-hours, ideally
immediately after Phase 1.

> Destructive because `sql/03_migrate_data.sql` writes into the target DBs (it
> truncates/repopulates target tables to be re-runnable). It only **reads** the live
> `[PACademy]` schemas.

### 2.1 Copy PROD data (`admin_v2` → `DB_PAcademy_Prod.dbo`)

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' -d PACademy \
  -i docs/db-migration/sql/03_migrate_data.sql \
  -v SourceSchema="admin_v2" TargetDb="DB_PAcademy_Prod"
```

### 2.2 Copy STAGING data (`PACademy_staging_db` → `DB_PAcademy_Staging.dbo`)

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' -d PACademy \
  -i docs/db-migration/sql/03_migrate_data.sql \
  -v SourceSchema="PACademy_staging_db" TargetDb="DB_PAcademy_Staging"
```

`03_migrate_data.sql` rules (enforced inside the script):
- **Excludes `row_version`** (and any computed column) from every `INSERT ... SELECT` —
  SQL Server rejects explicit inserts into a `rowversion` column. 23 of 24 AdminApi
  tables plus all module tables carry one; only `officer_directory` does not.
- **Excludes the four `__EFMigrationsHistory_*` tables** — history is seeded by the EF
  scripts in Phase 1, not copied (copying would risk duplicate/again-applied rows).
- **Disables target FK constraints** (`NOCHECK CONSTRAINT ALL`) for the load so table
  order is irrelevant, then re-enables `WITH CHECK` and re-validates afterward.
- **Module tables need a separate `dbo` pass.** The six module-context tables
  (`faculties`, `applicants`, `applicant_grades`, `applicant_grade_adjustments`,
  `grade_import_batches`, `grade_import_rows`) live in `[PACademy].[dbo]`, not under the
  env schema, so the admin-schema pass (2.1 / 2.2) does not see them. Run `03` again with
  `@SourceSchema=dbo` into EACH target DB — the four passes are listed in the `03` header:
  pass 2 = `dbo`→`DB_PAcademy_Prod`, pass 4 = `dbo`→`DB_PAcademy_Staging`. (Railway points
  both admin services' `ConnectionStrings__Default` at `Database=PACademy`, so the module
  tables resolve to `[PACademy].[dbo]`; confirm via `00_live_inventory_scan.sql`.)
- For staging, tolerates **missing** `applicant_portal_records` / `exam_slots` /
  `general_settings` (the documented drift): if a source table is absent, the target is
  left empty (it will be re-seeded/created on first boot or by Phase 2.3 for config).

### 2.3 Force lookup/configuration parity (Prod → Staging)

The lookup and configuration plane **must be identical** across the two DBs. Transactional
volume may differ; lookups/config may not. Run after both data copies:

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' \
  -i docs/db-migration/sql/04_sync_lookup_config.sql \
  -v SourceDb="DB_PAcademy_Prod" TargetDb="DB_PAcademy_Staging"
```

`04_sync_lookup_config.sql` overwrites these target tables from the source (still
excluding `row_version`):
- **Lookup:** `lookup_rows` (25 keys / 427 rows canonical), `faculties` (18).
- **Configuration:** `admission_cycles`, `applicant_categories`, `admission_rules`,
  `application_settings_category_configs`, `application_settings_category_specializations`,
  `application_settings_graduation_years`, `general_settings` (the single
  `Id='settings'` row — it is **not** seeded by any seeder, so it must be copied
  explicitly), `exams` (+`exam_rules`, `exam_question_links`), `exam_questions`
  (+`exam_question_options`, `exam_question_matching_pairs`).
- **Identity/permissions:** `roles` (8 cloud roles). `users` / `officer_directory`
  bootstrap rows are carried by the Phase 2.1/2.2 data copy; admin-created users that
  exist only in prod are preserved because prod runs `SkipMigrationsAndSeed=true` (the
  destructive non-bootstrap purge never runs in prod).

> The canonical lookup/config data is sourced from **live prod**, not the repo seeders —
> the repo seed JSON was emptied (commit `a47605d`) and a fresh boot would not reproduce
> it. Do **not** "fix" parity by re-running the application seeders.

### 2.4 Confirm migration history is present

The services run with `SkipMigrationsAndSeed=true` (the project's **manual-apply**
pattern: humans apply schema via scripts; the app does not auto-migrate at boot). The
idempotent EF scripts from Phase 1 already wrote the `__EFMigrationsHistory_*` rows.
Verify each of the four history tables in **both** DBs has its expected migration ids:

```sql
-- run in each of DB_PAcademy_Prod and DB_PAcademy_Staging
SELECT 'AdminApi' AS ctx, "MigrationId" FROM dbo.[__EFMigrationsHistory_AdminApi]
UNION ALL SELECT 'Lookups',  "MigrationId" FROM dbo.[__EFMigrationsHistory_LookupsAdmin]
UNION ALL SELECT 'Grades',   "MigrationId" FROM dbo.[__EFMigrationsHistory_ApplicantGradesAdmin]
UNION ALL SELECT 'Identity', "MigrationId" FROM dbo.[__EFMigrationsHistory_IdentityApplicant]
ORDER BY ctx, "MigrationId";
```

Expected: AdminApi = the 7 AdminApi migrations
(`20260521200238_InitialAdminSchema` … `20260530114800_AddGeneralSettingsTable`),
Lookups = `20260520113946_InitialLookups`, Grades = `20260521011646_InitialApplicantGrades`,
Identity = `20260521092833_InitialIdentityApplicant`.

> **GATE 2:** both DBs hold the copied data; `sql/04_sync_lookup_config.sql` has run; all
> four history tables are populated in both DBs. Lookup/config counts should already match
> between the two DBs (validated formally in Phase 3).

**ROLLBACK (Phase 2):** re-run `sql/03_migrate_data.sql` (it is idempotent) to redo a bad
copy, **or** run `sql/06_rollback.sql` to drop both new DBs and start clean. The live
`[PACademy]` schemas remain the system of record until Phase 5, so a Phase 2 failure has
no production impact.

---

## Phase 3 — VALIDATE (structural + record parity)

**Goal:** prove the two new DBs are structurally identical and that lookup/config record
counts match, **before** touching any code or Railway variable.

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' \
  -i docs/db-migration/sql/05_validate.sql \
  -o validate_phase3.txt
```

`sql/05_validate.sql` compares `DB_PAcademy_Prod` vs `DB_PAcademy_Staging` and emits one
row per metric with an `OK` / `MISMATCH` verdict:
- table count, column count, FK count, index count, view count, proc count, function
  count, trigger count;
- per-table record counts for every lookup/configuration table (must match exactly);
- a check that **no** object in either DB lives in a schema other than `dbo`;
- a check that the four `__EFMigrationsHistory_*` tables have matching migration-id sets.

Transcribe the results into `docs/db-migration/04_VALIDATION_REPORT_TEMPLATE.md`.

> **GATE 3:** **every** structural row is `OK` and **every** lookup/config record-count
> row matches. If any row is `MISMATCH`, stop — fix via Phase 2 re-run (or roll back) and
> re-validate. Do not proceed to code/Railway changes on a `MISMATCH`.

**ROLLBACK (Phase 3):** none of itself (read-only). On failure, return to Phase 2's
rollback.

---

## Phase 4 — CODE (non-deploying branch; do NOT push to a deploy branch)

**Goal:** make the source default to `dbo` and remove the schema-rename / hardcoded-schema
drift, on a branch that does **not** auto-deploy. This is committed but **not** pushed to
`staging` or `main` until the Phase 5 cutover is approved (Railway auto-deploys from those
branches).

Changes:
1. **`AdminDbContext.DefaultSchema`** (`backend/admin/PACademy.Admin.Api/Persistence/AdminDbContext.cs:14`):
   `"admin_v2"` → `"dbo"`. This flips every admin table to `dbo` when no
   `Database__Schema`/`ADMIN_DB_SCHEMA` override is set.
2. **`PortalDbContext` fallback**
   (`backend/applicant/PACademy.Applicant.Api/Modules/ApplicantPortal/PortalDbContext.cs:16`):
   `?? "admin_v2"` → `?? "dbo"`. The applicant appsettings carry no `Database:Schema`
   key, so this fallback is what actually drives `applicant_portal_records` / `exam_slots`.
3. **Fix the two drift migrations** so a clean rebuild targets `dbo`:
   - `20260525120424_AddApplicantPortal.cs` — replace the six hardcoded `admin_v2`
     literals (lines 16, 34, 54, 60, 70, 74) so the tables/indexes resolve via the runtime
     schema (i.e. `dbo`).
   - `20260526194218_PendingModelChanges.cs` — the schema-rename `Down()` must not
     reference `admin_v2` / `PACademy_staging_db`.
   - **Preferred alternative:** collapse the chain into a single clean baseline migration
     that targets `dbo` and drop both drift migrations. If you do this, regenerate
     `AdminDbContextModelSnapshot.cs` (its `HasDefaultSchema` and 24 `ToTable(...)` literals
     currently say `PACademy_staging_db`) so EF stops diffing against the staging schema.
4. **Repoint committed connection strings** (real secrets stay only in Railway; these
   committed defaults are the local/baseline values):
   - `backend/admin/.../appsettings.json` — `Database:Schema` `admin_v2` → `dbo` (or
     delete the key); `Default` + `AdminDb` `Database=PACademy_staging_db` →
     `Database=DB_PAcademy_Prod`.
   - `backend/admin/.../appsettings.Development.json` — `Schema` `PACademy_staging_db` →
     `dbo` (or remove); `AdminDb` `Database=PACademy` → `Database=DB_PAcademy_Staging`.
   - `backend/admin/.../appsettings.Uat.json` — `Schema` `PACademy_staging_db` → `dbo`.
   - `backend/applicant/.../appsettings.json` — `Default` `Database=PACademy_staging_db`
     → `Database=DB_PAcademy_Prod`.
   - `backend/applicant/.../appsettings.Development.json` — `Default` `Database=PACademy`
     → `Database=DB_PAcademy_Staging`.
   - `backend/admin/.../AdminDbContextFactory.cs` design-time fallback
     `Database=PACademy_Admin` → `Database=DB_PAcademy_Staging`.
5. **Docs/scripts hygiene** (non-blocking, can trail): update `backend/admin/README.md`
   and `backend/applicant/README.md` to drop the `Database__Schema` schema-switch section;
   mark the legacy `backend/admin/scripts/copy-admin-schema-to-uat-schema.sql` and
   `docs/db/migrations/*.sql` obsolete (they target `PACademy_staging_db`).

Verify the build compiles (`dotnet build backend/admin` / `backend/applicant`). Commit on
the feature branch.

> **GATE 4:** branch builds; changes reviewed; branch is confirmed **not** wired to a
> Railway auto-deploy. **Do not push to `staging` or `main` yet.**

**ROLLBACK (Phase 4):** revert the branch (it never reached a deploy branch, so nothing is
deployed). No live impact.

---

## Phase 5 — RAILWAY CUTOVER  `DESTRUCTIVE / REQUIRES APPROVAL`

**Goal:** point all four services at the new databases under `dbo`, then redeploy. This is
the moment production traffic moves off the old schema layout. Requires explicit approval
(per the project's "present for approval before changes" rule) and the maintenance window.

> Set variables with: `railway variables -s <service> -e production --set "Key=Value"`.
> Mask passwords as `<secret>` in any pasted artifact. After variables are set, redeploy
> each service. Do the **prod** pair and **staging** pair as deliberate, separately-verified
> steps. If the Phase 4 branch is the deploy source, merging/pushing it to the deploy
> branch is part of this gated step.

### 5.1 `pacademy-admin-prod-api` → `DB_PAcademy_Prod` / `dbo`

```bash
railway variables -s pacademy-admin-prod-api -e production --set "Database__Schema=dbo"
railway variables -s pacademy-admin-prod-api -e production \
  --set "ConnectionStrings__AdminDb=Server=34.17.135.245,1433;Database=DB_PAcademy_Prod;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
# the admin module contexts read ConnectionStrings:Default — point it at the SAME db:
railway variables -s pacademy-admin-prod-api -e production \
  --set "ConnectionStrings__Default=Server=34.17.135.245,1433;Database=DB_PAcademy_Prod;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
railway redeploy -s pacademy-admin-prod-api -e production
```

### 5.2 `pacademy-applicant-prod-api` → `DB_PAcademy_Prod` / `dbo`

```bash
railway variables -s pacademy-applicant-prod-api -e production --set "Database__Schema=dbo"
# applicant reads ConnectionStrings:Default for ALL contexts:
railway variables -s pacademy-applicant-prod-api -e production \
  --set "ConnectionStrings__Default=Server=34.17.135.245,1433;Database=DB_PAcademy_Prod;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
railway redeploy -s pacademy-applicant-prod-api -e production
```

> Note: this service has `SkipMigrationsAndSeed=false` and the applicant `Program.cs`
> ignores that flag, so `PortalSeeder.SeedExamSlotsAsync` runs on boot and will seed
> `exam_slots` if empty. Phase 2 should have copied prod's `exam_slots`, so the seeder
> will no-op. If you want to be certain it does not write, confirm `exam_slots` is
> non-empty in `DB_PAcademy_Prod` before redeploy.

### 5.3 `pacademy-admin-staging-api` → `DB_PAcademy_Staging` / `dbo`

```bash
railway variables -s pacademy-admin-staging-api -e production --set "Database__Schema=dbo"
railway variables -s pacademy-admin-staging-api -e production \
  --set "ConnectionStrings__AdminDbUat=Server=34.17.135.245,1433;Database=DB_PAcademy_Staging;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
railway variables -s pacademy-admin-staging-api -e production \
  --set "ConnectionStrings__Default=Server=34.17.135.245,1433;Database=DB_PAcademy_Staging;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
railway redeploy -s pacademy-admin-staging-api -e production
```

> `ASPNETCORE_ENVIRONMENT=Uat` stays (loads `appsettings.Uat.json`);
> `Database__ActiveConnectionName=AdminDbUat` stays. We only changed the schema and where
> `AdminDbUat`/`Default` point.

### 5.4 `pacademy-applicant-staging-api` → `DB_PAcademy_Staging` / `dbo`

```bash
railway variables -s pacademy-applicant-staging-api -e production --set "Database__Schema=dbo"
# IMPORTANT: this service today uses ConnectionStrings__AdminDb, but the applicant code
# reads ConnectionStrings:Default. Switch it to Default → DB_PAcademy_Staging:
railway variables -s pacademy-applicant-staging-api -e production \
  --set "ConnectionStrings__Default=Server=34.17.135.245,1433;Database=DB_PAcademy_Staging;User Id=sa;Password=<secret>;TrustServerCertificate=True;"
railway redeploy -s pacademy-applicant-staging-api -e production
```

> **GATE 5:** all four services redeployed cleanly (no boot crash, no "Connection string
> 'Default' is required" error). Proceed to Phase 6 immediately to confirm correctness.

**ROLLBACK (Phase 5):** revert every variable set above to its Phase-0 value
(`Database__Schema` back to `admin_v2` / `PACademy_staging_db`; connection strings back to
`Database=PACademy`; remove any `ConnectionStrings__Default` you added that did not exist
before — but note the admin module contexts always needed a `Default`, so on rollback set
`ConnectionStrings__Default` back to `Database=PACademy` rather than deleting it) and
redeploy each service. Because the old `[PACademy]` schemas are untouched (Phases 1–2 only
read them), reverting the variables fully restores the prior system. If the deploy branch
was merged, revert that merge too.

---

## Phase 6 — POST-VALIDATE

**Goal:** prove every service is on the new DB under `dbo`, do a read+write smoke per
service, re-run structural validation, and confirm no `admin_v2` / `PACademy_staging_db` /
`Database=PACademy` reference remains.

### 6.1 `/health/db` on the two admin services

The admin `Program.cs` exposes `GET /health/db`, returning `schema`, `connectionName`,
`database`, and `skipMigrationsAndSeed`. (The applicant service has no `/health/db` — use
the functional smoke in 6.2 for it.)

```bash
curl -s https://<pacademy-admin-prod-api-url>/health/db    | jq
curl -s https://<pacademy-admin-staging-api-url>/health/db | jq
```

Expect for prod-admin: `"schema":"dbo"`, `"connectionName":"AdminDb"`, `"database":1`
(the `SELECT 1` probe); for staging-admin: `"schema":"dbo"`,
`"connectionName":"AdminDbUat"`, `"database":1`. Any `"schema":"admin_v2"` or
`"...staging_db"` means the variable did not take — go to Phase 5 rollback for that
service.

### 6.2 Smoke test login + a read + a write per service

- **Admin (prod & staging):** log in with the bootstrap super_admin
  (`superadmin` / `<seeded-password>`); **read** a lookups list and the cycles list
  (confirms `lookup_rows` / `admission_cycles` resolve under `dbo`); **write** a
  no-harm edit (e.g. PATCH `/admin/settings` — also confirms the `general_settings`
  singleton path works, the one that previously broke on staging).
- **Applicant (prod & staging):** run an MOI-login flow (read projection of
  `applicants` / `faculties` / `applicant_grades` under `dbo`) and a portal **write**
  (reserve an exam slot → increments `exam_slots.reserved`, exercising
  `PortalDbContext` under the new schema). `backend/admin/scripts/smoke-admin-api.sh`
  can drive the admin HTTP surface against each environment URL.

### 6.3 Re-run structural validation

```bash
sqlcmd -S 34.17.135.245,1433 -U sa -P '<secret>' \
  -i docs/db-migration/sql/05_validate.sql -o validate_phase6.txt
```

All structural rows `OK`; lookup/config counts still match between the two DBs.

### 6.4 Confirm no stale references

```bash
# repo: no service config should still name the old schema or the old db
grep -rn "admin_v2\|PACademy_staging_db\|Database=PACademy\b" \
  backend/admin backend/applicant --include="appsettings*.json" || echo "clean"
```

```bash
# railway: dump each service's vars and eyeball Database__Schema + the conn string
for S in pacademy-admin-prod-api pacademy-applicant-prod-api \
         pacademy-admin-staging-api pacademy-applicant-staging-api; do
  echo "== $S =="; railway variables -s "$S" -e production
done
```

None should show `Database__Schema=admin_v2`, `Database__Schema=PACademy_staging_db`, or a
connection string with `Database=PACademy` (mask the password when capturing).

> **GATE 6 (done):** both admin `/health/db` report `schema=dbo` + the correct DB; all four
> smoke tests (login + read + write) pass; `sql/05_validate.sql` is all-`OK`; no stale
> `admin_v2` / `PACademy_staging_db` / `Database=PACademy` reference in repo configs or
> Railway vars. Migration complete.

**ROLLBACK (Phase 6):** if any check fails, roll back via Phase 5 (revert Railway vars +
redeploy) and, if needed, Phase 2/1 rollback (`sql/06_rollback.sql`). The old schema layout
in `[PACademy]` remains intact and authoritative until you are satisfied; only after a
clean Phase 6 should the old `admin_v2` / `PACademy_staging_db` schemas be retired (keep
the Phase 0 backup regardless).

---

## Decommissioning (after a clean Phase 6, separate approval)

Once production has run on the new DBs long enough to trust them, retire the old layout:
- Keep the Phase 0 `[PACademy]` backup archived.
- Drop the `[admin_v2]` and `[PACademy_staging_db]` schemas (or the whole `[PACademy]` DB)
  only on a fresh, explicit approval — this is irreversible without the backup.
- Remove the now-obsolete legacy scripts
  (`backend/admin/scripts/copy-admin-schema-to-uat-schema.sql`,
  `backend/admin/scripts/copy-admin-db-to-uat.sql`, `docs/db/migrations/*.sql`) or annotate
  them as superseded by this runbook.
