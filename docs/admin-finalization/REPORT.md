# Admin Finalization Report

**Date:** 2026-05-22

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
- Converted admin-facing frontend service bodies to API-only calls through `frontend/src/shared/lib/api-client.ts`.
- Removed admin service fallback reads from `MOCK`, `simulateLatency`, and `paginate`.
- Added missing backend route coverage for the API-only frontend: category restore, app-settings eligible/grading/parent reads, exam-schedule aggregate shape, lock-policy shape, and grade import envelopes.
- Added seeded-data-backed reports aggregates for the admin command-center sections.
- Added JSON-record-backed applicant-grade list/import/delete/adjustment persistence.
- Added persistent exam-plan reads, saves, and copy support.
- Added seeded category-config and app-settings summary responses for the admission setup pages.
- Added ESLint 9 flat config and npm lint dependencies so `npm --prefix frontend run lint` is now runnable.
- Added Railway-ready admin API deployment support: `PORT` binding, `/health`, configurable CORS, publish-time seed files, and `backend/admin/Dockerfile`.
- Added backend mutation audit emissions for JSON-record-backed admin modules.
- Added admission setup conflict guards for invalid date ranges, duplicate committee bindings, invalid percentage ranges, and capacity overflow.
- Added legacy grade import commit persistence alongside the v2 grade import flow.

## Verification

```bash
dotnet build backend/admin/PACademy.Admin.slnx
```

Result: clean build, 0 warnings, 0 errors.

```bash
node frontend/node_modules/typescript/lib/tsc.js -p frontend/tsconfig.json --noEmit
```

Result: clean frontend typecheck.

Runtime smoke-tested on:

```text
http://localhost:5101
```

Automated smoke script:

```bash
bash backend/admin/scripts/smoke-admin-api.sh http://localhost:5101
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

Frontend route smoke:

```bash
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node frontend/scripts/test-routes.mjs http://127.0.0.1:5173
```

Result: 74 passed, 0 failed.

Frontend lint:

```bash
/usr/local/bin/npm --prefix frontend run lint
```

Result: clean lint run.

Admin mock-read grep:

```bash
rg "MOCK\.|from '@/shared/mock-data'|simulateLatency|paginate\(" \
  frontend/src/features/admin frontend/src/features/lookups \
  frontend/src/features/applicant-grades frontend/src/features/applicants \
  frontend/src/features/audit frontend/src/features/auth/api \
  frontend/src/features/committees/api/committeeInstance.service.ts
```

Result: zero hits.

Browser smoke:

- Opened `http://127.0.0.1:5173/staff-login` with `VITE_API_BASE_URL=http://localhost:5101`.
- Session resolved to `/admin/reports`.
- Arabic admin chrome, sidebar, and reports shell rendered with seeded backend data.
- Screenshot captured at `docs/admin-finalization/screenshots/smoke-admin-reports.png`.

Role-by-route screenshot matrix:

- Captured 429 screenshots covering 11 roles × 39 admin/admin-owned routes.
- Summary: `docs/admin-finalization/screenshots/role-route-matrix/SUMMARY.md`.
- Result: 0 failures after denied applicant access to committee routes redirected to the applicant home.

Expanded backend hardening smoke:

- `/health` returned `{ status: "ok" }`.
- Invalid admission exam date range returned `conflictCode: "EXAM_DATE_RANGE_INVALID"`.
- Grade import commit inserted a JSON-record-backed grade row.
- `/api/audit` included backend-emitted audit entries for the grade import mutation.

## Remaining

The admin pages are routed to real HTTP, the admin service layer no longer reads frontend mocks, the major admin domains now have concrete controllers, and the deployment prep is in place. Remaining production-environment work:

1. Running the generated migration against the real SQL Server once a connection string is available.
2. Wiring the deployed Vercel frontend URL into the Railway `CORS_ALLOWED_ORIGINS` variable after the final Vercel domain is assigned.
3. Re-running the same smoke checks against the production Vercel/Railway URLs after deployment.

The backend now fails visibly for unknown routes because the fallback controller is gone.
