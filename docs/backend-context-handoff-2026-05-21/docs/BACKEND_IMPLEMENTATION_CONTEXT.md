# Backend Implementation Context

**Date ingested:** 2026-05-21  
**Source attachments:** `/Users/mac/Downloads/feedback_seed_from_mock (1).md`, `/Users/mac/Downloads/Backend-STATUS (1).md`, `/Users/mac/Downloads/academy-backend-plan (2).md`

This document captures the backend instructions attached during the admin integration workstream. Read it before writing backend code or changing frontend API wiring.

## Local Checkout Reality

In this checkout, `backend/` currently contains only `.gitkeep`. The attached `Backend-STATUS` describes an external/backend handoff state where a Faculties vertical slice already exists. Treat that status as implementation guidance to reconcile into this repository, not proof that the code is present locally.

## Architecture Decision

Build **two backends over one shared SQL Server database**:

| Service | Path | Port | Profile | Ownership |
|---|---|---:|---|---|
| Admin backend | `backend/admin/` | `5101` | Internal/VPN staff surface | Owns DDL, migrations, admin CRUD, staff auth/RBAC, lookups, cycles, payments, applicants, grades, committees config |
| Applicant backend | `backend/applicant/` | `5102` | Public internet applicant surface | Owns applicant login, draft/stage commits, family data, payment intents, exam pick; read-only where it should not mutate |
| Shared libraries | `backend/shared/` | n/a | Referenced by both | Shared contracts, domain entities, persistence conventions, audit, global exception handling |

Admin owns **all migrations**. Never run migrations from the applicant backend.

## Non-Negotiable Seed Rule

Every backend table seed must mirror the full frontend mock dataset verbatim:

- No subsets.
- No invented rows.
- No placeholder Arabic names.
- No throwaway rows posted to the live DB during smoke tests.
- If a remote/orphan table exists with the wrong schema, drop and recreate it with the new schema and full mock seed.

Authoritative seed sources:

| Domain | Frontend source |
|---|---|
| Typed lookups | `frontend/src/features/lookups/mock/lookups.mock.ts` |
| Applicants, cycles, categories, payments | `frontend/src/shared/mock-data/index.ts` plus helpers |
| MOI verification and four demo NIDs | `frontend/src/features/applicant-portal/lib/moi-session.mock.ts` |
| Applicant draft, exam slots, payment transactions | `frontend/src/shared/mock-data/applicantPortal.ts` |

Reviewers should reject any seeder that does not copy the frontend mock rows row-for-row, including Arabic names, codes, FK structure, and ordering.

## Backend Stack

- .NET 10
- EF Core 10 with SQL Server provider
- FluentValidation 11
- Built-in `AddOpenApi()` plus Scalar UI
- `sqlcmd` for direct SQL checks when needed
- Serilog structured logging with backend name and correlation ID

## Established Slice

The attached backend status identifies **Faculties** as the canonical first vertical slice:

| Endpoint | Service | Verb | Shape |
|---|---|---|---|
| `/api/lookups/faculties` | Admin `:5101` | GET | Admin DTO including `code`, `name`, `isActive`, timestamps, `rowVersion`; supports `isActive` and `search` |
| `/api/lookups/faculties` | Admin `:5101` | POST | Creates a faculty; validation errors return 400; duplicates return `LOOKUP_CODE_DUPLICATE` |
| `/api/lookups/faculties` | Applicant `:5102` | GET | Public DTO with `code` and `name` only |

The table shape is `faculties (code PK, name, is_active, created_at, updated_at, row_version)` with snake_case columns and SQL Server rowversion concurrency. The seed must copy all faculties from the frontend lookup mock.

Use this slice as the pattern for the remaining lookup/admin/applicant modules.

## Code Conventions

| Concern | Rule |
|---|---|
| Use cases | `public sealed class XxxUseCase(IDbContext db, ...deps)` with `Task<...> ExecuteAsync(..., CancellationToken ct = default)` |
| DTOs | `sealed record` only |
| Entities/use cases | `sealed class`, primary-constructor DI where suitable |
| Validation | FluentValidation `AbstractValidator<TRequest>` per write endpoint, mirroring frontend zod schemas where available |
| DB naming | snake_case columns via EF configuration |
| Audit/concurrency columns | Include `created_at`, `updated_at`, `row_version` on persisted tables unless there is a clear exception |
| Concurrency | SQL Server `rowversion`; expose base64 `RowVersion` in admin DTOs |
| Error constants | Use `PACademy.Shared.Contracts.ErrorCodes.*`; never invent or rename contract codes |
| Admin DbContext | Expose `DbSet<T>` for owned mutation surfaces |
| Applicant DbContext | Expose `IQueryable<T>` for read-only surfaces; no `Add`, `Update`, or `Remove` access where applicant must not write |
| Applicant reads | Always `AsNoTracking()` plus projected DTOs; never load full entities for public reads |
| Module registration | `builder.Services.AddXxxModule(builder.Configuration)` from the API `Program.cs` |

## Error Envelope

Both backends must return the shared envelope shape expected by the frontend `apiClient`:

| Condition | HTTP | Envelope expectation |
|---|---:|---|
| FluentValidation or model binding | 400 or 422 | `{ code: "VALIDATION_FAILED", errors: { field: message }, message }` |
| Typed conflict | 409 | `{ code: "CONFLICT", conflictCode, message }` |
| Dependency block | 409 or 424 | `{ code: "DEPENDENCY_BLOCKED", dependencyCode, message }` |
| Rowversion conflict | 412 | `{ code: "CONFLICT", conflictCode: "DRAFT_VERSION_CONFLICT", message }` |
| Missing record | 404 | `{ code: "NOT_FOUND", message }` |
| Forbidden | 403 | `{ code: "FORBIDDEN", message }` |
| Unexpected | 500 | `{ code: "INTERNAL_ERROR", message, detail? }` |

SQL unique violations `2627` / `2601` should map to the correct typed conflict code, such as `LOOKUP_CODE_DUPLICATE`.

## Auth And API Topology

- Admin and applicant backends have separate JWT issuers/audiences.
- Admin issuer/audience: `admin-api`.
- Applicant issuer/audience: `applicant-api`.
- Tokens are not interchangeable; each backend must reject the other audience.
- Applicant login is NID + mobile lookup, not staff role-selector auth.
- MOI integration is an `IMoiClient` interface: mock implementation in development only, HTTP implementation in production.

The attached backend plan expects the frontend to eventually use two base URLs:

```bash
VITE_ADMIN_API_URL=http://localhost:5101
VITE_APPLICANT_API_URL=http://localhost:5102
```

Current frontend admin integration uses one `VITE_API_BASE_URL` through `frontend/src/shared/lib/api-client.ts`. For the admin-only pass, point it at the admin backend. When applicant backend integration resumes, split the frontend client into admin/applicant clients or add equivalent routing without changing page components.

## Build Order

1. Foundation: shared/admin/applicant solution structure, appsettings, CORS, logging, OpenAPI/Scalar.
2. Shared libraries: contracts, persistence conventions, domain, audit, lookup abstractions.
3. Admin skeleton and `LookupsAdmin`: CRUD on all typed lookups, seeded verbatim from frontend mocks.
4. Admin modules: `AdmissionsAdmin`, `GradesAdmin`, `PaymentsAdmin`, `ApplicantsAdmin`.
5. Applicant skeleton: `IdentityApplicant`, `Moi`, `LookupsRead`, `AdmissionsRead`, `GradesRead`, rate limiting.
6. Applicant modules: `ApplicantPortal`, `PaymentsApplicant`, cache invalidation webhook.
7. Frontend wiring: preserve existing service/query/page boundaries while routing calls to the correct backend client.

## Pending Modules From Attached Status

Priority order from the backend handoff:

1. Remaining typed lookups beyond Faculties.
2. `AdmissionsAdmin` for cycles, categories, and admission setup wizard.
3. `AdmissionsRead` for applicant-facing cycles/categories/eligibility.
4. `IdentityApplicant` for NID + mobile login.
5. `Moi` client abstraction and dev mock.
6. `GradesRead` by-NID lookup.
7. `ApplicantPortal` draft/stages/family/exam/attendance/acquaintance data.
8. `PaymentsApplicant` for Fawry intent and confirmation.

## Verification Expectations

- Build both solutions.
- Run admin first so migrations and seeds apply.
- Run applicant second.
- Verify `/scalar` and `/openapi/v1.json` on both services.
- Verify audience isolation: admin token rejected by applicant backend and applicant token rejected by admin backend.
- Verify lookups return matching active rows on both services, with admin DTOs richer than public applicant DTOs.
- Verify seeds against the full frontend mock row counts and exact values.
- Avoid live-DB smoke rows; use in-memory/local tests or delete immediately.

## Cross References

- [ADMIN_BACKEND_INTEGRATION_STATUS.md](ADMIN_BACKEND_INTEGRATION_STATUS.md) — frontend admin service wiring status.
- [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md) — frontend service contracts and endpoint inventory.
- [DB_CONSTRAINTS.md](DB_CONSTRAINTS.md) — invariant and conflict-code contract.
