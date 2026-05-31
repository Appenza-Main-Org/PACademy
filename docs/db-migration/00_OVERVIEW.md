# PACademy DB Environment Separation — Overview

> Status: planning / pre-execution. No live-DB or Railway changes have been made.
> This document is the entry point for the environment-separation migration. Read it
> before running any script in `docs/db-migration/sql/`.

---

## 1. The problem

Today, PROD and STAGING are **not separate databases** — they are two SQL **schemas**
inside one physical database:

```
SQL Server  34.17.135.245,1433   (login: sa)
└── database [PACademy]
    ├── schema [admin_v2]              ← PROD application objects
    └── schema [PACademy_staging_db]   ← STAGING application objects
```

This is the anti-pattern we are removing. A schema name must never encode an
environment or a version (`admin_v2`, `*_staging_db`). The consequences of the
current layout are real and already biting:

- **Duplicate `[users]` table** exists in **both** schemas (drift).
- Migration `20260525120424_AddApplicantPortal` **hardcodes** `admin_v2`, so
  `applicant_portal_records` / `exam_slots` may be missing or mis-schema'd on staging.
- Migration `20260526194218_PendingModelChanges` **renames** tables
  `PACademy_staging_db` → `admin_v2` (the rename anti-pattern, baked into the chain).
- The applicant service only steers **two** of its eight tables by `Database__Schema`
  (`applicant_portal_records`, `exam_slots` via `PortalDbContext`); the other six
  resolve to `dbo` regardless — so on the schema-segregated DB the applicant service
  is half-pointed at the env schema and half at `dbo`.

The admin service runs **four** EF Core DbContexts, each with its own migrations
history table:

| DbContext | History table | Tables it owns |
|---|---|---|
| `AdminDbContext` | `__EFMigrationsHistory_AdminApi` | 24 core tables |
| `LookupsAdminDbContext` | `__EFMigrationsHistory_LookupsAdmin` | `faculties` |
| `ApplicantGradesAdminDbContext` | `__EFMigrationsHistory_ApplicantGradesAdmin` | `applicant_grades`, `applicant_grade_adjustments`, `grade_import_batches`, `grade_import_rows` |
| `IdentityApplicantAdminDbContext` | `__EFMigrationsHistory_IdentityApplicant` | `applicants` |

Only `AdminDbContext` pins its schema via `HasDefaultSchema(...)` (default
`admin_v2`). The three module contexts set **no** schema — their tables already
land in the connection login's default schema (`dbo`). The applicant service owns
**no** DDL (every context is `NO MigrationsAssembly`; admin owns all DDL).

---

## 2. The target

Two **separate databases**, each a single clean `dbo` schema, structurally identical:

```
[DB_PAcademy_Prod].[dbo]      ← pacademy-admin-prod-api    + pacademy-applicant-prod-api
[DB_PAcademy_Staging].[dbo]   ← pacademy-admin-staging-api + pacademy-applicant-staging-api
```

- **Canonical structure** = the current PROD schema (`admin_v2`) rebuilt cleanly under
  `dbo`, plus the three module contexts' tables (which already default to `dbo`).
- **Staging** is a synchronized **structural** copy of prod. Lookup and configuration
  data is identical across the two DBs; only transactional volume may differ.
- All four EF history tables are reproduced under `dbo` in each DB so the apps treat
  the database as fully migrated (the services run with `SkipMigrationsAndSeed=true`,
  i.e. manual-apply — see RUNBOOK Phase 2).

### Why this is mostly an `AdminDbContext` + config problem

The cleanup concentrates on `AdminDbContext` (it hardcodes `admin_v2` and has
`PACademy_staging_db` baked into its snapshot) and on the two drift migrations. The
three module contexts already emit schema-less migrations, so they rebuild cleanly
under `dbo` with **no code change**. The runbook's data-sync steps source the
**canonical lookup/config data from live PROD** (`admin_v2`), not from the repo
seeders — the repo seed JSON was emptied (commit `a47605d`) and a fresh boot would
**not** reproduce prod's lookups/cycles (see `01_INVENTORY` / seed notes).

---

## 3. Execution boundary (read this before doing anything)

This migration is authored on a machine that **cannot reach** `34.17.135.245:1433`.
Therefore:

- **Every live-DB step is an operator-run script.** Nothing in this folder connects to
  the database. The artifacts here are SQL scripts + reports that a human operator runs
  later, on a network that is allowed to reach the SQL Server. Do **not** attempt to
  connect to the DB from the authoring environment.
- **Railway changes and `git push` are gated on explicit approval.** Per the project's
  "present for approval before changes" rule, the Railway variable edits (Phase 5) and
  any push to the `staging` / `main` branches are presented for approval first and are
  **not** performed automatically. The code changes (Phase 4) land on a
  **non-auto-deploying** branch and are not pushed to a deploy branch until cutover is
  approved.
- **Destructive phases are flagged.** RUNBOOK Phases **1, 2, and 5** are marked
  `DESTRUCTIVE / REQUIRES APPROVAL`. Each phase carries an explicit ROLLBACK.

---

## 4. Railway services (current state)

Single Railway project **"PA Academy Project"** (id `eadfbf1c-8500-49cb-a53b-0824cdaf72df`),
single environment **`production`**. Passwords in connection strings are masked here as
`Password=<secret>`; the real values live only in the Railway service secrets.

| Service | ASPNETCORE_ENVIRONMENT | Database__Schema | Database__ActiveConnectionName | Connection string `Database=` | SkipMigrationsAndSeed |
|---|---|---|---|---|---|
| `pacademy-admin-prod-api` | `Production` | `admin_v2` | `AdminDb` | `ConnectionStrings__AdminDb` → `Database=PACademy` | `true` |
| `pacademy-admin-staging-api` | `Uat` | `PACademy_staging_db` | `AdminDbUat` | `ConnectionStrings__AdminDbUat` → `Database=PACademy` | `true` |
| `pacademy-applicant-prod-api` | `Production` | `admin_v2` | `AdminDb` | `ConnectionStrings__AdminDb` → `Database=PACademy` | `false` |
| `pacademy-applicant-staging-api` | `Production` | `PACademy_staging_db` | `AdminDb` | `ConnectionStrings__AdminDb` → `Database=PACademy` | `true` |

**Target state after Phase 5 cutover** (set `Database__Schema=dbo` on all four; repoint
each connection string's `Database=` to the matching new DB):

| Service | Database__Schema | Connection string target |
|---|---|---|
| `pacademy-admin-prod-api` | `dbo` | `ConnectionStrings__AdminDb` → `Database=DB_PAcademy_Prod` |
| `pacademy-admin-staging-api` | `dbo` | `ConnectionStrings__AdminDbUat` → `Database=DB_PAcademy_Staging` |
| `pacademy-applicant-prod-api` | `dbo` | `ConnectionStrings__AdminDb` → `Database=DB_PAcademy_Prod` |
| `pacademy-applicant-staging-api` | `dbo` | `ConnectionStrings__Default` → `Database=DB_PAcademy_Staging` |

> Cutover notes baked into the runbook:
> - The applicant service reads `ConnectionStrings:Default` for all four of its
>   contexts (not `AdminDb`). `pacademy-applicant-staging-api` today wrongly uses
>   `ConnectionStrings__AdminDb` + `Database__Schema=PACademy_staging_db` — it must be
>   switched to a `Default` connection string pointing at `DB_PAcademy_Staging`.
> - The three admin **module** contexts open `ConnectionStrings:Default`, not
>   `AdminDb`/`AdminDbUat`. Every admin environment must therefore **also** provide a
>   `ConnectionStrings__Default` pointing at the **same** DB as its AdminDb/AdminDbUat,
>   or those modules throw `Connection string "Default" is required` at startup.
> - `pacademy-applicant-prod-api` has `SkipMigrationsAndSeed=false`, **and** the
>   applicant `Program.cs` ignores that flag — `PortalSeeder.SeedExamSlotsAsync` runs on
>   every boot and re-seeds `exam_slots` if empty. Expect this on first boot against the
>   new prod DB.

---

## 5. Index of `docs/db-migration/`

| Path | What it is |
|---|---|
| `00_OVERVIEW.md` | **This file** — problem, target, execution boundary, Railway tables, index. |
| `01_INVENTORY.md` | Object inventory & migration map (the static, repo-derived inventory of contexts, tables, history tables, and schema literals). |
| `02_DISCOVERED_TABLES.md` | Per-table reference (columns, PKs, FKs, indexes, `row_version`/copy notes) for every migrated table. |
| `03_ENVIRONMENT_MAPPING.md` | Old → new mapping report (schema → DB, per-service config, what changes where). |
| `RUNBOOK.md` | The ordered, gated migration procedure (Phases 0–6) with per-phase ROLLBACK. |
| `04_VALIDATION_REPORT_TEMPLATE.md` | Fill-in Prod-vs-Staging structural + record-count parity report (populated by `sql/05_validate.sql`). |
| `sql/00_live_inventory_scan.sql` | Read-only inventory of the live `[PACademy]` DB across both schemas (Phase 0). |
| `sql/01_create_databases.sql` | Creates `[DB_PAcademy_Prod]` + `[DB_PAcademy_Staging]` (Phase 1). |
| `sql/02_build_dbo_schema_*.sql` | Generated by EF (`dotnet ef migrations script --idempotent`), one per DbContext; builds all `dbo` tables + seeds `__EFMigrationsHistory_*` (Phase 1). |
| `sql/03_migrate_data.sql` | Cross-DB data copy from a source schema into a target DB's `dbo`, excluding `row_version` (Phase 2). |
| `sql/04_sync_lookup_config.sql` | Forces lookup/configuration tables to be identical Prod → Staging (Phase 2). |
| `sql/05_validate.sql` | Structural + record-count parity checks; feeds `04_VALIDATION_REPORT_TEMPLATE.md` (Phase 3 / 6). |
| `sql/06_rollback.sql` | Drops the new DBs / reverts the migration so the old schema-based layout remains authoritative (rollback). |

> The `sql/` scripts above are authored as part of this workstream and live under
> `docs/db-migration/sql/`. They supersede the legacy same-DB cross-schema scripts in
> `backend/admin/scripts/copy-admin-schema-to-uat-schema.sql` and the
> `docs/db/migrations/*.sql` normalization scripts (which target `PACademy_staging_db`
> and are obsolete under the separate-DB topology).

---

## 6. Inputs this plan was built from

- The repo scan inventory (admin / module / applicant / refs / seed sub-inventories).
- `backend/admin/PACademy.Admin.Api/Persistence/AdminDbContext.cs` — schema resolution.
- `backend/admin/PACademy.Admin.Api/Persistence/AdminDatabaseConfiguration.cs` —
  `ADMIN_DB_SCHEMA` / `Database:Schema` and `Database:ActiveConnectionName` order.
- `backend/admin/PACademy.Admin.Api/Program.cs` — the `/health/db` endpoint that the
  cutover validation (Phase 6) asserts on (`schema`, `connectionName`, `database`).
- The four DbContexts' migration files (7 AdminApi + 1 each for the three modules).
- The current Railway per-service variables (from the migration brief, masked here).
