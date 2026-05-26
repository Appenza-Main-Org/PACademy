# Staging Admin Records Normalization Audit

Date: 2026-05-26

## Scope

This audit checks the live UAT/staging database state for `admin_records` normalization. It is read-only. No migration, delete, update, or backfill has been run.

The supplied UAT configuration points to:

- Database: `PACademy`
- Active admin schema: `PACademy_staging_db`
- Parallel admin schema also present: `admin_v2`
- Normalized/legacy schema also present: `dbo`

Sensitive connection details are intentionally not repeated here.

## Current Storage Map

### Active Staging Schema: `PACademy_staging_db`

The active admin API schema has these EF/admin tables:

| Table | Purpose | Current note |
|---|---|---|
| `admin_records` | Generic JSON document store | Still stores active grade/import-facing data and small applicant/exam/question modules. |
| `admission_cycles` | Admin cycle records | Real table. |
| `admission_rules` | Admin admission rules | Real table with JSON rule payloads. |
| `applicant_categories` | Category master records | Real table. |
| `applicant_portal_records` | Applicant portal generic records | Real table, still generic by type/record. |
| `application_settings_category_configs` | Application setup config | Real table. |
| `application_settings_category_specializations` | Category-specialization bindings | Real table. |
| `application_settings_graduation_years` | Graduation-year settings | Real table. |
| `audit_entries` | Admin audit log | Real table. |
| `exam_slots` | Exam slot capacity records | Real table. |
| `lookup_rows` | Admin lookup rows | Real table keyed by lookup/code. |
| `officer_directory` | NID-driven officer lookup | Real table. |
| `roles` | Admin roles | Real table. |
| `users` | Admin users | Real table. |

### Active `admin_records` Modules

| Module | Rows | Data saved in JSON |
|---|---:|---|
| `grades` | 23,337 | Seat, seating number, NID, name, kind, gender, branch, school/category, total/max, override/change fields, soft-delete markers, adjustment log. |
| `questions` | 52 | Question bank records. |
| `applicants` | 4 | Applicant projections with national ID, name, demographics, education-ish fields. |
| `exams` | 2 | Exam configuration/rules. |
| `admissionSetup.applicationSettings.CYC-1779721524770` | 1 | Cycle-scoped application settings draft/version payload. |
| `admissionSetup.applicationSettings.CYC-2026-M` | 1 | Cycle-scoped application settings draft/version payload. |
| `settings` | 1 | Global admin settings payload. |

All inspected payloads are valid JSON.

### Existing Normalized `dbo` Tables

The database already has normalized tables for core domains. The most relevant ones are:

| Domain | Existing tables |
|---|---|
| Applicants | `dbo.applicants`, `dbo.applicant_stage_submissions` |
| Grades | `dbo.applicant_grades`, `dbo.applicant_grade_adjustments`, `dbo.grade_rows`, `dbo.grade_adjustments`, `dbo.grade_import_batches`, `dbo.grade_import_rows`, `dbo.pending_grade_imports` |
| Admissions/setup | `dbo.cycles`, `dbo.categories`, `dbo.admission_rules`, `dbo.category_tests`, `dbo.category_specializations`, `dbo.category_committees`, `dbo.wizard_step_statuses`, `dbo.admin_cycle_setup_items` |
| Lookups | `dbo.lookup_items`, `dbo.admin_lookup_items`, plus lookup-specific tables such as governorates, nationalities, qualifications, universities, faculties, colleges, relationships, ranks, jobs |
| Committees | `dbo.committees`, `dbo.committee_members`, `dbo.committee_date_bindings`, `dbo.committee_types`, `dbo.committee_score_thresholds`, `dbo.committee_specializations`, `dbo.committee_merge_split_rules` |
| Exams | `dbo.cycle_exams`, `dbo.exam_types`, `dbo.exam_groups`, `dbo.exam_date_configs`, `dbo.total_score_configs`, `dbo.electronic_declarations` |
| Identity/workflows/reports | ASP.NET Identity tables, `dbo.system_users`, `dbo.workflows`, report snapshot tables |

## Consistency Findings

### Grades

| Source | Total rows | Live rows | Soft-deleted rows | Distinct live NIDs | Distinct live seating numbers |
|---|---:|---:|---:|---:|---:|
| `PACademy_staging_db.admin_records` module `grades` | 23,337 | 10,143 | 13,194 | 10,143 | 10,143 |
| `dbo.applicant_grades` | 10,000 | 10,000 | 0 | 10,000 | 10,000 |
| `dbo.grade_rows` | 18,373 | unknown | unknown | not checked | not checked |

Findings:

- Active staging `grades` has no live duplicate NID groups and no live duplicate seating-number groups.
- `dbo.applicant_grades` also has unique NID and seat/seating-number coverage.
- Active staging has 143 more live grade rows than `dbo.applicant_grades`.
- Active staging also carries 13,194 soft-deleted grade rows that the normalized grade table does not obviously represent.

Decision needed:

- Decide whether normalized grade history should preserve soft-deleted rows as `deleted_at` rows, archive rows, or import-history only.
- Reconcile the 143-row live delta before switching reads from JSON to `dbo.applicant_grades`.

### Applicants

| Source | Rows | Distinct national IDs | Missing national IDs |
|---|---:|---:|---:|
| `PACademy_staging_db.admin_records` module `applicants` | 4 | 4 | 0 |
| `dbo.applicants` | 4 | 4 | 0 |

Findings:

- Counts match.
- National IDs are unique in both sources.
- The staging applicant JSON shape has no phone value in the fields checked, while `dbo.applicants` has `phone_number`.
- Additional field-by-field comparison is still required before declaring the normalized table canonical.

## Current Application Behavior

The running admin code still uses `AdminRecordsService` for applicant and grade APIs:

- Applicant list uses `records.PageAsync("applicants")`, which loads module rows before pagination/search.
- Applicant check-NID loads all applicant JSON rows and checks `nationalId` in memory.
- Grades list has a faster SQL path for paginated requests, but still filters/sorts via `JSON_VALUE` from `admin_records.payload_json`.
- Grades by NID loads all grade JSON rows and filters in memory.
- Grade import duplicate checks scan all grade JSON rows, and the v2 import path repeats this per frontend chunk.

So even though normalized tables exist, the API has not switched to them yet.

## Recommended Normalization Strategy

### Phase 0: Freeze and Snapshot

Before any write:

1. Take a database backup or restore-point snapshot for staging.
2. Record row counts and checksums for active modules and target tables.
3. Temporarily pause grade imports during the backfill window, or add a dual-write/queue strategy.

### Phase 1: Choose Canonical Schema

Recommended decision: use the existing `dbo` normalized tables as the first canonical target for applicants and grades, because they already exist and have data/indexes.

Alternative: create equivalent normalized tables under `PACademy_staging_db` for strict environment/schema separation. This is cleaner for EF admin ownership but requires copying or replacing the existing `dbo` normalized model.

Do not proceed until this is decided.

### Phase 2: Reconciliation Scripts, Read-Only First

Build read-only comparison queries for:

- `admin_records.grades` live rows not in `dbo.applicant_grades` by NID.
- `dbo.applicant_grades` rows not in live `admin_records.grades` by NID.
- Same comparison by seating number.
- Field differences for rows matched by NID.
- Soft-deleted grade rows and their delete metadata.
- Applicant field differences by national ID.

Expected output: CSV/TSV reconciliation report and a proposed deterministic mapping for every unmatched row.

### Phase 3: Backfill Migration, Non-Destructive

Only after Phase 2 approval:

- Insert missing live grade rows into the normalized target.
- Upsert changed normalized fields where staging JSON is newer and approved as source-of-truth.
- Preserve soft-deleted grade records either with `deleted_at` columns added to normalized target or an archive/history table.
- Backfill grade adjustment logs into `applicant_grade_adjustments` if preserving adjustment history is required.
- Backfill applicant field differences into `dbo.applicants` only after explicit field precedence rules are approved.

No destructive changes should be included in the first backfill.

### Phase 4: API Read Path Switch

Change application reads after data is reconciled:

- `GET /api/grades` reads `dbo.applicant_grades` plus adjustment aggregates.
- `GET /api/admin/applicant-grades/by-nid/{nid}` seeks normalized `nid`.
- Eligibility checks seek normalized `nid`.
- Applicant list and check-NID read normalized `applicants`.

Keep compatibility JSON writes disabled or dual-written only during a short transition window.

### Phase 5: API Write Path Switch

Move writes/imports:

- Grade imports write to `grade_import_batches`, `grade_import_rows`, `applicant_grades`, and `applicant_grade_adjustments`.
- Applicant create/update writes to `applicants` plus child tables as they are introduced.
- Keep `admin_records` as legacy/audit snapshot only if needed.

## Risks

- The active schema and normalized schema are different (`PACademy_staging_db` vs `dbo`), so EF migrations may not automatically manage the normalized target.
- The 143-row grade delta must be understood before switching reads.
- Soft-deleted JSON rows may represent intentional import history or reset behavior; dropping them from the normalized model would lose operational context.
- The current connection uses a privileged SQL login; rotate the shared password after this audit and use least-privilege credentials for future automated verification.
- Changing write paths while imports are active can create split-brain data unless imports are paused or dual-write is designed.

## Approval Gate

Recommended next approval item:

Create a read-only reconciliation script/report for `PACademy_staging_db.admin_records` versus `dbo.applicants` and `dbo.applicant_grades`.

Do not generate or run a write migration/backfill until that reconciliation report is reviewed.
