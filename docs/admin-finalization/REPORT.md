# Admin Finalization Report

**Date:** 2026-05-21

## Completed

- Provisioned local .NET SDK `10.0.300` under `/Users/mac/.dotnet`.
- Added repo-local `global.json` so this checkout uses the sprint SDK.
- Created `backend/admin/PACademy.Admin.slnx`.
- Created admin API and shared projects:
  - `backend/admin/PACademy.Admin.Api`
  - `backend/shared/PACademy.Shared.Contracts`
  - `backend/shared/PACademy.Shared.Audit`
- Added shared error envelope and domain exceptions.
- Added EF `AdminDbContext` with snake_case mappings and audit columns.
- Added OpenAPI and Scalar.
- Implemented `LookupsAdmin` concrete backend slice.
- Implemented `AdmissionsAdmin` concrete backend basics for cycles, categories, and admission rules.
- Implemented `Identity` concrete backend basics for users, roles, and officer directory.
- Implemented `AdminRecords` backend seed/store for applicants, payments, audit, notifications, committee instances, workflows, reports, and settings.
- Added concrete admission-setup endpoints for app settings, exam schedule, committee bindings, declarations, and exam-date config.
- Added concrete auth, officer lookup, committee, and exam-plan/result endpoints.
- Removed `AdminFallbackController`; OpenAPI has no catchall fallback route.
- Generated initial SQL Server migration and wired startup migration application for real `AdminDb` connection strings.

## Verification

```bash
dotnet build backend/admin/PACademy.Admin.slnx
```

Result: clean build, 0 warnings, 0 errors.

Runtime smoke-tested on:

```text
http://localhost:5101
```

Confirmed:

- `/openapi/v1.json`
- `/scalar`
- `/api/lookups/faculties`
- `/api/cycles`
- `/api/admin/categories`
- `/api/admission-rules/CYC-2026-M/current`
- `/api/users`
- `/api/roles`
- `/api/applicants`
- `/api/admin/payments`
- `/api/audit`
- `/api/committee-instances`
- `/api/admin/app-settings/category-configs`
- `/api/auth/login`
- `/v1/officers/lookup`
- `/api/committees`
- `/api/exams/results/can-enter`
- SQL Server migration file exists under `Persistence/Migrations`.
- duplicate lookup conflict envelope
- active-cycle conflict envelope
- lookup FK delete guard

## Remaining

The admin pages are routed to real HTTP and the major admin domains now have concrete controllers. Remaining hardening work is to replace JSON-record implementations with full per-domain use cases where deeper business rules are needed:

1. ApplicantGrades parser/import persistence beyond empty import envelopes.
2. Reports aggregate calculations beyond lightweight seeded-data responses.
3. Admission setup business-rule conflicts for every wizard mutation.
4. Running the generated migration against the real SQL Server once a connection string is available.
5. Replacing lightweight endpoint shells with richer use cases where product behavior needs more than seeded JSON.

The backend now fails visibly for unknown routes because the fallback controller is gone.
