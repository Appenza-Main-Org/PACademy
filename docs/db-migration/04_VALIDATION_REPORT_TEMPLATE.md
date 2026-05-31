# Production vs Staging Validation Report

> Fill-in template. Compares `[DB_PAcademy_Prod].[dbo]` against
> `[DB_PAcademy_Staging].[dbo]` after the environment-separation migration.
>
> **Populated by `docs/db-migration/sql/05_validate.sql`** — run it (RUNBOOK Phase 3 and
> again Phase 6) and transcribe each emitted metric row below. The structural rows can
> also be pre-seeded from the Phase 0 `sql/00_live_inventory_scan.sql` baseline.

- **Run by:** `__________________`
- **Date / window:** `__________________`
- **Phase:** ☐ Phase 3 (pre-cutover)  ☐ Phase 6 (post-cutover)
- **Source server:** `34.17.135.245,1433`  (password masked as `<secret>` in any pasted command)
- **Verdict rule:** every structural row must be **OK**, and every lookup/configuration
  record-count row must match exactly, before the gate passes. Transactional tables are
  **not** required to match (staging may differ in volume).

---

## 1. Structural parity

| Metric | DB_PAcademy_Prod | DB_PAcademy_Staging | Match? |
|---|---|---|---|
| Table count | | | ☐ OK ☐ MISMATCH |
| Column count | | | ☐ OK ☐ MISMATCH |
| Foreign-key count | | | ☐ OK ☐ MISMATCH |
| Index count | | | ☐ OK ☐ MISMATCH |
| View count | | | ☐ OK ☐ MISMATCH |
| Stored-procedure count | | | ☐ OK ☐ MISMATCH |
| Function count | | | ☐ OK ☐ MISMATCH |
| Trigger count | | | ☐ OK ☐ MISMATCH |

**Expected (canonical) anchors:** 30 application tables under `dbo`
(24 `AdminDbContext` + `faculties` + 4 grade tables + `applicants`) plus the four
`__EFMigrationsHistory_*` tables; the 5 declared FKs
(`exam_question_options`, `exam_question_matching_pairs`, `exam_rules`,
`exam_question_links`, `exam_assignments` → their parents) plus the one
`applicant_grade_adjustments → applicant_grades` and `grade_import_rows →
grade_import_batches` module FKs. There are **no** views/procs/functions/triggers in the
EF model, so those four counts should be **0 on both sides**.

### 1a. Schema-purity & migration-history checks (also from `05_validate.sql`)

| Check | DB_PAcademy_Prod | DB_PAcademy_Staging | Match? |
|---|---|---|---|
| Objects in any schema other than `dbo` (expect 0) | | | ☐ OK ☐ MISMATCH |
| `__EFMigrationsHistory_AdminApi` migration-id set | | | ☐ OK ☐ MISMATCH |
| `__EFMigrationsHistory_LookupsAdmin` migration-id set | | | ☐ OK ☐ MISMATCH |
| `__EFMigrationsHistory_ApplicantGradesAdmin` migration-id set | | | ☐ OK ☐ MISMATCH |
| `__EFMigrationsHistory_IdentityApplicant` migration-id set | | | ☐ OK ☐ MISMATCH |

> Expected migration ids: AdminApi = the 7 ids
> `20260521200238_InitialAdminSchema`, `20260522114816_AddApplicationSettingsTables`,
> `20260525120424_AddApplicantPortal`, `20260526194218_PendingModelChanges`,
> `20260529120000_NormalizeExamCatalog`, `20260529123000_DrainAdminRecords`,
> `20260530114800_AddGeneralSettingsTable`; Lookups = `20260520113946_InitialLookups`;
> Grades = `20260521011646_InitialApplicantGrades`; Identity =
> `20260521092833_InitialIdentityApplicant`. **No** `admin_v2` / `PACademy_staging_db`
> object should exist in either DB.

---

## 2. Lookup / Configuration record counts (must match exactly)

These tables hold lookup- and configuration-class data that **must be identical**
Prod == Staging (sourced from live prod via `sql/04_sync_lookup_config.sql`). The
"Canonical" column is the expected count from the seed inventory (the pre-cleanup
scaffold shape); blank where the count is admin-authored and lives only in prod.

| Table | Class | Canonical | DB_PAcademy_Prod | DB_PAcademy_Staging | Match? |
|---|---|---|---|---|---|
| `lookup_rows` (all 25 keys) | lookup | 427 | | | ☐ OK ☐ MISMATCH |
| `faculties` (standalone, LookupsAdmin) | lookup | 18 | | | ☐ OK ☐ MISMATCH |
| `applicant_categories` | config | 4 | | | ☐ OK ☐ MISMATCH |
| `admission_cycles` | config | 5 | | | ☐ OK ☐ MISMATCH |
| `admission_rules` | config | 5 | | | ☐ OK ☐ MISMATCH |
| `application_settings_category_configs` | config | 4 | | | ☐ OK ☐ MISMATCH |
| `application_settings_category_specializations` | config | _(admin-authored)_ | | | ☐ OK ☐ MISMATCH |
| `application_settings_graduation_years` | config | _(admin-authored)_ | | | ☐ OK ☐ MISMATCH |
| `general_settings` (singleton `Id='settings'`) | config | 0 or 1 | | | ☐ OK ☐ MISMATCH |
| `exams` (+`exam_rules`, `exam_question_links`) | config | 2 | | | ☐ OK ☐ MISMATCH |
| `exam_questions` (+options, +matching_pairs) | config | 52 | | | ☐ OK ☐ MISMATCH |
| `roles` | identity / perms | 8 | | | ☐ OK ☐ MISMATCH |

> Notes:
> - `lookup_rows` canonical breakdown (sums to 427): relationships 34,
>   relationship-degree-tiers 4, tests 15, test-results 4, committees 19,
>   specializations 71, faculties 18 *(also duplicated by the standalone `faculties`
>   table — both must be preserved)*, submission-types 4, applicant-categories 4,
>   nationalities-countries 56, governorates 27, police-stations 64, jobs 25,
>   qualifications 14, announcements 4, applicant-divisions 5, school-categories 5,
>   nid-missing-reasons 6, universities 30, marital-statuses 4, academic-grades 4,
>   academic-degrees 3, exam-rounds 2, graduation-years 3, excellence-criteria 2.
> - `general_settings` is **not** seeded — it is created on first PATCH `/admin/settings`.
>   If prod has a saved row, the count is 1 and it **must** be copied to staging (defaults
>   differ from admin-saved values). If prod never saved one, both sides are 0.
> - `users` / `officer_directory` bootstrap rows are carried by the Phase 2 data copy;
>   admin-created users live only in prod and are intentionally **not** mirrored to
>   staging by a fixed count — exclude them from the "must match" rule.

---

## 3. Transactional tables (informational — match NOT required)

Captured for awareness only; staging may legitimately differ. Record counts if useful.

| Table | DB_PAcademy_Prod | DB_PAcademy_Staging | Notes |
|---|---|---|---|
| `admin_records` | | | expected empty (drained by migration) |
| `admin_record_documents` | | | document-store buckets (applicants/payments/biometric-*/exam-*) |
| `audit_entries` | | | |
| `exam_assignments` | | | |
| `exam_slots` | | | re-seeded on applicant boot if empty (5 `SLT-*` rows) |
| `applicant_portal_records` | | | |
| `applicants` (IdentityApplicant) | | | |
| `applicant_grades` | | | |
| `applicant_grade_adjustments` | | | |
| `grade_import_batches` | | | |
| `grade_import_rows` | | | |

---

## 4. Sign-off

| Gate | Result | Initials |
|---|---|---|
| All structural rows OK (§1, §1a) | ☐ Pass ☐ Fail | |
| All lookup/config record counts match (§2) | ☐ Pass ☐ Fail | |
| No object outside `dbo` in either DB | ☐ Pass ☐ Fail | |
| Migration-history sets match expected (§1a) | ☐ Pass ☐ Fail | |

**Overall:** ☐ PASS — proceed past gate  ☐ FAIL — stop, roll back per RUNBOOK

**Notes / anomalies:**

```
(record any MISMATCH, the table involved, the suspected cause, and the remediation taken)
```
