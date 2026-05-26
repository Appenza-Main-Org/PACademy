# Staging Admin Records Normalization Status

Date: 2026-05-26

Environment: `Uat`

Database: `PACademy`

Schema: `PACademy_staging_db`

## Applied

The full normalization migration in `docs/db/migrations/20260526_full_normalize_admin_records_staging.sql` has been applied to staging.

Business entities that were previously active only through `admin_records` now have real relational tables:

| Entity | Normalized tables |
|---|---|
| Applicants | `applicants` |
| Applicant grades | `applicant_grades`, `applicant_grade_adjustments` |
| Exam questions | `exam_questions`, `exam_question_options`, `exam_question_matching_pairs` |
| Exams | `exams`, `exam_rules`, `exam_question_links` |
| Admin settings | `admin_settings` |
| Cycle application settings | `cycle_application_settings`, `cycle_application_setting_headers`, `cycle_application_setting_values`, `cycle_application_setting_entries` |
| Admission cycle payload fields | normalized columns on `admission_cycles` |

`payload_json` remains in the normalized tables as a compatibility snapshot for the current frontend response contract. It is not the only storage location for the entity.

## Verification Counts

Final staging verification after applying the migration:

| Item | Count |
|---|---:|
| `admin_records.grades.total` | 23,337 |
| `admin_records.grades.live` | 10,143 |
| `applicant_grades` | 10,000 |
| `applicants` | 4 |
| `applicant_grade_adjustments` | 0 |
| `admin_records.questions` | 52 |
| `exam_questions` | 52 |
| `exam_question_options` | 205 |
| `exam_question_matching_pairs` | 3 |
| `admin_records.exams` | 2 |
| `exams` | 2 |
| `exam_rules` | 4 |
| `exam_question_links` | 70 |
| `admin_settings` | 1 |
| `cycle_application_settings` | 2 |
| `cycle_application_setting_headers` | 8 |
| `cycle_application_setting_values` | 16 |
| `cycle_application_setting_entries` | 17 |

Known reconciliation issues logged in `admin_record_normalization_issues`:

| Issue | Entity | Rows |
|---|---|---:|
| `INVALID_GRADE_SOURCE_ROW` | `grade` | 143 |
| `SOFT_DELETED_GRADES_SKIPPED` | `grade` | 1 |

## Backend/API Update

`AdminRecordsService` now routes these modules to normalized relational tables when the configured EF provider is relational:

- `applicants`
- `grades`
- `questions`
- `exams`
- `settings`
- `admissionSetup.applicationSettings.{cycleId}`

The in-memory test provider continues to use `admin_records`, so existing tests and local demo fallbacks keep working.

`GET /api/grades` now uses a server-paged SQL path over `applicant_grades`, preserving the existing frontend response shape with `rows`, `total`, `summary`, and `facets`.

Applicant eligibility lookups now read:

- grade data from `applicant_grades`
- cycle draft rules from `cycle_application_settings`

## API Smoke Tests

Staging-backed local API smoke checks were run against `http://127.0.0.1:5101`:

| Endpoint | Result |
|---|---|
| `/health` | `200` |
| `/api/grades?page=1&pageSize=3` | normalized grade rows returned |
| `/api/applicants?page=1&pageSize=3` | normalized applicant rows returned |
| `/api/questions` | 52 normalized questions returned |
| `/api/exams` | 2 normalized exams returned |
| `/api/admin/settings` | normalized settings row returned |
| `/api/admin/app-settings/cycle-drafts/CYC-2026-M` | normalized cycle application settings returned |
| `/api/admin/app-settings/cycle-drafts/CYC-2026-CLOSED` | empty normalized draft shell returned |

## Tests

- `dotnet build backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --no-restore`
- `dotnet test backend/admin/PACademy.Admin.Api.Tests/PACademy.Admin.Api.Tests.csproj --no-restore`

Result: build passed, 27/27 tests passed.

## Remaining Work

`admin_records` still exists as a legacy source and rollback shadow. It was intentionally not deleted or truncated.

Before deleting legacy rows, take a backup and get explicit destructive-change approval.

Recommended next steps:

1. Promote the SQL script into an EF migration or a deployment-controlled DBA script.
2. Add first-class services/controllers for each normalized domain instead of routing through `AdminRecordsService`.
3. Move history and invalid grade rows into dedicated archive/remediation tables if the business wants them queryable outside the issue log.
4. Stop emitting compatibility `payload_json` once the frontend and APIs are fully typed on normalized columns.
