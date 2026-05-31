# Application Reference Updates

> Every in-repo reference to the old topology (`Database=PACademy` / `Database=PACademy_staging_db`, `Database__Schema=admin_v2` / `=PACademy_staging_db`, and the `admin_v2` code defaults) that must change for the env-separation migration. Grouped by category as a checklist. All passwords are masked as `Password=<from-railway-secret>`; the real `sa` password currently sits in committed `appsettings*.json` and Railway secrets — see the **Secret-leak** note at the end.
>
> Scope note: general migration `*.Designer.cs` / `*ModelSnapshot.cs` files also contain `admin_v2` / `PACademy_staging_db` literals but are **design-time scaffold artifacts** — they regenerate automatically when the chain is rebaselined (recommended) and are excluded here, **except** the two operative `Up/Down` migration files explicitly flagged as drift.

---

## Category: `schema-config` (the `Database:Schema` key)

| ☐ | File | Line | Current | Proposed |
|---|---|---|---|---|
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.json` | 4 | `"Schema": "admin_v2"` | `"dbo"` — or delete the `Database.Schema` key entirely so `AdminDbContext.DefaultSchema="dbo"` applies |
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.Development.json` | 4 | `"Schema": "PACademy_staging_db"` | `"dbo"` — or remove the key so the `dbo` default applies for local dev |
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.Uat.json` | 4 | `"Schema": "PACademy_staging_db"` | `"dbo"` — UAT/staging now uses a separate DB under `dbo`; the `ConnectionStrings__AdminDbUat` secret must point at `DB_PAcademy_Staging` |

**Plus Railway env vars (not in repo, listed for completeness):** remove `Database__Schema` from all four services (`pacademy-admin-prod-api` `admin_v2`; `pacademy-admin-staging-api`, `pacademy-applicant-prod-api`, `pacademy-applicant-staging-api` — the staging/applicant ones carry `PACademy_staging_db`/`admin_v2`). See `03_ENVIRONMENT_MAPPING.md` §(c).

## Category: `connection-string` (committed `appsettings*.json`)

| ☐ | File | Line | Current | Proposed |
|---|---|---|---|---|
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.json` | 7 | `"Default": "Server=34.17.135.245,1433;Database=PACademy_staging_db;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Prod` (committed baseline = PROD; Railway overrides per-service). Server IP unchanged unless host moves |
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.json` | 8 | `"AdminDb": "Server=34.17.135.245,1433;Database=PACademy_staging_db;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Prod` — `AdminDb` is the **prod** connection key; this committed default currently wrongly points at the staging DB. Real secret stays only in Railway |
| ☐ | `backend/admin/PACademy.Admin.Api/appsettings.Development.json` | 7 | `"AdminDb": "Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Staging` — local dev targets the dedicated staging DB, not the legacy single `[PACademy]`. Use a developer-local secret, not the live `sa` password |
| ☐ | `backend/applicant/PACademy.Applicant.Api/appsettings.json` | 10 | `"Default": "Server=34.17.135.245,1433;Database=PACademy_staging_db;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Prod` (committed baseline = prod; Railway overrides `ConnectionStrings__Default` per service). Applicant has no `Schema` key — relies on `PortalDbContext` default |
| ☐ | `backend/applicant/PACademy.Applicant.Api/appsettings.Development.json` | 3 | `"Default": "Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Staging` — local-dev applicant against the staging DB; developer-local secret |

## Category: `code-default` (C# defaults + the two drift migrations)

| ☐ | File | Line | Current | Proposed |
|---|---|---|---|---|
| ☐ | `backend/admin/PACademy.Admin.Api/Persistence/AdminDbContext.cs` | 14 | `public const string DefaultSchema = "admin_v2";` | `"dbo"` — canonical code default for **all** admin EF tables (shared `ToTable()` calls inherit it via `HasDefaultSchema(Schema)`). Flips every admin table to `dbo` when no `Database.Schema` override is set |
| ☐ | `backend/applicant/PACademy.Applicant.Api/Modules/ApplicantPortal/PortalDbContext.cs` | 16 | `private string Schema => configuration["Database:Schema"] ?? "admin_v2";` | `?? "dbo"` — applicant appsettings carry **no** `Database.Schema` key, so this fallback is what the applicant actually uses for `applicant_portal_records` / `exam_slots`. Must become `dbo` |
| ☐ | `backend/admin/PACademy.Admin.Api/Persistence/AdminDbContextFactory.cs` | 24 | `?? "Server=localhost;Database=PACademy_Admin;Trusted_Connection=True;TrustServerCertificate=True",` | `Database=DB_PAcademy_Staging` — design-time `dotnet ef` fallback; align the placeholder DB name so stray EF tooling doesn't create a `PACademy_Admin` db. Schema now resolves to `dbo` via `DefaultSchema` |
| ☐ | `backend/admin/PACademy.Admin.Api/Persistence/Migrations/20260525120424_AddApplicantPortal.cs` | 16, 34, 54, 60, 70, 74 | `schema: "admin_v2"` (CreateTable / CreateIndex / DropTable for `applicant_portal_records` + `exam_slots`) | **DRIFT** — hardcodes `admin_v2` instead of the runtime `Schema`, so on staging these tables were created in the wrong/missing schema. Fix-forward: **regenerate a clean `dbo` baseline** (recommended), or hand-edit these 6 literals to `dbo`. Operator must verify both tables land in `dbo` |
| ☐ | `backend/admin/PACademy.Admin.Api/Persistence/Migrations/20260526194218_PendingModelChanges.cs` | 13 (+ 20–104) | `Up()` no-op; `Down()` `EnsureSchema admin_v2` + 14× `RenameTable PACademy_staging_db -> admin_v2` | **DRIFT** — encodes the schema-rename anti-pattern. Target topology has **no** schema rename (both DBs use `dbo`). Recommended: collapse the chain into one clean `dbo` baseline and **remove** this migration. If kept, its `Down()` must not reference `admin_v2`/`PACademy_staging_db`. **Operator must NOT run any schema-rename step** |

## Category: `script` (operator SQL / shell)

| ☐ | File | Line | Current | Proposed |
|---|---|---|---|---|
| ☐ | `backend/admin/scripts/copy-admin-schema-to-uat-schema.sql` | 1 | `:setvar SourceSchema "admin_v2"` / `:setvar TargetSchema "PACademy_staging_db"` | **OBSOLETE** under target topology — the env split is now DB-to-DB, not schema-to-schema. Rewrite as a cross-**database** structural sync (`DB_PAcademy_Prod.dbo` → `DB_PAcademy_Staging.dbo`, still excluding `rowversion`/computed columns), or retire it |
| ☐ | `backend/admin/scripts/copy-admin-schema-to-uat-schema.sql` | 46 | `AND source_table.name <> N'__EFMigrationsHistory_AdminApi'` | When rewritten for DB-to-DB sync, also exclude the other three history tables (`__EFMigrationsHistory_LookupsAdmin`, `_ApplicantGradesAdmin`, `_IdentityApplicant`) so the structural copy does not corrupt per-context migration history |
| ☐ | `backend/admin/scripts/copy-admin-db-to-uat.sql` | 1 | `:setvar SourceDb "PACademy_Admin"` / `:setvar TargetDb "PACademy_Admin_UAT"` | Repoint: `SourceDb=DB_PAcademy_Prod`, `TargetDb=DB_PAcademy_Staging` (and update `SourceLogicalDataName`/`SourceLogicalLogName` + mdf/ldf paths, lines ~4–7, 18–21). Backup/restore is the right tool for the new DB-to-DB topology; only names change |
| ☐ | `backend/admin/scripts/smoke-admin-api.sh` | 4 | `BASE_URL="${1:-http://localhost:5101}"` | **No change required** — DB-agnostic HTTP smoke. Listed for completeness; re-run post-migration against each environment URL to validate seeded rows landed in the new `dbo` DBs |
| ☐ | `docs/db/migrations/20260526_create_staging_normalized_from_admin_records.sql` | 5 | `Create staging-owned normalized tables in [PACademy_staging_db]` … backfill from `[PACademy_staging_db].[admin_records]` | One-off normalization script hardcoding `[PACademy_staging_db]`. Rewrite all object names to `[dbo].[*]` (run inside the target DB), or retire if superseded by the clean rebuild. Operator must not run it against a `PACademy_staging_db` schema that no longer exists |
| ☐ | `docs/db/migrations/20260526_full_normalize_admin_records_staging.sql` | 5 | `Convert all active PACademy_staging_db.admin_records … into real PACademy_staging_db SQL tables.` | Rewrite `[PACademy_staging_db]` → `[dbo]` (run within the target DB), or retire if superseded. `ROWVERSION` exclusion still applies on any data copy |
| ☐ | `docs/db/migrations/20260526_normalize_admin_records_to_dbo_review.sql` | 5 | `Normalize valid live PACademy_staging_db.admin_records applicant/grade JSON rows` (source `[PACademy_staging_db].[admin_records]`; target `dbo`) | Update the **source** prefix `[PACademy_staging_db]` → `[dbo]` (everything is one `dbo` DB now). Already writes to `dbo` targets — closest to the target shape; retire if the clean rebuild supersedes it |

## Category: `docs` (READMEs, comments, analysis docs)

| ☐ | File | Line | Current | Proposed |
|---|---|---|---|---|
| ☐ | `backend/admin/README.md` | 377 | `export Database__Schema=PACademy_staging_db` | Remove the `Database__Schema` override (target uses `dbo`). Rewrite the whole "UAT database copy and switching" section (~371–434) for separate-DB topology |
| ☐ | `backend/admin/README.md` | 378 | `export ConnectionStrings__AdminDbUat='Server=...;Database=PACademy_Admin_UAT;...'` | `Database=DB_PAcademy_Staging` on connection key `AdminDbUat` |
| ☐ | `backend/admin/README.md` | 385 | `` - `Database__Schema` or `ADMIN_DB_SCHEMA` selects the SQL Server schema, for example `admin_v2` or `PACademy_staging_db`. `` | Document that schema is now always `dbo`; env separation is by **database** (`DB_PAcademy_Prod` vs `DB_PAcademy_Staging`) via the connection string. Leave `Database__Schema`/`ADMIN_DB_SCHEMA` unset (defaults to `dbo`) |
| ☐ | `backend/admin/README.md` | 411 | `Database__Schema=PACademy_staging_db \` | Drop this line from the example (no per-env schema). Example should set `ConnectionStrings__AdminDbUat` → `DB_PAcademy_Staging` only |
| ☐ | `backend/admin/README.md` | 416 | `Stop the backend after migrations create the PACademy_staging_db schema, then copy current data from admin_v2:` | Rewrite: there is no per-env schema creation. Staging is a separate DB synced structurally from prod (`dbo`). Replace the "separate UAT schema" section with the separate-DB procedure |
| ☐ | `backend/admin/README.md` | 421 | `-v SourceSchema=admin_v2 TargetSchema=PACademy_staging_db` | Replace with the DB-to-DB sync invocation (`SourceDb=DB_PAcademy_Prod TargetDb=DB_PAcademy_Staging`, `dbo` on both) |
| ☐ | `backend/admin/README.md` | 424 | `Run the UAT backend … `Database__Schema=PACademy_staging_db`, and its own CORS origins.` | Drop `Database__Schema=PACademy_staging_db`; keep `ASPNETCORE_ENVIRONMENT=Uat` + `Database__ActiveConnectionName=AdminDbUat` (resolves to `DB_PAcademy_Staging` via the connection string) |
| ☐ | `backend/admin/README.md` | 329 | `"Default": "Server=...;Database=PACademy;User Id=...;Password=...;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Prod` (or `DB_PAcademy_Staging` for the staging example). Placeholder doc string |
| ☐ | `backend/applicant/README.md` | 214 | `"Default": "Server=...;Database=PACademy;User Id=...;Password=...;TrustServerCertificate=True;"` | `Database=DB_PAcademy_Prod` (prod) / `DB_PAcademy_Staging` (staging). Note applicant inherits `dbo` (no `Database.Schema`) |
| ☐ | `frontend/.env.local` | 6 | `#   staging DB (PACademy_staging_db @ 34.17.135.245):` | Comment only (no runtime effect). Update to `staging DB (DB_PAcademy_Staging @ <server>)`. Frontend has no other DB/schema wiring |
| ☐ | `docs/backend-context-handoff-2026-05-21/Users/mac/Downloads/Backend-STATUS (1).md` | 13 | `- **Shared SQL Server**: `34.17.135.245,1433 / PACademy`. Both backends connect to it.` | Update topology: two databases (`DB_PAcademy_Prod`, `DB_PAcademy_Staging`), `dbo` schema. Historical snapshot — annotate as superseded rather than silently editing |
| ☐ | `docs/db/data-model-inventory-and-normalization-options.md` | 18, 19, 26, 27, 42, 82, 111 | `Active admin schema … PACademy_staging_db` / `default code schema is admin_v2 …` | Update to `dbo`-on-separate-DBs, or annotate as a **pre-migration** snapshot of the old drifted DB |
| ☐ | `docs/db/staging-admin-records-normalization-audit.md` | 12, 13, 20, 75, 95, 131, 181, 191 | `Active admin schema: PACademy_staging_db` / `Parallel admin schema also present: admin_v2` | Keep as historical evidence (documents both duplicate schemas — direct runbook input) but annotate that the target collapses both to a single `dbo` per separate DB |
| ☐ | `docs/db/applicants-grades-perf-audit.md` | 7, 27, 29, 231, 340, 351, 365, 378, 394 | `active UAT configuration points EF to schema PACademy_staging_db, not the code default admin_v2 …` | Pre-migration audit; queries `[PACademy_staging_db].[admin_records]`. Under target these become `[dbo].[admin_records]`. Annotate as pre-migration; update schema prefixes to `dbo` if re-run |
| ☐ | `docs/db/full-admin-records-normalization-plan.md` | 13, 45–48, 58–63, 68, 77, 128 | `Live active modules in PACademy_staging_db.admin_records:` (+ many `PACademy_staging_db.<table>` refs) | If still relevant post-migration, retarget all `PACademy_staging_db.<table>` → `dbo.<table>`. Otherwise mark superseded |
| ☐ | `docs/db/staging-admin-records-normalization-status.md` | 9 | `Schema: PACademy_staging_db` | `dbo`, or mark pre-migration |
| ☐ | `docs/db/staging-admin-records-reconciliation-report.md` | 9, 137, 156 | `Active source JSON: PACademy_staging_db.admin_records` | `dbo.admin_records` in the relevant DB, or annotate as pre-migration |

---

## By the numbers

| Category | Reference count | Files touched |
|---|---|---|
| `schema-config` | 3 | 3 (`appsettings.json`, `appsettings.Development.json`, `appsettings.Uat.json` — admin) |
| `connection-string` | 5 | 4 (2 admin appsettings, 2 applicant appsettings) |
| `code-default` | 5 | 5 (`AdminDbContext.cs`, `PortalDbContext.cs`, `AdminDbContextFactory.cs`, + 2 drift migrations) |
| `script` | 7 | 7 (3 `backend/admin/scripts/*`, including 1 no-change smoke; 3 `docs/db/migrations/*.sql`; 1 cross-listed) |
| `docs` | 18 | 9 (2 backend READMEs, 1 frontend `.env.local`, 1 handoff status, 5 `docs/db/*` analysis docs) |
| **Total** | **38** | **~28 distinct files** |

> Per-category line entries map 1:1 to `inventory.refInv.references`; some files appear in more than one row because multiple lines change. The `script` count includes `smoke-admin-api.sh` (intentionally no-change, listed for completeness) and treats the three `backend/admin/scripts/*` plus three `docs/db/migrations/*.sql` files; the two-line entry for `copy-admin-schema-to-uat-schema.sql` (lines 1 and 46) is one file.

## Secret-leak note (act on during cutover)

The committed `appsettings.json` (admin line 7/8) and `appsettings.json` (applicant line 10), plus `appsettings.Development.json` for both services, currently contain the **real live `sa` password in plaintext**. They are masked as `Password=<from-railway-secret>` throughout these reports. As part of this migration: (1) scrub real passwords out of committed config (use empty strings filled by Railway, as `appsettings.Uat.json`/`appsettings.Production.json` already do); (2) **rotate the `sa` password** after cutover since it was committed; (3) keep the only live copy in Railway secrets.

---

## Cutover ordering — DO NOT deploy code before the databases exist

The code `DefaultSchema` change and the `appsettings` changes above **must not** be deployed before the new databases exist and data has been migrated. A premature deploy would point a running service at a `dbo` schema (or a `DB_PAcademy_*` database) that has no tables yet, breaking prod/staging. Execute in this order:

1. **Build the structure first.** Create `DB_PAcademy_Prod` and `DB_PAcademy_Staging`. Build all 30 application tables + 5 real FKs + every index under `dbo` in each (canonical = current PROD `admin_v2` shape rebuilt under `dbo`). Recommended: a clean rebaselined `dbo` migration, or an operator CREATE script.
2. **Seed the four `__EFMigrationsHistory_*` tables** in each new DB with the applied migration ids (see `01_INVENTORY.md` → *Applied migration ids*) — or the single new baseline id if rebaselined — so EF treats each DB as up-to-date and the boot migrator is a no-op.
3. **Copy data**, excluding `row_version` from every `INSERT...SELECT` (only `officer_directory` is safe to copy whole):
   - **Prod** ← current `admin_v2` (+ the `dbo` module tables) into `DB_PAcademy_Prod.dbo`. For the duplicate `users`, take the `admin_v2` copy. Verify `applicant_portal_records`/`exam_slots`/`general_settings` exist before copy.
   - **Staging** ← structural sync of lookup/config/identity from prod (`lookup_rows`, `faculties`, `roles`, `officer_directory`, `users`, `admission_cycles`/`rules`/`applicant_categories`, `application_settings_*`, `exams`/`exam_questions`/children, `general_settings`) + staging transactional rows where they exist, into `DB_PAcademy_Staging.dbo`.
4. **Verify** row counts and key invariants against `00_live_inventory_scan.sql` output (single active cycle, 25 lookup keys / 427 rows, 8 roles, 1 bootstrap super_admin, etc.).
5. **Only now deploy the code + config changes.** Ship `DefaultSchema="dbo"` (`AdminDbContext.cs`) + `PortalDbContext` fallback `"dbo"` + the appsettings retargets, and update Railway vars per `03_ENVIRONMENT_MAPPING.md` §(c): remove `Database__Schema` on all four services, repoint connection strings to the new DB names, and **add `ConnectionStrings__Default`** on both admin services (else the three module contexts throw at startup).
6. **Post-deploy guard:** keep `SkipMigrationsAndSeed=true` on the admin services so the boot migrator doesn't re-run; decide whether to pre-populate `exam_slots` so the applicant `PortalSeeder` (which ignores `SkipMigrationsAndSeed`) doesn't seed demo rows into prod. Smoke-test each service URL, then scrub + rotate the leaked `sa` password.
