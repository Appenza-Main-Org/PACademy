# Admin Finalization Phase 2 Start Gate

**Date:** 2026-05-21  
**Scope:** backend wiring for `/admin/*` only  
**Status:** blocked before backend implementation

## Current Finding

Phase 2 cannot be implemented safely in this checkout yet because the required admin backend code and .NET toolchain are not present locally.

Evidence:

```bash
find backend -maxdepth 5 -type f
# backend/.gitkeep

find . -maxdepth 4 \( -name '*.sln' -o -name '*.slnx' -o -name '*.csproj' -o -name 'Directory.Build.props' -o -name 'global.json' \) -print
# no output

which dotnet || true
# dotnet not found

which brew || true
# brew not found
```

The attached backend status says a Faculties vertical slice exists elsewhere, but this repository currently has no local `backend/admin/` implementation to extend and no `dotnet` command to build, scaffold, run EF migrations, or verify `/scalar`.

## What Is Already Ready

- Phase 0 audit exists at `docs/admin-finalization/AUDIT.md`.
- Backend instruction context is captured at `docs/BACKEND_IMPLEMENTATION_CONTEXT.md`.
- Admin frontend service wiring context is captured at `docs/ADMIN_BACKEND_INTEGRATION_STATUS.md`.
- Phase 1 RBAC route guards, admin permission claims, seeded role claims, and cloud permission matrix changes are committed.
- The admin frontend services already contain backend-call branches in this worktree, with mock fallback still present behind the integration flag. Phase 2 must remove those mock reads only after backend endpoints exist.

## Required Before Phase 2 Code Work

1. Restore or import the backend tree described by the handoff into:

```text
backend/admin/
backend/applicant/
backend/shared/
```

2. Ensure the repository contains at least:

```text
backend/admin/README.md
backend/applicant/README.md
backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj
backend/admin/PACademy.Admin.slnx
backend/shared/PACademy.Shared.Contracts/
backend/shared/PACademy.Shared.Audit/
```

3. Install the .NET SDK required by the handoff. The attached backend instructions specify .NET 10 / EF Core 10.

4. Confirm these commands work locally:

```bash
dotnet --version
dotnet build backend/admin/PACademy.Admin.slnx
dotnet run --project backend/admin/PACademy.Admin.Api --urls http://localhost:5101
```

5. Confirm the admin API exposes:

```text
http://localhost:5101/openapi/v1.json
http://localhost:5101/scalar
```

## First Backend Slice Once Unblocked

Start with `LookupsAdmin`, using Faculties as the canonical pattern from the attached status. In this checkout, current frontend lookup reality is 25 keys, not the older 24-key wording:

```text
relationships
relationship-degree-tiers
faculties
specializations
tests
test-results
committees
submission-types
applicant-categories
nationalities-countries
governorates
police-stations
jobs
qualifications
announcements
applicant-divisions
school-categories
nid-missing-reasons
universities
marital-statuses
academic-grades
academic-degrees
exam-rounds
graduation-years
excellence-criteria
```

Seed source:

```text
frontend/src/features/lookups/mock/lookups.mock.ts
```

Do not subset or rename rows. The seeder must copy `LOOKUPS_SEED` verbatim, including Arabic names, codes, FK fields, active flags, and ordering.

## Backend Module Queue

Follow this queue after the backend tree and toolchain are available:

1. `LookupsAdmin`
2. `AdmissionsAdmin` for cycles, categories, admission setup, admission rules
3. `ApplicantsAdmin`
4. `ApplicantGradesAdmin`
5. `UsersAdmin` / `Identity`
6. `CommitteesExamConfigAdmin`
7. `WorkflowsAdmin`
8. `Reports`
9. `Audit`
10. `Settings`
11. `Notifications`
12. `PaymentsAdmin`

Each module must follow `docs/BACKEND_IMPLEMENTATION_CONTEXT.md`:

- sealed DTO records
- FluentValidation for writes
- snake_case EF columns
- `created_at`, `updated_at`, `row_version`
- `(Ok, ErrorCode)` use-case results
- standard error envelope
- module DI extension called from `Program.cs`
- seed-from-mock verbatim

## Frontend Wiring Gate

Do not delete remaining admin mock fallback reads until the matching backend endpoints are implemented and verified. For each module:

1. Implement backend endpoints and seeders.
2. Run the admin API locally on `:5101`.
3. Point frontend admin calls at the local admin API.
4. Verify route behavior and typed error toasts.
5. Remove `MOCK.*`, `simulateLatency()`, and `paginate()` fallback paths from that module's admin service.
6. Commit backend module and frontend page wiring separately.

## Stop Condition

This is a hard implementation blocker, not an ambiguity in the sprint scope. Continuing by inventing unverified backend files in this checkout would violate the sprint's migration, Scalar, and `dotnet build` verification requirements.
