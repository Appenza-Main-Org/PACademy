# Environment Mapping Report (Old → New)

> Maps every object reference, Railway service, and connection string from the **current** shared-DB-with-schemas topology to the **target** separate-databases-single-`dbo`-schema topology. All passwords are masked as `Password=<from-railway-secret>` — the real values live only in Railway secrets and must be copied from there, never from committed `appsettings*.json`.

## (a) Object references

Format: `<currentDB>.<currentSchema>.<table>  ->  <targetDB>.dbo.<table>`. Every application table appears once for **prod** (`admin_v2 → DB_PAcademy_Prod`) and once for **staging** (`PACademy_staging_db → DB_PAcademy_Staging`).

### AdminDbContext tables (currently under the env schema)

```
# --- Production: admin_v2 -> DB_PAcademy_Prod.dbo ---
PACademy.admin_v2.admin_records                                  -> DB_PAcademy_Prod.dbo.admin_records
PACademy.admin_v2.admin_record_documents                        -> DB_PAcademy_Prod.dbo.admin_record_documents
PACademy.admin_v2.admission_cycles                              -> DB_PAcademy_Prod.dbo.admission_cycles
PACademy.admin_v2.admission_rules                               -> DB_PAcademy_Prod.dbo.admission_rules
PACademy.admin_v2.applicant_categories                         -> DB_PAcademy_Prod.dbo.applicant_categories
PACademy.admin_v2.application_settings_category_configs        -> DB_PAcademy_Prod.dbo.application_settings_category_configs
PACademy.admin_v2.application_settings_category_specializations-> DB_PAcademy_Prod.dbo.application_settings_category_specializations
PACademy.admin_v2.application_settings_graduation_years        -> DB_PAcademy_Prod.dbo.application_settings_graduation_years
PACademy.admin_v2.audit_entries                                -> DB_PAcademy_Prod.dbo.audit_entries
PACademy.admin_v2.exams                                        -> DB_PAcademy_Prod.dbo.exams
PACademy.admin_v2.exam_questions                               -> DB_PAcademy_Prod.dbo.exam_questions
PACademy.admin_v2.exam_question_options                        -> DB_PAcademy_Prod.dbo.exam_question_options
PACademy.admin_v2.exam_question_matching_pairs                 -> DB_PAcademy_Prod.dbo.exam_question_matching_pairs
PACademy.admin_v2.exam_rules                                   -> DB_PAcademy_Prod.dbo.exam_rules
PACademy.admin_v2.exam_question_links                          -> DB_PAcademy_Prod.dbo.exam_question_links
PACademy.admin_v2.exam_assignments                             -> DB_PAcademy_Prod.dbo.exam_assignments
PACademy.admin_v2.officer_directory                            -> DB_PAcademy_Prod.dbo.officer_directory
PACademy.admin_v2.roles                                        -> DB_PAcademy_Prod.dbo.roles
PACademy.admin_v2.users                                        -> DB_PAcademy_Prod.dbo.users          # DRIFT: duplicate users also in PACademy_staging_db — keep this prod copy
PACademy.admin_v2.lookup_rows                                  -> DB_PAcademy_Prod.dbo.lookup_rows
PACademy.admin_v2.general_settings                             -> DB_PAcademy_Prod.dbo.general_settings
PACademy.admin_v2.applicant_portal_records                    -> DB_PAcademy_Prod.dbo.applicant_portal_records   # created here by AddApplicantPortal hardcode
PACademy.admin_v2.exam_slots                                  -> DB_PAcademy_Prod.dbo.exam_slots                 # created here by AddApplicantPortal hardcode
PACademy.admin_v2.__EFMigrationsHistory_AdminApi              -> DB_PAcademy_Prod.dbo.__EFMigrationsHistory_AdminApi   # rebuild + seed ids; do not bulk-copy

# --- Staging: PACademy_staging_db -> DB_PAcademy_Staging.dbo ---
PACademy.PACademy_staging_db.admin_records                                  -> DB_PAcademy_Staging.dbo.admin_records
PACademy.PACademy_staging_db.admin_record_documents                        -> DB_PAcademy_Staging.dbo.admin_record_documents
PACademy.PACademy_staging_db.admission_cycles                              -> DB_PAcademy_Staging.dbo.admission_cycles
PACademy.PACademy_staging_db.admission_rules                               -> DB_PAcademy_Staging.dbo.admission_rules
PACademy.PACademy_staging_db.applicant_categories                         -> DB_PAcademy_Staging.dbo.applicant_categories
PACademy.PACademy_staging_db.application_settings_category_configs        -> DB_PAcademy_Staging.dbo.application_settings_category_configs
PACademy.PACademy_staging_db.application_settings_category_specializations-> DB_PAcademy_Staging.dbo.application_settings_category_specializations
PACademy.PACademy_staging_db.application_settings_graduation_years        -> DB_PAcademy_Staging.dbo.application_settings_graduation_years
PACademy.PACademy_staging_db.audit_entries                                -> DB_PAcademy_Staging.dbo.audit_entries
PACademy.PACademy_staging_db.exams                                        -> DB_PAcademy_Staging.dbo.exams
PACademy.PACademy_staging_db.exam_questions                               -> DB_PAcademy_Staging.dbo.exam_questions
PACademy.PACademy_staging_db.exam_question_options                        -> DB_PAcademy_Staging.dbo.exam_question_options
PACademy.PACademy_staging_db.exam_question_matching_pairs                 -> DB_PAcademy_Staging.dbo.exam_question_matching_pairs
PACademy.PACademy_staging_db.exam_rules                                   -> DB_PAcademy_Staging.dbo.exam_rules
PACademy.PACademy_staging_db.exam_question_links                          -> DB_PAcademy_Staging.dbo.exam_question_links
PACademy.PACademy_staging_db.exam_assignments                             -> DB_PAcademy_Staging.dbo.exam_assignments
PACademy.PACademy_staging_db.officer_directory                            -> DB_PAcademy_Staging.dbo.officer_directory
PACademy.PACademy_staging_db.roles                                        -> DB_PAcademy_Staging.dbo.roles
PACademy.PACademy_staging_db.users                                        -> DB_PAcademy_Staging.dbo.users          # DRIFT: duplicate users also in admin_v2 — keep this staging copy
PACademy.PACademy_staging_db.lookup_rows                                  -> DB_PAcademy_Staging.dbo.lookup_rows
PACademy.PACademy_staging_db.general_settings                            -> DB_PAcademy_Staging.dbo.general_settings   # DRIFT: may be MISSING (staging skips auto-migrate) — create then copy from prod
PACademy.PACademy_staging_db.applicant_portal_records                    -> DB_PAcademy_Staging.dbo.applicant_portal_records   # DRIFT: created in admin_v2 — likely missing under this schema; verify
PACademy.PACademy_staging_db.exam_slots                                  -> DB_PAcademy_Staging.dbo.exam_slots                 # DRIFT: created in admin_v2 — likely missing under this schema; verify
PACademy.PACademy_staging_db.__EFMigrationsHistory_AdminApi              -> DB_PAcademy_Staging.dbo.__EFMigrationsHistory_AdminApi   # rebuild + seed ids; do not bulk-copy
```

### Module-context tables (currently under `dbo` already — login default schema)

These six tables + their three history tables do **not** track `Database:Schema` today; they resolve to the `sa` login's default schema (`dbo`). The mapping is therefore a **database split** (one physical `dbo` copy serving both envs → two separate `dbo` copies), not a schema move.

```
# --- Production split: PACademy.dbo -> DB_PAcademy_Prod.dbo ---
PACademy.dbo.faculties                                    -> DB_PAcademy_Prod.dbo.faculties
PACademy.dbo.applicants                                   -> DB_PAcademy_Prod.dbo.applicants
PACademy.dbo.applicant_grades                             -> DB_PAcademy_Prod.dbo.applicant_grades
PACademy.dbo.applicant_grade_adjustments                 -> DB_PAcademy_Prod.dbo.applicant_grade_adjustments
PACademy.dbo.grade_import_batches                         -> DB_PAcademy_Prod.dbo.grade_import_batches
PACademy.dbo.grade_import_rows                            -> DB_PAcademy_Prod.dbo.grade_import_rows
PACademy.dbo.__EFMigrationsHistory_LookupsAdmin          -> DB_PAcademy_Prod.dbo.__EFMigrationsHistory_LookupsAdmin
PACademy.dbo.__EFMigrationsHistory_ApplicantGradesAdmin  -> DB_PAcademy_Prod.dbo.__EFMigrationsHistory_ApplicantGradesAdmin
PACademy.dbo.__EFMigrationsHistory_IdentityApplicant     -> DB_PAcademy_Prod.dbo.__EFMigrationsHistory_IdentityApplicant

# --- Staging split: PACademy.dbo -> DB_PAcademy_Staging.dbo ---
PACademy.dbo.faculties                                    -> DB_PAcademy_Staging.dbo.faculties
PACademy.dbo.applicants                                   -> DB_PAcademy_Staging.dbo.applicants
PACademy.dbo.applicant_grades                             -> DB_PAcademy_Staging.dbo.applicant_grades
PACademy.dbo.applicant_grade_adjustments                 -> DB_PAcademy_Staging.dbo.applicant_grade_adjustments
PACademy.dbo.grade_import_batches                         -> DB_PAcademy_Staging.dbo.grade_import_batches
PACademy.dbo.grade_import_rows                            -> DB_PAcademy_Staging.dbo.grade_import_rows
PACademy.dbo.__EFMigrationsHistory_LookupsAdmin          -> DB_PAcademy_Staging.dbo.__EFMigrationsHistory_LookupsAdmin
PACademy.dbo.__EFMigrationsHistory_ApplicantGradesAdmin  -> DB_PAcademy_Staging.dbo.__EFMigrationsHistory_ApplicantGradesAdmin
PACademy.dbo.__EFMigrationsHistory_IdentityApplicant     -> DB_PAcademy_Staging.dbo.__EFMigrationsHistory_IdentityApplicant
```

> **Discovery caveat:** `ConnectionStrings:Default` in committed `appsettings.json` points at `Database=PACademy_staging_db` — a **database name**, not the `[PACademy]` the brief assumes. The module contexts open `Default`. So these nine objects may physically reside in a database named `PACademy_staging_db` (its `dbo`) rather than in `[PACademy].dbo`. The live scan **must enumerate them across both candidate database names** (`PACademy` and `PACademy_staging_db`) before the copy, and the mapping above should be re-pinned to wherever they are actually found.

## (b) Railway service → target database mapping

Railway project **"PA Academy Project"** (`eadfbf1c-8500-49cb-a53b-0824cdaf72df`), single environment **"production"**. Four services:

| Railway service | Role | Current target (DB / schema) | **New target database** | New schema |
|---|---|---|---|---|
| `pacademy-admin-prod-api` | Admin (prod) | `PACademy` / `admin_v2` | **`DB_PAcademy_Prod`** | `dbo` |
| `pacademy-applicant-prod-api` | Applicant (prod) | `PACademy` / `admin_v2` | **`DB_PAcademy_Prod`** | `dbo` |
| `pacademy-admin-staging-api` | Admin (staging) | `PACademy` / `PACademy_staging_db` | **`DB_PAcademy_Staging`** | `dbo` |
| `pacademy-applicant-staging-api` | Applicant (staging) | `PACademy` / `PACademy_staging_db` | **`DB_PAcademy_Staging`** | `dbo` |

Prod pair → `DB_PAcademy_Prod`; staging pair → `DB_PAcademy_Staging`. In both target DBs the schema is `dbo` for every object.

## (c) Connection-string & env-var mapping per service

The general transformation: **old** `Database=PACademy` (or `PACademy_staging_db`) **+** `Database__Schema=<admin_v2 | PACademy_staging_db>` → **new** `Database=<DB_PAcademy_Prod | DB_PAcademy_Staging>` **+** `Database__Schema` **removed entirely** (so the code default `dbo` applies). Passwords masked.

### `pacademy-admin-prod-api`

| Var | Old value | New value |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` (unchanged) |
| `Database__Schema` | `admin_v2` | **remove** (defaults to `dbo`) |
| `Database__ActiveConnectionName` | `AdminDb` | `AdminDb` (unchanged) |
| `ConnectionStrings__AdminDb` | `Server=34.17.135.245,1433;Database=PACademy;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;` | `Server=34.17.135.245,1433;Database=DB_PAcademy_Prod;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;` |
| `ConnectionStrings__Default` | *(absent)* | **add** = same as `AdminDb` → `...;Database=DB_PAcademy_Prod;...` (required by the 3 module contexts, else startup throws *"Connection string 'Default' is required"*) |
| `SkipMigrationsAndSeed` | `true` | `true` until cutover; flip to `false` only on a controlled deploy so EF applies the clean `dbo` baseline (or pre-build the DB via script and keep `true`) |

### `pacademy-applicant-prod-api`

| Var | Old value | New value |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` (unchanged) |
| `Database__Schema` | `admin_v2` | **remove** (PortalDbContext fallback becomes `dbo`) |
| `Database__ActiveConnectionName` | `AdminDb` | n/a for applicant (it reads `ConnectionStrings:Default`, not `AdminDb`) — leave or remove |
| `ConnectionStrings__AdminDb` | `...;Database=PACademy;...` | the applicant **reads `Default`, not `AdminDb`** — ensure `ConnectionStrings__Default` is set (below); `AdminDb` is inert here |
| `ConnectionStrings__Default` | *(verify which var actually feeds it today)* | `Server=34.17.135.245,1433;Database=DB_PAcademy_Prod;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;` |
| `SkipMigrationsAndSeed` | `false` | **`false` is currently inert** (applicant `Program.cs` ignores it) — but `PortalSeeder.SeedExamSlotsAsync` runs on every boot and seeds `exam_slots` if empty. Decide whether to pre-populate `exam_slots` before first boot so the seeder doesn't write demo rows into prod |

### `pacademy-admin-staging-api`

| Var | Old value | New value |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Uat` | `Uat` (unchanged — loads `appsettings.Uat.json`) |
| `Database__Schema` | `PACademy_staging_db` | **remove** (defaults to `dbo`); also drop the `Schema` key from `appsettings.Uat.json` |
| `Database__ActiveConnectionName` | `AdminDbUat` | `AdminDbUat` (unchanged) |
| `ConnectionStrings__AdminDbUat` | `...;Database=PACademy;...` (staging conn) | `Server=34.17.135.245,1433;Database=DB_PAcademy_Staging;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;` |
| `ConnectionStrings__Default` | *(absent)* | **add** = `...;Database=DB_PAcademy_Staging;...` (required by the 3 module contexts) |
| `SkipMigrationsAndSeed` | `true` | `true` (staging structure is built/synced by script, not by boot migration) |

### `pacademy-applicant-staging-api`

| Var | Old value | New value |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` (unchanged) — note: it does **not** use the `Uat` profile |
| `Database__Schema` | `PACademy_staging_db` | **remove** (PortalDbContext fallback becomes `dbo`) |
| `Database__ActiveConnectionName` | `AdminDb` | inert for applicant (reads `Default`) |
| `ConnectionStrings__AdminDb` | `...;Database=PACademy;...` | inert here — the applicant reads `ConnectionStrings:Default` |
| `ConnectionStrings__Default` | *(must be set to feed the applicant)* | `Server=34.17.135.245,1433;Database=DB_PAcademy_Staging;User Id=sa;Password=<from-railway-secret>;TrustServerCertificate=True;` |
| `SkipMigrationsAndSeed` | `true` | inert for applicant; `exam_slots` seeder still runs if the table is empty |

### Cross-service notes

- **`Default` connection string is mandatory post-cutover for the admin service.** `AddLookupsAdminModule` / `AddApplicantGradesAdminModule` / `AddIdentityApplicantAdminModule` each throw *"Connection string 'Default' is required for the admin backend."* if absent. `appsettings.Development.json` and `appsettings.Uat.json` define only `AdminDb`/`AdminDbUat`, and the Railway admin services set `AdminDb`/`AdminDbUat` but **no** `Default`. Set `ConnectionStrings__Default` == the active admin connection (same new DB) on **both** admin services, or unify the module contexts onto `ResolveAdminDatabaseSettings` as part of the cleanup.
- **Applicant services read `ConnectionStrings:Default` for all four of their contexts** — not `AdminDb`/`AdminDbUat`. Confirm which Railway var actually populates `Default` for each applicant service before retargeting; the committed `appsettings.json` `Default` points at `Database=PACademy_staging_db`.
- **Passwords** stay in Railway secrets only. Do not commit the real `sa` password to any `appsettings*.json` (the committed defaults already leak it — see `05_REFERENCE_UPDATES.md`; rotate after cutover is recommended).
