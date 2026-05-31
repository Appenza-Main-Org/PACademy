# Discovered Tables

> Every application table discovered across the four EF Core `DbContext`s, listed **once per environment** (production row + staging row). Source of truth: the model snapshots and entity configurations (verified against the live code, not the live DB). **Migration status is `Pending` everywhere** at authoring time — it advances only as the operator executes the runbook on an allowed network.
>
> **Current schema caveat:** tables owned by `AdminDbContext` currently live under `admin_v2` (prod) / `PACademy_staging_db` (staging). Tables owned by the three module contexts (`LookupsAdmin`, `ApplicantGradesAdmin`, `IdentityApplicant`) currently resolve to the connection login's **default schema (`dbo`)** because those contexts never call `HasDefaultSchema` — they are noted as `dbo (login default)` below. After the migration, **all** tables live under `dbo` in their dedicated database.

## Context: AdminDbContext — history table `__EFMigrationsHistory_AdminApi`

| Table name | Current schema | Current database | Target schema | Target database | Migration status |
|---|---|---|---|---|---|
| admin_records | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| admin_records | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| admin_record_documents | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| admin_record_documents | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| admission_cycles | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| admission_cycles | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| admission_rules | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| admission_rules | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| applicant_categories | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| applicant_categories | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| application_settings_category_configs | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| application_settings_category_configs | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| application_settings_category_specializations | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| application_settings_category_specializations | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| application_settings_graduation_years | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| application_settings_graduation_years | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| audit_entries | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| audit_entries | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exams | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exams | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_questions | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_questions | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_question_options | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_question_options | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_question_matching_pairs | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_question_matching_pairs | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_rules | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_rules | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_question_links | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_question_links | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_assignments | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_assignments | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| officer_directory | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| officer_directory | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| roles | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| roles | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| users | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| users | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| lookup_rows | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| lookup_rows | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| general_settings | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| general_settings | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| applicant_portal_records | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| applicant_portal_records | PACademy_staging_db (drift: created in admin_v2 — verify) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| exam_slots | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| exam_slots | PACademy_staging_db (drift: created in admin_v2 — verify) | PACademy | dbo | DB_PAcademy_Staging | Pending |

## Context: LookupsAdminDbContext — history table `__EFMigrationsHistory_LookupsAdmin`

| Table name | Current schema | Current database | Target schema | Target database | Migration status |
|---|---|---|---|---|---|
| faculties | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| faculties | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |

## Context: ApplicantGradesAdminDbContext — history table `__EFMigrationsHistory_ApplicantGradesAdmin`

| Table name | Current schema | Current database | Target schema | Target database | Migration status |
|---|---|---|---|---|---|
| applicant_grades | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| applicant_grades | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| applicant_grade_adjustments | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| applicant_grade_adjustments | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| grade_import_batches | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| grade_import_batches | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| grade_import_rows | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| grade_import_rows | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |

## Context: IdentityApplicantAdminDbContext — history table `__EFMigrationsHistory_IdentityApplicant`

| Table name | Current schema | Current database | Target schema | Target database | Migration status |
|---|---|---|---|---|---|
| applicants | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| applicants | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |

## Migration-history tables

The four `__EFMigrationsHistory_*` tables are themselves objects to recreate (rebuild + seed with the applied migration ids; do **not** bulk-copy from the drifted DB).

| Table name | Current schema | Current database | Target schema | Target database | Migration status |
|---|---|---|---|---|---|
| __EFMigrationsHistory_AdminApi | admin_v2 | PACademy | dbo | DB_PAcademy_Prod | Pending |
| __EFMigrationsHistory_AdminApi | PACademy_staging_db | PACademy | dbo | DB_PAcademy_Staging | Pending |
| __EFMigrationsHistory_LookupsAdmin | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| __EFMigrationsHistory_LookupsAdmin | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| __EFMigrationsHistory_ApplicantGradesAdmin | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| __EFMigrationsHistory_ApplicantGradesAdmin | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |
| __EFMigrationsHistory_IdentityApplicant | dbo (login default) | PACademy | dbo | DB_PAcademy_Prod | Pending |
| __EFMigrationsHistory_IdentityApplicant | dbo (login default) | PACademy | dbo | DB_PAcademy_Staging | Pending |

## Applicant service (consumer — owns no DDL)

The applicant service (`backend/applicant`) runs **four DbContexts with zero migrations and zero history tables** — admin owns all DDL. It contributes no new objects. Its tables are the admin-owned ones above, accessed as:

| Table | Applicant access | Owning admin context | Schema today on applicant side |
|---|---|---|---|
| applicants | read-write (auto-create on first MOI login) | IdentityApplicantAdminDbContext | `dbo` (ApplicantsDbContext omits `HasDefaultSchema`) |
| faculties | read-only projection | LookupsAdminDbContext | `dbo` (LookupsReadDbContext omits `HasDefaultSchema`) |
| applicant_grades | read-only projection | ApplicantGradesAdminDbContext | `dbo` (GradesReadDbContext omits `HasDefaultSchema`) |
| applicant_grade_adjustments | read-only projection | ApplicantGradesAdminDbContext | `dbo` |
| grade_import_batches | read-only (model graph only) | ApplicantGradesAdminDbContext | `dbo` |
| grade_import_rows | read-only (model graph only) | ApplicantGradesAdminDbContext | `dbo` |
| applicant_portal_records | read-write | AdminDbContext | follows `Database:Schema` via PortalDbContext (only applicant context that does) |
| exam_slots | read-write (re-seeded on boot) | AdminDbContext | follows `Database:Schema` via PortalDbContext |

> **Headline applicant-side defect** (self-resolves after this migration): only `PortalDbContext` honors `Database:Schema`. The other three applicant contexts ignore it and resolve to `dbo`. On today's shared-DB-with-schemas topology, the applicant service is therefore half-pointed at `admin_v2`/`PACademy_staging_db` (the 2 portal tables) and half at `dbo` (the other 6). Once everything lands in `dbo` in separate databases, the split disappears.

## Summary counts

| Owning context | Distinct tables | Rows here (× 2 envs) |
|---|---|---|
| AdminDbContext | 24 | 48 |
| LookupsAdminDbContext | 1 | 2 |
| ApplicantGradesAdminDbContext | 4 | 8 |
| IdentityApplicantAdminDbContext | 1 | 2 |
| **Application tables total** | **30** | **60** |
| EF migration-history tables | 4 | 8 |
| **Grand total objects** | **34** | **68** |

All 68 rows are **Pending**.
