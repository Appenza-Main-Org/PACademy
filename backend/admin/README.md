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

Smoke endpoints after starting the API:

```bash
bash backend/admin/scripts/smoke-admin-api.sh http://localhost:5101
```

## Migrations

The admin API owns migrations. The initial schema migration is under:

```text
backend/admin/PACademy.Admin.Api/Persistence/Migrations/
```

When `ConnectionStrings:AdminDb` is empty, the API uses EF InMemory for local smoke tests. When `AdminDb` is set, startup runs `Database.MigrateAsync()` before seeders execute.

Add future migrations with:

```bash
dotnet dotnet-ef migrations add <Name> \
  --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj \
  --startup-project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj \
  --context AdminDbContext \
  --output-dir Persistence/Migrations
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
- Auth/officer lookup, committees, and exam-plan/result endpoint coverage.
- The temporary fallback controller has been removed; OpenAPI no longer contains a `{**path}` catchall.

## UAT database copy and switching

The backend can switch between named SQL Server connection strings without code changes:

```bash
export Database__ActiveConnectionName=AdminDbUat
export Database__Schema=PACademy_staging_db
export ConnectionStrings__AdminDbUat='Server=...;Database=PACademy_Admin_UAT;User Id=...;Password=...;TrustServerCertificate=True'
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
```

Supported overrides:

- `Database__ActiveConnectionName` or `ADMIN_DB_CONNECTION_NAME` selects the connection-string key.
- `Database__Schema` or `ADMIN_DB_SCHEMA` selects the SQL Server schema, for example `admin_v2` or `PACademy_staging_db`.
- `ConnectionStrings__AdminDb` / `ConnectionStrings__AdminDbUat` hold environment-specific SQL Server strings.
- `ADMIN_DB_CONNECTION_STRING` can override the selected connection string directly for one-off backend runs.

The `/health/db` endpoint returns the active `connectionName`, schema, provider, and whether the backend is using InMemory. It never returns the connection string.

Option A, separate UAT database: create an exact UAT copy of the current admin DB with backup/restore:

```bash
sqlcmd -S <server> -U <user> -P '<password>' \
  -i backend/admin/scripts/copy-admin-db-to-uat.sql \
  -v SourceDb=PACademy_Admin \
     TargetDb=PACademy_Admin_UAT \
     BackupPath=/tmp/PACademy_Admin_UAT_COPY.bak \
     SourceLogicalDataName=PACademy_Admin \
     SourceLogicalLogName=PACademy_Admin_log \
     TargetDataFile=/var/opt/mssql/data/PACademy_Admin_UAT.mdf \
     TargetLogFile=/var/opt/mssql/data/PACademy_Admin_UAT_log.ldf
```

Use the logical file names returned by `RESTORE FILELISTONLY` if your database files are named differently. The script uses `COPY_ONLY` backup/restore so it copies the current schema, EF migration history, constraints, indexes, rowversion columns, and all data into the UAT database.

Option B, separate UAT schema in the same database:

```bash
ASPNETCORE_ENVIRONMENT=Uat \
Database__Schema=PACademy_staging_db \
ConnectionStrings__AdminDbUat='Server=...;Database=PACademy_Admin;User Id=...;Password=...;TrustServerCertificate=True' \
dotnet run --project backend/admin/PACademy.Admin.Api/PACademy.Admin.Api.csproj --urls http://localhost:5101
```

Stop the backend after migrations create the `PACademy_staging_db` schema, then copy current data from `admin_v2`:

```bash
sqlcmd -S <server> -U <user> -P '<password>' -d PACademy_Admin \
  -i backend/admin/scripts/copy-admin-schema-to-uat-schema.sql \
  -v SourceSchema=admin_v2 TargetSchema=PACademy_staging_db
```

Run the UAT backend as a separate service with `ASPNETCORE_ENVIRONMENT=Uat`, `Database__ActiveConnectionName=AdminDbUat`, `Database__Schema=PACademy_staging_db`, and its own CORS origins.

Deploy the UAT frontend as a separate Vercel project using:

```bash
vercel --local-config vercel.uat.json
```

Set the UAT Vercel environment variable `VITE_API_BASE_URL=https://admin-staging-api.appenzademo.com` and keep `VITE_USE_MOCKS=false`.
