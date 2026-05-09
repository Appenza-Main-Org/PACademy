# Implementation Plan: Modular-Monolith Refactor (Phase 5)

**Branch**: `005-modular-monolith` (fork from `004-lookups-crud` once that PR merges; or fork from `dev`) | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-modular-monolith/spec.md`

## Summary

Carve the existing single-bag backend (`PACademy.Domain`, `Application`, `Infrastructure`, `Contracts`) into bounded-context modules — `Modules/Identity`, `Modules/Admissions`, `Modules/ReferenceData`, `Modules/Workflows` — plus a cross-cutting `Shared/Audit` and a slim `Shared/Contracts`. Each module owns its `DbContext` (5 contexts total against a single physical SQL Server DB), exposes a `*.Public` interface for inter-module reads (`IIdentityApi`, `IAdmissionsApi`, …), and writes audit rows through a shared `IAuditApi`. Cross-context atomic writes flow through a host-level `CrossModuleUnitOfWork` (single `SqlConnection` + `SqlTransaction`); `TransactionScope` is forbidden because the dev Docker SQL container does not support DTC. Architecture rules are enforced in CI via `NetArchTest.Rules` assertions in `PACademy.Architecture.Tests`. The user-facing API contract is unchanged at every step — phase 5 is invisible to the SPA.

## Technical Context

**Language/Version**: C# 13 / .NET 10
**Primary Dependencies**: ASP.NET Core 10 Web API, EF Core 10 (`Microsoft.EntityFrameworkCore.SqlServer`), AspNet Core Identity, FluentValidation 11, Microsoft.AspNetCore.Authentication.Cookies. New for phase 5: `NetArchTest.Rules` (architecture assertions, ~50 KB)
**Storage**: SQL Server 2022 (single physical DB; per-context migration tables: `__EFMigrationsHistory_Audit`, `__EFMigrationsHistory_Identity`, `__EFMigrationsHistory_ReferenceData`, `__EFMigrationsHistory_Workflows`, `__EFMigrationsHistory_Admissions`). Dev runs in Docker (`pacademy-sql` container)
**Testing**: xUnit 2.9, FluentAssertions, Testcontainers.MsSql for integration tests. Architecture tests in a new `PACademy.Architecture.Tests` project. Existing `Admin/Cycles/{Crud,Overrides,Transition}Tests` carry over with namespace rewrites only
**Target Platform**: Linux containers (Docker), Windows dev workstations. Same deployable across both
**Project Type**: Modular monolith (single ASP.NET Core API host, multiple EF Core `DbContext`s within one process)
**Performance Goals**: Refactor invisible to API contract — no measurable latency regression on any endpoint. `CrossModuleUnitOfWork` paths add ≤ 5 ms p95 vs. the single-context baseline (single connection + single tx, no extra round-trips)
**Constraints**: No DTC (Docker SQL Server does not support it); no cross-module DB-level FK constraints; no `*.Public` interface ever exposed over HTTP/gRPC; no `TransactionScope`. New backend dependency `NetArchTest.Rules` is < 100 KB and only ships in test assemblies, so no production binary impact
**Scale/Scope**: 21 new csproj files added; 5 DbContexts; ~30 entity types relocated across 4 modules + 1 shared audit module; ~120 use-case files moved; legacy `PACademy.*` projects shrink in line with the carve. Frontend untouched (`frontend/` is explicitly out of scope)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.1.0. The constitution is currently frontend-focused; phase 5 is a **backend-only refactor** (`frontend/` is explicitly out of scope per spec.md), so frontend gates pass trivially by non-application. The note in the constitution Sync Impact Report explicitly acknowledges this: *"backend-specific rules will be added to this constitution when the backend kicks off."*

- **I. Code Quality & Maintainability** — N/A (no TypeScript / React changes). Backend code follows the .NET style baseline already enforced by `dotnet format --verify-no-changes` (pre-commit hook). No new `any`-equivalents; nullable reference types stay enabled per `<Nullable>enable</Nullable>` in every csproj. New dependency `NetArchTest.Rules` (~50 KB) is justified — it codifies the modular-monolith boundary that this entire spec is about. **Pass**.
- **II. Testing Standards** — Phase 5 keeps every existing backend test green (FR-B02). New tests added: 5 architecture-boundary tests (NetArchTest), 1 `CrossModuleUnitOfWork` integration test, 1 `MigrationOwnership` test. Architecture tests run on every PR (CI gate). The frontend test suite is untouched. **Pass**.
- **III. UX Consistency** — N/A (no UI changes). The user-facing API contract is identical at every point during the carve (US1-AS2: GET /admin/cycles returns identical shape to phase 4). **Pass by non-application**.
- **IV. Performance Requirements** — N/A (no frontend bundle changes; no Lighthouse delta). Backend-side perf budget: `CrossModuleUnitOfWork` paths must not regress more than 5 ms p95 vs single-context baseline; verified by an integration test in T362. **Pass**.
- **V. Spec-Driven Discipline** — `spec.md` stays tech-agnostic (no `.csproj` paths, no `NetArchTest.Rules` mention; those live here in plan.md). Traceability spec → plan → tasks → PR is preserved. The PR will link `specs/005-modular-monolith/spec.md`. **Pass**.

No violations to record in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/005-modular-monolith/
├── plan.md              # This file
├── research.md          # Phase 0 output — bounded-context decisions + alternatives
├── data-model.md        # Phase 1 output — entities per module, FK rules, JSON shapes
├── quickstart.md        # Phase 1 output — operator's per-module carve guide
├── contracts/           # Phase 1 output — per-module *.Public interfaces + error codes
└── tasks.md             # Phase 2 output — already drafted; see /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── PACademy.slnx
└── src/
    ├── Shared/
    │   ├── PACademy.Shared.Contracts/                          # PagedResult<T>, ApiError, ErrorCodes — zero refs
    │   └── Audit/
    │       ├── PACademy.Shared.Audit.Domain/                   # AuditEntry, AuditAction, IAuditableWrite
    │       ├── PACademy.Shared.Audit.Application/              # AuditApi (impl of IAuditApi)
    │       ├── PACademy.Shared.Audit.Infrastructure/           # AuditDbContext, immutability trigger migration
    │       └── PACademy.Shared.Audit.Public/                   # IAuditApi
    │
    ├── Modules/
    │   ├── Identity/      # 4 csprojs (Domain/Application/Infrastructure/Public) — auth + RBAC + system users
    │   ├── Admissions/    # 4 csprojs — applicants, cycles, categories, admission rules
    │   ├── ReferenceData/ # 4 csprojs — 8 lookup categories
    │   └── Workflows/     # 4 csprojs — workflows + workflow_stages
    │
    ├── PACademy.Api/                                           # Host. Composition root. Controllers (transitional). Middleware. CrossModuleUnitOfWork helper
    │
    └── (legacy — shrinks as modules extract)
        ├── PACademy.Domain/         # remaining cross-cutting types pending phase-6+ extraction
        ├── PACademy.Application/    # shrinks
        ├── PACademy.Infrastructure/ # shrinks; report-snapshot tables stay until phase 10
        └── PACademy.Contracts/      # shrinks; module-specific DTOs migrate into modules

backend/tests/
├── PACademy.Architecture.Tests/                                # NEW: NetArchTest assertions for module boundaries
├── PACademy.Api.Tests/                                         # Existing — namespace rewrites only, no test files moved
└── PACademy.Domain.Tests/                                      # Existing — namespace rewrites only

frontend/                                                       # UNTOUCHED in phase 5
```

**Structure Decision**: Modular monolith with 5 DbContexts on a single physical SQL Server DB. Each module is 4 csprojs (Domain, Application, Infrastructure, Public). Cross-module communication is via DI-injected `*.Public` interfaces only; HTTP exposure of public APIs is forbidden (FR-M05). Controllers stay in `PACademy.Api/Controllers/` for phase 5 (transitional decision documented in §A5).

---

## Project layout (target end state of phase 5)

```
backend/
├── PACademy.slnx
└── src/
    ├── Shared/
    │   ├── PACademy.Shared.Contracts/                          ← (1) PagedResult, ApiError, error codes. Zero project refs.
    │   │
    │   └── Audit/
    │       ├── PACademy.Shared.Audit.Domain/                   ← AuditEntry aggregate, IAuditableWrite, AuditAction enum
    │       ├── PACademy.Shared.Audit.Application/              ← AuditWriter (impl of IAuditApi), validators
    │       ├── PACademy.Shared.Audit.Infrastructure/           ← AuditDbContext, EF config, immutability trigger migration, AuditModule.AddAuditModule()
    │       └── PACademy.Shared.Audit.Public/                   ← IAuditApi, AuditEnvelopeDto. Referenced by every module that emits audit rows.
    │
    ├── Modules/
    │   ├── Identity/
    │   │   ├── PACademy.Modules.Identity.Domain/               ← SystemUser, Session, Role
    │   │   ├── PACademy.Modules.Identity.Application/          ← LoginUseCase, LogoutUseCase, GetMeUseCase, AdminUsers/* use cases, validators, IIdentityProvider
    │   │   ├── PACademy.Modules.Identity.Infrastructure/       ← IdentityDbContext, EF Configurations, InSystemIdentityProvider, AspNetIdentity wiring, IdentityModule.AddIdentityModule()
    │   │   └── PACademy.Modules.Identity.Public/               ← IIdentityApi, CurrentUserDto, ROLE constants
    │   │
    │   ├── Admissions/
    │   │   ├── PACademy.Modules.Admissions.Domain/             ← Applicant, Cycle, Category, AdmissionRule, Workflow, WorkflowStage
    │   │   ├── PACademy.Modules.Admissions.Application/        ← Admin/{Cycles,Categories,AdmissionRules,Applicants}/* use cases, validators
    │   │   ├── PACademy.Modules.Admissions.Infrastructure/     ← AdmissionsDbContext, EF Configurations, AdmissionsModule.AddAdmissionsModule()
    │   │   └── PACademy.Modules.Admissions.Public/             ← IAdmissionsApi (read-only — current cycle, category-by-key)
    │   │
    │   ├── ReferenceData/
    │   │   ├── PACademy.Modules.ReferenceData.Domain/          ← ReferenceDataEntry
    │   │   ├── PACademy.Modules.ReferenceData.Application/     ← Admin CRUD use cases (List/Get/Create/Update/Archive), validator
    │   │   ├── PACademy.Modules.ReferenceData.Infrastructure/  ← ReferenceDataDbContext, EF config, ReferenceDataModule.AddReferenceDataModule()
    │   │   └── PACademy.Modules.ReferenceData.Public/          ← IReferenceDataApi (read-only — list-by-category, find-by-key)
    │   │
    │   └── Workflows/
    │       ├── PACademy.Modules.Workflows.Domain/              ← Workflow, WorkflowStage, WorkflowStatus
    │       ├── PACademy.Modules.Workflows.Application/         ← Admin CRUD use cases (List/Get/Create/Update/Publish/Archive), publish-with-auto-archive (Serializable, single-context per FR-W04)
    │       ├── PACademy.Modules.Workflows.Infrastructure/      ← WorkflowsDbContext, EF config, WorkflowsModule.AddWorkflowsModule()
    │       └── PACademy.Modules.Workflows.Public/              ← IWorkflowsApi (read-only — get-published, has-inflight-applicants)
    │
    ├── PACademy.Api/                                           ← Host. Composition root. Controllers (transitional). Middleware (Csrf, Session, GlobalException). DI bootstrap. Program.cs. CrossModuleUnitOfWork helper.
    │
    └── (legacy — UNCHANGED in phase 5; ported in later phases)
        ├── PACademy.Domain/                                    ← (shrinks as modules extract; remaining legacy types stay until phases 6+)
        ├── PACademy.Application/                               ← (will shrink as use cases move)
        ├── PACademy.Infrastructure/                            ← (will shrink as DbContexts move out; report snapshot tables stay until Reports module is carved in phase 10)
        └── PACademy.Contracts/                                 ← (will shrink as DTOs move into modules; non-module-specific DTOs migrate to Shared.Contracts)
```

**Project counts**: phase 5 adds **21 new projects** — 1 `Shared.Contracts` + 4 `Shared.Audit.*` + 4×4 modules (Identity, Admissions, ReferenceData, Workflows). Legacy projects stay; their content shrinks as modules are extracted.

---

## Architecture decisions

### A1 — Project layering inside a module

Each module follows the canonical onion:

```
Domain         (entities + interfaces; no infra)
  ↑
Application    (use cases + validators + DTOs; depends on Domain + Shared.Contracts)
  ↑
Infrastructure (EF DbContext + EF configurations + external services; depends on Domain + Application)
```

`*.Public` sits perpendicular to this stack: it depends only on `Shared.Contracts` and exposes the inter-module interface. Its implementation lives in the module's `Application` (or `Infrastructure`) layer and is registered via the module's `Add<Module>()` extension.

### A2 — Inter-module communication

```csharp
// In Modules.Identity.Public/IIdentityApi.cs
namespace PACademy.Modules.Identity.Public;

public interface IIdentityApi
{
    /// <summary>Current authenticated user; null when unauthenticated.</summary>
    Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default);

    Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default);
}

public sealed record CurrentUserDto(Guid Id, string FullName, string Role, IReadOnlyList<string> Apps);
```

Implementation lives inside `Modules.Identity.Application` and is registered by `IdentityModule.AddIdentity()`. Admissions consumes it via constructor injection — same pattern as today's `ICurrentUser`, just hoisted to a module-public interface.

### A3 — `Module.AddX()` extension method

Each module exposes one composition-root extension. The host calls them in `Program.cs`:

```csharp
// PACademy.Api/Program.cs
builder.Services
    .AddSharedContracts()          // no-op marker, exists for symmetry
    .AddIdentityModule(builder.Configuration)
    .AddAdmissionsModule(builder.Configuration);
```

`AddIdentityModule` registers `IdentityDbContext`, `IIdentityProvider`, `IAuditWriter`, `IIdentityApi` impl, FluentValidation for the module's validators, and AspNet Core Identity. `AddAdmissionsModule` registers `AdmissionsDbContext`, the use cases, validators, and `IAdmissionsApi` impl.

### A4 — Cross-context transactions

Phase 5 ships **one** sanctioned pattern: `CrossModuleUnitOfWork` (host helper). It opens a single `SqlConnection`/`SqlTransaction` and exposes accessors that bind each context to that connection.

```csharp
// PACademy.Api/Hosting/CrossModuleUnitOfWork.cs
public sealed class CrossModuleUnitOfWork(IConfiguration cfg) : IAsyncDisposable
{
    private SqlConnection? _conn;
    private DbTransaction? _tx;

    public async Task BeginAsync(CancellationToken ct)
    {
        _conn = new SqlConnection(cfg.GetConnectionString("Default"));
        await _conn.OpenAsync(ct);
        _tx = await _conn.BeginTransactionAsync(ct);
    }

    public T Use<T>(Func<DbContextOptions<T>, T> factory) where T : DbContext
    {
        var opts = new DbContextOptionsBuilder<T>().UseSqlServer(_conn!).Options;
        var ctx  = factory(opts);
        ctx.Database.UseTransaction(_tx);
        return ctx;
    }

    public async Task CommitAsync(CancellationToken ct) => await _tx!.CommitAsync(ct);
    public async ValueTask DisposeAsync() { if (_tx is not null) await _tx.DisposeAsync(); if (_conn is not null) await _conn.DisposeAsync(); }
}
```

Use sites:

```csharp
await using var uow = new CrossModuleUnitOfWork(cfg);
await uow.BeginAsync(ct);

var admissions = uow.Use<AdmissionsDbContext>(opts => new AdmissionsDbContext(opts));
var audit      = uow.Use<AuditDbContext>(opts => new AuditDbContext(opts));

admissions.Cycles.Add(cycle);
audit.AuditEntries.Add(AuditEntry.Create(...));

await admissions.SaveChangesAsync(ct);
await audit.SaveChangesAsync(ct);
await uow.CommitAsync(ct);
```

`TransactionScope` is **forbidden** in phase 5 — on Windows + multiple `DbContext` instances it can promote to MSDTC, which the dev Docker SQL container does not support. Operations that don't need cross-context atomicity (background analytics, reports) save through their own context normally; no UoW needed.

### A5 — Where do controllers live?

**Decision (transitional):** controllers stay under `PACademy.Api/Controllers/<X>/` for phase 5. The host knows about every module's controllers because controllers reference module Application interfaces directly. Moving controllers into the module project forces the module to take a dependency on `Microsoft.AspNetCore.App`, which is fine for a monolith but adds friction. Phase 6+ may revisit.

**Rationale**: keeps phase-5 PR focused on the data/domain split. Controllers are one-line forwards to use cases anyway; their physical location is a detail.

### A6 — Migration history split

EF Core supports per-context migration tables via `OnConfiguring` / `UseSqlServer(... opts.MigrationsHistoryTable("__EFMigrationsHistory_Admissions"))`. Each module's DbContext sets a unique table name.

**One-time cutover script** (`backend/src/Modules/_split_migration_history.sql`):

```sql
-- Idempotent: only inserts if rows don't already exist
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '__EFMigrationsHistory_Identity')
BEGIN
    SELECT * INTO __EFMigrationsHistory_Identity FROM __EFMigrationsHistory WHERE 1=0;
    SELECT * INTO __EFMigrationsHistory_Admissions FROM __EFMigrationsHistory WHERE 1=0;

    -- Identity owns: AspNet Identity tables, audit, sessions
    INSERT INTO __EFMigrationsHistory_Identity (MigrationId, ProductVersion)
    SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
    WHERE MigrationId IN (
        '20260508121134_Initial',
        '20260508121214_AuditImmutabilityTrigger'
    );

    -- Admissions owns: cycles, categories, applicants, admission rules, workflows, reference data
    INSERT INTO __EFMigrationsHistory_Admissions (MigrationId, ProductVersion)
    SELECT MigrationId, ProductVersion FROM __EFMigrationsHistory
    WHERE MigrationId IN (
        '20260508121231_ReportSnapshotTables',
        '20260509130659_004_LookupsCrudExtensions',
        '20260509144412_004b_LookupsCrudCompleteSchema'
    );

    DROP TABLE __EFMigrationsHistory;
END
```

Future migrations land in `Modules/<X>/<X>.Infrastructure/Migrations/` and update only their context's history.

For developers who prefer a clean slate: drop the DB, then `dotnet ef database update --context AdmissionsDbContext` and `dotnet ef database update --context IdentityDbContext`. The `005_SplitMigrationHistory` script is only needed to migrate an existing DB in-place.

### A7 — Tests stay where they are (mostly) + NetArchTest

Existing tests in `backend/tests/PACademy.Api.Tests/Admin/Cycles/*` reference DTOs by namespace. After the move, `using PACademy.Contracts.Admin.Cycles;` becomes `using PACademy.Modules.Admissions.Application.Dtos;`. A `find/sed` script handles the namespace rewrite. No test file moves.

A new test project — `backend/tests/PACademy.Architecture.Tests/` — uses **NetArchTest.Rules** (`<PackageReference Include="NetArchTest.Rules" />`) to assert the boundaries:

```csharp
// PACademy.Architecture.Tests/ModuleBoundariesTests.cs
public sealed class ModuleBoundariesTests
{
    [Fact]
    public void Admissions_Application_does_not_depend_on_Identity_Infrastructure()
    {
        var result = Types.InAssembly(typeof(AdmissionsModule).Assembly)
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.Identity.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            $"failing types: {string.Join(", ", result.FailingTypeNames ?? Array.Empty<string>())}");
    }

    [Fact]
    public void Admissions_does_not_query_ReferenceData_directly()
    {
        var result = Types.InAssemblies(new[] { typeof(AdmissionsModule).Assembly })
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.ReferenceData.Infrastructure")
            .And()
            .ShouldNot()
            .HaveDependencyOn("PACademy.Modules.ReferenceData.Domain")
            .GetResult();

        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void SharedContracts_has_zero_project_references()
    {
        var refs = typeof(PagedResult<>).Assembly.GetReferencedAssemblies()
            .Where(a => a.Name?.StartsWith("PACademy") == true);
        refs.Should().BeEmpty();
    }
}
```

The full rule list (one test per rule) lives in `ModuleBoundariesTests.cs`. CI runs them on every commit.

### A8 — Naming convention

- Project name: `PACademy.Modules.<Module>.<Layer>` (e.g. `PACademy.Modules.Admissions.Application`)
- Default namespace: same as project name
- Module composition extension class: `<Module>Module` (e.g. `IdentityModule`)
- Module composition extension method: `Add<Module>Module` (e.g. `AddIdentityModule`) — note this differs from `AddIdentity` (which is taken by AspNet Core)
- DbContext name: `<Module>DbContext` (e.g. `AdmissionsDbContext`, `IdentityDbContext`)
- Migration history table: `__EFMigrationsHistory_<Module>` (e.g. `__EFMigrationsHistory_Admissions`)
- Public-API interface: `I<Module>Api` (e.g. `IAdmissionsApi`, `IIdentityApi`)

---

## Sequencing

The work is largely additive: scaffold 17 new projects, move types into them, leave the old projects in place until empty. The user-facing API surface does not change at any point.

```
Setup            ── scaffold 21 new csprojs + slnx + DI plumbing + CrossModuleUnitOfWork
Foundational     ── Shared.Contracts (move PagedResult, ApiError, error codes)
US6 (Audit)      ── ported FIRST (Identity's login flow writes audit rows)
US2 (Identity)   ── ported SECOND (every other module consumes IIdentityApi)
US5 (RefData)    ── port THIRD — sibling with Workflows (parallelisable)
US8 (Workflows)  ── port THIRD — sibling with ReferenceData (parallelisable)
US1 (Admissions) ── ported LAST (consumes IIdentityApi + IReferenceDataApi + IWorkflowsApi + IAuditApi)
US3 (verify)     ── NetArchTest assertions lock the boundary
US4 (Migrations) ── per-context migration tables + cutover script + verification test
US7 (Seeders)    ── split DemoDataSeeder into 5 module-specific seeders
Cleanup          ── remove emptied legacy code paths; dotnet format; test pass; CLAUDE.md update
```

**Dependency order** (read top→bottom; each module depends on those above it):

```
Shared.Contracts   ← no deps
Shared.Audit       ← Shared.Contracts
Identity           ← Shared.Contracts, Shared.Audit.Public
ReferenceData      ← Shared.Contracts, Shared.Audit.Public, Identity.Public
Workflows          ← Shared.Contracts, Shared.Audit.Public, Identity.Public
Admissions         ← Shared.Contracts, Shared.Audit.Public, Identity.Public, ReferenceData.Public, Workflows.Public
```

Identity is ported before everything else because every module reads the current user. ReferenceData and Workflows are siblings — neither depends on the other; both port before Admissions, which consumes both. Audit ports first because every module's writes emit audit rows.

---

## Risks (mirrored from spec.md, monitored here)

| Risk | Mitigation | Tracked |
|---|---|---|
| R1 — EF migration split | SQL cutover script (idempotent) + verification test + drop-and-recreate fallback for dev | spec FR-X02 |
| R2 — Cross-context transactions | `CrossModuleUnitOfWork` host helper (single SqlConnection + Transaction); `TransactionScope` forbidden | plan A4 |
| R3 — Boilerplate explosion (17 new projects) | Tiny `*.Public` projects (1 interface + a few records); pays for itself at module #3 | spec out-of-scope |
| R4 — Hidden test coupling to legacy namespaces | One-shot find/sed across `backend/tests/` to rewrite namespaces; NetArchTest enforces in CI | plan A7 |
| R5 — Audit-Identity coupling | Audit ports before Identity; Identity consumes `IAuditApi` from day one | sequencing |
| R6 — Workflow entity cross-module ownership | `Workflow`/`WorkflowStage` lives in `Admissions.Domain` for phase 5; revisit in phase 7 if Investigations/Medical need their own workflow definitions | docs/SCOPE_AUDIT.md |

---

## Parallelisation map

Within phases:
- Setup (T301–T305) is sequential (csproj depends on solution).
- Identity ports (T310–T319) are mostly sequential within the module.
- Admissions ports (T320–T335) can begin once Identity.Public exists (T315).
- Architecture tests (T336–T338) and the migration cutover (T340–T343) are independent and `[P]`.

Across phases — phase 5 must merge before any phase 6 work begins (don't try to extract Committees while Admissions is mid-port).

---

## Done definition

A PR titled `spec: 005 modular-monolith refactor (Shared + Audit + Identity + ReferenceData + Admissions)` passes when:

1. All 5 user stories' Acceptance Scenarios pass.
2. All 6 Success Criteria are objectively measurable in CI logs.
3. `dotnet build PACademy.slnx` is 0 warnings / 0 errors.
4. Every existing test passes; no test file deleted.
5. The dev DB can be dropped + recreated cleanly via per-context `dotnet ef database update`, and the SPA's lookups CRUD round-trips identically to phase 4.
6. The frontend's user-facing behavior is unchanged. No phase-5 code touches `frontend/`.
