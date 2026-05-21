# PACademy Admin Backend

Admin backend for the Police Academy Admissions Platform.

## Run

```bash
export DOTNET_ROOT="$HOME/.dotnet"
export PATH="$HOME/.dotnet:$PATH"
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
```

OpenAPI:

```text
http://localhost:5101/openapi/v1.json
http://localhost:5101/scalar
```

## Module Recipe

Every admin module follows the same shape:

```text
backend/admin/PACademy.Admin.Api/Modules/<Name>/
  <Name>Entities.cs
  <Name>Service.cs
  <Name>Seeder.cs
  <Name>Module.cs

backend/admin/PACademy.Admin.Api/Controllers/<Name>Controller.cs
```

Rules:

- DTOs are sealed records when the shape is stable.
- Write validation uses FluentValidation.
- EF configuration lives in `Persistence/AdminDbContext.cs`.
- Tables use snake_case columns plus `created_at`, `updated_at`, `row_version`.
- Use cases throw shared contract exceptions from `PACademy.Shared.Contracts`.
- Error responses use `{ code, conflictCode?, errors?, message, detail? }`.
- Seed data is copied from frontend mocks verbatim.
- Register each module in `Program.cs` with `AddXxxModule(builder.Configuration)`.

## Current Slices

- `LookupsAdmin`: concrete CRUD over 25 lookup dictionaries, seeded from `frontend/src/features/lookups/mock/lookups.mock.ts`.
- `AdmissionsAdmin`: concrete cycles, applicant categories, and admission rules seed/read/write basics, seeded from `frontend/src/shared/mock-data/admissionCycles.ts` and applicant-category lookup rows.
- `Identity`: concrete users, roles, and officer directory seed/read/write basics, seeded from `frontend/src/shared/mock-data/roles.ts`, `officers.ts`, and the deterministic `USER_SEED`.
- `AdminRecords`: seeded backend JSON records for applicants, payments, audit, notifications, committee instances, workflows, reports, and settings.
- Admission setup endpoint coverage for app settings, exam schedule, committee bindings, declarations, and exam-date config.
- Temporary fallback controller: only catches still-unknown admin API calls while dedicated modules replace it.
