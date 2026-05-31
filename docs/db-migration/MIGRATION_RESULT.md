# DB Environment Separation — EXECUTED ✅ (2026-05-31)

The migration was **executed and verified end-to-end** against the live SQL Server
(`34.17.135.245`, SQL Server 2017 Web Edition, Windows). Environments are now separated
by **database** on a single `dbo` schema; the old schema-based split is retired.

```
DB_PAcademy_Prod    / dbo   ← pacademy-admin-prod-api   + pacademy-applicant-prod-api
DB_PAcademy_Staging / dbo   ← pacademy-admin-staging-api + pacademy-applicant-staging-api
```

## What the live scan actually found (drift — worse than the plan assumed)

The single DB `[PACademy]` held three schemas, all drifted from each other and from the
EF model:

| schema | role | tables | notable row counts |
|---|---|---|---|
| `admin_v2` | prod | 18 | `applicant_grades` **10000**, `lookup_rows` 429, `admin_records` 115, `applicants` 5 |
| `PACademy_staging_db` | staging | 27 | full **exam Question Bank** (`exam_questions` 52, options 205, `exams` 2), `general_settings` 1, `audit_entries` 337 |
| `dbo` | shared modules | 13 | `applicants` **29**, `faculties` 19, `applicant_grades` **0** |

Key problems: `applicants`/`applicant_grades`/`applicant_categories` existed in **multiple
schemas with different counts**; the **exam Question Bank + `general_settings` existed only
in the staging schema** (prod had none); prod's `admin_v2` was missing the exam catalog,
`general_settings`, `admin_record_documents`, `faculties`, and `grade_import_*`.

## Reconciliation strategy (data-preserving, prod-canonical)

`DB_PAcademy_Prod` was loaded from an **explicit per-table source map** (not a blind
schema copy), choosing the live/populated copy of each table and **rescuing** the
staging-only seed/config so nothing was lost — see [`executed/20_load_prod.sql`](executed/20_load_prod.sql):

- **from `admin_v2`** (live prod admin incl. the 10k grades): `admin_records`, `admission_cycles`, `admission_rules`, `applicant_categories`, `applicant_grade_adjustments`, `applicant_grades`, `applicant_portal_records`, `application_settings_*`, `audit_entries`, `exam_slots`, `lookup_rows`, `officer_directory`, `roles`, `users`
- **from `dbo`** (live module tables): `applicants` (29), `faculties` (19), `grade_import_batches`, `grade_import_rows`
- **backfilled from staging schema** (seed/config that prod lacked — preserved, not lost): `exams`, `exam_questions`, `exam_question_options`, `exam_question_matching_pairs`, `exam_rules`, `exam_question_links`, `exam_assignments`, `general_settings`

`DB_PAcademy_Staging` was then made a **synchronized clone of `DB_PAcademy_Prod`** (your
stated intent: "staging = a synchronized copy of production") — see
[`executed/30_clone_staging.sql`](executed/30_clone_staging.sql).

## Execution order (what ran)

1. **Backup** — `BACKUP DATABASE [PACademy] … WITH COPY_ONLY, CHECKSUM` → verified
   (`…\MSSQL\Backup\PACademy_premigration_20260531.bak`). [`executed/10_backup.sql`](executed/10_backup.sql)
2. **Create** — `DB_PAcademy_Prod`, `DB_PAcademy_Staging` (compat 140). `sql/01_create_databases.sql`
3. **Structure** — 4 EF-generated `dbo` scripts × both DBs (`sql/02_build_dbo_schema_*.sql`); zero `admin_v2`/`staging` literals.
4. **Data** — prod load (28 tables) → staging clone (29 tables).
5. **Validate** — `sql/05_validate.sql` + [`executed/40_parity.sql`](executed/40_parity.sql): all green.
6. **Cutover** — `railway_cutover.sh --apply` (4 services, atomic per-service).
7. **Post-validate** — `/health/db` + boot checks on all 4 services.

## Verification (all green)

| Check | Result |
|---|---|
| Structure parity (tables/cols/FKs/indexes/views/procs/funcs/triggers) | **29 / 266 / 7 / 57 / 0 / 0 / 0 / 0** — identical both DBs |
| EF migration history | 10 migrations present in both (AdminApi 7 + Lookups/Grades/Identity 1 each) |
| Lookup/config parity | identical (lookups 429, exam_questions 52, roles 8, faculties 19, general_settings 1, …) |
| Row-count parity (all 29 tables) | **0 mismatches** |
| `admin-prod` / `admin-staging` `/health/db` | HTTP 200, `status=ok`, `schema=dbo`, connected to the new DB |
| `applicant-prod` / `applicant-staging` | up (booted past boot-time DB read on the new DB) |
| Source `[PACademy]` (admin_v2 18 / staging 27 / dbo 13) | **untouched** — full rollback intact |

## Rollback (if ever needed)

Non-destructive: `[PACademy]` and its schemas were only **read**. To revert, re-point the
4 Railway services' vars to `Database=PACademy` + `Database__Schema=admin_v2` /
`PACademy_staging_db` (see [`sql/06_rollback.sql`](sql/06_rollback.sql) part (a)); the new DBs
can be dropped via part (b). The pre-migration backup is on the server.

## Remaining follow-ups (not blocking; system is live & correct)

- **Code changes are applied in the working tree but NOT committed/pushed** (the running
  services already work via the Railway vars, which override appsettings + the code default).
  Commit `DefaultSchema="dbo"` + the appsettings/migration fixes when ready — keep them
  separate from the unrelated in-flight applicant-eligibility / applicant-portal changes.
- **Scrub + rotate the `sa` password** (committed in `appsettings*.json`).
- Optionally drop the retired `admin_v2` / `PACademy_staging_db` schemas from `[PACademy]`
  after a soak period (not required; they're harmless and serve as a fallback).
