# Object Inventory & Migration Map

> **Authoring constraint:** the live SQL Server (`34.17.135.245,1433`, database `[PACademy]`) is **not reachable** from the machine that produced this report. Every **Row Count** is therefore deferred to a live scan — run `00_live_inventory_scan.sql` on an allowed network and fill the column in. All connection-string passwords are masked as `Password=<from-railway-secret>`.

## Purpose

This is the authoritative object list for the **environment-separation migration**: moving from one physical database (`[PACademy]`) whose environments are segregated by **SQL schema** (`admin_v2` = prod, `PACademy_staging_db` = staging — an anti-pattern) to **two physical databases**, each with a single canonical `dbo` schema:

| Logical env | Target database | Schema | Consumed by |
|---|---|---|---|
| Production | `DB_PAcademy_Prod` | `dbo` | `pacademy-admin-prod-api` + `pacademy-applicant-prod-api` |
| Staging | `DB_PAcademy_Staging` | `dbo` | `pacademy-admin-staging-api` + `pacademy-applicant-staging-api` |

Canonical structure = current **PROD** layout (`admin_v2`) rebuilt cleanly under `dbo`. Staging is a synchronized **structural** copy — lookup/config/identity data identical, only transactional volume may differ.

## Legend

- **Object Type** — every application object in this model is `Table` (EF Core code-first; see *Views / Procedures / Functions / Triggers* below).
- **Row Count = `see 00_live_inventory_scan.sql`** — placeholder for the deferred live-DB scan (DB unreachable at authoring time).
- **Migration Action**
  - `Move admin_v2 -> dbo (new DB)` — rebuild the table under `dbo` in `DB_PAcademy_Prod`; copy prod rows from `[PACademy].[admin_v2]` (exclude `row_version`).
  - `Move PACademy_staging_db -> dbo (new DB)` — rebuild the table under `dbo` in `DB_PAcademy_Staging`; structural-sync from prod (lookup/config/identity) or copy staging rows (transactional), excluding `row_version`.
  - Drift/duplicate rows carry a precise action in the cell.
- **Owning context** is noted in the Object Name column as a suffix tag so the four EF migration histories stay traceable: `[AdminApi]`, `[LookupsAdmin]`, `[ApplicantGradesAdmin]`, `[IdentityApplicant]`.

## Views / Procedures / Functions / Triggers

**none found (EF code-first model has none).** The schema is generated entirely by EF Core migrations across four `DbContext`s; there are no `CREATE VIEW` / `CREATE PROC` / `CREATE FUNCTION` / `CREATE TRIGGER` statements in any migration. The live-DB scan (`00_live_inventory_scan.sql`) should still enumerate `sys.views`, `sys.procedures`, `sys.objects` (FN/IF/TF), and `sys.triggers` per schema to confirm nothing was added out-of-band.

---

## Production: `[PACademy].[admin_v2]` → `[DB_PAcademy_Prod].[dbo]`

| Current DB | Current Schema | Object Name | Object Type | Row Count | Target DB | Target Schema | Migration Action |
|---|---|---|---|---|---|---|---|
| PACademy | admin_v2 | admin_records `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — table is an **empty leftover** post `DrainAdminRecords`; rebuild empty, copy any residual rows (excl. `row_version`) |
| PACademy | admin_v2 | admin_record_documents `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — transactional document store; copy rows (excl. `row_version`) |
| PACademy | admin_v2 | admission_cycles `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config; preserves `is_active` (CYC-2026-M) |
| PACademy | admin_v2 | admission_rules `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config |
| PACademy | admin_v2 | applicant_categories `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config (RFP 4-category set) |
| PACademy | admin_v2 | application_settings_category_configs `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config |
| PACademy | admin_v2 | application_settings_category_specializations `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config |
| PACademy | admin_v2 | application_settings_graduation_years `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config |
| PACademy | admin_v2 | audit_entries `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — transactional; copy rows (excl. `row_version`) |
| PACademy | admin_v2 | exam_assignments `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — FK→exams (load after exams) |
| PACademy | admin_v2 | exams `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config (Question Bank blueprint) |
| PACademy | admin_v2 | exam_questions `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — config; load **before** its option/matching children |
| PACademy | admin_v2 | exam_question_links `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — FK→exams (load after exams) |
| PACademy | admin_v2 | exam_question_matching_pairs `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — FK→exam_questions (load after) |
| PACademy | admin_v2 | exam_question_options `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — FK→exam_questions (load after) |
| PACademy | admin_v2 | exam_rules `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — FK→exams (load after exams) |
| PACademy | admin_v2 | officer_directory `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — **no `row_version`**; copy ALL columns directly |
| PACademy | admin_v2 | roles `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — identity/RBAC; identical prod==staging |
| PACademy | admin_v2 | users `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — **DRIFT: pick the `admin_v2` copy**; staging has a duplicate (see Drift §). Carry admin-created users from prod |
| PACademy | admin_v2 | lookup_rows `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — lookup canon (25 keys / 427 rows); identical prod==staging |
| PACademy | admin_v2 | general_settings `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — 1-row config singleton; **must be explicitly copied** (never re-seeded) |
| PACademy | admin_v2 | applicant_portal_records `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — **DRIFT: hardcoded `admin_v2`** by AddApplicantPortal; verify presence before copy |
| PACademy | admin_v2 | exam_slots `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Move admin_v2 -> dbo (new DB) — **DRIFT: hardcoded `admin_v2`** by AddApplicantPortal; applicant-prod re-seeds on boot if empty |
| PACademy | dbo* | faculties `[LookupsAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — context already schema-less; lookup (18 rows FAC-01..18); identical prod==staging. *Currently resolves to login-default `dbo`, **not** `admin_v2` |
| PACademy | dbo* | applicants `[IdentityApplicant]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — context already schema-less; shared (admin owns DDL, applicant RW). Transactional. *Currently login-default `dbo` |
| PACademy | dbo* | applicant_grades `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — context already schema-less; transactional; parent of adjustments. *Currently login-default `dbo` |
| PACademy | dbo* | applicant_grade_adjustments `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — FK→applicant_grades (load after). *Currently login-default `dbo` |
| PACademy | dbo* | grade_import_batches `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — transactional; parent of import_rows. *Currently login-default `dbo` |
| PACademy | dbo* | grade_import_rows `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo (new DB) — FK→grade_import_batches (load after). *Currently login-default `dbo` |
| PACademy | admin_v2 | __EFMigrationsHistory_AdminApi `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo, **seed with all 7 applied AdminApi migration ids** so EF treats the DB as up-to-date (do NOT bulk-copy from drifted DB) |
| PACademy | dbo* | __EFMigrationsHistory_LookupsAdmin `[LookupsAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo, seed with the 1 LookupsAdmin migration id. *Currently login-default `dbo` |
| PACademy | dbo* | __EFMigrationsHistory_ApplicantGradesAdmin `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo, seed with the 1 ApplicantGradesAdmin migration id. *Currently login-default `dbo` |
| PACademy | dbo* | __EFMigrationsHistory_IdentityApplicant `[IdentityApplicant]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Prod | dbo | Rebuild under dbo, seed with the 1 IdentityApplicant migration id. *Currently login-default `dbo` |

> \* **Schema caveat for the 6 module tables + 3 module history tables:** the `LookupsAdmin`, `ApplicantGradesAdmin`, and `IdentityApplicant` contexts **never call `HasDefaultSchema`** and connect via `ConnectionStrings:Default`. They resolve to the connection login's default schema (`dbo` for `sa`), **not** `admin_v2`/`PACademy_staging_db`. The `00_live_inventory_scan.sql` step must enumerate these across **all schemas and both candidate database names** (`Database=PACademy` for `AdminDb` vs `Database=PACademy_staging_db` baked into `ConnectionStrings:Default`) to confirm where they physically live before any copy.

---

## Staging: `[PACademy].[PACademy_staging_db]` → `[DB_PAcademy_Staging].[dbo]`

| Current DB | Current Schema | Object Name | Object Type | Row Count | Target DB | Target Schema | Migration Action |
|---|---|---|---|---|---|---|---|
| PACademy | PACademy_staging_db | admin_records `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — empty leftover; rebuild empty |
| PACademy | PACademy_staging_db | admin_record_documents `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — transactional; staging volume may differ |
| PACademy | PACademy_staging_db | admission_cycles `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; structural-sync identical to prod |
| PACademy | PACademy_staging_db | admission_rules `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | applicant_categories `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | application_settings_category_configs `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | application_settings_category_specializations `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | application_settings_graduation_years `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | audit_entries `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — transactional |
| PACademy | PACademy_staging_db | exam_assignments `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — FK→exams (load after) |
| PACademy | PACademy_staging_db | exams `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; sync from prod |
| PACademy | PACademy_staging_db | exam_questions `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — config; load before children |
| PACademy | PACademy_staging_db | exam_question_links `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — FK→exams (load after) |
| PACademy | PACademy_staging_db | exam_question_matching_pairs `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — FK→exam_questions (load after) |
| PACademy | PACademy_staging_db | exam_question_options `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — FK→exam_questions (load after) |
| PACademy | PACademy_staging_db | exam_rules `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — FK→exams (load after) |
| PACademy | PACademy_staging_db | officer_directory `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — **no `row_version`**; copy ALL columns directly |
| PACademy | PACademy_staging_db | roles `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — identity/RBAC; identical to prod |
| PACademy | PACademy_staging_db | users `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — **DRIFT: duplicate table** also in `admin_v2`; keep exactly one `dbo.users` of this shape |
| PACademy | PACademy_staging_db | lookup_rows `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — lookup canon; sync identical to prod |
| PACademy | PACademy_staging_db | general_settings `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — **DRIFT: may be MISSING on staging** (staging skips auto-migrate; added by `20260530114800_AddGeneralSettingsTable`). Ensure table exists, then copy from prod |
| PACademy | PACademy_staging_db | applicant_portal_records `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — **DRIFT: created in `admin_v2`, likely MISSING under `PACademy_staging_db`**. Verify per-schema; rebuild under dbo |
| PACademy | PACademy_staging_db | exam_slots `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Move PACademy_staging_db -> dbo (new DB) — **DRIFT: created in `admin_v2`, likely MISSING under `PACademy_staging_db`**. Verify per-schema; rebuild under dbo |
| PACademy | dbo* | faculties `[LookupsAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — context schema-less; lookup; sync identical to prod. *Currently login-default `dbo`, shared with prod env today |
| PACademy | dbo* | applicants `[IdentityApplicant]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — context schema-less; transactional. *Currently login-default `dbo`, **shared single copy with prod env today** — split required |
| PACademy | dbo* | applicant_grades `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — context schema-less; transactional. *Currently login-default `dbo`, shared with prod env today |
| PACademy | dbo* | applicant_grade_adjustments `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — FK→applicant_grades (load after). *Currently login-default `dbo` |
| PACademy | dbo* | grade_import_batches `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — transactional. *Currently login-default `dbo` |
| PACademy | dbo* | grade_import_rows `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo (new DB) — FK→grade_import_batches (load after). *Currently login-default `dbo` |
| PACademy | PACademy_staging_db | __EFMigrationsHistory_AdminApi `[AdminApi]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo, **seed with all 7 applied AdminApi migration ids** (do NOT bulk-copy from drifted DB) |
| PACademy | dbo* | __EFMigrationsHistory_LookupsAdmin `[LookupsAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo, seed with the 1 LookupsAdmin migration id. *Currently login-default `dbo` |
| PACademy | dbo* | __EFMigrationsHistory_ApplicantGradesAdmin `[ApplicantGradesAdmin]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo, seed with the 1 ApplicantGradesAdmin migration id. *Currently login-default `dbo` |
| PACademy | dbo* | __EFMigrationsHistory_IdentityApplicant `[IdentityApplicant]` | Table | see 00_live_inventory_scan.sql | DB_PAcademy_Staging | dbo | Rebuild under dbo, seed with the 1 IdentityApplicant migration id. *Currently login-default `dbo` |

> \* Same schema caveat as the production table: the 6 module tables + their 3 history tables do not currently live under `PACademy_staging_db`. On the shared-DB topology they exist as **one physical `dbo` copy** serving both env services — separating them into `DB_PAcademy_Prod.dbo` and `DB_PAcademy_Staging.dbo` is part of this migration (the applicant service today half-reads `dbo` and half-reads the env schema; this defect self-resolves once everything is `dbo` in separate DBs).

---

## Applied migration ids (for history-table seeding)

The rebuilt `__EFMigrationsHistory_*` tables must be seeded with these ids (regenerated as a single clean `dbo` baseline if the chain is rebaselined — see `05_REFERENCE_UPDATES.md` cutover note). Until then, the existing chain is:

| Context | History table | Applied migration ids |
|---|---|---|
| AdminDbContext | `__EFMigrationsHistory_AdminApi` | `20260521200238_InitialAdminSchema`, `20260522114816_AddApplicationSettingsTables`, `20260525120424_AddApplicantPortal`, `20260526194218_PendingModelChanges`, `20260529120000_NormalizeExamCatalog`, `20260529123000_DrainAdminRecords`, `20260530114800_AddGeneralSettingsTable` |
| LookupsAdminDbContext | `__EFMigrationsHistory_LookupsAdmin` | `20260520113946_InitialLookups` |
| ApplicantGradesAdminDbContext | `__EFMigrationsHistory_ApplicantGradesAdmin` | `20260521011646_InitialApplicantGrades` |
| IdentityApplicantAdminDbContext | `__EFMigrationsHistory_IdentityApplicant` | `20260521092833_InitialIdentityApplicant` |

> **Recommended fix-forward (per inventory):** regenerate a single clean baseline migration that targets `dbo`, dropping `AddApplicantPortal`'s hardcoded `admin_v2` schema and `PendingModelChanges`'s schema-rename. If the chain is rebaselined, the history tables instead carry the **one** new baseline id. The operator must **never** execute any `admin_v2 ↔ PACademy_staging_db` rename step (the `Down()` of `PendingModelChanges`).

---

## Counts

- **Application tables per environment:** 30 (24 `AdminDbContext` + 6 module-context tables; the 3 applicant-service owned/shared tables — `applicants`, `applicant_portal_records`, `exam_slots` — are already counted under their owning admin context, so the de-duplicated union is 30, not 33).
- **EF migration-history tables per environment:** 4.
- **Total objects per environment:** 34. Across both environments: 68 rows in the maps above.
- **Views / Procedures / Functions / Triggers:** none found (EF code-first model has none).

## Drift & anomalies

1. **Duplicate `users` table.** A `[users]` table exists in **both** `admin_v2` **and** `PACademy_staging_db` in the live DB. The canonical `dbo` rebuild keeps **exactly one** `users` table of the `AdminDbContext` shape (PK `id`, unique `ux_users_national_id`). For prod, take the `admin_v2` copy; for staging, take the `PACademy_staging_db` copy. Reconcile against `IdentityApplicantAdminDbContext.applicants` (a separate table — do **not** conflate the two).

2. **`AddApplicantPortal` hardcodes `admin_v2`.** Migration `20260525120424_AddApplicantPortal.cs` writes literal `schema: "admin_v2"` (lines 16, 34, 54, 60, 70, 74) for `applicant_portal_records` + `exam_slots` instead of `AdminDbContext.Schema`. Consequence: on **staging**, those two tables were created under `admin_v2`, so they may be **missing or mis-schema'd** under `PACademy_staging_db`. The operator must verify presence per-schema before copy; the rebuilt DBs must place both under `dbo`. Fix-forward: purge the six hardcoded literals (or rebaseline).

3. **`PendingModelChanges` rename anti-pattern.** Migration `20260526194218_PendingModelChanges.cs` has a deliberate **no-op `Up()`** (comment: *"Tables already exist in PACademy_staging_db schema — no-op."*) and a `Down()` that renames 14 tables `PACademy_staging_db → admin_v2`. This migration is what ties the model snapshot's default schema to `PACademy_staging_db`. Under the target topology there is **no schema rename** — both DBs use `dbo`. The operator must **not** run any schema-rename step; recommended to collapse the chain into a clean `dbo` baseline.

4. **`general_settings` may be missing on staging.** Added by `20260530114800_AddGeneralSettingsTable` (correctly uses `AdminDbContext.Schema`). Because staging historically **skips auto-migrate**, the table may not exist under `PACademy_staging_db` (this previously broke Settings get/save). Ensure the table exists in `DB_PAcademy_Staging.dbo`, then copy the 1-row singleton from prod (it is never re-seeded — defaults differ from admin-saved values).

5. **Module contexts resolve to `dbo`, not the env schema.** The `faculties`, `applicants`, and four grade tables (+ their three history tables) follow the connection login's default schema (`dbo`), **not** `admin_v2`/`PACademy_staging_db`, because their contexts never call `HasDefaultSchema` and connect via `ConnectionStrings:Default` (which points at `Database=PACademy_staging_db` in committed appsettings — possibly a different physical DB than `AdminDb`'s `Database=PACademy`). The live scan must enumerate these across **all schemas and both candidate DB names**.

6. **`ROWVERSION` cannot be inserted.** 29 of the 30 application tables (every one except `officer_directory`) carry a `row_version` `ROWVERSION` column. **Every cross-DB `INSERT...SELECT` data copy must exclude `row_version`** (SQL Server rejects explicit inserts; the value regenerates). Use explicit column lists. `officer_directory` is the only table safe to copy all columns directly.
