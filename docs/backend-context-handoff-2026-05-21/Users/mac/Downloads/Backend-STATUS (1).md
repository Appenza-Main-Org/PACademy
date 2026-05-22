# PACademy Backend — Status Summary (2026-05-20)

For team handoff. Everything below is in `backend/` on `main`.

---

## 1. Architecture decision

**Two backends, one shared SQL Server DB.**

- **Admin backend** (`backend/admin/`, port `:5101`) — internal-network. Owns all DDL/migrations. Full CRUD on lookups, cycles, payments, applicants, etc.
- **Applicant backend** (`backend/applicant/`, port `:5102`) — public-internet. Read-mostly. Owns the applicant journey (drafts, family, payment intents, exam pick).
- **Shared SQL Server**: `34.17.135.245,1433 / PACademy`. Both backends connect to it.

Full plan lives at `/Users/mac/.claude/plans/foamy-watching-map.md` — read it before adding new modules.

---

## 2. What's actually built

### Repository layout

```
backend/
├── PACademy.Admin.slnx                ← admin solution
├── PACademy.Applicant.slnx            ← applicant solution
├── shared/
│   ├── PACademy.Shared.Contracts/     ErrorCodes constants, envelope shape
│   ├── PACademy.Shared.Domain/        Entities (Faculty so far)
│   ├── PACademy.Shared.Persistence/   EF Core configurations
│   ├── PACademy.Shared.Audit/         (skeleton — not yet wired)
│   └── PACademy.Shared.Web/           Global exception handler
├── admin/
│   ├── PACademy.Admin.Api/            Program.cs + Controllers
│   │   ├── Program.cs                 CORS, Scalar UI, exception middleware
│   │   ├── appsettings.json           ← connection string lives here
│   │   └── Controllers/
│   │       └── FacultiesController.cs (GET + POST)
│   └── Modules/
│       └── LookupsAdmin/
│           ├── PACademy.Modules.LookupsAdmin.Application/Faculties/
│           │   ├── ILookupsAdminDbContext.cs
│           │   ├── FacultyDtos.cs
│           │   ├── ListFacultiesUseCase.cs
│           │   ├── CreateFacultyUseCase.cs
│           │   └── CreateFacultyValidator.cs      (FluentValidation)
│           └── PACademy.Modules.LookupsAdmin.Infrastructure/
│               ├── LookupsAdminDbContext.cs
│               ├── LookupsAdminDbContextFactory.cs (design-time, for `dotnet ef`)
│               ├── LookupsAdminModule.cs           (AddLookupsAdminModule DI)
│               ├── LookupsAdminSeeder.cs           (migrates + seeds on startup)
│               └── Migrations/20260520113946_InitialLookups.cs
└── applicant/
    ├── PACademy.Applicant.Api/        Program.cs + Controllers
    │   └── Controllers/
    │       └── LookupsController.cs   (GET only — public DTO shape)
    └── Modules/
        └── LookupsRead/
            ├── …Application/          (ILookupsReadDbContext exposes IQueryable, NOT DbSet)
            └── …Infrastructure/       (LookupsReadDbContext, AddLookupsReadModule)
```

### Tech stack

- **.NET 10.0.103** (SDK installed locally)
- **EF Core 10.0** + **SqlServer 10.0** provider
- **FluentValidation 11.11**
- **OpenAPI** — built-in `AddOpenApi()` + **Scalar.AspNetCore 2.0.16** for the UI (Swashbuckle is incompatible with .NET 10 — Scalar is the modern replacement)
- **sqlcmd** (Homebrew) for direct SQL access

---

## 3. The one working slice — Faculties

| Endpoint | Backend | Verb | Shape |
|---|---|---|---|
| `/api/lookups/faculties` | Admin :5101 | GET | `FacultyAdminDto[]` (code, name, isActive, createdAt, updatedAt, rowVersion) + `isActive` + `search` filters |
| `/api/lookups/faculties` | Admin :5101 | POST | Creates, returns 201; 400 on validation; 409 `LOOKUP_CODE_DUPLICATE` on duplicate |
| `/api/lookups/faculties` | Applicant :5102 | GET | `FacultyPublicDto[]` (code + name only — strips audit fields) |

DB table: `faculties (code PK, name, is_active, created_at, updated_at, row_version)` — snake_case, rowversion concurrency. Seeded with **18 faculties verbatim from** `frontend/src/features/lookups/mock/lookups.mock.ts:169-188`.

---

## 4. The 🚨 SEED-DATA RULE — non-negotiable

**Every backend table seed must mirror the full frontend mock dataset verbatim. No subsets, no invented rows.**

The client reviewed and approved the mock as real production-day data. Authoritative mock sources:

| Domain | Mock file |
|---|---|
| 24 typed lookups | `frontend/src/features/lookups/mock/lookups.mock.ts` |
| Applicants, cycles, categories, payments | `frontend/src/shared/mock-data/index.ts` (+ helpers) |
| MOI verification + 4 demo NIDs | `frontend/src/features/applicant-portal/lib/moi-session.mock.ts` |
| Applicant draft, exam slots | `frontend/src/shared/mock-data/applicantPortal.ts` |

If an orphan table exists on the remote DB with a different schema → drop it and recreate with our schema + full mock seed. Don't try to migrate the old data.

Never POST throwaway test rows against the live DB during smoke testing — use the in-memory provider or delete immediately.

This rule is documented in:
- 🚨 banner at the top of [backend/admin/README.md](admin/README.md)
- 🚨 banner at the top of [backend/applicant/README.md](applicant/README.md)

---

## 5. Conventions established (follow these for every new module)

| Concern | Rule |
|---|---|
| Use case | `public sealed class XxxUseCase(IDbContext db, ...deps)` with `Task<...> ExecuteAsync(...request, CancellationToken ct = default)`. Returns `(Ok, ErrorCode)` tuple for predictable failures; throws for unexpected. |
| DTOs | `sealed record` only |
| Validation | FluentValidation `AbstractValidator<TRequest>` per write endpoint |
| DB columns | snake_case via `HasColumnName("...")`. Always include `created_at`, `updated_at`, `row_version`. |
| Concurrency | `byte[] RowVersion` with `.IsRowVersion()` |
| Error envelope | `{ code, conflictCode?, errors?, message, detail? }`. Use `ErrorCodes.*` constants — never rename. |
| Admin DbContext | Exposes `DbSet<T>` (full CRUD) |
| Applicant DbContext | Exposes `IQueryable<T>` only (compile-time write block) |
| Migrations | Admin owns ALL migrations. Never run `dotnet ef database update` from applicant backend. |
| Read paths in applicant | `AsNoTracking()` + projected DTO. Never load full entities. |
| Module DI | `AddXxxModule(IConfiguration)` extension, called once from `Program.cs` |

The recipe for adding a new admin endpoint (with full code snippets) is in [backend/admin/README.md](admin/README.md) → "How to add a new endpoint — recipe".

---

## 6. Global error/exception handling

Both backends share `PACademy.Shared.Web.GlobalExceptionHandler` which translates exceptions into the unified envelope:

| Exception | HTTP | Envelope |
|---|---|---|
| `FluentValidation.ValidationException` | 400 | `{ code: "VALIDATION_FAILED", errors: {field: message}, message }` |
| `DbUpdateConcurrencyException` | 412 | `{ code: "CONFLICT", conflictCode: "DRAFT_VERSION_CONFLICT", message }` |
| `DbUpdateException` (SQL 2627/2601) | 409 | `{ code: "CONFLICT", conflictCode: "LOOKUP_CODE_DUPLICATE", message }` |
| `DbUpdateException` (other) | 409 | generic conflict + detail in dev |
| `KeyNotFoundException` | 404 | `{ code: "NOT_FOUND", message }` |
| `UnauthorizedAccessException` | 403 | `{ code: "FORBIDDEN", message }` |
| `ArgumentException` | 400 | `{ code: "VALIDATION_FAILED", message }` |
| Anything else | 500 | `{ code: "INTERNAL_ERROR", message, detail (dev only) }` |

Model-binding errors (missing fields, garbage JSON) use the **same envelope** — `InvalidModelStateResponseFactory` is overridden in `AddPacademyExceptionHandling()`.

---

## 7. How to run

```bash
cd backend

# Build
dotnet build PACademy.Admin.slnx
dotnet build PACademy.Applicant.slnx

# Run admin FIRST (it owns migrations + seeds)
dotnet run --project admin/PACademy.Admin.Api     --urls http://localhost:5101

# Then applicant
dotnet run --project applicant/PACademy.Applicant.Api --urls http://localhost:5102
```

**URLs**:
- Admin API: http://localhost:5101/api/lookups/faculties
- Admin docs: http://localhost:5101/scalar (try-it-out UI) + /openapi/v1.json (raw spec)
- Applicant API: http://localhost:5102/api/lookups/faculties
- Applicant docs: http://localhost:5102/scalar + /openapi/v1.json

**Useful EF commands** (from `backend/`):

```bash
# Add a migration after entity/config changes
dotnet ef migrations add <Name> \
  --project admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Infrastructure \
  --startup-project admin/PACademy.Admin.Api \
  --context LookupsAdminDbContext \
  --output-dir Migrations

# Apply migrations manually (admin also does this on startup)
dotnet ef database update \
  --project admin/Modules/LookupsAdmin/PACademy.Modules.LookupsAdmin.Infrastructure \
  --startup-project admin/PACademy.Admin.Api \
  --context LookupsAdminDbContext
```

---

## 8. What's still pending

Per the approved plan, in dependency order:

| Phase | Module | What unblocks |
|---|---|---|
| **Next** | Remaining 23 lookups (specializations, universities, governorates, kinship, jobs, qualifications, marital-statuses, …) | Applicant Stage345 dropdowns + family tree pickers |
| | `AdmissionsAdmin` (cycles + categories + admission-setup wizard backing) | Cycle picker + category gating |
| | `AdmissionsRead` (applicant-facing cycles + categories + eligibility check) | `/applicant/start` page |
| | `Identity` (applicant) — NID + mobile login | `/applicant-login` |
| | `Moi` (mock client behind `IMoiClient` interface, Dev only) | Demo NID routing (Ahmed/Khaled/Mohamed/Youssef) |
| | `GradesRead` (by-NID lookup) | Thanaweya pre-fill in Stage345 |
| | `ApplicantPortal` (draft, stages, family, exam pick, attendance card data) | The big one — every applicant page |
| | `PaymentsApplicant` (Fawry intent + confirm) | Stage 6 payment |

Each of these follows the **exact same pattern as the Faculties slice** — see the controller recipe in the admin README.

---

## 9. Where to find everything

| Need | Path |
|---|---|
| Architecture plan + design decisions | `/Users/mac/.claude/plans/foamy-watching-map.md` |
| Admin backend usage + controller recipe | `backend/admin/README.md` |
| Applicant backend usage + differences | `backend/applicant/README.md` |
| Seed-data rule | banners on both READMEs |
| Frontend integration contracts | `frontend/src/features/**/api/*.service.ts` (every `INTEGRATION CONTRACT` JSDoc header is authoritative) |
| Mock data (source of truth for seeds) | `frontend/src/features/lookups/mock/lookups.mock.ts` + `frontend/src/shared/mock-data/index.ts` |
| DB constraints the backend must enforce | `docs/DB_CONSTRAINTS.md` |
| End-to-end integration handoff | `docs/INTEGRATION_HANDOFF.md` |

---

## 10. TL;DR for the team

1. **Pick a module from §8.** Use Faculties as the template — copy the layout, swap the entity/DTO/use cases.
2. **Open the mock file** for the data you're seeding, copy every row verbatim into the seeder.
3. **Generate a migration** from the admin backend, restart it once → table + data land in the shared DB.
4. **Write the applicant-side `LookupsRead`-style endpoint** if applicants need it (read-only `IQueryable`).
5. **Open** `/scalar` on both backends to verify your new endpoint shows up in the OpenAPI doc.
6. **Never POST throwaway test data to the live DB.** Use in-memory provider for ad-hoc tests or delete immediately.
7. **Follow the conventions table** in §5 — PR reviewers will reject anything that deviates without justification.

The Faculties slice is the canonical reference. If something in the new code doesn't match the Faculties pattern, ask why before merging.
