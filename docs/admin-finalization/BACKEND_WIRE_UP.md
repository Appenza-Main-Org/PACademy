# Admin Backend Wire-Up Runbook

**Date:** 2026-05-22
**Backend:** `backend/admin/` on `http://localhost:5101`

## Environment

```bash
export DOTNET_ROOT="$HOME/.dotnet"
export PATH="$HOME/.dotnet:$PATH"
dotnet build backend/admin/PACademy.Admin.slnx
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
```

The repo has a local `global.json` pinned to SDK `10.0.300` so it is not affected by `/Users/mac/global.json`.

## Migration Status

Initial SQL Server migration generated:

```text
backend/admin/PACademy.Admin.Api/Persistence/Migrations/20260521200238_InitialAdminSchema.cs
```

Startup behavior:

- empty `ConnectionStrings:AdminDb` -> EF InMemory + `EnsureCreatedAsync()` for local smoke
- non-empty `ConnectionStrings:AdminDb` -> SQL Server + `MigrateAsync()` before seeders

Local EF tool manifest:

```text
dotnet-tools.json
```

## Concrete Modules Shipped

### LookupsAdmin

Seed source:

```text
frontend/src/features/lookups/mock/lookups.mock.ts
backend/admin/PACademy.Admin.Api/SeedData/lookups.seed.json
```

Seed size: 25 lookup dictionaries, 427 rows.

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/lookups/{key}` | Supports `isActive`, `search`. |
| POST | `/api/lookups/{key}` | Generates next code from `LOOKUP_META` when omitted. |
| PATCH | `/api/lookups/{key}/{code}` | Merges patch into the stored row JSON. |
| DELETE | `/api/lookups/{key}/{code}` | Returns `{ deleted: false, reason, referenceCount }` for FK blocks. |

Typed conflicts:

- Duplicate code returns `{ code: "CONFLICT", conflictCode: "DUPLICATE_CODE" }`.
- FK delete guards mirror frontend mock checks for relationships, jobs, governorates, faculties, applicant categories, submission types, and applicant divisions.

### AdmissionsAdmin

Seed sources:

```text
frontend/src/shared/mock-data/admissionCycles.ts
frontend/src/features/lookups/mock/lookups.mock.ts#applicant-categories
backend/admin/PACademy.Admin.Api/SeedData/admissions.seed.json
```

Seed size: 5 cycles, 4 categories, 5 admission rules.

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/cycles` | Returns seeded cycles sorted by year. |
| GET | `/api/cycles/active` | Returns the single active cycle. |
| GET | `/api/cycles/{id}` | Returns one cycle. |
| POST | `/api/cycles` | Creates cycle; enforces single-active invariant. |
| PATCH | `/api/cycles/{id}` | Updates cycle JSON. |
| POST | `/api/cycles/{id}/activate` | Enforces `ACTIVE_CYCLE_EXISTS` unless `swap=true`. |
| POST | `/api/cycles/{id}/set-active` | Atomic activation swap. |
| POST | `/api/cycles/{id}/transition` | Updates status. |
| POST | `/api/cycles/{id}/close` | Closes cycle. |
| POST | `/api/cycles/{id}/extend` | Updates close date and marks extended. |
| POST | `/api/cycles/{id}/archive` | Archives cycle. |
| PATCH | `/api/cycles/{id}/categories/{key}` | Updates per-cycle category config. |
| GET | `/api/admin/categories` | Locked 4-category set. |
| GET | `/api/admin/categories/{key}` | Returns one category. |
| PATCH | `/api/admin/categories/{key}` | Updates editable category fields. |
| GET | `/api/admin/categories/{key}/dependencies` | Dependency envelope. |
| POST | `/api/admin/categories/{key}/preview-rule-change` | Impact preview placeholder. |
| PATCH | `/api/admin/categories/{key}/conditions` | Updates expanded conditions. |
| GET | `/api/admission-rules?cycleId=` | Versioned rule list. |
| GET | `/api/admission-rules/{cycleId}/current` | Latest rule version. |
| POST | `/api/admission-rules` | Appends a new version. |

Typed conflicts:

- Second active cycle returns `{ code: "CONFLICT", conflictCode: "ACTIVE_CYCLE_EXISTS" }`.
- Locked category delete returns `{ code: "CONFLICT", conflictCode: "IN_USE" }`.

### Identity / Users / Roles

Seed sources:

```text
frontend/src/shared/mock-data/roles.ts
frontend/src/shared/mock-data/officers.ts
frontend/src/shared/mock-data/index.ts#USER_SEED
backend/admin/PACademy.Admin.Api/SeedData/identity.seed.json
```

Seed size: 12 roles, 12 officer-directory rows, 10 users.

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/users` | System user list. |
| GET | `/api/users/{id}` | One system user. |
| POST | `/api/users` | NID-driven create, rejects duplicate NID. |
| PATCH | `/api/users/{id}` | Updates user JSON and account status mirrors. |
| POST | `/api/users/{id}/status` | Account status toggle. |
| POST | `/api/users/{id}/deactivate` | Legacy inactive alias. |
| POST | `/api/users/{id}/reset-2fa` | Acknowledgement endpoint. |
| GET | `/api/users/{id}/activity` | Empty activity list until Audit module is fully ported. |
| GET | `/api/roles` | Role matrix rows. |
| GET | `/api/roles/{id}` | One role. |
| POST | `/api/roles` | Creates custom role, rejects duplicate key. |
| PATCH | `/api/roles/{id}` | Updates role JSON. |
| GET | `/api/roles/{id}/dependencies` | Counts users assigned to the role. |
| POST | `/api/roles/{id}/soft-delete` | Marks deleted timestamp. |
| POST | `/api/roles/{id}/restore` | Clears deleted timestamp. |

Typed conflicts:

- Duplicate user NID returns `USER_NID_DUPLICATE`.
- Duplicate role key returns `ROLE_KEY_DUPLICATE`.

### AdminRecords / Remaining Admin Surfaces

Seed source:

```text
frontend/src/shared/mock-data/index.ts
backend/admin/PACademy.Admin.Api/SeedData/admin-records.seed.json
```

Seed size: 6,451 backend records:

- 2,847 applicants
- 2,847 admin payments
- 687 audit entries
- 15 committee instances
- 6 workflows
- 4 notifications
- workflow progress and transition records
- KPI singleton

Concrete endpoint groups now covered:

- `/api/applicants`, `/api/v1/applicants/*`
- `/api/admin/payments/*`
- `/api/admin/notifications/*`
- `/api/committee-instances/*`
- `/api/v1/admin/workflows/*`
- `/api/audit/*`
- `/api/admin/reports/*`
- `/api/admin/settings`
- `/api/grades/*`
- `/api/admin/app-settings/*`
- `/api/admin/exam-schedule/*`
- `/api/admin/committee-bindings/*`
- `/api/admission-setup/*`
- `/api/auth/*`
- `/v1/officers/lookup`
- `/api/committees/*`
- `/api/exams/*`
- `/api/cycles/{cycleId}/exam-plans`
- `/api/cycles/{cycleId}/categories/{categoryId}/exam-plan`

Latest hardening notes:

- Reports endpoints now return seeded-data-backed aggregate rows for cycle snapshot, funnel, department, test-result, operational-status, governance, and integration sections.
- Grades endpoints now persist JSON-record grade imports, adjustments, override-max changes, selected/all deletes, and NID detail lookups.
- Exam plans now return academy exam definitions, generated defaults, persisted saves, and copy-plan results.
- Admission setup app-settings endpoints now derive category config and summary rows from seeded categories.
- Audit role filters now derive from seeded audit rows.

Frontend admin wire-up status:

- Admin-facing service bodies now call `apiClient` directly.
- The service-layer mock fallback has been removed for auth, users, roles, cycles, categories, admission rules, admission setup, lookups, applicants consumed by admin, applicant grades, audit, reports, settings, notifications, payments, workflows, and committee instances.
- The broad admin mock-read grep returns zero hits for `MOCK.`, `from '@/shared/mock-data'`, `simulateLatency`, and `paginate(` in the admin service surface.

## Fallback Status

`AdminFallbackController` has been deleted. `/openapi/v1.json` has no `{**path}` catchall route. Unknown admin API calls now fail visibly instead of being silently papered over.

## RBAC Claims

Route-level claims are defined in:

```text
frontend/src/features/auth/rbac.ts
frontend/src/routes.tsx
frontend/src/features/admin/users/lib/cloudPermissions.ts
```

Backend JWT claim names should match the frontend permission strings exactly, for example:

```text
roles:manage
audit:view
settings:manage
admission-rules:manage
cycles:activate
lookups:delete
```

## Verification Evidence

Commands run:

```bash
dotnet build backend/admin/PACademy.Admin.slnx
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
bash backend/admin/scripts/smoke-admin-api.sh http://localhost:5101
node frontend/node_modules/typescript/lib/tsc.js -p frontend/tsconfig.json --noEmit
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node frontend/scripts/test-routes.mjs http://127.0.0.1:5173
curl http://localhost:5101/openapi/v1.json
curl -L http://localhost:5101/scalar
curl http://localhost:5101/api/lookups/faculties
curl http://localhost:5101/api/cycles
curl http://localhost:5101/api/admin/categories
curl http://localhost:5101/api/admission-rules/CYC-2026-M/current
curl http://localhost:5101/api/users
curl http://localhost:5101/api/roles
curl 'http://localhost:5101/api/applicants?page=1&pageSize=3'
curl http://localhost:5101/api/admin/payments
curl http://localhost:5101/api/audit
curl http://localhost:5101/api/committee-instances
curl http://localhost:5101/api/admin/app-settings/category-configs
curl -X POST http://localhost:5101/api/auth/login
curl 'http://localhost:5101/v1/officers/lookup?nationalId=29512011500011'
curl http://localhost:5101/api/committees
curl http://localhost:5101/api/exams/results/can-enter
```

Smoke results:

- `/api/lookups/faculties` returned 18 rows, `FAC-01` through `FAC-18`.
- Duplicate `FAC-01` returned `DUPLICATE_CODE`.
- Deleting `FAC-01` returned an FK-blocked delete result with 26 specialization references.
- `/api/cycles` returned 5 cycles and active cycle `CYC-2026-M`.
- Activating a second cycle without swap returned `ACTIVE_CYCLE_EXISTS`.
- `/api/users` returned 10 users.
- `/api/roles` returned 12 roles.
- `/api/roles/ROLE-SUPER_ADMIN/dependencies` returned one assigned user and `blocking: true`.
- `/api/applicants?page=1&pageSize=3` returned total `2847`.
- `/api/admin/payments` returned `2847` rows.
- `/api/audit` returned `687` rows.
- `/api/committee-instances` returned `15` rows.
- `/api/admin/app-settings/category-configs`, `/api/admin/exam-schedule/cycles/CYC-2026-M`, and `/api/admin/committee-bindings/cycles/CYC-2026-M` returned HTTP 200.

OpenAPI result on 2026-05-22:

```json
{
  "paths": 173,
  "operations": 212
}
```

Frontend verification on 2026-05-22:

```bash
node frontend/node_modules/typescript/lib/tsc.js -p frontend/tsconfig.json --noEmit
/usr/local/bin/npm --prefix frontend run lint
/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node frontend/scripts/test-routes.mjs http://127.0.0.1:5173
```

Results: typecheck clean, lint clean, route walker 74 passed / 0 failed.

Browser smoke on 2026-05-22:

- Authenticated as `super_admin` through the local admin API.
- Opened `http://127.0.0.1:5173/admin/reports` against `http://localhost:5101`.
- Confirmed Arabic admin chrome and reports content rendered.
- Screenshot: `docs/admin-finalization/screenshots/smoke-admin-reports.png`.
- `/api/auth/login` returned an auth user with token, apps, and permissions.
- `/v1/officers/lookup?nationalId=29512011500011` returned `OFF-1001`.
- `/api/committees` returned 18 rows.
- `/api/exams/results/can-enter` returned `true`.
- OpenAPI contains 173 paths and no `{**path}` fallback after endpoint coverage was completed.
- `/openapi/v1.json` returned 200.
- `/scalar` returned 200 with redirect following.
- Frontend typecheck completed with 0 errors.
- Frontend route walker completed with 74 passed, 0 failed.
- Lint could not be executed because ESLint is not installed in this checkout (`frontend/node_modules/.bin/eslint` missing).
