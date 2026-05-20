# PACademy Applicant Backend

Public-internet applicant API. **Read-mostly** against the shared SQL
Server DB; the only mutations it owns are the applicant journey itself
(draft, family, payment intent, exam pick). All lookup / cycle / category
CRUD lives in the **Admin backend** (`../admin/`).

**Owns**: applicant accounts, drafts, stage commits, family data, parents
approval, payment intents/confirms, exam slot reservation, attendance
card data.

**Does NOT own**: DDL/migrations (admin backend does), lookup mutations,
cycle config, grades imports, payments ledger admin overrides.

> 📘 Architecture decisions, module split, error envelope, and the
> rationale for the two-backend topology live in
> `/Users/mac/.claude/plans/foamy-watching-map.md` (the approved plan).

---

## 🚨 Seed-data rule (non-negotiable)

**Every table seed must mirror the full frontend mock dataset verbatim — no subsets, no invented rows.** The client reviewed and approved the mock as real production-day data. This applies even though the applicant backend rarely writes — when it does (applicant accounts, demo drafts, etc.) it uses the same authoritative mock sources listed in [backend/admin/README.md](../admin/README.md#-seed-data-rule-non-negotiable).

In practice this backend doesn't seed lookup tables (admin does that on the shared DB). But when wiring demo applicant accounts, demo MOI sessions, demo drafts, or any other applicant-side fixture, copy the matching records out of:

- `frontend/src/features/applicant-portal/lib/moi-session.mock.ts` — 4 demo NIDs
- `frontend/src/shared/mock-data/applicantPortal.ts` — `SAMPLE_DRAFT`, `EXAM_SLOTS`
- `frontend/src/shared/mock-data/index.ts` — applicants/cycles/categories/payments

**Never POST throwaway test rows against the live DB** during smoke testing — delete them immediately or test against the local in-memory provider (`UseInMemoryDatabase=true` in `appsettings.Development.json`).

---

## TL;DR — get it running

```bash
# from backend/ (where the .slnx files live)
dotnet build PACademy.Applicant.slnx
dotnet run   --project applicant/PACademy.Applicant.Api --urls http://localhost:5102
```

Prerequisite: the **admin backend** must have been started at least once
to apply migrations to the shared DB. If you're starting fresh, run the
admin backend first (`dotnet run --project admin/PACademy.Admin.Api`),
then this one.

URLs after startup:
- `http://localhost:5102/api/lookups/faculties` — sample read endpoint
- `http://localhost:5102/scalar` — interactive API docs (Scalar)
- `http://localhost:5102/openapi/v1.json` — raw OpenAPI spec

---

## Repository layout

```
backend/
├── PACademy.Applicant.slnx           ← this solution
├── shared/                            ← libraries shared with admin
│   ├── PACademy.Shared.Contracts/
│   ├── PACademy.Shared.Domain/
│   ├── PACademy.Shared.Persistence/
│   └── PACademy.Shared.Audit/
└── applicant/
    ├── PACademy.Applicant.Api/         ← startup project (controllers, Program.cs)
    │   ├── Controllers/
    │   ├── Program.cs
    │   ├── appsettings.json             ← connection string lives here
    │   └── appsettings.Development.json
    └── Modules/
        └── LookupsRead/                 ← example module (read-only)
            ├── PACademy.Modules.LookupsRead.Application/
            │   ├── ILookupsReadDbContext.cs   (exposes IQueryable, NOT DbSet)
            │   ├── FacultyPublicDto.cs         (Code + Name only — no audit)
            │   └── ListActiveFacultiesUseCase.cs
            └── PACademy.Modules.LookupsRead.Infrastructure/
                ├── LookupsReadDbContext.cs    (IQueryable surface, no Migrate())
                ├── LookupsReadModule.cs        (DI extension)
                └── LookupsDevSeeder.cs         (in-memory dev only)
```

Same four-tier shape as the admin backend (Domain/Application/Infrastructure/Public),
but with one critical difference:

- **The Application interface (`I<Module>DbContext`) exposes `IQueryable<T>`, NOT `DbSet<T>`.**
- **The Infrastructure DbContext does not register `MigrationsAssembly` / does not call `Migrate()`.**

This makes lookup writes a compile-time error inside applicant code, and
prevents accidental `dotnet ef database update` from corrupting the
shared schema.

---

## How to add a new read endpoint — recipe

Walk-through for adding a new applicant-facing read endpoint, using
`GET /api/lookups/specializations` as a hypothetical example.

### 1. Reuse the entity + EF configuration from `shared/`

These already exist (admin backend owns the schema; applicant just
references the same `Specialization` class from
`PACademy.Shared.Domain.Lookups`).

### 2. Add the IQueryable surface to `ILookupsReadDbContext`

```csharp
public interface ILookupsReadDbContext
{
    IQueryable<Faculty> Faculties { get; }
    IQueryable<Specialization> Specializations { get; }   // ← new
}
```

…and on the concrete `LookupsReadDbContext`:

```csharp
private DbSet<Specialization> SpecializationsSet => Set<Specialization>();
public IQueryable<Specialization> Specializations => SpecializationsSet.AsNoTracking();
```

### 3. Add a public DTO (no audit fields)

```csharp
public sealed record SpecializationPublicDto(string Code, string Name, string FacultyCode);
```

### 4. Write the use case

```csharp
public sealed class ListSpecializationsForFacultyUseCase(ILookupsReadDbContext db)
{
    public async Task<IReadOnlyList<SpecializationPublicDto>> ExecuteAsync(
        string facultyCode,
        CancellationToken ct = default)
        => await db.Specializations
            .Where(s => s.IsActive && s.FacultyCode == facultyCode)
            .OrderBy(s => s.Name)
            .Select(s => new SpecializationPublicDto(s.Code, s.Name, s.FacultyCode))
            .ToListAsync(ct);
}
```

### 5. Register in the module DI extension

```csharp
services.AddScoped<ListSpecializationsForFacultyUseCase>();
```

### 6. Add the controller action (in `applicant/PACademy.Applicant.Api/Controllers/`)

```csharp
[HttpGet("specializations")]
public async Task<IActionResult> GetSpecializations(
    [FromQuery] string facultyCode,
    [FromServices] ListSpecializationsForFacultyUseCase useCase,
    CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(facultyCode))
        return BadRequest(new { code = ErrorCodes.ValidationFailed, message = "facultyCode required" });
    return Ok(await useCase.ExecuteAsync(facultyCode, ct));
}
```

That's it — no migration, no validator (no input mutation), no audit
emit. **All write paths are forbidden here by design.**

---

## How to add a new write endpoint (e.g. ApplicantPortal stage commit)

The applicant backend DOES own some writes — applicant accounts, drafts,
family, payment intents, exam reservations. Those modules follow the
**same shape as the admin backend** (sealed use case, FluentValidation,
typed `ErrorCodes`, etc.) — see `backend/admin/README.md` for the
controller recipe.

The only differences:
- **No new tables added here.** If you need a new table, add it to the
  shared domain + admin's migration, then add a `DbSet<T>` (not just
  `IQueryable<T>`) on the applicant-backend's writable DbContext for that
  module.
- **Every write emits** `IAuditApi.RecordAsync(source: "applicant", ...)`.
- **CORS origin** comes from `appsettings.json → Cors:ApplicantFrontendOrigin`.
- **JWT audience** is `applicant-api` — admin-issued tokens are rejected.

---

## Conventions (non-negotiable)

| Concern | Rule |
|---|---|
| Lookup data access | `IQueryable<T>` only. Never `DbSet<T>` on a read-only module's interface. |
| Read paths | `AsNoTracking()` + projected DTO via `.Select(...)`. Never load full entities. |
| Public DTOs | Strip audit columns (`CreatedAt`, `UpdatedAt`, `RowVersion`) — those leak edit history. |
| Use case shape | Same as admin: `sealed class`, primary-ctor DI, `Task<...> ExecuteAsync(..., CancellationToken ct = default)`. |
| DTOs | `sealed record` only. |
| Validation | FluentValidation on every write endpoint. |
| Error envelope | Same `{ code, conflictCode?, message }` shape as admin. Use `ErrorCodes.*` from `PACademy.Shared.Contracts`. |
| Auth | Every endpoint except `/api/auth/*` requires `[Authorize]`. JWT audience `applicant-api`. |
| Rate limiting | Public-internet — `Microsoft.AspNetCore.RateLimiting` is wired in `Program.cs` (per-IP fixed window + per-NID token bucket once auth lands). |
| Migrations | **Never run `dotnet ef database update` from this backend.** Admin owns DDL. |

---

## Connection string

In `applicant/PACademy.Applicant.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=...;Database=PACademy;User Id=...;Password=...;TrustServerCertificate=True;"
  },
  "UseInMemoryDatabase": false,
  "Cors": { "ApplicantFrontendOrigin": "http://localhost:5173" }
}
```

For local-only smoke tests without SQL Server, set `UseInMemoryDatabase=true`
and the backend will seed the lookups in-memory on startup (no shared DB
needed). Production must use SQL Server.

---

## Useful commands

```bash
# Build
dotnet build PACademy.Applicant.slnx

# Run with hot-reload
dotnet watch --project applicant/PACademy.Applicant.Api

# Run normally
dotnet run --project applicant/PACademy.Applicant.Api --urls http://localhost:5102

# Smoke test the sample endpoint
curl http://localhost:5102/api/lookups/faculties

# Open interactive docs in browser
open http://localhost:5102/scalar
```

---

## Frontend wiring

This backend serves the applicant surface of the existing Vite SPA.
After integration, `frontend/src/shared/api/client.ts` exposes:

```ts
export const applicantApi = axios.create({ baseURL: import.meta.env.VITE_APPLICANT_API_URL });
```

Set `VITE_APPLICANT_API_URL=http://localhost:5102` in
`frontend/.env.development`. All `frontend/src/features/applicant-portal/**`
service files swap their `simulateLatency() + MOCK.*` body for
`applicantApi.get/post(...).then(r => r.data)`.

---

## Differences from the admin backend

| Concern | Admin | Applicant |
|---|---|---|
| Network | Internal / VPN-gated | Public internet |
| Traffic | Low, working hours | Spiky during cycle-open windows |
| Auth | OTP two-step (staff) | NID + mobile direct lookup |
| Rate limiting | None needed | Required (per-IP + per-NID) |
| CAPTCHA | No | Yes (after 3 failed logins from same IP) |
| Owns DDL | Yes | No |
| Lookup access | Full CRUD | Read-only `IQueryable` |
| JWT audience | `admin-api` | `applicant-api` |
| Audit `source` column | `"admin"` | `"applicant"` |
| Heavy aggregate loads | Tolerable | Forbidden — projected DTOs only |
