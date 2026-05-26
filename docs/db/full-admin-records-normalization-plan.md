# Full Admin Records Normalization Plan

Date: 2026-05-26

## Goal

No business entity should remain stored only in `admin_records`.

`admin_records` may remain temporarily as a legacy import/source table during migration, but the application should read and write real SQL tables for every domain.

## Active Staging Modules To Remove From `admin_records`

Live active modules in `PACademy_staging_db.admin_records`:

| Module | Current rows | Target normalized tables |
|---|---:|---|
| `grades` | 23,337 total / 10,143 live | `applicant_grades`, `applicant_grade_adjustments`, grade issue/history table |
| `applicants` | 4 | `applicants`, later child applicant profile tables |
| `questions` | 52 | `exam_questions`, `exam_question_options`, `exam_question_matching_pairs` |
| `exams` | 2 | `exams`, `exam_rules`, `exam_question_links` |
| `settings` | 1 | `admin_settings` typed settings row |
| `admissionSetup.applicationSettings.{cycleId}` | 2 | `cycle_application_settings`, `cycle_application_setting_headers`, `cycle_application_setting_values`, `cycle_application_setting_entries` |

Also normalize cycle payload fields already sitting inside `admission_cycles.payload_json`.

## Current Reality

Already real but still partly JSON:

- `admission_cycles`: real table, but details like `cohort`, `openDate`, `closeDate`, `expectedCapacity`, `openCategories`, `conditionOverrides` remain in `payload_json`.
- `application_settings_category_configs`: real table.
- `application_settings_category_specializations`: real table.
- `application_settings_graduation_years`: real table, currently `0` rows in staging.

Still entity JSON:

- cycle application settings drafts live in two `admin_records` modules.
- exam questions and exam configs live in `admin_records`.
- grades/applicants still read/write through `admin_records` in the backend.

## Required Normalized Tables

### Applicants and Grades

- `PACademy_staging_db.applicants`
- `PACademy_staging_db.applicant_grades`
- `PACademy_staging_db.applicant_grade_adjustments`
- `PACademy_staging_db.admin_record_normalization_issues`

Rules:

- Only live grade rows with valid 14-digit NIDs become active `applicant_grades`.
- Invalid short-NID rows are quarantined.
- Soft-deleted grade rows are not active grades; move them to history/archive in a follow-up table.

### Exams

- `PACademy_staging_db.exam_questions`
- `PACademy_staging_db.exam_question_options`
- `PACademy_staging_db.exam_question_matching_pairs`
- `PACademy_staging_db.exams`
- `PACademy_staging_db.exam_rules`
- `PACademy_staging_db.exam_question_links`
- Later, for runtime writes: `exam_attempts`, `exam_answers`, `exam_sessions`.

### Admin Settings

- `PACademy_staging_db.admin_settings`

Known typed columns from current frontend/backend:

- `exam_days_per_applicant`
- `exam_slot_selection_window_days`

### Cycles

Enhance `PACademy_staging_db.admission_cycles` with real columns:

- `cohort`
- `open_date`
- `close_date`
- `expected_capacity`
- `deleted_at`
- `deleted_by`
- `delete_reason`

Keep `payload_json` temporarily for compatibility until the service rewrite lands.

### Cycle Application Settings

Normalize `admissionSetup.applicationSettings.{cycleId}` into:

- `cycle_application_settings`
- `cycle_application_setting_headers`
- `cycle_application_setting_values`
- `cycle_application_setting_entries`

Reason for the generic values/entries table:

- Header payloads contain category-specific arrays like graduation years, marital statuses, divisions, school categories, and approved/local sets.
- Putting those arrays into child rows gives queryable relational data without inventing one nullable column per category-specific rule.

## Backend Rewrite Required

Database normalization alone is not enough. The backend currently still calls `AdminRecordsService` for these entities:

- Applicants
- Grades
- Questions
- Exams
- Admin settings
- Admission setup cycle drafts
- Several future modules such as payments, notifications, committees, workflows, exam plans, and committee instances

After backfill, replace those calls with real services:

- `ApplicantsService`
- `GradesService`
- `ExamCatalogService`
- `AdminSettingsService`
- `CycleApplicationSettingsService`

Then keep `admin_records` read-only or disabled for those modules.

## Safe Execution Order

1. Create normalized tables.
2. Backfill from `PACademy_staging_db.admin_records`.
3. Verify counts and invalid-row issue logs.
4. Rewrite backend read paths.
5. Rewrite backend write paths.
6. Run route/API smoke tests against staging.
7. Stop writing those modules into `admin_records`.
8. Archive or drop `admin_records` rows only after backup and explicit destructive approval.

## Do Not Do Yet

- Do not delete `admin_records`.
- Do not truncate modules.
- Do not drop `payload_json` columns from existing EF tables until backend services no longer depend on them.
- Do not backfill invalid short-NID grade rows as valid applicants or valid grades.
