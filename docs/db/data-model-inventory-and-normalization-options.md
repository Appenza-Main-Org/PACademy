# Data Model Inventory and Normalization Options

Date: 2026-05-26

## Purpose

This document lists the data currently used by the app, how the checked-in backend saves it today, and which domains should become first-class SQL Server tables for performance and separation of concerns.

This is a decision document, not a migration. No destructive changes are proposed here.

## Live Database Verification Status

The UAT/staging SQL Server was inspected read-only on 2026-05-26 using the supplied staging connection.

Important environment facts:

- Active database: `PACademy`.
- Active admin schema from configuration: `PACademy_staging_db`.
- The default code schema is `admin_v2`, but `Database__Schema="PACademy_staging_db"` moves EF tables to the staging schema.
- Migrations and seed are skipped in UAT (`SkipMigrationsAndSeed=true`), so live schema must be treated as the source of truth before any migration/backfill.

Schemas found:

| Schema | Meaning |
|---|---|
| `PACademy_staging_db` | Active staging admin schema used by the provided UAT configuration. |
| `admin_v2` | Parallel admin schema with similar EF tables and more grade history. |
| `dbo` | Contains many normalized/legacy tables, including real `applicants`, `applicant_grades`, `grade_rows`, workflows, lookups, committees, identity tables, and reporting tables. |

Active staging `admin_records` modules:

| Module | Rows | Notes |
|---|---:|---|
| `grades` | 23,337 | 10,143 live rows, 13,194 soft-deleted rows; no live duplicate NIDs or seating numbers found. |
| `questions` | 52 | Question bank JSON documents. |
| `applicants` | 4 | Applicant JSON projections; all 4 have national IDs, but no phone field in the checked JSON shape. |
| `exams` | 2 | Exam configuration JSON documents. |
| `admissionSetup.applicationSettings.CYC-1779721524770` | 1 | Versioned/draft admission setup JSON for one cycle. |
| `admissionSetup.applicationSettings.CYC-2026-M` | 1 | Versioned/draft admission setup JSON for one cycle. |
| `settings` | 1 | Global admin settings JSON. |

Parallel `admin_v2.admin_records` modules:

| Module | Rows | Notes |
|---|---:|---|
| `grades` | 31,529 | 8,192 live rows, 23,337 soft-deleted rows. |
| `questions` | 52 | Same logical module. |
| `exams` | 2 | Same logical module. |
| `admissionSetup.applicationSettings.CYC-1779721524770` | 1 | Same logical module. |
| `admissionSetup.applicationSettings.CYC-2026-M` | 1 | Same logical module. |
| `settings` | 1 | Same logical module. |

Relevant normalized `dbo` row counts:

| Table | Rows | Notes |
|---|---:|---|
| `dbo.applicant_grades` | 10,000 | Real normalized grade table; unique NID and seat/seating-number indexes exist. |
| `dbo.grade_rows` | 18,373 | Separate grade-row table, likely import/legacy grade store. |
| `dbo.applicant_grade_adjustments` | 3 | Real adjustments table. |
| `dbo.grade_import_batches` | 1 | Import batch tracking. |
| `dbo.grade_import_rows` | 3 | Import row tracking. |
| `dbo.applicants` | 4 | Real normalized applicant table. |
| `dbo.applicant_stage_submissions` | 0 | Real applicant stage table, currently empty. |
| `dbo.cycles` | 6 | Real cycles table. |
| `dbo.categories` | 7 | Real categories table. |
| `dbo.workflows` | 6 | Real workflow definitions. |
| `dbo.committees` | 5 | Real committees table. |
| `dbo.system_users` | 11 | Real user table. |
| `dbo.audit_entries` | 100 | Older/other audit table; staging admin audit lives in schema-local `audit_entries`. |
| `dbo.lookup_items` | 315 | Normalized lookup store. |
| `dbo.admin_lookup_items` | 427 | Admin lookup store. |
| `dbo.admin_cycle_setup_items` | 381 | Admin setup item store. |

Live consistency checks:

- JSON validity: all active staging `admin_records.payload_json` values inspected are valid JSON.
- Staging `grades`: 23,337 total rows, 10,143 live rows, 10,143 live distinct NIDs, 10,143 live distinct seating numbers, 0 live duplicate groups.
- `dbo.applicant_grades`: 10,000 rows, 10,000 distinct NIDs, 10,000 distinct seating numbers.
- Staging `applicants`: 4 rows, 4 distinct national IDs.
- `dbo.applicants`: 4 rows, 4 distinct national IDs.

Decision implication: real tables already exist for several core domains, but they are not consistently the same source as active staging `admin_records`. A normalization pass should first reconcile and map `PACademy_staging_db.admin_records` into the existing normalized tables, not blindly create a second set of tables.

## Current Persistence Model

The current backend and staging database are hybrid:

1. Some domains are real EF/SQL tables inside the configured admin schema.
2. Some domains also exist as older or cross-service normalized tables under `dbo`.
3. Several operational domains are still JSON documents in one generic table, `admin_records`.

### Real EF Tables in the Configured Admin Schema

| Table | Entity | Current purpose | Notes |
|---|---|---|---|
| `lookup_rows` | `LookupRowEntity` | 25 typed lookup catalogs | Keyed by `(lookup_key, code)` with full row JSON in `payload_json`. |
| `admission_cycles` | `AdmissionCycleEntity` | Admission cycle master records | Real table, but detail still in `payload_json`. |
| `applicant_categories` | `ApplicantCategoryEntity` | Applicant category master records | Real table, but conditions/details still in `payload_json`. |
| `admission_rules` | `AdmissionRuleEntity` | Versioned rules by cycle | Unique `(cycle_id, version)`, full rule in JSON. |
| `application_settings_category_configs` | `ApplicationSettingsCategoryConfigEntity` | Admission setup category config | Real table. |
| `application_settings_category_specializations` | `ApplicationSettingsCategorySpecializationEntity` | Category-specialization bindings | Real table. |
| `application_settings_graduation_years` | `ApplicationSettingsGraduationYearEntity` | Per-specialization year/rule rows | Real table with several JSON array columns. |
| `users` | `UserEntity` | Staff users | Real table with unique `national_id`; permissions/details in JSON. |
| `roles` | `RoleEntity` | Role definitions | Real table with unique `key`; permission matrix in JSON. |
| `officer_directory` | `OfficerEntity` | NID-driven staff/officer lookup | Real table keyed by `national_id`. |
| `audit_entries` | `AuditRowEntity` | Durable audit log | Real table. |
| `admin_records` | `AdminRecordEntity` | Generic JSON document store | Composite PK `(module, id)`. Active staging modules are listed above. |

### Existing Normalized `dbo` Tables Relevant to Normalization

The database already contains normalized tables for many domains. Before adding tables, decide whether the target should be these existing `dbo` tables, new tables in `PACademy_staging_db`, or a clean consolidated schema.

| Domain | Existing tables observed |
|---|---|
| Applicants | `dbo.applicants`, `dbo.applicant_stage_submissions` |
| Grades | `dbo.applicant_grades`, `dbo.applicant_grade_adjustments`, `dbo.grade_rows`, `dbo.grade_adjustments`, `dbo.grade_import_batches`, `dbo.grade_import_rows`, `dbo.pending_grade_imports` |
| Identity | ASP.NET identity tables, `dbo.system_users`, `dbo.lockout_states`, `dbo.pending_otps` |
| Admissions | `dbo.cycles`, `dbo.categories`, `dbo.admission_rules`, `dbo.category_tests`, `dbo.category_specializations`, `dbo.category_committees`, `dbo.wizard_step_statuses` |
| Lookups | `dbo.lookup_items`, `dbo.admin_lookup_items`, and specific lookup tables such as `governorates`, `nationalities`, `qualifications`, `universities`, `faculties`, `colleges`, `relationships`, `ranks`, `jobs` |
| Committees | `dbo.committees`, `dbo.committee_members`, `dbo.committee_date_bindings`, `dbo.committee_types`, `dbo.committee_score_thresholds`, `dbo.committee_specializations`, `dbo.committee_merge_split_rules` |
| Exams/setup | `dbo.cycle_exams`, `dbo.exam_types`, `dbo.exam_groups`, `dbo.exam_date_configs`, `dbo.total_score_configs`, `dbo.electronic_declarations` |
| Workflows/reports | `dbo.workflows`, `dbo.reports_operational_status`, `dbo.reports_registration_tempo`, `dbo.reports_stage_funnel` |

### JSON Modules in `admin_records`

These are logical tables hidden inside `admin_records.module`.

| Module | Domain | Current consumers | Recommendation |
|---|---|---|---|
| `applicants` | Applicant master records | Admin applicants, reports, committees, cycles/categories dependency checks | Promote to real `applicants` table. Critical. |
| `grades` | Applicant secondary/Azhar grades | Grades import, eligibility by NID, grade adjustments | Promote to real `applicant_grades` and `applicant_grade_adjustments`. Critical. |
| `payments` | Admin payment ledger | Payments admin, reports, applicant payment flow | No active staging module found in this scan; create/promote when payment backend is wired. |
| `notifications` | Admin-authored notifications | Notifications admin, applicant notifications | No active staging module found in this scan; create/promote when notification backend is wired. |
| `committees` | Committee definitions | Committee app, reports, assignment | Active normalized `dbo.committees` exists; no active staging JSON module found. |
| `committeeInstances` | Per-cycle/date committee instances | Committee schedule, admission setup, capacity | No active staging module found in this scan; create/promote when committee scheduling is wired. |
| `committeeResults` | Committee applicant results | Committee detail/results | No active staging module found in this scan; create/promote when committee results are wired. |
| `workflows` | Department workflow definitions | Workflow builder, applicant transitions | Active normalized `dbo.workflows` exists; no active staging JSON module found. |
| `applicantWorkflowProgress` | Applicant workflow state | Applicant detail/progress | No active staging module found in this scan; create/promote when applicant workflow state is wired. |
| `workflowTransitions` | Applicant workflow transition log | Applicant timeline | No active staging module found in this scan; create/promote when workflow transition writes are wired. |
| `questions` | Question bank | Exams module | Promote to `exam_questions`, options/subitems as child JSON or tables. Near-term. |
| `exams` | Exam configuration | Exams module | Promote to `exams`, `exam_question_links`. Near-term. |
| `exam-attempts` | Applicant exam attempts | Exams take/proctor/results | Promote to `exam_attempts`, `exam_answers`. Critical for write/read performance. |
| `exam-live-sessions` | Live proctor sessions | Proctor monitoring | Promote to `exam_sessions` or ephemeral/cache-backed table. Near-term. |
| `examPlans` | Cycle/category exam plan | Admission setup/exam results | Promote to `cycle_category_exam_plans`. Critical. |
| `examResults` | Exam result records/callbacks | Exam plan result entry/device callbacks | Promote to `exam_results`. Critical. |
| `admissionSetup.examScheduleDays` | Per-category exam schedule days | Admission setup wizard | Promote to `exam_schedule_days`. Near-term. |
| `admissionSetup.committeeBindings` | Committee/category bindings | Admission setup wizard | Promote to `committee_category_bindings`. Near-term. |
| `admissionSetup.applicationSettings.{cycleId}` | Draft/local admission setup rows | Eligibility draft overlay | Split into normalized draft tables or add versioned draft table. Near-term. |
| `settings` | Admin global settings | Settings/auth policy | Promote to `admin_settings` key-value table. Low volume. |
| `kpis` | Dashboard KPI snapshot | Dashboard stats fallback | Should be derived/materialized, not hand-authored JSON. |
| `last14Days` | Dashboard/report time series | Reports | Should be derived/materialized. |
| `categories`, `cycles`, `audit` | Legacy seeded modules | Seed cleanup/old reports | Superseded by real tables; should not remain active. |

## App Data Inventory by Surface

### PUBLIC / Applicant-Facing

| Data | Frontend source/contract | Current backend storage | Target table shape |
|---|---|---|---|
| Active cycles | `/api/applicant/cycles/active` | `admission_cycles` | Keep real table. |
| Public categories | `/api/applicant/categories` | `applicant_categories` + `lookup_rows` | Keep, add bridge tables for category rules. |
| Eligibility check | `/api/applicant/eligibility`, `/api/applicants/{nationalId}/eligible-categories` | Reads grades from `admin_records:grades`; settings from real tables + draft JSON | Move grade lookup to `applicant_grades`; draft rules to normalized draft/version tables. |
| Applicant auth/session | `/applicant/auth/initiate`, `/verify` | Not implemented in current admin backend | Add `applicant_auth_sessions` and/or OTP/session table in applicant backend. |
| Applicant draft/stages | `/applicant/draft/:id`, `/applicant/stage/:id/:stage` | Frontend mock only/current contract | Add `applicant_drafts`, stage tables or structured JSON sections keyed by applicant. |
| Family data | Applicant wizard family/acquaintance doc | Frontend mock/contract | Add `applicant_family_members`, `applicant_acquaintance_documents`. |
| Payment intent/status | Applicant payment APIs | `admin_records:payments` for admin ledger | Add `payments`, `payment_events`, external refs. |
| Exam slots/reservations | Applicant exam slot APIs | Mock/test schedules/admin records | Add `exam_slots`, `exam_reservations`. |

### STAFF / Admin

| Data | Current backend storage | Target decision |
|---|---|---|
| Applicants | `admin_records:applicants` | Real `applicants` table plus child tables for addresses/contact/education/family if needed. |
| Applicant grades | `admin_records:grades` | Real `applicant_grades`; separate `applicant_grade_adjustments`; optional import batch tables. |
| Users/roles/officers | `users`, `roles`, `officer_directory` | Already real. Keep, normalize role permissions if matrix querying becomes important. |
| Lookups | `lookup_rows` | Already real enough for low/medium volume. Can split high-value lookups later, but not urgent. |
| Cycles/categories/rules | Mixed real tables + JSON payloads | Keep real master tables; normalize frequently queried rule dimensions. |
| Admission setup | `application_settings_*` tables plus draft JSON modules | Mostly real. Normalize draft records and committee/exam schedule modules. |
| Payments | `admin_records:payments` | Real `payments`, `payment_events`, refund records. |
| Notifications | `admin_records:notifications` | Real notification tables. |
| Audit | `audit_entries` | Already real. Add indexes by module/entity/created_at. |
| Reports/KPIs | Derived from applicants, payments, committees, audit, grades | Should query real tables or materialized/reporting views. |

### STAFF / Committee

| Data | Current backend storage | Target decision |
|---|---|---|
| Committee definitions | `admin_records:committees` and lookup `committees` | Normalize as `committees`; lookup can remain a display catalog or be folded in. |
| Committee instances/schedule | `admin_records:committeeInstances` | Real `committee_instances` with `(cycle_id, date, committee_id)` indexes. |
| Committee results | `admin_records:committeeResults` | Real `committee_results` with applicant FK. |
| Applicant queue by committee/date | Derived by scanning applicants/instances | Query by indexed assignment table. |

### STAFF / Exams

| Data | Current backend storage | Target decision |
|---|---|---|
| Question bank | `admin_records:questions` | Real `exam_questions`; options can be JSON initially. |
| Exams/configs | `admin_records:exams` | Real `exams`, `exam_question_links`. |
| Attempts/answers | `admin_records:exam-attempts` | Real `exam_attempts`, `exam_answers`; critical for proctor/results. |
| Live proctor sessions | `admin_records:exam-live-sessions` | Real/ephemeral `exam_sessions` table with heartbeat indexes. |
| Exam plans/results | `admin_records:examPlans`, `examResults` | Real `cycle_category_exam_plans`, `exam_results`. |

### STAFF / Medical, Investigations, Board, Barcode, Biometric

The frontend has integration contracts for these surfaces, but the current admin backend does not implement equivalent real modules for most of them yet.

| Domain | Frontend contract | Current checked-in backend | Target tables |
|---|---|---|---|
| Medical stations/results/certificates | `/api/medical/*` | Mock/front-end contract only | `medical_stations`, `medical_queue`, `medical_results`, `medical_certificates`. |
| Investigations/cases/letters/distribution | `/api/investigations/*` | Mock/front-end contract only | `investigation_cases`, `investigation_assignments`, `investigation_letters`, `investigators`. |
| Board members/sessions/votes/decisions | `/api/board/*` | Mock/front-end contract only | `board_members`, `board_sessions`, `board_votes`, `board_decisions`. |
| Barcode records/scans/replacements | `/api/barcode/*` | Mock/front-end contract only | `barcode_records`, `barcode_scans`, `barcode_replacements`. |
| Biometric enrollments/verifications | `/api/biometric/*` | Mock/front-end contract only | `biometric_enrollments`, `biometric_verifications`, station/device tables. |

## Recommended Target Architecture

My recommendation: **normalize core transactional aggregates into real SQL Server tables, keep JSON only for flexible leaf payloads and audit snapshots.**

Why:

- This app is not just a demo CRUD shell anymore. It has high-volume lists, imports, workflows, queues, eligibility, reporting, and cross-surface joins.
- `admin_records` is useful for quick demo coverage, but it makes every cross-entity query expensive and fragile.
- Real tables give clear ownership, FK constraints, unique constraints, better indexes, better migrations, and cleaner applicant/admin backend separation.

## Proposed Table Groups

### 1. Admissions Core

Keep/enhance:

- `admission_cycles`
- `applicant_categories`
- `admission_rules`
- `application_settings_category_configs`
- `application_settings_category_specializations`
- `application_settings_graduation_years`

Add:

- `cycle_categories`
- `category_conditions` or versioned rule rows
- `admission_setup_drafts`
- `admission_setup_publish_events`

### 2. Applicants Core

Add:

- `applicants`
- `applicant_contacts`
- `applicant_addresses`
- `applicant_education`
- `applicant_documents`
- `applicant_family_members`
- `applicant_status_history`
- `applicant_workflow_progress`
- `applicant_workflow_transitions`

High-value indexes:

- Unique `(cycle_id, national_id)`.
- `(cycle_id, status, department_id, id)`.
- `(cycle_id, governorate_code, cert_type, id)`.
- `(registered_at DESC, id)`.

### 3. Grades

Add:

- `applicant_grades`
- `applicant_grade_adjustments`
- `grade_import_batches`
- `grade_import_rows` for audit/replay of uploads if needed.

High-value indexes:

- Unique live `(cycle_id, national_id)`.
- Unique live `(cycle_id, seating_number)` where seating number is not null.
- `(cycle_id, school_category_code, graduation_year, branch, kind, seat)`.
- `(national_id)` for eligibility lookup.
- `(grade_changed_at, seat)` for changed-only views.

### 4. Payments and Notifications

Add:

- `payments`
- `payment_events`
- `refund_requests`
- `notifications`
- `notification_audiences`
- `notification_deliveries`

### 5. Committees and Scheduling

Add:

- `committees`
- `committee_instances`
- `committee_category_bindings`
- `committee_applicant_assignments`
- `committee_results`
- `exam_schedule_days`

### 6. Exams

Add:

- `exam_questions`
- `exam_question_versions`
- `exams`
- `exam_question_links`
- `exam_attempts`
- `exam_answers`
- `exam_sessions`
- `exam_results`
- `cycle_category_exam_plans`

### 7. Operational Apps

Add as each backend module is implemented:

- Medical: `medical_stations`, `medical_results`, `medical_certificates`.
- Investigations: `investigation_cases`, `investigation_assignments`, `investigation_letters`.
- Board: `board_members`, `board_sessions`, `board_votes`, `board_decisions`.
- Barcode: `barcode_records`, `barcode_scans`.
- Biometric: `biometric_enrollments`, `biometric_verifications`.

## Options

### Option A: Patch `admin_records` with computed columns and indexes

Best for: fastest performance relief with minimal app changes.

Pros:

- Low migration surface.
- Improves grades/applicants hot paths quickly.
- Does not require rewriting every controller immediately.

Cons:

- Keeps weak separation of concerns.
- Still depends on JSON discipline.
- Does not give clean FKs or type constraints.

I would only use this if the demo deadline requires quick relief before deeper backend work.

### Option B: Normalize applicants and grades first, leave other modules in JSON

Best for: best balance right now.

Pros:

- Fixes the hottest domains first.
- Gives immediate performance and data integrity wins.
- Keeps scope manageable.
- Creates a pattern for migrating the rest.

Cons:

- Requires service rewrites for applicants/grades.
- Needs data backfill from `admin_records` and/or seed sources.
- Temporary dual-read/dual-write or cutover strategy is needed.

This is my recommended next implementation path.

### Option C: Full normalized schema for all 9 apps in one program

Best for: clean long-term architecture.

Pros:

- Best separation of concerns.
- Strong constraints everywhere.
- Reporting becomes much simpler.

Cons:

- Large migration and rewrite blast radius.
- Harder to verify before demo.
- More likely to stall because many operational backend modules are still frontend-contract/mock only.

I do not recommend doing this in one jump.

## Recommended Decision

Proceed with **Option B**:

1. Create real `applicants` and `applicant_grades` table designs first.
2. Add supporting child tables only where the current UI/workload needs them now:
   - `applicant_grade_adjustments`
   - `grade_import_batches`
   - `applicant_workflow_progress`
   - `applicant_workflow_transitions`
3. Keep `admin_records` as temporary compatibility storage for low-volume modules.
4. Then migrate committees/schedules/payments next, because they join heavily with applicants.
5. Leave medical/investigations/board/barcode/biometric table design for their backend implementation phases.

## Next Decision Needed

Before migration planning, choose the cutover strategy:

1. **Clean cutover:** create real tables, backfill, update services to read/write real tables, leave old JSON modules read-only for rollback.
2. **Dual-write transition:** services write both real tables and `admin_records` for one release, then remove JSON writes.
3. **Read-through fallback:** services read real tables first and fall back to `admin_records` until backfill is verified.

My recommendation is **read-through fallback for applicants/grades**, then remove fallback once row counts and route tests match.
