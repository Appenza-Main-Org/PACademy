# Admin Backend Wire-Up Runbook

**Date:** 2026-05-21  
**Backend:** `backend/admin/` on `http://localhost:5101`

## Environment

```bash
export DOTNET_ROOT="$HOME/.dotnet"
export PATH="$HOME/.dotnet:$PATH"
dotnet build backend/admin/PACademy.Admin.slnx
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
```

The repo has a local `global.json` pinned to SDK `10.0.300` so it is not affected by `/Users/mac/global.json`.

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

## Temporary Backend Fallback

`AdminFallbackController` exists only to keep the frontend on real HTTP while the remaining vertical modules are completed. It covers missing admin endpoints with empty/safe envelopes and must be deleted as Priority B/C modules replace it.

Fallback-covered modules:

- Auth/Identity details beyond lock-policy basics
- Applicants
- Applicant grades
- Committees exam config
- Workflows
- Reports aggregates beyond placeholder shapes
- Audit details beyond empty list/export
- Settings
- Notifications
- Payments

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
curl http://localhost:5101/openapi/v1.json
curl -L http://localhost:5101/scalar
curl http://localhost:5101/api/lookups/faculties
curl http://localhost:5101/api/cycles
curl http://localhost:5101/api/admin/categories
curl http://localhost:5101/api/admission-rules/CYC-2026-M/current
curl http://localhost:5101/api/users
curl http://localhost:5101/api/roles
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
- `/openapi/v1.json` returned 200.
- `/scalar` returned 200 with redirect following.
