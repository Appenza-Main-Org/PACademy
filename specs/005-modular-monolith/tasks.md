---
description: "Tasks for spec 005 — Modular-monolith refactor (Shared.Contracts + Shared.Audit + Identity + ReferenceData + Workflows + Admissions)"
---

# Tasks: Modular-Monolith Refactor (Phase 5)

**Input**: Design documents from [`specs/005-modular-monolith/`](./)
**Prerequisites**: Spec 003 (admin auth + RBAC) and spec 004 (lookups CRUD) MUST be merged to `dev` before this spec begins.

**Companion artifacts** — read these before starting work in the corresponding phase:

- [research.md](./research.md) — R0.1–R0.9 architecture decisions (bounded-context split, single-DB-multi-DbContext, CrossModuleUnitOfWork, separate `*.Public` csproj, FK strategy, DbContext lifetime, Audit-in-Shared, NetArchTest, migration cutover)
- [data-model.md](./data-model.md) — per-context table ownership, cross-module FK list, JSON column shapes, per-aggregate invariants
- [quickstart.md](./quickstart.md) — Day 0–6 operator's guide with concrete PowerShell commands; this is the "how do I actually run this" companion to the structured task list below
- [contracts/](./contracts/) — `IIdentityApi`, `IAdmissionsApi`, `IReferenceDataApi`, `IWorkflowsApi`, `IAuditApi`, plus the `ErrorCodes` registry — the authoritative interface signatures

**Tests**: Phase 5 is a backend-only refactor. The user-facing API contract is unchanged at every step (see SC-X01 — `GET /admin/cycles` returns identical payloads). Existing test files (`Admin/Cycles/{Crud,Overrides,Transition}Tests`) carry over — only `using` statements change. NEW test files added: 5 NetArchTest assertions + 1 `CrossModuleUnitOfWork` integration test + 1 `MigrationOwnership` test. Per Constitution Principle II, every new piece of test-affecting infrastructure (the architecture-rule library, the cross-module UoW) ships with a test. Coverage budget unchanged from phase 4.

**Numbering**: tasks continue from spec 004's last task (T291). This spec's range is **T300–T371** (sub-IDs T339a–T339k cover the Workflows-module port that was added after the initial draft).

**Format**: `[ID] [P?] [Story] Description`

- **[P]** — can run in parallel (different files, no dependency on tasks ahead)
- **[Story]** — `Setup` / `Foundation` (Shared.Contracts) / `US6` (Shared.Audit) / `US2` (Identity) / `US5` (ReferenceData) / `US8` (Workflows) / `US1` (Admissions) / `US3` (Shared verification) / `US4` (Migrations) / `US7` (Seeders) / `Cleanup`

**Phase ordering rationale**:
- Shared.Contracts is foundational — every module depends on it.
- Shared.Audit ports next — every module's writes emit audit rows, so Audit must be live before any other module's write paths move.
- Identity ports third — every other module depends on `IIdentityApi`.
- ReferenceData and Workflows are siblings — neither depends on the other; they can port in parallel after Identity. ReferenceData task IDs are kept distinct from Workflows task IDs so two contributors can work concurrently.
- Admissions ports LAST — it consumes Identity, ReferenceData, Workflows, and Audit.
- Architecture verification, migration cutover, and seeder split close out.

---

## Phase 1: Setup

- [ ] **T300** [Setup] Create branch `005-modular-monolith` from `dev` after spec 004 merges.

- [ ] **T301** [Setup] Create the new directory layout under `backend/src/`:
  ```
  backend/src/
  ├── Shared/
  │   ├── PACademy.Shared.Contracts/
  │   └── Audit/
  │       ├── PACademy.Shared.Audit.Domain/
  │       ├── PACademy.Shared.Audit.Application/
  │       ├── PACademy.Shared.Audit.Infrastructure/
  │       └── PACademy.Shared.Audit.Public/
  └── Modules/
      ├── Identity/
      │   ├── PACademy.Modules.Identity.Domain/
      │   ├── PACademy.Modules.Identity.Application/
      │   ├── PACademy.Modules.Identity.Infrastructure/
      │   └── PACademy.Modules.Identity.Public/
      ├── Admissions/
      │   ├── PACademy.Modules.Admissions.Domain/
      │   ├── PACademy.Modules.Admissions.Application/
      │   ├── PACademy.Modules.Admissions.Infrastructure/
      │   └── PACademy.Modules.Admissions.Public/
      ├── ReferenceData/
      │   ├── PACademy.Modules.ReferenceData.Domain/
      │   ├── PACademy.Modules.ReferenceData.Application/
      │   ├── PACademy.Modules.ReferenceData.Infrastructure/
      │   └── PACademy.Modules.ReferenceData.Public/
      └── Workflows/
          ├── PACademy.Modules.Workflows.Domain/
          ├── PACademy.Modules.Workflows.Application/
          ├── PACademy.Modules.Workflows.Infrastructure/
          └── PACademy.Modules.Workflows.Public/
  ```
  Add the 21 new `.csproj` files (TargetFramework `net10.0`, `Nullable enable`, `ImplicitUsings enable`).

- [ ] **T302** [Setup] Add the 21 new projects to `backend/PACademy.slnx`. Verify `dotnet build` still succeeds (the new projects are empty so no real compilation happens yet — but they must be in the solution).

- [ ] **T303** [Setup] Configure project-reference rules in each new `.csproj`:
  - **Shared:**
    - `Shared.Contracts` → no refs
    - `Shared.Audit.Public` → `Shared.Contracts`
    - `Shared.Audit.Domain` → `Shared.Contracts`
    - `Shared.Audit.Application` → `Shared.Audit.Domain`, `Shared.Audit.Public`, `Shared.Contracts`
    - `Shared.Audit.Infrastructure` → `Shared.Audit.Application`, `Shared.Audit.Domain`, `Shared.Audit.Public`, `Shared.Contracts`
  - **Identity:**
    - `Identity.Public` → `Shared.Contracts`
    - `Identity.Domain` → `Shared.Contracts`
    - `Identity.Application` → `Identity.Domain`, `Identity.Public`, `Shared.Audit.Public`, `Shared.Contracts`
    - `Identity.Infrastructure` → `Identity.Application`, `Identity.Domain`, `Shared.Audit.Public`, `Shared.Contracts` (and AspNet Core Identity NuGet)
  - **Admissions:**
    - `Admissions.Public` → `Shared.Contracts`
    - `Admissions.Domain` → `Shared.Contracts`
    - `Admissions.Application` → `Admissions.Domain`, `Identity.Public`, `ReferenceData.Public`, `Shared.Audit.Public`, `Shared.Contracts`
    - `Admissions.Infrastructure` → `Admissions.Application`, `Admissions.Domain`, `Shared.Contracts`
  - **ReferenceData:**
    - `ReferenceData.Public` → `Shared.Contracts`
    - `ReferenceData.Domain` → `Shared.Contracts`
    - `ReferenceData.Application` → `ReferenceData.Domain`, `Identity.Public`, `Shared.Audit.Public`, `Shared.Contracts`
    - `ReferenceData.Infrastructure` → `ReferenceData.Application`, `ReferenceData.Domain`, `Shared.Contracts`
  - **Workflows:**
    - `Workflows.Public` → `Shared.Contracts`
    - `Workflows.Domain` → `Shared.Contracts`
    - `Workflows.Application` → `Workflows.Domain`, `Identity.Public`, `Shared.Audit.Public`, `Shared.Contracts`
    - `Workflows.Infrastructure` → `Workflows.Application`, `Workflows.Domain`, `Shared.Contracts`
  - **Host:**
    - `PACademy.Api` → all five `*.Infrastructure` projects (Identity, Admissions, ReferenceData, Workflows, Audit) + all five `*.Public` projects + `Shared.Contracts`

- [ ] **T304** [Setup] Add `<Module>Module.cs` skeleton in each module's `Infrastructure` project with an empty `Add<Module>Module(IServiceCollection, IConfiguration)` extension. Wire them into `PACademy.Api/Program.cs` (still no-ops at this point):
  ```csharp
  builder.Services
      .AddAuditModule(builder.Configuration)
      .AddIdentityModule(builder.Configuration)
      .AddReferenceDataModule(builder.Configuration)
      .AddWorkflowsModule(builder.Configuration)
      .AddAdmissionsModule(builder.Configuration);
  ```

- [ ] **T305** [Setup] Add `CrossModuleUnitOfWork` host helper at `PACademy.Api/Hosting/CrossModuleUnitOfWork.cs` per [plan §A4](./plan.md#a4-cross-context-transactions). No call sites yet — just the implementation + DI registration.

- [ ] **T306** [Setup] Verify `dotnet build PACademy.slnx` passes with the new project tree wired in but no types moved. Green checkpoint before any code migration.

---

## Phase 2: Foundational — Shared.Contracts

- [ ] **T307** [Foundation] Move `backend/src/PACademy.Contracts/Common/PagedResult.cs` → `Shared.Contracts/PagedResult.cs`. Update `using` statements in any consumer (legacy controllers, use cases). Run `dotnet build`.

- [ ] **T308** [Foundation] Move `backend/src/PACademy.Contracts/ApiError.cs` (or equivalent problem-details shape) → `Shared.Contracts/ApiError.cs`.

- [ ] **T309** [Foundation] Create `Shared.Contracts/ErrorCodes.cs` with `public static class ErrorCodes` containing every cross-module error string in use today: `REFERENCE_KEY_TAKEN`, `REFERENCE_IN_USE`, `INVALID_CYCLE_TRANSITION`, `OVERLAPPING_ACTIVE_CYCLE`, `CYCLE_HAS_APPLICANTS`, `CYCLE_CLOSED`, `INVALID_CATEGORY_KEY`, `STALE_AFFECTED_COUNT`, `ADMISSION_RULES_IMMUTABLE`, `WORKFLOW_IN_USE`, `CSRF_INVALID`, `INVALID_CREDENTIALS`. Replace inline string literals across the codebase with `ErrorCodes.X` references.

**Checkpoint**: `Shared.Contracts/Shared.Contracts.csproj` has zero `<ProjectReference>`. `dotnet build` is green.

---

## Phase 3: User Story 6 — Shared.Audit (Priority: P1)

> Shared.Audit ports BEFORE Identity because Identity's login flow writes audit rows.

**Goal**: The audit log lives in `Shared/Audit/` (not under `Modules/`). Every module's writes call `IAuditApi.RecordAsync(...)` from `Shared.Audit.Public`. Domain/Application/Infrastructure stay private to the audit module. Spec FR-S01, FR-S05, FR-S06.

**Independent Test**: `Shared.Audit.Public` is referenced by Identity, Admissions, ReferenceData, Workflows. The `audit_entries` table is owned by `AuditDbContext`, has its own migration history (`__EFMigrationsHistory_Audit`), and the immutability triggers from spec 003 are recreated. UPDATE/DELETE on `audit_entries` rows continue to fail at SQL level.

### Tests for US6 (write FIRST — Constitution II)

- [ ] **T310** [US6] NetArchTest assertion in `PACademy.Architecture.Tests/SharedAuditBoundariesTests.cs`:
  - `Shared.Audit.Public` references only `Shared.Contracts`.
  - `Shared.Audit.Domain` does NOT reference any `Microsoft.EntityFrameworkCore.*` assembly.
  - No `Modules.*` project references `Shared.Audit.Domain` or `Shared.Audit.Infrastructure` (only `Shared.Audit.Public`).

- [ ] **T311** [US6] Integration test: `AuditWriteThroughCrossModuleUnitOfWork.cs` — open a UoW, register an audit row + a (mock) admissions row in the same transaction, verify both commit atomically. Use Testcontainers SQL Server.

### Implementation for US6

- [ ] **T312** [US6] Move `AuditEntry` aggregate, `IAuditableWrite`, `AuditAction` enum from legacy `PACademy.Domain/Audit/` → `Shared.Audit.Domain/`.

- [ ] **T313** [US6] Define `Shared.Audit.Public/IAuditApi.cs`:
  ```csharp
  public interface IAuditApi
  {
      Task RecordAsync(AuditAction action, string targetType, Guid targetId, string targetLabel,
          AuditOutcome outcome, string? beforeJson, string? afterJson, CancellationToken ct = default);
  }
  ```
  Plus `AuditEnvelopeDto` (cross-module write envelope).

- [ ] **T314** [US6] Move `IAuditWriter` impl (was `AuditWriter` in `PACademy.Infrastructure/Audit/`) → `Shared.Audit.Application/AuditWriter.cs`. Rename to `AuditApi` (it now implements `IAuditApi`).

- [ ] **T315** [US6] Create `Shared.Audit.Infrastructure/Persistence/AuditDbContext.cs` owning the `audit_entries` table. Configure `MigrationsHistoryTable("__EFMigrationsHistory_Audit")`. Move the audit-immutability trigger migration from spec 003 into this context.

- [ ] **T316** [US6] Implement `AuditModule.AddAuditModule(IServiceCollection, IConfiguration)` in `Shared.Audit.Infrastructure`. Registers: `AuditDbContext`, `IAuditApi` (singleton or scoped), and adds the migrations to the EF tooling config.

- [ ] **T317** [US6] Generate per-context migration: `dotnet ef migrations add InitialAuditSnapshot --context AuditDbContext --project Shared.Audit.Infrastructure`. Should contain only the `audit_entries` table + immutability trigger.

- [ ] **T318** [US6] Update `PACademy.Api/Program.cs` to call `AddAuditModule(...)` first (other modules depend on `IAuditApi`).

**Checkpoint**: `dotnet build` green. Audit writes still work end-to-end (verified by re-running spec 003's auth tests).

---

## Phase 4: User Story 2 — Identity module (Priority: P1)

> Identity ports AFTER Audit (Login writes an audit row) and BEFORE every other module (all consume `IIdentityApi`).

**Goal**: Identity owns auth + RBAC + system-user provisioning. Exposes `IIdentityApi` (current user + UserExists check) for other modules to consume; consumes nothing from other modules except `Shared.Audit.Public`.

**Independent Test**: Sign in as super_admin → exercise an Admissions write endpoint → audit row appears in `audit_entries` (Audit context) with the correct user id; cycle row in `cycles` (Admissions context); both writes succeed atomically via `CrossModuleUnitOfWork`. The existing `Admin/Cycles/CrudTests.cs` passes with only namespace rewrites.

### Tests for US2 (write FIRST)

- [ ] **T319** [US2] Architecture test: `IdentityModuleBoundariesTests.cs`. Asserts:
  - `Identity.Application` does not reference `Admissions.*` or `ReferenceData.*` assemblies.
  - `Identity.Infrastructure` references `Shared.Audit.Public` (allowed) but NOT `Shared.Audit.Infrastructure` (forbidden).
  - `Identity.Public` references only `Shared.Contracts`.

- [ ] **T320** [P] [US2] Update `backend/tests/PACademy.Api.Tests/Admin/Cycles/CrudTests.cs` (and siblings) — these reference `IAuditWriter`/`ICurrentUser` and other Identity-owned types. After the move, they must use the new namespaces.

### Implementation for US2

- [ ] **T321** [US2] Move Domain types: `SystemUser`, `Session`, `Role` → `Modules/Identity/Identity.Domain/`. (Audit moved out in T312.)

- [ ] **T322** [US2] Move Application types: `LoginUseCase`, `LogoutUseCase`, `GetMeUseCase`, `Admin/Users/*` use cases + `CreateSystemUserValidator`, `IIdentityProvider`, `ICurrentUser`, `LoginRequestValidator` → `Modules/Identity/Identity.Application/`.

- [ ] **T323** [US2] Move Infrastructure types: `IdentityDbContext` (renamed from the auth/identity slice of `PaDbContext`), EF configurations for `SystemUser`, `Session`, `InSystemIdentityProvider`, `HttpContextCurrentUser`, AspNet Core Identity setup → `Modules/Identity/Identity.Infrastructure/`.

- [ ] **T324** [US2] Define `Identity.Public/IIdentityApi.cs`:
  ```csharp
  public interface IIdentityApi
  {
      Task<CurrentUserDto?> GetCurrentUserAsync(CancellationToken ct = default);
      Task<bool> UserExistsAsync(Guid userId, CancellationToken ct = default);
  }
  public sealed record CurrentUserDto(Guid Id, string FullName, string Role, IReadOnlyList<string> Apps);
  ```
  Implement in `Identity.Application/IdentityApi.cs` (delegates to `ICurrentUser`).

- [ ] **T325** [US2] Implement `IdentityModule.AddIdentityModule(IServiceCollection, IConfiguration)` in `Identity.Infrastructure`. Registers: `IdentityDbContext` (with `MigrationsHistoryTable("__EFMigrationsHistory_Identity")`), AspNet Core Identity, `IIdentityProvider`, `IIdentityApi`, FluentValidation for `LoginRequest` and `CreateSystemUserRequest`, `ClaimsPrincipalFactory`.

- [ ] **T326** [US2] Update `PACademy.Api/Program.cs` to call `AddIdentityModule(...)` after `AddAuditModule(...)`. Remove equivalent registrations from legacy `PACademy.Infrastructure/DependencyInjection.cs`.

- [ ] **T327** [US2] Update `AuthController` and `AdminUsersController` (in `PACademy.Api/Controllers/`) to use new namespaces. Login flow needs to write an audit row via `IAuditApi.RecordAsync(...)` inside a `CrossModuleUnitOfWork` (because Login writes a session row to Identity AND an audit row to Shared.Audit).

- [ ] **T328** [US2] Generate per-context migration: `dotnet ef migrations add InitialIdentitySnapshot --context IdentityDbContext --project Identity.Infrastructure`. Should contain Identity tables (`system_users`, `sessions`, AspNet Core Identity tables).

**Checkpoint**: `dotnet build` green. Login + User-CRUD flows pass against the dev DB.

---

## Phase 5: User Story 5 — ReferenceData module (Priority: P1)

> ReferenceData ports BEFORE Admissions (Admissions consumes `IReferenceDataApi`). Sibling with Workflows (Phase 5b) — neither depends on the other; parallelisable.

**Goal**: Lookup data (8 reference dictionaries) lives in `Modules/ReferenceData/`. Consumed by Admissions today via `IReferenceDataApi`; future modules (Investigations case-types, Medical station codes) consume the same interface.

**Independent Test**: `dotnet build Modules.ReferenceData.Infrastructure` from a fresh clone succeeds with `Shared.Contracts` + `Identity.Public` as its only project references. `IReferenceDataApi.ListByCategoryAsync("governorate")` returns the same payload as `GET /reference-data?category=governorate` did in phase 4.

### Tests for US5 (write FIRST)

- [ ] **T329** [US5] Architecture test: `ReferenceDataModuleBoundariesTests.cs`. Asserts:
  - `ReferenceData.*` does not reference any `Admissions.*` assembly.
  - `ReferenceData.Public` references only `Shared.Contracts`.
  - `ReferenceData.Domain` has no EF dependencies.

- [ ] **T330** [P] [US5] Integration test: `ReferenceDataPublicApiTests.cs` — `IReferenceDataApi.ListByCategoryAsync("governorate")` returns the same payload as `GET /reference-data?category=governorate` did in phase 4.

### Implementation for US5

- [ ] **T331** [US5] Move Domain type: `ReferenceDataEntry` → `Modules/ReferenceData/ReferenceData.Domain/`.

- [ ] **T332** [US5] Move Application namespace: `Admin/ReferenceData/*` use cases + validator + `ReferenceDataConstants` (the 8 valid category names) → `Modules/ReferenceData/ReferenceData.Application/`.

- [ ] **T333** [US5] Move Contract DTOs: `PACademy.Contracts/Admin/ReferenceData/{CreateReferenceDataRequest,ReferenceDataDetailDto,ReferenceDataListFilters,ReferenceDataListItemDto,UpdateReferenceDataRequest}.cs` → `Modules/ReferenceData/ReferenceData.Application/Dtos/`.

- [ ] **T334** [US5] Define `ReferenceData.Public/IReferenceDataApi.cs`:
  ```csharp
  public interface IReferenceDataApi
  {
      Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(string category, CancellationToken ct = default);
      Task<ReferenceDataItemDto?> FindByKeyAsync(string category, string key, CancellationToken ct = default);
  }
  public sealed record ReferenceDataItemDto(Guid Id, string Category, string Key, string NameAr, string? NameEn, string? Metadata, int SortOrder, bool IsActive);
  ```
  Implement in `ReferenceData.Application/ReferenceDataApi.cs`.

- [ ] **T335** [US5] Create `ReferenceData.Infrastructure/Persistence/ReferenceDataDbContext.cs` owning the `reference_data_entries` table. Configure `MigrationsHistoryTable("__EFMigrationsHistory_ReferenceData")`. Move EF configuration `ReferenceDataEntryConfiguration.cs`.

- [ ] **T336** [US5] Implement `ReferenceDataModule.AddReferenceDataModule(IServiceCollection, IConfiguration)`. Registers: `ReferenceDataDbContext`, the 5 admin CRUD use cases + validator, `IReferenceDataApi`.

- [ ] **T337** [US5] Update `AdminReferenceDataController` and `ReferenceDataController` (in `PACademy.Api/Controllers/`) to use new namespaces. Admin write paths use `CrossModuleUnitOfWork` (write to `ReferenceDataDbContext` + audit row to `AuditDbContext`).

- [ ] **T338** [US5] Update `PACademy.Api/Program.cs` to call `AddReferenceDataModule(...)` after `AddIdentityModule(...)`.

- [ ] **T339** [US5] Generate per-context migration: `dotnet ef migrations add InitialReferenceDataSnapshot --context ReferenceDataDbContext --project ReferenceData.Infrastructure`. Should contain only `reference_data_entries`.

**Checkpoint**: ReferenceData admin CRUD round-trips identically to phase 4. `IReferenceDataApi` returns the same data the public `/reference-data` endpoint did.

---

## Phase 5b: User Story 8 — Workflows module (Priority: P1)

> Workflows ports in parallel with ReferenceData (sibling — no inter-dependency). Both BEFORE Admissions, which consumes both.

**Goal**: Workflow definitions and stage pipelines live in `Modules/Workflows/`. The single-`Published`-per-`(categoryKey, cycleId)` invariant from spec 004 (FR-W02) and contiguous 1-based stage ordering (FR-W04) are enforced inside this module. Admissions reads via `IWorkflowsApi`.

**Independent Test**: `dotnet build Modules.Workflows.Infrastructure` succeeds with `Shared.Contracts` + `Identity.Public` as project references. `IWorkflowsApi.GetPublishedAsync("officers_general", cycleId)` returns the same payload as `GET /admin/workflows?categoryKey=…&cycleId=…&status=published` did in spec 004.

### Tests for US8 (write FIRST)

- [ ] **T339a** [US8] Architecture test: `WorkflowsModuleBoundariesTests.cs`. Asserts:
  - `Workflows.*` does not reference any `Admissions.*` or `ReferenceData.*` assembly.
  - `Workflows.Public` references only `Shared.Contracts`.
  - `Workflows.Domain` has no EF dependencies.

- [ ] **T339b** [P] [US8] Integration test: `WorkflowsPublishConcurrencyTest.cs` — port spec 004's 32-way parallel publish test (FR-W02 invariant) into the new module's test project. Verify `WorkflowsDbContext` still enforces single-`Published`-per-`(categoryKey, cycleId)` under load.

### Implementation for US8

- [ ] **T339c** [US8] Move Domain types: `Workflow`, `WorkflowStage`, `WorkflowStatus` → `Modules/Workflows/Workflows.Domain/`. (These currently live in `PACademy.Domain/Workflows/` — relocate, update namespaces.)

- [ ] **T339d** [US8] Move Application namespace: `Admin/Workflows/*` use cases (List/Get/Create/Update/Publish/Archive) + validators → `Modules/Workflows/Workflows.Application/`. The publish-with-auto-archive use case stays a single-context `IsolationLevel.Serializable` transaction inside `WorkflowsDbContext` (FR-W04).

- [ ] **T339e** [US8] Move Contract DTOs: `WorkflowListItemDto`, `WorkflowDetailDto`, `WorkflowStageDto`, `CreateWorkflowRequest`, `UpdateWorkflowRequest`, `PublishWorkflowResponse`, `WorkflowListFilters` → `Modules/Workflows/Workflows.Application/Dtos/`.

- [ ] **T339f** [US8] Define `Workflows.Public/IWorkflowsApi.cs`:
  ```csharp
  public interface IWorkflowsApi
  {
      Task<WorkflowSummaryDto?> GetPublishedAsync(string categoryKey, Guid cycleId, CancellationToken ct = default);
      Task<bool> HasInflightApplicantsAsync(Guid workflowId, CancellationToken ct = default);
  }
  public sealed record WorkflowSummaryDto(Guid Id, string Name, string CategoryKey, Guid CycleId, IReadOnlyList<WorkflowStageSummaryDto> Stages);
  public sealed record WorkflowStageSummaryDto(int Order, string Kind, string PassingCriteria);
  ```
  Implement in `Workflows.Application/WorkflowsApi.cs`.

- [ ] **T339g** [US8] Create `Workflows.Infrastructure/Persistence/WorkflowsDbContext.cs` owning `workflows` and `workflow_stages`. Configure `MigrationsHistoryTable("__EFMigrationsHistory_Workflows")`. Move EF configurations.

- [ ] **T339h** [US8] Implement `WorkflowsModule.AddWorkflowsModule(IServiceCollection, IConfiguration)`. Registers: `WorkflowsDbContext`, the 6 admin CRUD use cases + validator, `IWorkflowsApi`.

- [ ] **T339i** [US8] Update `AdminWorkflowsController` and `WorkflowsController` (in `PACademy.Api/Controllers/`) to use new namespaces. Admin write paths use `CrossModuleUnitOfWork` (write to `WorkflowsDbContext` + audit row to `AuditDbContext`); publish-with-auto-archive stays single-context (FR-W04).

- [ ] **T339j** [US8] Update `PACademy.Api/Program.cs` to call `AddWorkflowsModule(...)` after `AddReferenceDataModule(...)` (siblings — order between them doesn't matter, but both before `AddAdmissionsModule`).

- [ ] **T339k** [US8] Generate per-context migration: `dotnet ef migrations add InitialWorkflowsSnapshot --context WorkflowsDbContext --project Workflows.Infrastructure`. Should contain only `workflows` and `workflow_stages` (with the unique partial index `IX_workflows_categorykey_cycleid_published WHERE Status=Published` from spec 004).

**Checkpoint**: Workflows admin CRUD + publish flow round-trip identically to spec 004. `IWorkflowsApi.GetPublishedAsync(...)` returns the active workflow for any `(categoryKey, cycleId)` pair.

---

## Phase 6: User Story 1 — Admissions module (Priority: P1) 🎯 MVP

**Goal**: Admissions owns applicants, cycles, categories, admission rules. Largest domain. Self-contained — entities/use cases/EF configurations all live under `Modules/Admissions/`. Cross-module reads via `IIdentityApi`, `IReferenceDataApi`, `IWorkflowsApi`; cross-module writes via `IAuditApi`.

**Independent Test**: `dotnet build Modules.Admissions.Infrastructure` succeeds with only `Shared.Contracts` + `Identity.Public` + `ReferenceData.Public` + `Workflows.Public` + `Shared.Audit.Public` references. `GET /admin/cycles` as super_admin returns identical shape/content to phase 4 (the refactor is invisible to the API contract).

### Tests for US1 (write FIRST)

- [ ] **T340** [US1] Architecture test: `AdmissionsModuleBoundariesTests.cs`. Asserts:
  - `Admissions.Application` does not reference `Identity.Application`/`Identity.Infrastructure`, `ReferenceData.Application`/`ReferenceData.Infrastructure`, or `Workflows.Application`/`Workflows.Infrastructure`.
  - `Admissions.*` references `Identity.Public`, `ReferenceData.Public`, and `Workflows.Public` (allowed) but NOT their Domain/Infrastructure projects (forbidden).
  - `Admissions.Infrastructure` does not reference `IdentityDbContext`, `ReferenceDataDbContext`, `WorkflowsDbContext`, or `AuditDbContext` directly.

- [ ] **T341** [P] [US1] Update existing Admin/Cycles/* tests' `using` statements to point at the new namespaces.

### Implementation for US1

- [ ] **T342** [US1] Move Domain types: `Applicant`, `Cycle`, `CycleStatus`, `Category`, `AdmissionRule` → `Modules/Admissions/Admissions.Domain/`. (`ReferenceDataEntry` moved out in T331; `Workflow`/`WorkflowStage`/`WorkflowStatus` moved out in T339c.)

- [ ] **T343** [P] [US1] Move Application namespaces: `Admin.Cycles.*`, `Admin.Categories.*`, `Admin.AdmissionRules.*`, `Admin.Applicants.*` (use cases + validators) → `Modules/Admissions/Admissions.Application/`.

- [ ] **T344** [P] [US1] Move Contract DTOs OUT of `PACademy.Contracts/Admin/{Cycles,Categories,AdmissionRules,Applicants}/` INTO `Modules/Admissions/Admissions.Application/Dtos/`. Update consumer namespaces.

- [ ] **T345** [US1] Refactor every Admissions use case that currently injects `ICurrentUser` to inject `IIdentityApi` instead. Refactor any use case touching reference data to consume `IReferenceDataApi`. Refactor any use case touching workflows (e.g. cycle activation that checks for a published workflow per open category) to consume `IWorkflowsApi`. Direct EF queries against `reference_data_entries`, `workflows`, or `workflow_stages` from Admissions are forbidden (caught by T340 architecture test).

- [ ] **T346** [US1] Create `AdmissionsDbContext` with the entity configurations from `PaDbContext`'s admissions slice (`Applicants`, `Cycles`, `Categories`, `AdmissionRules`). Configure `MigrationsHistoryTable("__EFMigrationsHistory_Admissions")`. (`workflows`, `workflow_stages`, `reference_data_entries` belong to Workflows and ReferenceData contexts respectively.)

- [ ] **T347** [P] [US1] Move EF Configurations: `AdmissionRuleConfiguration.cs`, `CategoryConfiguration.cs`, `CycleConfiguration.cs`, applicant config → `Modules/Admissions/Admissions.Infrastructure/Persistence/Configurations/`. (Workflow EF config went to Workflows.Infrastructure in T339g; ReferenceData EF config went to ReferenceData.Infrastructure in T335.)

- [ ] **T348** [US1] Define `Admissions.Public/IAdmissionsApi.cs` (small for now — reads only):
  ```csharp
  public interface IAdmissionsApi
  {
      Task<CycleSummaryDto?> GetActiveCycleAsync(CancellationToken ct = default);
      Task<CategorySummaryDto?> GetCategoryByKeyAsync(string key, CancellationToken ct = default);
  }
  ```
  Implement in `Admissions.Application/AdmissionsApi.cs`.

- [ ] **T349** [US1] Implement `AdmissionsModule.AddAdmissionsModule()` in `Admissions.Infrastructure`. Registers: `AdmissionsDbContext`, all use-case categories, FluentValidation, `IAdmissionsApi`.

- [ ] **T350** [US1] Update `PACademy.Api/Program.cs` to call `AddAdmissionsModule(...)` last (after Audit, Identity, ReferenceData, Workflows).

- [ ] **T351** [US1] Update controllers `AdminCyclesController`, `AdminCategoriesController`, `AdminAdmissionRulesController`, `CategoriesController`, `CyclesController` (in `PACademy.Api/Controllers/`) to import from new namespaces. Admin write paths use `CrossModuleUnitOfWork`.

- [ ] **T352** [US1] Generate per-context migration: `dotnet ef migrations add InitialAdmissionsSnapshot --context AdmissionsDbContext --project Admissions.Infrastructure`. Verify the migration is empty (no schema changes — types just moved).

- [ ] **T353** [US1] Strip the now-orphaned legacy paths from `PaDbContext`. After phase 5 the legacy context owns only what's still in `PACademy.Infrastructure` for phases 6+ — primarily the report-snapshot tables (`reports_*`) which are carved in phase 10. Workflows, ReferenceData, Identity, Audit, and Admissions slices are all out by phase 5. Document remaining legacy footprint in `plan.md` Open Items.

- [ ] **T354** [US1] Run the full Admin/Cycles/* test suite. All green. The test code didn't move; only its `using` statements changed.

- [ ] **T355** [US1] Smoke-test the SPA: log in, click through `/admin/cycles`, `/admin/categories`, `/admin/admission-rules`, `/admin/reference-data/*`. Compare network responses against the phase-4 baseline.

**Checkpoint**: Admissions is self-contained. Cross-module calls verified: Admissions → IIdentityApi (current user), Admissions → IReferenceDataApi (lookups), Admissions → IWorkflowsApi (published workflow per category+cycle), Admissions writes → IAuditApi (audit rows).

---

## Phase 7: User Story 3 — Shared verification (Priority: P1)

**Goal**: NetArchTest assertions in `PACademy.Architecture.Tests` lock the module-reference rules in CI. Replaces ad-hoc reference-list audits.

**Independent Test**: All architecture tests pass; one fails when intentionally introducing a forbidden reference (e.g. add `using PACademy.Modules.Identity.Domain;` to an Admissions use case → CI red).

- [ ] **T356** [P] [US3] NetArchTest: every `*.Public/*.csproj` references exactly `Shared.Contracts` (no other project refs).

- [ ] **T357** [P] [US3] NetArchTest: every module's `*.Domain` assembly has zero `Microsoft.EntityFrameworkCore.*` references (Domain MUST be infra-free).

- [ ] **T358** [P] [US3] NetArchTest: `Shared.Contracts/*.csproj` has 0 `<ProjectReference>` elements (parses csproj XML).

---

## Phase 8: User Story 4 — Migration history split (Priority: P1)

**Goal**: Each `DbContext` has its own `__EFMigrationsHistory_<Module>` table. Adding a column to one module's entity produces a migration only in that module's `Migrations/`. Supports both fresh dev DBs (drop-and-recreate) and existing prod DBs (idempotent SQL cutover).

**Independent Test**: Drop the dev DB → run `dotnet ef database update --context X` for each of the 5 contexts in any order → all succeed → `INFORMATION_SCHEMA.TABLES` shows every table mapped to exactly one history table.

- [ ] **T360** [US4] Create `backend/scripts/migrations/005_split_migration_history.sql` per [plan §A6](./plan.md#a6-migration-history-split). Idempotent. Splits the existing `__EFMigrationsHistory` into 4 per-context histories. Verified against a copy of the dev DB before merge.

- [ ] **T361** [US4] Add a startup hook in `PACademy.Api/Hosting/MigrationHistoryCutover.cs` that runs the SQL once on dev/staging environments (skipped in production unless explicit opt-in). Logs whether the split happened or was a no-op.

- [ ] **T362** [P] [US4] Verification test: `MigrationOwnershipTests.cs` queries `INFORMATION_SCHEMA.TABLES` against a Testcontainers SQL Server, asserts every table appears under exactly one `__EFMigrationsHistory_<Module>` after all 5 contexts are updated.

- [ ] **T363** [US4] Update `quickstart.md` with both paths: dev (drop DB → `dotnet ef database update --context X` for each of the 5 contexts: Audit, Identity, ReferenceData, Workflows, Admissions → `--seed-demo`) and prod cutover (run `005_split_migration_history.sql` on the existing DB).

---

## Phase 9: User Story 7 — Demo seeder split (Priority: P2)

**Goal**: The monolithic `DemoDataSeeder` splits into 5 module-specific seeders, each writing through its own `DbContext`. Same row counts as phase 4 (240 applicants / 11 system users / 80 audit entries / 105 reference rows / 7 categories / 4 cycles / 1 admission rule).

**Independent Test**: Drop DB → start API with `--seed-demo` → SQL counts match phase 4.

- [ ] **T364** [P] [US7] Extract `IdentityDemoSeeder` from the legacy `DemoDataSeeder` — owns AspNet Core Identity user creation. Lives in `Identity.Infrastructure/Seeding/`.

- [ ] **T365** [P] [US7] Extract `AuditDemoSeeder` — owns the 80 demo audit-entry rows. Lives in `Shared.Audit.Infrastructure/Seeding/`.

- [ ] **T366** [P] [US7] Extract `AdmissionsDemoSeeder` — owns cycles, categories, applicants, admission rules. Lives in `Admissions.Infrastructure/Seeding/`.

- [ ] **T367** [P] [US7] Extract `ReferenceDataDemoSeeder` — owns the 105 lookup rows. Lives in `ReferenceData.Infrastructure/Seeding/`.

- [ ] **T367a** [P] [US7] Extract `WorkflowsDemoSeeder` — owns workflow rows for the 7 RFP categories under the active cycle (publishes one workflow per `(categoryKey, cycleId)`). Lives in `Workflows.Infrastructure/Seeding/`.

- [ ] **T368** [US7] Update `Program.cs` `--seed-demo` block to invoke seeders in dependency order: Audit → Identity → ReferenceData → Workflows → Admissions. (Workflows seeded after ReferenceData and before Admissions because Admissions cycle activation reads `IWorkflowsApi` to verify a published workflow exists per open category.)

- [ ] **T369** [US7] Update `SeedParityTests.cs` to verify counts identical to phase 4 (240 applicants / 11 system users / 80 audit entries / 105 ref rows / 7 categories / 4 cycles / 1 admission rule).

---

## Phase 10: Cleanup

- [ ] **T370** [Cleanup] Delete the now-empty legacy directories under `backend/src/PACademy.Domain/`, `PACademy.Application/`, `PACademy.Infrastructure/`, `PACademy.Contracts/` for the Audit, Identity, ReferenceData, Workflows, and Admissions slices. Leave the remaining (yet-to-be-ported) types in place for phases 6+ (mainly the report-snapshot tables — phase 10).

- [ ] **T371** [Cleanup] Run `dotnet format` over the whole solution. Run `dotnet test`. Update `CLAUDE.md` §3 with the new project tree (mark phase-5 as complete; flag remaining modules with their phase-6+ ETAs from spec.md's roadmap).

---

## Dependencies graph

```
Phase 1 (Setup, T300–T306)
    ↓
Phase 2 (Foundation: Shared.Contracts, T307–T309)
    ↓
Phase 3 (US6: Shared.Audit, T310–T318)
    ↓
Phase 4 (US2: Identity, T319–T328)
    ↓
    ├── Phase 5  (US5: ReferenceData, T329–T339)   ┐
    │                                              ├── parallelisable
    └── Phase 5b (US8: Workflows, T339a–T339k)     ┘
                                                    ↓
Phase 6 (US1: Admissions, T340–T355)
    ↓
Phase 7 (US3: Architecture verification, T356–T358)
    ↓
Phase 8 (US4: Migration cutover, T360–T363)
    ↓
Phase 9 (US7: Demo seeder split, T364–T369)
    ↓
Phase 10 (Cleanup, T370–T371)
```

**Story dependencies**:

- US6 (Audit) depends on Foundation only.
- US2 (Identity) depends on US6 — login writes audit rows.
- US5 (ReferenceData) and US8 (Workflows) depend on US2 — both consume `IIdentityApi` and `IAuditApi`. **They do not depend on each other.**
- US1 (Admissions) depends on US2 + US5 + US8 + US6.
- US3 (architecture verification) is a checkpoint — no implementation tasks block on it, but CI failure on it blocks merge.
- US4 (migrations) and US7 (seeders) close the loop after the carve.

## Parallel execution examples

**Within Phase 1 (Setup)**: T301 (directory layout) is sequential before T302 (slnx). T303 (project references) can run in parallel with T304 (`<Module>Module.cs` skeletons) — different files. T305 (CrossModuleUnitOfWork) is independent.

**Within Phase 3 (US6 Audit)**: T312 (Domain types), T313 (`IAuditApi` definition), T314 (impl rename), T315 (DbContext) can be drafted by different contributors concurrently — the serial spine is `T312 → T315 → T317 (migration)`.

**Phase 5 ‖ Phase 5b**: ReferenceData and Workflows can be carved by two contributors **in parallel** after Phase 4 completes. Each runs through its own test → DTO → use case → DbContext → controller wiring sequence. Merge order doesn't matter; both must complete before Phase 6 starts.

**Within Phase 6 (US1 Admissions)**: T342 (Domain), T343 (Application), T344 (Contracts) are `[P]` — different files. T345 (refactor injections) is the serial pivot — every later task depends on the use cases having the new `IIdentityApi`/`IReferenceDataApi`/`IWorkflowsApi` injections.

## Implementation Strategy

> Operator's guide for the per-story slice (backend layout → DbContext extraction → IFooApi definition → host wiring) lives in [quickstart.md](./quickstart.md). Per-module DTO shapes and error codes are in module Application/Dtos/. Use this section for ordering and parallelisation decisions only.

**MVP cut**: T300–T328 (Setup + Shared.Contracts + Shared.Audit + Identity). Three things shipped — the foundation, the cross-cutting audit, and the auth gateway. Every other module's port is mechanical from here.

**Full Spec 005**: T300–T371. All 6 carve-outs shipped (Shared.Contracts, Shared.Audit, Identity, ReferenceData, Workflows, Admissions) + architecture verification + migration cutover + seeder split + cleanup.

**Parallelisation map**: within each phase, every test file is `[P]`. The DTO/use-case moves within a story are mostly `[P]` (different files). The DbContext setup is the serial spine for each module. Cross-phase: Audit must complete before Identity; Identity must complete before everything else; **ReferenceData (Phase 5) and Workflows (Phase 5b) are siblings and can run in parallel** (two contributors); both must complete before Admissions (Phase 6) starts.

**Story independence**: US6 (Audit) ships standalone. US2 (Identity) depends on US6. US5 (ReferenceData) and US8 (Workflows) both depend on US2 and are independent of each other. US1 (Admissions) depends on US2 + US5 + US8. US3 (architecture verification) is a checkpoint after the carve. US4 (migrations) and US7 (seeders) close the loop.

---

## Risks (mirrored from spec.md, monitored here)

| Risk | Mitigation | Tracked |
|---|---|---|
| R1 — EF migration split | SQL cutover script + verification test + drop-and-recreate as the always-available fallback | spec FR-X02, T360–T362 |
| R2 — Cross-context transactions | `CrossModuleUnitOfWork` host helper introduced in T305; pattern A is the only sanctioned path; `TransactionScope` explicitly forbidden | plan A4 |
| R3 — Boilerplate explosion (17 new csprojs) | Tiny `*.Public` projects (1 interface + a few records); pays for itself at module #3 | spec out-of-scope |
| R4 — Hidden test coupling to legacy namespaces | One-shot find/sed across `backend/tests/` to rewrite namespaces; CI verifies via NetArchTest | T320, T341 |
| R5 — Audit too tightly coupled to Identity if both port together | Audit ports BEFORE Identity (T312–T318 vs T321–T328); Identity consumes `IAuditApi` from day one | sequencing rationale |

---

## Done definition

A PR titled `spec: 005 modular-monolith refactor` passes when:
1. All 7 user stories' Acceptance Scenarios pass.
2. SC-D01, SC-D02, SC-M01, SC-S01, SC-X01, SC-B01 are objectively green in CI.
3. No `--no-verify` on the merge commit.
4. Every existing test passes.
5. `frontend/` is untouched.
6. CLAUDE.md §3 reflects the new project tree.
7. The phase 6+ roadmap appendix in spec.md is up to date.
