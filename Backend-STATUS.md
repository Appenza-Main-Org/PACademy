# PACademy Backend — Status Summary (2026-05-21)

## Done

### Faculties / initial lookups slice

| Endpoint | Backend | Verb | Shape |
|---|---|---|---|
| `/api/lookups/faculties` | Admin :5101 | GET | `FacultyAdminDto[]` |
| `/api/lookups/faculties` | Admin :5101 | POST | Creates faculty; validation envelope; `LOOKUP_CODE_DUPLICATE` conflict |
| `/api/lookups/faculties` | Applicant :5102 | GET | `FacultyPublicDto[]` |

### Applicant grades

| Endpoint | Backend | Verb | Shape |
|---|---|---|---|
| `/api/admin/applicant-grades` | Admin :5101 | GET | Paginated `{ rows, total }` when `page/size` is provided; otherwise `GradeRowDto[]` |
| `/api/grades` | Admin :5101 | GET | Compatibility alias for the frontend service JSDoc |
| `/api/admin/applicant-grades/export` | Admin :5101 | GET | Full filtered `GradeRowDto[]` |
| `/api/admin/applicant-grades/by-nid/{nid}` | Admin :5101 | GET | `GradeRowDto?` |
| `/api/admin/applicant-grades/import/stage` | Admin :5101 | POST | Legacy staged import result with duplicates/skipped rows |
| `/api/admin/applicant-grades/import/commit` | Admin :5101 | POST | Legacy staged commit result |
| `/api/admin/applicant-grades/import/preflight` | Admin :5101 | POST | V2 import preflight `ImportReport` |
| `/api/admin/applicant-grades/import/v2/commit` | Admin :5101 | POST | V2 import commit counts |
| `/api/admin/applicant-grades/{seat}/adjustments` | Admin :5101 | POST | Adds adjustment without mutating imported total |
| `/api/admin/applicant-grades/{seat}/adjustments/{adjustmentId}` | Admin :5101 | PATCH/DELETE | Toggle or delete adjustment |
| `/api/admin/applicant-grades/{seat}/override-max` | Admin :5101 | PATCH | Update/reset override max |
| `/api/admin/applicant-grades/by-nid/{nid}` | Applicant :5102 | GET | Read-only mirror, URL intentionally kept under `/api/admin/...` for frontend compatibility |

DB tables created by `ApplicantGradesAdminDbContext`:

| Table | Notes |
|---|---|
| `applicant_grades` | Imported original grade rows; includes computed-input fields from the frontend `GradeRow` shape |
| `applicant_grade_adjustments` | Active/inactive adjustment log; original imported total stays unchanged |
| `grade_import_batches` | Staged import batch metadata |
| `grade_import_rows` | Staged raw row payloads + validation status |

Frontend parity notes:

- The frontend applicant-grades mock starts with `STATE: GradeRow[] = []`, so the backend seed is intentionally empty.
- Import commit/preflight mirrors `frontend/src/features/applicant-grades/api/grades.service.ts` including NID validation, upload duplicate resolution, school-category max-grade defaults, duplicate existing-row handling, and Arabic/digit search behavior.
- List DTOs include server-computed `effectiveGrade`, `hasAdjustment`, `adjustmentCount`, and `latestAdjustmentReason`.

## Pending

| Module | Status |
|---|---|
| Remaining typed lookups | Audit found large coverage gaps on `backend-init`; needs explicit gap-fill work |
| AdmissionsAdmin / AdmissionsRead | Pending |
| Identity / MOI dev client | Pending |
| ApplicantPortal | Pending |
| PaymentsApplicant | Pending |
