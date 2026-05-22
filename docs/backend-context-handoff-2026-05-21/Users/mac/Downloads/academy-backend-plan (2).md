# Backend Plan — Two-Service Split (Admin + Applicant)

## Context

The PACademy frontend is feature-complete and consumes a typed mock-service layer (see every
`*.service.ts` file's `INTEGRATION CONTRACT` JSDoc header). The backend (`backend/`) is currently
a `.gitkeep` stub.

We're building **two backends, not one**, because their hosting profiles differ sharply:

- **Admin backend** — internal-network / VPN-gated, low traffic, staff-only, OTP-protected,
  scheduled work hours. Mutates lookups, cycles, payments ledger, grades imports, committee
  scheduling, applicant review queues.
- **Applicant backend** — public-internet, spiky traffic during cycle-open windows, needs rate
  limiting + DDoS posture, lighter auth (NID + mobile), read-heavy on lookups & cycles, owns
  the applicant draft + stage commits + exam pick.

**User-confirmed decisions** (this session):

| Decision | Choice |
|---|---|
| Single backend vs split | **Two backends**, separate hosting |
| Starting point | **Greenfield**, mirror established `.NET 10 / EF Core / SQL Server / modular-monolith` conventions |
| Database topology | **Shared single SQL Server DB** (admin backend owns DDL + migrations; applicant backend has read-only access on tables it shouldn't write) |
| Cross-backend communication | **Direct HTTP webhooks** for events that can't flow through the shared DB |
| Frontend | **One SPA, two API base URLs** (`VITE_ADMIN_API_URL` + `VITE_APPLICANT_API_URL`) |
| Auth | **Separate JWT issuers** per backend (`aud='admin-api'`, `aud='applicant-api'`); tokens not interchangeable |
| Applicant login | **NID + mobile direct lookup** (no OTP) |
| MOI integration | **`IMoiClient` interface**; mock impl in Dev, HTTP impl in Prod (NOT a permanent module) |
| Draft model | **Server-owned full draft** (frontend sessionStorage `familyData` + `profileData` snapshots go away on integration) |

**Focus**: applicant flow + the lookups it consumes. Admin endpoints are scoped to what unblocks
the applicant flow (cycle/category config, lookup CRUD, grades import); deep admin features
(committees, workflows, board) are out of scope here.

---

## Issues with the Original Single-Backend Plan (now Resolved)

The previous draft assumed a modular monolith. The split topology forces fixes:

1. **In-process `IApi` callbacks become network calls.** Original plan had `IPaymentsApi.MarkConfirmedAsync` calling back into `ApplicantPortal`. Across deployments that's an HTTP call — needs retry policy, timeouts, dead-letter. **Resolution:** with shared DB, most "callbacks" become reads on next request (no webhook needed). Reserve HTTP webhooks for events that can't wait for next read.
2. **`MoiMock` was a permanent module.** Risk of leaking mock data to prod. **Resolution:** `IMoiClient` interface; `MoiMockClient` registered only when `Mock.MoiClient = true` in `appsettings.Development.json`.
3. **No rate limiting on public-internet endpoints.** **Resolution:** `Microsoft.AspNetCore.RateLimiting` + request-size limits on the applicant backend; per-IP + per-NID buckets.
4. **Auth mixed under `/api/auth/login` with role discriminator.** **Resolution:** distinct controllers per backend; separate JWT issuers/audiences; admin tokens rejected by applicant middleware and vice versa.
5. **DB constraints solely via SQL triggers.** Awful to debug across services. **Resolution:** application-layer checks throw typed `ErrorCodes.CONFLICT_*` first; SQL triggers stay as belt-and-braces.
6. **Heavy aggregate loads.** **Resolution:** every applicant-backend read path uses `AsNoTracking()` + projected DTOs (no full entity loads). Documented as a convention in `PACademy.Shared.Persistence.ReadConventions`.
7. **Migration ownership undefined.** **Resolution:** admin backend owns all migrations; applicant backend's DbContexts have `[NotMapped]`/`OnConfiguring → throw` if `database update` is attempted.
8. **CORS + frontend wiring not addressed.** **Resolution:** admin backend allows admin-frontend origin only (initially same Vite dev origin in Dev, restricted in Prod). Applicant backend mirrors. Frontend gets two `apiClient` instances under `frontend/src/shared/api/`.
9. **Lookup write surface leaking to applicant.** **Resolution:** applicant backend's `ILookupsReadApi` is `IQueryable<TRow>`-projection only; no `Add/Update/Remove` references compiled.
10. **Audit trail provenance.** **Resolution:** `audit_log.source NVARCHAR(16) NOT NULL` column with values `'admin'`/`'applicant'`. Each backend stamps its own source on every audit emit.

---

## Repository Layout

```
backend/
├── shared/                                           common to both backends
│   ├── PACademy.Shared.Domain/                       entities, value objects, enums used by both
│   ├── PACademy.Shared.Persistence/                  EF Core configurations, base DbContext, migration assembly
│   ├── PACademy.Shared.Contracts/                    ErrorCodes, common envelopes, cross-backend DTOs
│   ├── PACademy.Shared.Audit/                        IAuditApi + Audit entity (source column for backend provenance)
│   └── PACademy.Shared.Lookups/                      lookup entity types + read-only IQueryable repository
│
├── admin/                                            ADMIN BACKEND (internal-network)
│   ├── PACademy.Admin.Api/                           composition root, controllers, auth middleware, Swagger
│   ├── Modules/
│   │   ├── Identity/                                 staff OTP auth, lock policy, RBAC
│   │   │   ├── PACademy.Modules.Identity.Domain/
│   │   │   ├── PACademy.Modules.Identity.Application/
│   │   │   ├── PACademy.Modules.Identity.Infrastructure/
│   │   │   └── PACademy.Modules.Identity.Public/
│   │   ├── LookupsAdmin/                             CRUD on 24 typed lookups
│   │   ├── AdmissionsAdmin/                          cycles + categories + admission-setup wizard
│   │   ├── GradesAdmin/                              import (.mdb/.xlsx/.csv) + adjustments
│   │   ├── PaymentsAdmin/                            Fawry ledger, sync, refunds
│   │   └── ApplicantsAdmin/                          search, list, view, transition, audit timeline
│   └── PACademy.Admin.sln
│
├── applicant/                                        APPLICANT BACKEND (public-internet)
│   ├── PACademy.Applicant.Api/                       composition root, controllers, rate limiting, anti-bot
│   ├── Modules/
│   │   ├── IdentityApplicant/                        NID + mobile login, applicant user store
│   │   ├── Moi/                                      IMoiClient interface + MoiMockClient (Dev) + MoiHttpClient (Prod)
│   │   ├── AdmissionsRead/                           read-only cycles + categories + eligibility checker
│   │   ├── LookupsRead/                              read-only typed lookup queries
│   │   ├── GradesRead/                               by-NID lookup
│   │   ├── PaymentsApplicant/                        create intent (Fawry), confirm, verify by ref
│   │   └── ApplicantPortal/                          draft, stages, family, exam pick, attendance card data
│   └── PACademy.Applicant.sln
│
├── tests/                                            shared test projects
│   ├── PACademy.Admin.IntegrationTests/
│   ├── PACademy.Applicant.IntegrationTests/
│   └── PACademy.Shared.Architecture.Tests/           enforces module boundaries (e.g. applicant backend can't reference admin)
│
└── README.md                                         "which solution to open when working on X"
```

Each module under `Modules/<Name>/` follows the same four-project split:
`Domain / Application / Infrastructure / Public`. Shared libraries live in
`backend/shared/` and are referenced by both backends via project reference.

---

## Backend Conventions to Follow

(Apply to both backends — `backend/admin/` and `backend/applicant/`.)

**Code style** (mirroring the f542317 baseline):
- `sealed class` for use cases + entities; primary constructor for DI.
- `sealed record` for DTOs + request/response shapes.
- Async-first; final `CancellationToken ct = default` param on every method.
- EF Core: per-module DbContext, snake_case columns via `ApplyConfigurationsFromAssembly`, `rowversion` for concurrency, per-module `__EFMigrationsHistory_<Name>` table.
- Validation: FluentValidation `AbstractValidator<TRequest>` mirroring the frontend's zod schemas (`frontend/src/features/applicant-portal/schemas/index.ts`).
- Errors: throw or return tuples carrying `PACademy.Shared.Contracts.ErrorCodes.*` constants; controller maps to HTTP envelope.
- Authorization: `[Authorize(Policy = "resource:verb")]` per endpoint, plus audience check via JWT bearer config.
- Read paths in the applicant backend: `AsNoTracking()` + projected DTOs only; **never** load full entities.
- `Program.cs` wires modules via `builder.Services.AddXxxModule(builder.Configuration);`.
- CORS: each backend whitelists only its frontend origin via `appsettings.*.json`.
- Serilog structured logging with backend name + correlation ID.

**Authoritative reference docs** (read before writing matching code):
- [docs/DB_CONSTRAINTS.md](/Users/mac/Desktop/Appenza/Projects/PACademy/docs/DB_CONSTRAINTS.md) — every invariant + typed `ConflictError` code
- [docs/INTEGRATION_HANDOFF.md](/Users/mac/Desktop/Appenza/Projects/PACademy/docs/INTEGRATION_HANDOFF.md) — endpoint catalog + error-envelope shape

---

## Shared Library Contracts

### `PACademy.Shared.Domain`

Pure entity classes referenced by both backends (one DB → one canonical entity type):

- `AdmissionCycle`, `ApplicantCategory`, `CycleOpenCategory`, `CycleFee`
- `Applicant`, `ApplicantEducation`, `ApplicantAddress`, `ApplicantFamilyMember`, `ApplicantExamReservation`
- `Payment` (Fawry ledger row)
- `GradeRow` (Thanaweya import row)
- All 24 lookup entity types (`Faculty`, `Specialization`, `University`, `Governorate`, `SchoolCategory`, …)

Entities expose `internal` factory methods. Public mutating methods live in their owning
backend's module (e.g. `Payment.MarkConfirmed()` is callable only from `PaymentsAdmin`).

### `PACademy.Shared.Persistence`

- `BasePACademyDbContext` — shared base with audit-column conventions, soft-delete query filter, snake_case naming convention.
- `MigrationsAssemblyConvention` — points all module DbContexts at the admin backend's migration assembly so only admin runs DDL.
- `ReadConventions` static class — extension methods `.AsReadOnlyProjection<T>()` enforcing `AsNoTracking()` + projection.

### `PACademy.Shared.Contracts`

- `ErrorCodes` constants (single source of truth for both backends).
- Envelope records: `ConflictResponse`, `DependencyBlockedResponse`, `ValidationErrorResponse`.
- Cross-backend DTOs: `ApplicantPublicProfile`, `PaymentRefDto`, etc.

### `PACademy.Shared.Audit`

- `AuditEntry` entity with new `Source NVARCHAR(16) NOT NULL` column (`'admin'` | `'applicant'`).
- `IAuditApi` exposing `RecordAsync(action, entityType, entityId, outcome, …)`. Each backend implements with its own source value injected.

### `PACademy.Shared.Lookups`

- 24 typed lookup entity classes.
- `ILookupsReadApi<TRow>` — projection-only `IQueryable<TRow>` access. Applicant backend depends on this.
- (Admin-only mutation is via `LookupsAdmin` module's `ILookupsAdminApi` — NOT in shared lib.)

---

## Admin Backend (`backend/admin/`)

Internal-network deployment. Staff OTP auth. Owns DDL/migrations.

### Modules + endpoints

| Module | Endpoints (sample) | Notes |
|---|---|---|
| `Identity` | `POST /api/auth/login/request-otp`, `POST /api/auth/login/verify-otp`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/lock-policy`, `PATCH /api/auth/lock-policy`, `GET /api/auth/lock-policy/locked-users`, `POST /api/auth/lock-policy/unlock` | Staff OTP two-step. JWT issuer `admin-api`. Mirrors the existing `auth.service.ts` contract. |
| `LookupsAdmin` | `GET /api/lookups/:key`, `POST /api/lookups/:key`, `PATCH /api/lookups/:key/:code`, `DELETE /api/lookups/:key/:code` | CRUD on 24 typed lookups. `:key` validated against closed union. |
| `AdmissionsAdmin` | `GET /api/admin/cycles`, `POST /api/admin/cycles`, `PATCH /api/admin/cycles/:id`, `POST /api/admin/cycles/:id/activate` (enforces `ACTIVE_CYCLE_EXISTS`), `GET /api/admin/categories`, `PATCH /api/admin/categories/:key`, admission-setup wizard endpoints | Cycles + categories + admission-setup wizard backing. |
| `GradesAdmin` | `GET /api/admin/applicant-grades`, `POST /api/admin/applicant-grades/import/stage`, `POST /api/admin/applicant-grades/import/commit`, `POST /api/admin/applicant-grades/:seat/adjustments` | Bulk import (.mdb/.xlsx/.csv parsed client-side; backend just commits rows) + per-seat adjustments. |
| `PaymentsAdmin` | `GET /api/admin/payments`, `GET /api/admin/payments/:ref`, `POST /api/admin/payments/:id/sync`, `PATCH /api/admin/payments/:id/status`, `POST /api/admin/payments/:id/refund` | Fawry ledger, sync, manual override, refunds. |
| `ApplicantsAdmin` | `GET /api/applicants`, `GET /api/applicants/:id`, `GET /api/applicants/:id/timeline`, `POST /api/v1/applicants/:id/transition`, `GET /api/v1/audit?entity=applicant&entityId=:id` | Read-mostly view of `applicants` table (writes from applicant backend). |

### Audit, CORS, JWT

- All endpoints `[Authorize(Policy="…")]`. Each emits via `IAuditApi.RecordAsync(source='admin', …)`.
- CORS: `appsettings.json → Cors.AdminFrontendOrigin`.
- JWT bearer: `Issuer='admin-api'`, `Audience='admin-api'`. Tokens minted only by `Identity/VerifyOtpUseCase`.

---

## Applicant Backend (`backend/applicant/`)

Public-internet deployment. Rate-limited. NID + mobile login. Owns no DDL — only reads/writes through projected DTOs against the shared DB.

### Modules + endpoints

| Module | Endpoints | Notes |
|---|---|---|
| `IdentityApplicant` | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | Body: `{username: NID, password: mobile, role:'applicant'}`. Lookup against `applicants` by `(nid, mobile)`; issue JWT `aud='applicant-api'`. |
| `Moi` | `GET /applicant/moi/verify/:nid` | Backed by `IMoiClient`. Dev: `MoiMockClient` returns seeded data for 4 demo NIDs (Ahmed `30412180103456` eligible, Khaled `28503150103456` ineligible, Mohamed `30506200103456` 404, Youssef `30407010103456` submitted). Prod: `MoiHttpClient` (stubbed throw until real integration). |
| `AdmissionsRead` | `GET /api/applicant/cycles/active`, `GET /api/applicant/categories?cycleId=…`, `POST /api/applicant/eligibility` | Read-only projection of cycles/categories. Eligibility returns typed `reasons[]`. |
| `LookupsRead` | `GET /api/lookups/:key` | Read-only `IQueryable<LookupRow>` projection. Same URL as admin's read endpoint but no write verbs. |
| `GradesRead` | `GET /api/admin/applicant-grades/by-nid/:nid?cycleId=…` | Single-row lookup. URL kept as `/api/admin/...` so the frontend's existing service contract is unchanged. |
| `PaymentsApplicant` | `POST /applicant/payment/intent`, `POST /applicant/payment/confirm`, `GET /applicant/payment/verify/:refNumber`, `POST /applicant/payment/confirm-identity` | Creates Fawry intent (deterministic 10-digit `refNumber`, fresh 8-digit `fawryCode` per intent), polls Fawry for confirmation, AF-2 pre-payment identity gate. |
| `ApplicantPortal` | `POST /applicant/auth/initiate`, `POST /applicant/auth/verify`, `GET /applicant/draft/:id`, `PATCH /applicant/draft/:id` (requires `If-Match: <row_version>`), `POST /applicant/stage/:id/:n`, `POST /applicant/verify-certificate`, `POST /applicant/verify`, `GET /applicant/:id/family`, `PUT /applicant/:id/family/:relation/:index?`, `DELETE /applicant/:id/family/:relation/:index`, `POST /applicant/parents/approve`, `GET /applicant/exam-slots`, `POST /applicant/exam-slots/:slotId/reserve`, `POST /applicant/exam-date`, `GET /applicant/follow-up/:id`, `POST /applicant/attendance-card/:id`, `POST /applicant/acquaintance-doc/:id` | Full applicant journey. |

### Rate limiting + anti-abuse

- `Microsoft.AspNetCore.RateLimiting`: per-IP fixed window (60 req/min) + per-NID token bucket (300 req/hour after login).
- Request size limit: 256 KB on PATCH/POST except `family-member` PUT (1 MB).
- CAPTCHA on `POST /api/auth/login` after 3 failures from same IP within 5 min (decision deferred — placeholder middleware in plan).

### Audit, CORS, JWT

- All write endpoints emit `IAuditApi.RecordAsync(source='applicant', …)`.
- CORS: `appsettings.json → Cors.ApplicantFrontendOrigin`.
- JWT bearer: `Issuer='applicant-api'`, `Audience='applicant-api'`. Tokens minted only by `IdentityApplicant/LoginUseCase`. Admin-issued tokens are rejected (audience mismatch).

---

## Key Module Detail: `ApplicantPortal`

### Tables (snake_case; admin backend owns the migrations)

- **`applicants`** — `id (UUID PK), cycle_id, category_key, faculty_key, specialization_key, national_id, phone_number, moi_session_json, verified_at, furthest_stage (int), suspended (bit), suspension_reason, submitted_demo (bit), parents_approved (bit), parents_approved_at, first_exam_date, attendance_card_printed_at, payment_ref_number, paid_at, last_saved_at, social_handles_json, follow_up_pipeline_json, manual_personal_json, qualification_level, created_at, updated_at, row_version`. `UNIQUE (national_id, cycle_id)`.
- **`applicant_education`** — `applicant_id (PK/FK), thanawi_*, school_name_ar, school_address, bachelor_*, postgrad_*, doctorate_*, row_version`.
- **`applicant_address`** — `applicant_id (PK/FK), address_governorate, address_district, current_address_detail, home_phone, secondary_mobile, fax, birth_district, row_version`.
- **`applicant_family_members`** — single table with `relation` discriminator enum (15 values: `father, mother, father_wife, mother_husband, paternal_grandfather, paternal_grandmother, maternal_grandfather, maternal_grandmother, brother, sister, paternal_uncle, paternal_aunt, maternal_aunt, maternal_uncle, guardian`). Columns: `id, applicant_id, relation, sort_index, full_name, national_id, nid_unavailable, nid_reason, shuhra, religion, dob, birth_*, deceased, residence_*, profession, profession_detail, seniority_number, qualification, qualification_detail, workplace_detail, is_saved, row_version`.
- **`applicant_exam_reservations`** — `id, applicant_id, slot_id, exam_date, time, location, reserved_at, row_version`.

### Use cases (`backend/applicant/Modules/ApplicantPortal/Application/UseCases/`)

```
Auth/         InitiateApplicantAuthUseCase, VerifyApplicantAuthUseCase,
              ReverifyApplicantIdentityUseCase, ConfirmPrePaymentIdentityUseCase
Moi/          FetchMoiVerificationUseCase  (calls IMoiClient)
Draft/        GetApplicantDraftUseCase, PatchApplicantDraftUseCase  (requires If-Match)
Stages/       SubmitApplicantStageUseCase  +  Stage345Validator, Stage6Validator, Stage8Validator
Family/       GetApplicantFamilyUseCase, UpsertFamilyMemberUseCase,
              RemoveFamilyMemberUseCase, ApproveParentsUseCase
Payment/      CreatePaymentIntentUseCase, ConfirmPaymentUseCase, MarkPaymentConfirmedUseCase
ExamSlots/    ListAvailableExamSlotsUseCase, ReserveExamSlotUseCase, PickFirstExamDateUseCase
FollowUp/     GetFollowUpPipelineUseCase
Documents/    GenerateAttendanceCardDataUseCase, GenerateAcquaintanceDocDataUseCase
```

**Concurrency**: PATCH `/draft` requires `If-Match: <row_version>` header → `ErrorCodes.DRAFT_VERSION_CONFLICT` on mismatch. Stage submits are monotonic on `furthest_stage`.

---

## Sample Vertical Slice — Faculties Lookup (Admin CRUD vs Applicant Read-Only)

One concrete walk-through to lock in the conventions before broader implementation. Faculties
chosen because: shared `Faculty` entity, simple shape (`code`, `name`, `isActive`), consumed by
the applicant Stage345 bachelor block and managed by admin under `/admin/lookups/faculties`.

### 0 — Shared entity + EF configuration (`backend/shared/`)

```csharp
// backend/shared/PACademy.Shared.Domain/Lookups/Faculty.cs
namespace PACademy.Shared.Domain.Lookups;

public sealed class Faculty
{
    private Faculty() { }

    public string Code { get; private set; } = default!;     // FAC-01 ..
    public string Name { get; private set; } = default!;     // Arabic
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = default!;

    internal static Faculty Create(string code, string name)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("code required");
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("name required");
        var now = DateTimeOffset.UtcNow;
        return new Faculty { Code = code, Name = name, IsActive = true, CreatedAt = now, UpdatedAt = now };
    }

    internal void Rename(string newName)
    {
        if (string.IsNullOrWhiteSpace(newName)) throw new ArgumentException("name required");
        Name = newName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    internal void SetActive(bool isActive)
    {
        IsActive = isActive;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
```

```csharp
// backend/shared/PACademy.Shared.Persistence/Lookups/FacultyConfiguration.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Shared.Persistence.Lookups;

public sealed class FacultyConfiguration : IEntityTypeConfiguration<Faculty>
{
    public void Configure(EntityTypeBuilder<Faculty> b)
    {
        b.ToTable("faculties");
        b.HasKey(x => x.Code);
        b.Property(x => x.Code).HasColumnName("code").HasMaxLength(16);
        b.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
        b.Property(x => x.IsActive).HasColumnName("is_active");
        b.Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Property(x => x.RowVersion).HasColumnName("row_version").IsRowVersion();
    }
}
```

---

### 1 — Admin backend: full CRUD slice

```csharp
// backend/admin/Modules/LookupsAdmin/Application/Faculties/ILookupsAdminDbContext.cs
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public interface ILookupsAdminDbContext
{
    DbSet<Faculty> Faculties { get; }
    Task<int> SaveChangesAsync(CancellationToken ct);
}
```

```csharp
// backend/admin/Modules/LookupsAdmin/Application/Faculties/FacultyDtos.cs
namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public sealed record FacultyAdminDto(string Code, string Name, bool IsActive,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, string RowVersion);

public sealed record CreateFacultyRequest(string Code, string Name);
public sealed record UpdateFacultyRequest(string Name, bool IsActive);
```

```csharp
// backend/admin/Modules/LookupsAdmin/Application/Faculties/ListFacultiesUseCase.cs
using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public sealed record ListFacultiesFilters(bool? IsActive, string? Search);

public sealed class ListFacultiesUseCase(ILookupsAdminDbContext db)
{
    public async Task<IReadOnlyList<FacultyAdminDto>> ExecuteAsync(
        ListFacultiesFilters filters,
        CancellationToken ct = default)
    {
        IQueryable<Shared.Domain.Lookups.Faculty> q = db.Faculties.AsNoTracking();

        if (filters.IsActive.HasValue) q = q.Where(f => f.IsActive == filters.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(filters.Search))
        {
            var s = filters.Search.Trim();
            q = q.Where(f => EF.Functions.Like(f.Name, $"%{s}%") || EF.Functions.Like(f.Code, $"%{s}%"));
        }

        return await q.OrderBy(f => f.Code)
            .Select(f => new FacultyAdminDto(f.Code, f.Name, f.IsActive, f.CreatedAt, f.UpdatedAt,
                Convert.ToBase64String(f.RowVersion)))
            .ToListAsync(ct);
    }
}
```

```csharp
// backend/admin/Modules/LookupsAdmin/Application/Faculties/CreateFacultyUseCase.cs
using PACademy.Shared.Audit.Public;
using PACademy.Shared.Contracts;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public sealed class CreateFacultyUseCase(ILookupsAdminDbContext db, IAuditApi audit)
{
    public async Task<(FacultyAdminDto? Ok, string? ErrorCode)> ExecuteAsync(
        CreateFacultyRequest request, Guid actorId, CancellationToken ct = default)
    {
        var exists = await db.Faculties.FindAsync(new object?[] { request.Code }, ct);
        if (exists is not null) return (null, ErrorCodes.LookupCodeDuplicate);

        var entity = Faculty.Create(request.Code, request.Name);
        db.Faculties.Add(entity);
        await db.SaveChangesAsync(ct);

        await audit.RecordAsync("lookup.create", "faculty", actorId, entity.Code,
            AuditOutcome.Success, source: "admin", ct: ct);

        return (new FacultyAdminDto(entity.Code, entity.Name, entity.IsActive,
            entity.CreatedAt, entity.UpdatedAt,
            Convert.ToBase64String(entity.RowVersion)), null);
    }
}
```

```csharp
// backend/admin/Modules/LookupsAdmin/Application/Faculties/CreateFacultyValidator.cs
using FluentValidation;

namespace PACademy.Modules.LookupsAdmin.Application.Faculties;

public sealed class CreateFacultyValidator : AbstractValidator<CreateFacultyRequest>
{
    public CreateFacultyValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().Matches("^FAC-[0-9]{2,4}$")
            .WithMessage("Code must match FAC-NN pattern");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
    }
}
```

```csharp
// backend/admin/PACademy.Admin.Api/Controllers/LookupsAdminController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.LookupsAdmin.Application.Faculties;
using PACademy.Shared.Contracts;

namespace PACademy.Admin.Api.Controllers;

[ApiController]
[Route("api/lookups/faculties")]
[Authorize(Policy = "lookups:write")]
public sealed class LookupsFacultyController(
    ListFacultiesUseCase list,
    CreateFacultyUseCase create) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "lookups:read")]
    public async Task<IActionResult> List([FromQuery] bool? isActive, [FromQuery] string? search,
        CancellationToken ct)
        => Ok(await list.ExecuteAsync(new ListFacultiesFilters(isActive, search), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFacultyRequest body, CancellationToken ct)
    {
        var actorId = User.GetUserId(); // extension off ClaimsPrincipal
        var (ok, errorCode) = await create.ExecuteAsync(body, actorId, ct);

        if (errorCode == ErrorCodes.LookupCodeDuplicate)
            return Conflict(new {
                code = "CONFLICT",
                conflictCode = errorCode,
                message = "كود الكلية مستخدم مسبقاً",
            });

        return CreatedAtAction(nameof(List), new { code = ok!.Code }, ok);
    }
}
```

```csharp
// backend/admin/Modules/LookupsAdmin/Infrastructure/LookupsAdminModule.cs
public static class LookupsAdminModule
{
    public static IServiceCollection AddLookupsAdminModule(this IServiceCollection services,
        IConfiguration config)
    {
        var cs = config.GetConnectionString("Default")!;
        services.AddDbContext<LookupsAdminDbContext>(opt =>
            opt.UseSqlServer(cs, o => o
                .MigrationsHistoryTable("__EFMigrationsHistory_LookupsAdmin")
                .MigrationsAssembly(typeof(LookupsAdminDbContext).Assembly.FullName)));

        services.AddScoped<ILookupsAdminDbContext>(sp => sp.GetRequiredService<LookupsAdminDbContext>());
        services.AddScoped<ListFacultiesUseCase>();
        services.AddScoped<CreateFacultyUseCase>();
        services.AddScoped<IValidator<CreateFacultyRequest>, CreateFacultyValidator>();
        return services;
    }
}
```

---

### 2 — Applicant backend: read-only slice (same DB, different surface)

```csharp
// backend/applicant/Modules/LookupsRead/Application/Faculties/ILookupsReadDbContext.cs
using Microsoft.EntityFrameworkCore;
using PACademy.Shared.Domain.Lookups;

namespace PACademy.Modules.LookupsRead.Application;

public interface ILookupsReadDbContext
{
    // IQueryable, NOT DbSet — applicant backend cannot Add/Update/Remove.
    IQueryable<Faculty> Faculties { get; }
}
```

```csharp
// backend/applicant/Modules/LookupsRead/Infrastructure/LookupsReadDbContext.cs
public sealed class LookupsReadDbContext(DbContextOptions<LookupsReadDbContext> options)
    : DbContext(options), ILookupsReadDbContext
{
    private DbSet<Faculty> _faculties => Set<Faculty>();

    // Expose IQueryable only — no Add/Update/Remove access.
    public IQueryable<Faculty> Faculties => _faculties.AsNoTracking();

    protected override void OnModelCreating(ModelBuilder b)
        => b.ApplyConfigurationsFromAssembly(typeof(PACademy.Shared.Persistence.Lookups.FacultyConfiguration).Assembly);

    // Defensive: this backend never runs migrations.
    public override int SaveChanges() => throw new InvalidOperationException(
        "Applicant backend is read-only. Migrations + writes belong to the admin backend.");
}
```

```csharp
// backend/applicant/Modules/LookupsRead/Application/Faculties/FacultyPublicDto.cs
namespace PACademy.Modules.LookupsRead.Application;

// Public surface — no audit fields, no row version.
public sealed record FacultyPublicDto(string Code, string Name);
```

```csharp
// backend/applicant/Modules/LookupsRead/Application/Faculties/ListActiveFacultiesUseCase.cs
using Microsoft.EntityFrameworkCore;

namespace PACademy.Modules.LookupsRead.Application;

public sealed class ListActiveFacultiesUseCase(ILookupsReadDbContext db)
{
    public async Task<IReadOnlyList<FacultyPublicDto>> ExecuteAsync(CancellationToken ct = default)
        => await db.Faculties
            .Where(f => f.IsActive)
            .OrderBy(f => f.Name)
            .Select(f => new FacultyPublicDto(f.Code, f.Name))
            .ToListAsync(ct);
}
```

```csharp
// backend/applicant/PACademy.Applicant.Api/Controllers/LookupsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PACademy.Modules.LookupsRead.Application;

namespace PACademy.Applicant.Api.Controllers;

[ApiController]
[Route("api/lookups")]
[Authorize] // any authenticated applicant; lookups carry no PII
public sealed class LookupsController(ListActiveFacultiesUseCase listFaculties) : ControllerBase
{
    [HttpGet("faculties")]
    public async Task<IActionResult> GetFaculties(CancellationToken ct)
        => Ok(await listFaculties.ExecuteAsync(ct));

    // Other lookup keys land here as additional [HttpGet] methods —
    // one per key, each with its own use case + DTO. Closed union
    // enforced at the controller level.
}
```

```csharp
// backend/applicant/Modules/LookupsRead/Infrastructure/LookupsReadModule.cs
public static class LookupsReadModule
{
    public static IServiceCollection AddLookupsReadModule(this IServiceCollection services,
        IConfiguration config)
    {
        var cs = config.GetConnectionString("Default")!;
        services.AddDbContext<LookupsReadDbContext>(opt =>
            opt.UseSqlServer(cs)               // NO MigrationsAssembly — read-only
               .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

        services.AddScoped<ILookupsReadDbContext>(sp => sp.GetRequiredService<LookupsReadDbContext>());
        services.AddScoped<ListActiveFacultiesUseCase>();
        return services;
    }
}
```

---

### 3 — Side-by-side comparison

| Concern | Admin backend (CRUD) | Applicant backend (read-only) |
|---|---|---|
| DbContext interface | `ILookupsAdminDbContext` exposes `DbSet<Faculty>` | `ILookupsReadDbContext` exposes `IQueryable<Faculty>` (no mutation surface) |
| DbContext class | Standard EF `DbContext` with `SaveChangesAsync` | Overrides `SaveChanges` to throw; no `MigrationsAssembly` |
| DTO shape | `FacultyAdminDto` (includes `CreatedAt`, `UpdatedAt`, `RowVersion`) | `FacultyPublicDto` (just `Code` + `Name`) |
| Use cases | `ListFacultiesUseCase`, `CreateFacultyUseCase`, `UpdateFacultyUseCase`, `DeleteFacultyUseCase` | `ListActiveFacultiesUseCase` only |
| Validators | `CreateFacultyValidator`, `UpdateFacultyValidator` (FluentValidation) | none — no inputs to validate |
| Controller route | `/api/lookups/faculties` with `[HttpGet/Post/Patch/Delete]` | `/api/lookups/faculties` with `[HttpGet]` only |
| Auth | `[Authorize(Policy="lookups:read")]` on GET, `[Authorize(Policy="lookups:write")]` on others | `[Authorize]` (any logged-in applicant) |
| Audit | Every write emits `IAuditApi.RecordAsync(source: "admin", ...)` | No writes → no audit |
| Caching | None (admin writes need fresh reads) | In-memory cache with 5-min TTL + webhook invalidation from admin |
| Architecture test | `applicant` projects MUST NOT reference `LookupsAdmin` assemblies | enforced in `PACademy.Shared.Architecture.Tests` |

This same shape repeats for all 24 lookups — each gets a typed entity in `Shared.Domain.Lookups/`,
an EF configuration in `Shared.Persistence/Lookups/`, an admin CRUD slice in `LookupsAdmin/`, and a
read-only slice in `LookupsRead/`. Once the pattern is reviewed and approved, the remaining 23
lookups are mechanical replication.

---

## Cross-Backend Coordination

| Event | Mechanism | Rationale |
|---|---|---|
| Admin suspends an applicant | Shared DB write; applicant backend reads `suspended=true` on next request | No webhook needed |
| Admin opens new cycle | Shared DB write; applicant backend reads cycle config on next request | No webhook needed |
| Admin updates a lookup | Shared DB write; applicant backend reads lookups with 5-min in-memory cache | Cache invalidation: HTTP webhook `POST /internal/cache/invalidate?key=…` from admin backend |
| Applicant submits a stage | Shared DB write; admin sees via search/list | No webhook needed |
| Fawry callback confirms payment | Fawry calls applicant backend's `POST /applicant/payment/fawry-callback`; applicant backend writes ledger | No webhook needed |
| Admin overrides payment status | Shared DB write; applicant backend reads on next refresh | No webhook needed |

**Webhook auth**: shared HMAC signed with a backend-to-backend shared secret in `appsettings`. Each webhook endpoint validates the signature header before processing.

---

## Frontend Wiring

[frontend/src/shared/api/client.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/shared/api/client.ts) gets split into two clients:

```ts
// new
export const adminApi = axios.create({ baseURL: import.meta.env.VITE_ADMIN_API_URL });
export const applicantApi = axios.create({ baseURL: import.meta.env.VITE_APPLICANT_API_URL });
```

Each `*.service.ts` picks its base via location:

- `frontend/src/features/admin/**` + `frontend/src/features/lookups/**` (admin CRUD) + `frontend/src/features/applicant-grades/**` + most other staff features → `adminApi`
- `frontend/src/features/applicant-portal/**` + `frontend/src/features/auth/api/auth.service.ts` (when role==='applicant') + `frontend/src/features/lookups/**` (when called from applicant pages — read-only) → `applicantApi`

The lookups feature is the only ambiguous case (read by both). Add a tiny `lookups.read.service.ts` that points at `applicantApi` for applicant-portal consumers; keep the existing `lookups.service.ts` for admin CRUD on `adminApi`.

Env vars per environment:

| Env | `VITE_ADMIN_API_URL` | `VITE_APPLICANT_API_URL` |
|---|---|---|
| Dev | `http://localhost:5101` | `http://localhost:5102` |
| Demo | `https://admin-api.appenzademo.com` | `https://apply-api.appenzademo.com` |
| Prod | … | … |

---

## Database Invariants (Enforced in Both Layers)

From `docs/DB_CONSTRAINTS.md`:

| Invariant | Conflict code | DB | Application |
|---|---|---|---|
| One active cycle only | `ACTIVE_CYCLE_EXISTS` | filtered unique index | `AdmissionsAdmin/ActivateCycleUseCase` |
| Unique applicant per (NID, cycle) | `NID_CYCLE_DUPLICATE` | `UNIQUE (nid, cycle_id)` | `ApplicantPortal/InitiateApplicantAuthUseCase` |
| Committee daily attendance ≤ capacity | `COMMITTEE_AT_CAPACITY` | trigger on `committee_slots` | `ApplicantPortal/ReserveExamSlotUseCase` |
| Soft-delete filter | — | — | shared query filter via `BasePACademyDbContext` |
| Grade mode mismatch | `GRADE_MODE_MISMATCH` | — | `AdmissionsAdmin/UpdateCategoryUseCase` |
| Draft version conflict | `DRAFT_VERSION_CONFLICT` | rowversion | `ApplicantPortal/PatchApplicantDraftUseCase` |

---

## Critical Files Referenced

| File | Why |
|---|---|
| [docs/DB_CONSTRAINTS.md](/Users/mac/Desktop/Appenza/Projects/PACademy/docs/DB_CONSTRAINTS.md) | Every invariant + typed conflict code |
| [docs/INTEGRATION_HANDOFF.md](/Users/mac/Desktop/Appenza/Projects/PACademy/docs/INTEGRATION_HANDOFF.md) | Endpoint catalog + error-envelope shape baseline |
| [frontend/src/features/applicant-portal/api/applicantPortal.service.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/api/applicantPortal.service.ts) | 18 method contracts the applicant backend must satisfy |
| [frontend/src/features/auth/api/auth.service.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/auth/api/auth.service.ts) | Login contract (applicant vs staff) |
| [frontend/src/features/applicant-portal/api/categories.service.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/api/categories.service.ts) | Cycles + categories + eligibility — applicant read |
| [frontend/src/features/applicant-grades/api/grades.service.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-grades/api/grades.service.ts) | Grade-by-NID lookup (applicant read), full CRUD (admin) |
| [frontend/src/features/applicant-portal/schemas/index.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/schemas/index.ts) | Per-stage zod schemas → mirror as FluentValidation |
| [frontend/src/features/applicant-portal/lib/familyData.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/lib/familyData.ts) | `FamilyDataSnapshot` shape → tables |
| [frontend/src/features/applicant-portal/lib/profileData.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/lib/profileData.ts) | `ProfileSnapshot` shape → tables |
| [frontend/src/features/applicant-portal/lib/moi-session.mock.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/lib/moi-session.mock.ts) | MOI verdict shape + 4 demo NIDs to seed |
| [frontend/src/features/applicant-portal/lib/deterministic-codes.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/applicant-portal/lib/deterministic-codes.ts) | LCG seed pattern for `refNumber`, `fawryCode`, `fileNumber` |
| [frontend/src/features/lookups/types.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/features/lookups/types.ts) | 24-key closed union + per-key row types |
| [frontend/src/shared/types/domain.ts](/Users/mac/Desktop/Appenza/Projects/PACademy/frontend/src/shared/types/domain.ts) | `ApplicantDraft`, `ExamSlot`, `AdmissionCycle`, `ApplicantCategory` shapes |

---

## Build Sequence

Order chosen so each step unblocks the next; each step lands a runnable artifact.

**Phase 0 — Foundation**
1. Create `backend/` directory tree (shared + admin + applicant + tests).
2. Scaffold both solutions; wire shared library project references.
3. Compose connection string + appsettings layering.
4. Set up Serilog, Swagger, basic CORS on both API projects.

**Phase 1 — Shared libraries**
5. `PACademy.Shared.Contracts` (ErrorCodes + envelopes).
6. `PACademy.Shared.Persistence` (BasePACademyDbContext + read conventions).
7. `PACademy.Shared.Domain` (entity classes — single source of truth).
8. `PACademy.Shared.Audit` (with `source` column).
9. `PACademy.Shared.Lookups` (typed lookup entities + `ILookupsReadApi`).

**Phase 2 — Admin backend skeleton + Lookups**
10. `Identity` module (staff OTP auth).
11. `LookupsAdmin` module (CRUD on 24 lookups). Generate initial migration (covers all shared-DB tables including applicant-side tables).
12. Seed data: copy `frontend/src/features/lookups/mock/lookups.mock.ts` row-by-row into a DataSeeder.

**Phase 3 — Admin: cycles + categories + grades + payments**
13. `AdmissionsAdmin` module.
14. `GradesAdmin` module.
15. `PaymentsAdmin` module.
16. `ApplicantsAdmin` (read-mostly search/list).

**Phase 4 — Applicant backend skeleton**
17. `IdentityApplicant` (NID+mobile login + JWT `aud='applicant-api'`).
18. `Moi` module (`IMoiClient` + `MoiMockClient`).
19. `LookupsRead` (read projection over shared lookup tables).
20. `AdmissionsRead` (cycles/categories/eligibility).
21. `GradesRead` (by-NID).
22. Rate limiting middleware + CORS for `:5173`.

**Phase 5 — Applicant: ApplicantPortal + Payments**
23. `ApplicantPortal` use cases in dependency order: Auth → Draft → Stages → Family → ExamSlots → Documents → FollowUp.
24. `PaymentsApplicant` (intent + confirm).
25. Cross-backend cache invalidation webhook (`POST /internal/cache/invalidate`).

**Phase 6 — Frontend wiring**
26. Split `frontend/src/shared/api/client.ts` into `adminApi` + `applicantApi`.
27. Update `frontend/.env.*` with the two base URLs.
28. Swap each `*.service.ts` body from `simulateLatency() + MOCK.*` to the appropriate client `.get/post(...).then(r => r.data)`.

---

## Verification

End-to-end smoke (mirrors the demo script, runs against both backends):

1. **Both backends up**: `dotnet run --project backend/admin/PACademy.Admin.Api` on `:5101` + `dotnet run --project backend/applicant/PACademy.Applicant.Api` on `:5102`.
2. **Migrations applied**: `dotnet ef database update` from the admin backend creates schema; seed data populated.
3. **Audience isolation**: admin token rejected by applicant backend (`401 Unauthorized`); applicant token rejected by admin backend.
4. **Lookups respond on both backends**: `curl http://localhost:5101/api/lookups/faculties` and `curl http://localhost:5102/api/lookups/faculties` return identical row arrays.
5. **Cycles + categories**: `curl http://localhost:5102/api/applicant/cycles/active` then `/api/applicant/categories?cycleId=…` populate.
6. **Login (Ahmed eligible path)**: `POST http://localhost:5102/api/auth/login` with `{username:'30412180103456', password:'01012345678', role:'applicant'}` returns a token; frontend lands at `/applicant/start` with category pre-selected.
7. **Login (Mohamed not_found path)**: same call with `30506200103456` returns a token; frontend lands at `/applicant/start` with category-picker visible (MOI verify returned 404).
8. **Draft round-trip**: `GET /applicant/draft/:id` → patch fields → `PATCH` with `If-Match` → re-fetch shows merged data. Without `If-Match` → 412 Precondition Required. Stale `If-Match` → `DRAFT_VERSION_CONFLICT`.
9. **Stage commit**: `POST /applicant/stage/:id/3` with a valid Stage345 payload returns `{valid: true}`; invalid returns FluentValidation `field: message` errors.
10. **Family upsert** → `PUT /applicant/:id/family/father` → `POST /applicant/parents/approve` flips the gate. Verify admin search sees the new applicant.
11. **Payment** → `POST /applicant/payment/intent` returns `{intentId, refNumber, fawryCode}` → `POST /applicant/payment/confirm` returns `{confirmed:true, paidAt}`. Admin backend `GET /api/admin/payments?search=:refNumber` shows the row.
12. **Exam date pick** → `POST /applicant/exam-date` with ISO date → frontend Stage 9 print page renders the card.
13. **Print card + admission form**: Stage 9 single `window.print()` produces the combined PDF using real backend data (no sessionStorage).
14. **Rate limiting**: 100 anonymous requests in 60s to `/api/auth/login` from one IP → `429 Too Many Requests`.
15. **Cache invalidation**: admin updates `faculties` lookup → applicant backend's cached response stays stale until webhook fires → after webhook, next read returns fresh data.
16. **Frontend route smoke**: `npm --prefix frontend run test:routes` returns 200 on every applicant + admin route.

CI hardening (Sprint 10): contract tests per controller (xUnit + WebApplicationFactory), EF Core in-memory provider for unit tests, integration tests against LocalDB.

---

## Risks / Open Items

- **MOI demo NID `30506200103456`** routes through the `not_found` path; `MoiMockClient` seed must mirror this exactly so the existing UI demo continues to work.
- **`submitStage` payload is `Record<string, unknown>`** on the frontend — backend will be strict. Frontend may need a tightening pass before the wire call.
- **Deterministic codes** (`refNumber`, `fawryCode`, `fileNumber`) must use the same LCG seed pattern as `frontend/src/features/applicant-portal/lib/deterministic-codes.ts` (XOR with `0xd061` / `0xfa07` / `0xf11e`) so pre-integration screenshots match post-integration output.
- **`manual_personal_json` block** duplicates fields that also exist as columns on `applicants` for MOI-verified path. Decide before migration #1 whether to promote those JSON fields to columns or keep the duality.
- **Migration ownership clash**: if a dev mistakenly runs `dotnet ef database update` from the applicant backend, schema drift is possible. Guardrail: applicant DbContexts override `OnModelCreating` to throw if invoked from a migration context. Test in CI.
- **CAPTCHA on applicant login** — deferred decision (anti-bot vs UX friction). Plan ships placeholder middleware that no-ops until product calls it.
- **Lookup cache invalidation**: HTTP webhook between backends is a fragile coupling. If admin → applicant webhook fails, applicant cache stays stale until TTL expires. Acceptable for v1 (5-min TTL bound); document the SLA.
- **Webhook auth via shared HMAC secret** — needs key rotation playbook before prod.
