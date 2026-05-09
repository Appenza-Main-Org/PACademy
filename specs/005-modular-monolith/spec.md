# Feature Specification: Modular-Monolith Refactor (Phase 5)

**Feature Branch**: `005-modular-monolith`
**Created**: 2026-05-09
**Status**: Draft (awaiting sign-off)
**Input**: User description: "Map every module in frontend to a module in backend with its own domain, dbcontext and infrastructure. Collect common settings in shared module. Mark this as phase 5."

> Phase 4 (specs 003 + 004) closed the mock-data gap: every admin lookup CRUD now reads/writes the database. Phase 5 turns the inside out — the backend layers (`Domain` / `Application` / `Infrastructure` / `Contracts`) currently mix every domain in single shared projects, which is fine when the codebase is small but will not scale through the nine-app vision in CLAUDE.md §1. This spec carves the backend into **bounded-context modules**, each with its own `Domain`, `Application`, `Infrastructure` (with its own `DbContext`), and `Contracts`. Cross-module concerns are limited to `Shared.Contracts` — pure DTOs and error types that every module's API surface needs.

## Clarifications resolved on 2026-05-09

| Q | Decision | Drives |
|---|---|---|
| Database split | **Single physical SQL Server DB, multiple `DbContext`s** — `AdmissionsDbContext`, `IdentityDbContext`, `ReferenceDataDbContext`, `WorkflowsDbContext`, `AuditDbContext` all point at the same connection string but each owns its tables. EF migrations are partitioned per context. | FR-D01, FR-D02 |
| Inter-module communication | **Public interfaces in each module's Application layer, exposed via separate `*.Public` csproj per module.** Module exposes `IAdmissionsApi` / `IIdentityApi` / etc. via DI; consumers reference the `*.Public` project only. No MediatR, no message bus, no direct concrete-type references. | FR-M01, FR-M02 |
| Initial scope | **Phased.** Phase 5 carves: `Shared.Contracts`, `Shared.Audit.*` (4 projects — cross-cutting audit log), `Modules/Identity/*`, `Modules/Admissions/*`, `Modules/ReferenceData/*`, `Modules/Workflows/*`. The remaining contexts (Committees, Board, Investigations, Medical, Exams, Barcode, Biometric, Reports) stay in the legacy `PACademy.*` projects until later phases. | FR-S01 |
| `Shared` scope | **Common DTOs and contracts** (`Shared.Contracts`) **plus a cross-cutting Audit module** (`Shared.Audit.{Domain,Application,Infrastructure,Public}`). Audit is universal — every module's writes emit audit rows, so it sits in Shared rather than under `Modules/`. **Not** general-purpose abstractions, hosting helpers, or Identity. Each module owns its own primitives. | FR-S02, FR-S03 |
| ReferenceData ownership | **Its own module from day one** — `Modules/ReferenceData/*`. Lookup data is consumed by Admissions (governorate, qualification, college) AND by future modules (Investigations consumes case-type, Medical consumes station-key). Carving it out now avoids Investigations later reaching into Admissions. | FR-R01 |
| Cross-context transactions | **Explicit shared-connection helper** (`CrossModuleUnitOfWork` in the host) opens one `SqlConnection` + `SqlTransaction` and passes it to both contexts. No `TransactionScope`, no MSDTC promotion (the dev Docker SQL container does not support DTC). | FR-D05 |
| Architecture-rule enforcement | **NetArchTest.Rules** (NuGet) — assertion-style architecture tests live in `PACademy.Architecture.Tests`. Replaces ad-hoc csproj-XML parsing. | SC-M01 |
| Migration cutover | **Two paths shipped:** (a) drop-and-recreate for dev — `dotnet ef database update --context X` per context against a fresh DB; (b) idempotent SQL cutover (`005_split_migration_history.sql`) for prod, applied automatically on startup in non-prod environments via `MigrationHistoryCutover` hosting hook. | FR-X01, FR-X02 |

---

## Clarifications

### Session 2026-05-09

- Q: When `CrossModuleUnitOfWork` saves through two contexts and the second `SaveChangesAsync` throws after the first has succeeded, what's the contract? → A: Roll back both writes via the shared `SqlTransaction`; rethrow the original exception. Caller retries the whole operation. Standard ACID semantics — partial commits are not allowed.
- Q: Should `*.Public` module APIs be exposable over HTTP, or DI-only? → A: DI-only forever. Public APIs are intra-process contracts; no controllers may reference them. Future microservice extraction is a separate spec, not an undocumented capability of phase 5.
- Q: Should cross-module foreign keys (e.g. `audit_entries.user_id` → `system_users.Id`) carry DB-level `FOREIGN KEY` constraints, or be bare `Guid` columns? → A: Bare `Guid` columns. No DB FK across module boundaries — integrity is the writer's responsibility. Keeps modules schema-decoupled so a future "extract module to its own DB" path stays open.
- Q: How does `CrossModuleUnitOfWork` reconcile with DI-scoped DbContexts? Inside a UoW request, the DI container returns one instance and the UoW creates another — which one wins? → A: UoW-supplied contexts win, explicitly. Use cases that participate in cross-module writes accept the context as a parameter or call `uow.Use<T>()`. DI-injected contexts are used only for non-UoW paths (single-context reads/writes). No magic ScopedFactory replacement — explicit beats clever.
- Q: Does `Workflow`/`WorkflowStage` get carved into its own module from day one (like ReferenceData), or stay in `Admissions.Domain` per R6? → A: Its own module from day one — `Modules/Workflows/{Domain,Application,Infrastructure,Public}`. Phase 5 grows from 17 to 21 new projects. Same logic as ReferenceData: half the planned modules (Admissions, Investigations, Medical, Exams) will read workflows; carving now avoids a phase-7 refactor. R6 closed.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admissions module is self-contained (Priority: P1) 🎯 MVP

A backend developer can open the `backend/src/Modules/Admissions/` folder and see every line of code for the admissions domain — entities, use cases, EF configurations, controllers (or controller-extension classes registered by the module), DbContext, migrations — without leaving the folder. Cross-module dependencies are visible: only references to `Shared.Contracts` and to other modules' `Public/I*Api.cs` interfaces.

**Why this priority**: Admissions is the largest domain (applicants, cycles, categories, admission-rules; workflows and reference-data carved into their own modules per US5/US8) and the one most actively touched. Modularising it proves the pattern on the heaviest case; remaining modules follow the template.

**Independent test**: Run `dotnet build backend/src/Modules/Admissions/Admissions.Infrastructure/Admissions.Infrastructure.csproj` from a fresh clone — it must compile with only `Shared.Contracts` and (optionally) `Modules.Identity.Public` as project references.

**Acceptance Scenarios**:

1. **Given** a clean repo, **When** I `dotnet build` the Admissions infrastructure project alone, **Then** it succeeds with project references to **only** `Shared.Contracts` (and `Modules.Identity.Public` if it consumes the current user).
2. **Given** the running API, **When** I hit `GET /admin/cycles` as super_admin, **Then** the response is identical (status, headers, body shape) to phase 4. The refactor is invisible to the API contract.
3. **Given** the running API, **When** I run `dotnet ef migrations list --context AdmissionsDbContext`, **Then** I see the migrations that own the admissions tables (applicants, cycles, categories, admission_rules) and only those — workflows/workflow_stages live in `WorkflowsDbContext`, reference_data_entries in `ReferenceDataDbContext`.
4. **Given** the dev DB, **When** I query `INFORMATION_SCHEMA.TABLES`, **Then** every table is owned by exactly one DbContext's migration history (no two contexts try to migrate the same table).
5. **Given** an Admissions use case needing the current user's id, **When** it executes, **Then** it consumes `IIdentityApi.GetCurrentUserId()` from `Modules.Identity.Public` — never `HttpContextAccessor` directly.

---

### User Story 2 — Identity module is self-contained (Priority: P1)

The Identity module owns authentication, RBAC, system-user provisioning, and the audit log (since audit is keyed to user actions). It exposes `IIdentityApi` (current user, role checks) for other modules to consume; it consumes nothing from other modules.

**Why this priority**: Every other module reads the current user. Identity must be the most stable, most-tested module — and it's the only module other modules depend on. Carving it out cleanly first means downstream modules are never tempted to leak `HttpContextAccessor` into their use cases.

**Independent test**: Sign in as super_admin, then exercise an Admissions write endpoint. Audit a row appears in `audit_entries` (Identity-owned table) with the correct user id. Both contexts saved in the same logical operation.

**Acceptance Scenarios**:

1. **Given** the running API, **When** super_admin POSTs `/admin/cycles`, **Then** (a) the cycle row is written by `AdmissionsDbContext`, (b) the audit row is written by `IdentityDbContext`, and (c) both writes succeed atomically (or both fail).
2. **Given** an Admissions use case calling `_identity.GetCurrentUser()`, **When** the use case is invoked outside an HTTP context (e.g. from a unit test), **Then** the test substitutes a fake `IIdentityApi` without needing an HttpContextAccessor mock.
3. **Given** the auth flow, **When** I run the existing `Admin/Cycles/CrudTests.cs`, **Then** every test still passes — the controllers, DTOs, and routes are unchanged; only the project assembly each type lives in changes.

---

### User Story 3 — Shared.Contracts is the only cross-cutting compile-time dependency (Priority: P1)

Every module's `Contracts` and (per-module) DTO files now live inside that module. The single `Shared.Contracts` project carries only what every module's `Application` and `Api` layers need: `PagedResult<T>`, the error-code registry, common audit metadata DTOs.

**Why this priority**: This is the boundary that proves the modules are actually decoupled. If `Shared.Contracts` starts pulling in domain types or use-case interfaces, the modular monolith collapses into the same single bag the legacy `PACademy.Contracts` was.

**Independent test**: Open `Shared.Contracts/Shared.Contracts.csproj` — it must have **zero project references**. Open any module's `*.csproj` — its references list `Shared.Contracts` and (for Application) the module's own Domain, and (only if the module consumes them) other modules' `*.Public` interface assemblies.

**Acceptance Scenarios**:

1. **Given** the solution, **When** I inspect `Shared.Contracts/*.csproj`, **Then** the file has no `<ProjectReference>` elements.
2. **Given** the solution, **When** I run `dotnet sln list`, **Then** the project list reflects the module structure (`Shared.Contracts`, `Modules.Admissions.Domain`, `Modules.Admissions.Application`, `Modules.Admissions.Infrastructure`, `Modules.Admissions.Public`, plus the equivalent four for `Modules.Identity`, plus the host `PACademy.Api` and the legacy projects we have not yet ported).
3. **Given** any module, **When** I add a new DTO that only that module's controllers expose, **Then** I add it to that module — never to `Shared.Contracts`.

---

### User Story 4 — Migration history is partitioned per context (Priority: P1)

Each `DbContext` has its own `__EFMigrationsHistory_<Context>` table; running `dotnet ef migrations add` for one module never touches the model snapshot of another. Adding a column to `applicants` is a `AdmissionsDbContext` migration; adding a column to `system_users` is an `IdentityDbContext` migration.

**Why this priority**: This is the operational test that the contexts are actually separate. If two contexts share `__EFMigrationsHistory`, they fight; if they share the model snapshot, every cross-module change shows up as a "pending changes" warning in both.

**Independent test**: From scratch, drop the dev DB, then `dotnet ef database update --context AdmissionsDbContext` and `dotnet ef database update --context IdentityDbContext` (any order, even interleaved). Both succeed, the database has all the tables, the demo seed runs cleanly, the API starts.

**Acceptance Scenarios**:

1. **Given** a dropped dev DB, **When** I update only `AdmissionsDbContext`, **Then** Admissions tables exist; Identity tables do not.
2. **Given** Admissions migrations applied, **When** I update `IdentityDbContext` afterwards, **Then** Identity tables are added without Admissions tables being modified.
3. **Given** both contexts updated, **When** I run `SELECT name FROM sys.tables`, **Then** every table appears under exactly one context's migration set (verified by inspecting `__EFMigrationsHistory_Admissions` and `__EFMigrationsHistory_Identity`).
4. **Given** I add a column to an admissions entity, **When** I run `dotnet ef migrations has-pending-model-changes --context IdentityDbContext`, **Then** it reports no changes (Identity is unaffected).

---

### User Story 5 — ReferenceData is its own module (Priority: P1)

Lookup data — the eight reference dictionaries (governorates, specializations, ranks, colleges, qualifications, nationalities, relationships, case-types) — lives in `Modules/ReferenceData/`. It is consumed by Admissions (the wizard's governorate/qualification dropdowns) via `IReferenceDataApi` and by future modules (Investigations' case-type picker, Medical's station codes). It does not depend on any other module.

**Why this priority**: Lookup data is consumed by ~half the planned modules. Inlining it into Admissions in phase 5 would force Investigations and Medical (later phases) to reach into Admissions for case types and station codes, violating module boundaries. Carving ReferenceData out now is cheap (small domain, isolated CRUD already done in spec 004) and prevents a refactor later.

**Independent test**: `dotnet build Modules.ReferenceData.Infrastructure` from a fresh clone succeeds with `Shared.Contracts` as its only project reference. `IReferenceDataApi.ListAsync(category)` returns the same payload as `GET /reference-data?category=…` did in phase 4.

**Acceptance Scenarios**:

1. **Given** the running API, **When** I `GET /admin/reference-data?category=governorate`, **Then** the response shape and content are identical to phase 4. The route, controller, and DTO are physically owned by `Modules.ReferenceData` now.
2. **Given** an Admissions use case (e.g. eligibility check) needing the list of governorates, **When** it executes, **Then** it consumes `IReferenceDataApi.ListByCategoryAsync("governorate")` — never queries `reference_data_entries` directly.
3. **Given** `ReferenceDataDbContext`, **When** I list its tables, **Then** it owns exactly one table (`reference_data_entries`) and no others.
4. **Given** a lint pass, **When** I check Admissions' assembly references, **Then** `Modules.Admissions.*` references `Modules.ReferenceData.Public` but NOT `Modules.ReferenceData.Domain` or `Modules.ReferenceData.Infrastructure`.

---

### User Story 6 — Shared.Audit is the cross-cutting audit log (Priority: P1)

The audit log — `audit_entries` table, `IAuditWriter`, `AuditEntry`, immutability triggers — lives in `Shared/Audit/` (not under `Modules/`) because it is consumed by every module. Identity calls it on login/logout; Admissions calls it on every CRUD; future modules will too. Like `Shared.Contracts`, `Shared.Audit.Public` is referenced by every module that emits audit rows; the Domain/Application/Infrastructure layers stay private.

**Why this priority**: Audit is the most cross-cutting concern in the system. Putting it inside any single module (Identity was the alternative) would force every other module to take a dependency on that module just to record an audit row — an inverted dependency.

**Independent test**: `Shared.Audit.Public` is referenced by Identity, Admissions, AND ReferenceData modules' Application layers. The `audit_entries` table is owned by `AuditDbContext`, has its own migration history (`__EFMigrationsHistory_Audit`), and the immutability triggers from spec 003 are recreated by the new context.

**Acceptance Scenarios**:

1. **Given** super_admin POSTs `/admin/cycles`, **When** the request completes, **Then** (a) the cycle row is in `cycles` (Admissions context), (b) the audit row is in `audit_entries` (Audit context), (c) both writes succeed atomically via `CrossModuleUnitOfWork`.
2. **Given** the running API, **When** I run `dotnet ef migrations list --context AuditDbContext`, **Then** the audit-related migrations (immutability trigger, audit_entries table creation) appear; no other context's migrations show in this list.
3. **Given** a test attempting to UPDATE or DELETE an `audit_entries` row, **When** it commits, **Then** the operation is blocked by the immutability trigger (carry-over from spec 003).
4. **Given** Identity's `LoginUseCase`, **When** it records an audit row, **Then** it does so via `IAuditApi.RecordAsync(...)` — never via direct EF access to a context that's not its own.

---

### User Story 8 — Workflows is its own module (Priority: P1)

The workflow definition and stage-pipeline data — `workflows`, `workflow_stages` tables, `Workflow`/`WorkflowStage`/`WorkflowStatus` types, the publish-with-auto-archive use case from spec 004 (FR-W02) — lives in `Modules/Workflows/`. Admissions reads it via `IWorkflowsApi.GetPublishedAsync(categoryKey, cycleId)`. Future modules (Investigations stage pipelines, Medical station pipelines, Exams stage gates) consume it the same way.

**Why this priority**: Workflows is consumed by ~half the planned modules (Admissions, Investigations, Medical, Exams). Inlining it into Admissions in phase 5 — even though Admissions is the only consumer in phase 5 — would force every later module to either depend on Admissions or duplicate the workflow concept. The carve-out cost is the same as ReferenceData: small domain, single aggregate, isolated CRUD already done in spec 004.

**Independent test**: `dotnet build Modules.Workflows.Infrastructure` from a fresh clone succeeds with `Shared.Contracts` + `Identity.Public` (for the publisher's user-id) as project references. `IWorkflowsApi.GetPublishedAsync("officers_general", cycleId)` returns the same payload as `GET /admin/workflows?categoryKey=…&cycleId=…&status=published` did in spec 004.

**Acceptance Scenarios**:

1. **Given** the running API, **When** I `GET /admin/workflows`, **Then** the response shape and content are identical to spec 004. The route, controller, and DTOs are physically owned by `Modules.Workflows` now.
2. **Given** an Admissions use case (e.g. cycle activation needing to verify a published workflow exists for each open category), **When** it executes, **Then** it consumes `IWorkflowsApi` — never queries `workflows` or `workflow_stages` directly.
3. **Given** `WorkflowsDbContext`, **When** I list its tables, **Then** it owns exactly two tables (`workflows` and `workflow_stages`) and no others.
4. **Given** a publish operation, **When** it auto-archives the prior `Published` workflow for the same `(categoryKey, cycleId)` pair (FR-W02), **Then** the transaction stays inside `WorkflowsDbContext` — no `CrossModuleUnitOfWork` is needed for this single-context invariant.
5. **Given** a lint pass, **When** I check Admissions' assembly references, **Then** `Modules.Admissions.*` references `Modules.Workflows.Public` but NOT `Modules.Workflows.Domain` or `Modules.Workflows.Infrastructure`.

---

### User Story 7 — Demo seed runs per-context (Priority: P2)

The demo seeder splits into `AdmissionsDemoSeeder` (cycles, categories, applicants, admission rules, reference data) and `IdentityDemoSeeder` (system users, audit entries). The host invokes both; each writes through its own DbContext.

**Why this priority**: Lower than P1 because the existing monolithic `DemoDataSeeder` will keep working through the refactor — but a clean seed split is necessary before extracting more modules in later phases.

**Acceptance Scenarios**:

1. **Given** a fresh DB, **When** I run the API with `--seed-demo`, **Then** the same 240 applicants / 11 system users / 80 audit entries / 105 reference rows / 7 categories / 4 cycles / 1 admission rule are seeded.
2. **Given** the seeders, **When** I disable `IdentityDemoSeeder` only, **Then** the API still seeds Admissions data (with a system user-id placeholder) and starts; only the audit-trail rows are absent.
3. **Given** the seeders, **When** the LCG is reseeded with `seed = 42`, **Then** the per-applicant deterministic data is identical to phase 4.

---

## Functional Requirements *(mandatory)*

### Database (FR-D)

- **FR-D01** — Each module SHALL define exactly one `DbContext`. Phase 5 cut: `AdmissionsDbContext`, `IdentityDbContext`, `ReferenceDataDbContext`, `WorkflowsDbContext`, `AuditDbContext` (5 total). All contexts use the same connection string (`ConnectionStrings:Default`).
- **FR-D02** — Each `DbContext` SHALL configure `MigrationsHistoryTable("__EFMigrationsHistory_<Context>")` so per-context migration tables do not collide.
- **FR-D03** — Each module's tables SHALL be configured only inside that module's `DbContext.OnModelCreating`. Tables MUST NOT be configured by more than one context.
- **FR-D04** — Cross-module foreign keys (e.g. `applicants.created_by_user_id` → `system_users.id`, `audit_entries.user_id` → `system_users.id`) SHALL be expressed as **Guid columns without EF navigation properties AND without DB-level `FOREIGN KEY` constraints** (i.e., no `ALTER TABLE ... ADD CONSTRAINT FK_...`). The FK is a value; the relationship is enforced only by the writing module's code path. Lookups across modules go through the public API interfaces, not EF joins. Rationale: keeps modules schema-decoupled so a future "extract module to its own DB" path stays open, and avoids a migration-ordering trap (the constraint would force a specific update order even though spec-5 says any order works — see SC-X01).
- **FR-D05** — Cross-context atomic writes SHALL go through `CrossModuleUnitOfWork` (host-level helper). It opens one `SqlConnection` + `SqlTransaction` and instantiates each affected `DbContext` over that connection (`UseConnection(conn).UseTransaction(tx)`). **`TransactionScope` is forbidden** in phase 5 because the dev Docker SQL container does not support DTC and cross-context `TransactionScope` will sometimes promote to it.
- **FR-D06** — `CrossModuleUnitOfWork` SHALL provide all-or-nothing semantics: if **any** participating `SaveChangesAsync` call throws after another has already succeeded, the shared `SqlTransaction` MUST be rolled back and the original exception MUST be rethrown to the caller. Partial commits are forbidden — there is no scenario in which one module's write is persisted while another's is dropped. The caller is responsible for retry; no outbox or dead-letter pattern is introduced in phase 5.
- **FR-D07** — DbContext registration: each module's `DbContext` SHALL be registered with the DI container as `Scoped` (the default for `services.AddDbContext<T>()`) for **non-UoW** request paths (single-context reads/writes injected into use cases via constructor). Use cases that participate in **cross-module atomic writes** SHALL NOT use the DI-injected instance; instead they accept a `CrossModuleUnitOfWork` parameter and call `uow.Use<T>()` to obtain a context bound to the shared `SqlConnection`/`SqlTransaction`. The two instances are not interchangeable — change tracking is local to each. No `IServiceProvider` magic that silently swaps the scoped instance for the UoW instance.

### Modules (FR-M)

- **FR-M01** — Each module SHALL expose a `Public` project (e.g. `Modules.Admissions.Public`) containing only `interface I<Module>Api` and the read-model DTOs that interface returns. Domain/Application/Infrastructure types are private to the module.
- **FR-M02** — A module MAY only reference: (a) `Shared.Contracts`, (b) other modules' `*.Public` projects. It MUST NOT reference other modules' Domain, Application, or Infrastructure projects directly.
- **FR-M03** — Each module SHALL register its services via a `<Module>Module` static class with an `AddX(IServiceCollection, IConfiguration)` extension. The host (`PACademy.Api`) calls them in `Program.cs`.
- **FR-M04** — Each module's controllers SHALL be co-located with the module under `Modules/<X>/<X>.Api` or, if controller projects add too much friction in this phase, kept in `PACademy.Api/Controllers/<X>/` as a transitional measure (decision: see plan.md).
- **FR-M05** — `*.Public` interfaces SHALL be **intra-process only**. No `[ApiController]` may inject or expose a `*.Public` interface over HTTP, gRPC, or any other wire protocol. Public APIs are compile-time contracts between modules in the same deployable; never network surfaces. If a future phase needs service-to-service exposure, it MUST ship as a new spec — phase 5 forbids the back door.

### Shared (FR-S)

- **FR-S01** — Phase 5 SHALL ship with two Shared concerns: `Shared.Contracts` (single project — DTOs and error codes) and `Shared.Audit` (4 projects — Domain, Application, Infrastructure, Public). No `Shared.Kernel`, no `Shared.Hosting`, no `Shared.Identity`. Future phases MAY add additional shared projects only with an explicit spec amendment.
- **FR-S02** — `Shared.Contracts` SHALL contain: `PagedResult<T>` (relocated from `PACademy.Contracts.Common`), the `ApiError` problem-details type, the cross-module error-code registry constants (e.g. `REFERENCE_KEY_TAKEN`, `INVALID_CYCLE_TRANSITION` — these are already known to both producer and consumer modules), and the common audit metadata DTO (`AuditEnvelopeDto`).
- **FR-S03** — `Shared.Contracts` SHALL have **zero project references**.
- **FR-S04** — Module-specific DTOs (e.g. `CycleDetailDto`, `CategoryDetailDto`) move OUT of the legacy `PACademy.Contracts` project and INTO their owning module's contracts namespace (e.g. `Modules.Admissions.Application.Dtos`). The frontend's import paths to backend DTOs do not exist (frontend defines its own types), so the relocation is transparent to the SPA.
- **FR-S05** — `Shared.Audit.Public` SHALL contain `IAuditApi` (the cross-module write surface) and a `AuditAction` enum/registry. `Shared.Audit.Domain` owns the `AuditEntry` aggregate. `Shared.Audit.Infrastructure` owns `AuditDbContext` (a single table: `audit_entries`). `Shared.Audit.Application` owns the `AuditWriter` implementation of `IAuditApi`.
- **FR-S06** — The audit-immutability trigger from spec 003 SHALL be recreated by `AuditDbContext`'s migration. UPDATE and DELETE on `audit_entries` continue to fail at the SQL level.

### ReferenceData (FR-R)

- **FR-R01** — `Modules/ReferenceData/` SHALL be a fully separate module with its own Domain, Application, Infrastructure, and Public projects. It owns the `reference_data_entries` table via `ReferenceDataDbContext`.
- **FR-R02** — `IReferenceDataApi` (in `Modules.ReferenceData.Public`) SHALL expose at minimum: `Task<IReadOnlyList<ReferenceDataItemDto>> ListByCategoryAsync(string category, CancellationToken ct)` and `Task<ReferenceDataItemDto?> FindByKeyAsync(string category, string key, CancellationToken ct)`. Admin CRUD lives in the module's Application layer and is exposed via the controllers in `PACademy.Api`.
- **FR-R03** — Admissions and other consumer modules SHALL access lookup data only through `IReferenceDataApi`. Direct EF queries against `reference_data_entries` from outside the ReferenceData module are forbidden (enforced by an architecture test).

### Workflows (FR-W)

- **FR-W01** — `Modules/Workflows/` SHALL be a fully separate module with its own Domain, Application, Infrastructure, and Public projects. It owns the `workflows` and `workflow_stages` tables via `WorkflowsDbContext`. The single-`Published`-per-`(categoryKey, cycleId)` invariant from spec 004 (FR-W02) and the contiguous-1-based-stage-ordering invariant (FR-W04) are enforced inside this module's use cases.
- **FR-W02** — `IWorkflowsApi` (in `Modules.Workflows.Public`) SHALL expose at minimum: `Task<WorkflowSummaryDto?> GetPublishedAsync(string categoryKey, Guid cycleId, CancellationToken ct)` and `Task<bool> HasInflightApplicantsAsync(Guid workflowId, CancellationToken ct)` (used by reorder-blocking checks per spec 004 FR-W05). Admin CRUD lives in the module's Application layer and is exposed via the controllers in `PACademy.Api`.
- **FR-W03** — Admissions and other consumer modules SHALL access workflow data only through `IWorkflowsApi`. Direct EF queries against `workflows`/`workflow_stages` from outside the Workflows module are forbidden (enforced by an architecture test).
- **FR-W04** — Publish-with-auto-archive (spec 004 FR-W02) is a single-context operation — both writes happen against `WorkflowsDbContext`. No `CrossModuleUnitOfWork` is needed; a single `WorkflowsDbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable)` is sufficient.

### Migration story (FR-X)

- **FR-X01** — The phase-5 PR SHALL include EF migrations that split the existing single migration history into per-context histories. Concretely:
  - `IdentityDbContext` adopts the existing tables it owns (`__EFMigrationsHistory_Identity` is created; rows from the old `__EFMigrationsHistory` for migrations `Initial`, `AuditImmutabilityTrigger`, the user-related parts of `004*` are recorded in the new history). No DDL on existing tables.
  - `AdmissionsDbContext` adopts the rest (`__EFMigrationsHistory_Admissions` created with the corresponding rows).
- **FR-X02** — A `005_SplitMigrationHistory` script (raw SQL or an empty EF migration on each new context) SHALL handle the split. The script is idempotent — running it on a fresh DB or an already-split DB produces the same final state.
- **FR-X03** — The legacy migrations under `backend/src/PACademy.Infrastructure/Persistence/Migrations/` SHALL be retained (not deleted) for their `Up`/`Down` provenance. Future migrations are added per-context.

### Build & deploy (FR-B)

- **FR-B01** — `dotnet build PACademy.slnx` SHALL succeed with the new project layout. The CI pipeline contract is unchanged.
- **FR-B02** — `dotnet test` SHALL run all existing tests (Admin/Cycles/* tests included). No test file is moved in phase 5 unless it imports a type that itself moved.
- **FR-B03** — The pre-commit hook's `dotnet format --verify-no-changes` SHALL pass on the new project layout.

---

## Success Criteria *(mandatory)*

- **SC-D01** — `INFORMATION_SCHEMA.TABLES` shows every table owned by exactly one `__EFMigrationsHistory_<Module>` table. Verified by a SQL query in the `Admin/Modular/MigrationOwnership` test.
- **SC-D02** — Adding a new column to `applicants` produces a migration in `Admissions.Infrastructure/Migrations/` only — the other 3 contexts (`IdentityDbContext`, `ReferenceDataDbContext`, `AuditDbContext`) report no pending changes.
- **SC-M01** — NetArchTest assertions in `PACademy.Architecture.Tests` enforce module boundaries automatically. Replaces ad-hoc reference-list audits.
- **SC-M02** — NetArchTest assertion verifies **no type in `PACademy.Api.Controllers.*` has a constructor or method parameter typed as a `*.Public` interface** — controllers must inject the module's own use cases (or in-module orchestrators), never the cross-module public interface. Enforces FR-M05.
- **SC-S01** — `PACademy.Shared.Contracts.csproj` has zero `<ProjectReference>` elements (XML-parsed assertion).
- **SC-S02** — Every module's `*.Public.csproj` has exactly one `<ProjectReference>` (to `Shared.Contracts`).
- **SC-X01** — Dropping the dev DB, then running `dotnet ef database update` per context (any order — Audit, Identity, ReferenceData, Admissions), then `--seed-demo`, then `GET /admin/cycles` returns the same payload as the phase-4 baseline.
- **SC-X02** — `005_split_migration_history.sql` is idempotent — running it twice on the same DB produces the same final state (verified by checksum comparison on the four `__EFMigrationsHistory_<Module>` tables).
- **SC-B01** — `dotnet build` produces no warnings or errors. The set of test projects' green status is identical to phase 4.
- **SC-B02** — `CrossModuleUnitOfWork` is exercised by an integration test that writes through ≥2 contexts in a single transaction; the test passes against the dev Docker SQL container without DTC promotion.

---

## Out of Scope

- Porting Committees, Board, Investigations, Medical, Exams, Barcode, Biometric, or Reports. Those land in phases 6+ (see [Phase 6+ Roadmap](#phase-6-roadmap) below).
- Splitting into separate physical databases (FR-D01 explicitly: same DB, multiple contexts).
- Switching to MediatR, MassTransit, or any message bus.
- Outbox pattern for cross-module writes — `CrossModuleUnitOfWork` is sufficient for same-DB atomic writes.
- Extracting modules into separate `.sln` files or Git submodules. Single `PACademy.slnx`.
- Migrating frontend feature modules. The frontend's `features/<x>/` boundaries are already strong (per CLAUDE.md §3); they are the inspiration for the backend cut, not the target of this change.
- Renaming the `PACademy.Api` host project. It stays at the root of `backend/src/`.

---

## Phase 6+ Roadmap

The remaining bounded contexts are sequenced for delivery after phase 5 merges. Effort estimates are rough engineering hours assuming the spec-5 pattern is locked in (no further architectural decisions).

| Phase | Module(s) | Owns | Depends on | Effort |
|---|---|---|---|---|
| 6 | **Committees** + **Board** | committee_*, board_session_*, board_decision_*, committee_results, board_members | `Identity.Public`, `Admissions.Public` (applicants), `Workflows.Public` (committee stages), `Audit.Public` | ~8h each |
| 7 | **Investigations** + **Medical** | cases_*, outgoing_letters, medical_stations, medical_exam_results | `Identity.Public`, `Admissions.Public`, `ReferenceData.Public` (case-types, station codes), `Workflows.Public` (case + medical pipelines) | ~8h each |
| 8 | **Exams** | bank_questions, exams, exam_attempts, exam_sessions, question_pool | `Identity.Public`, `Admissions.Public`, `Workflows.Public` (exam-stage gates), `Audit.Public` | ~12h |
| 9 | **Barcode** + **Biometric** | barcode_records, barcode_scans, biometric_enrollments, biometric_verifications | `Identity.Public`, `Admissions.Public` | ~4h each |
| 10 | **Reports** | reports_* snapshot tables (read-only aggregations across all the above) | EVERY other module's `*.Public` (read-only). Special: may use `IDbConnection`-level cross-context queries via the existing `CrossModuleUnitOfWork` | ~10h |

**Sequencing rationale**:
- Committees + Board first — smallest domains, well-defined CRUD, exercise the spec-5 pattern at scale (4 modules total in solution).
- Investigations + Medical next — both consume ReferenceData (case-type, station-key), forcing the cross-module read pattern to mature.
- Exams stands alone — biggest domain (question bank, attempts, live sessions, proctoring), needs more time.
- Barcode + Biometric small but with hardware-integration gotchas — keep them together.
- Reports last — it aggregates over every other module, so it can only be carved cleanly once the rest are stable.

Each phase ships its own spec (`specs/006-committees-board/`, etc.) following the spec-5 template.

---

## Dependencies on Prior Specs

- **Spec 003** (admin auth + RBAC) MUST be merged — phase 5 carves the auth code into `Modules.Identity` without changing its behavior.
- **Spec 004** (lookups CRUD) MUST be merged — phase 5 moves the spec-004 controllers/use-cases/DTOs into `Modules.Admissions` without changing their behavior.

---

## Risks

- **R1** — EF migration split: the rebase from a single `__EFMigrationsHistory` to four is the highest-risk operation. Mitigation: ship `005_split_migration_history.sql` (idempotent) + a verification test (`MigrationOwnershipTests`) + drop-and-recreate as the always-available fallback for dev. Rehearse on a copy of the dev DB before merging.
- **R2** — Cross-module transactions: writing through multiple DbContexts in the same operation. Mitigation: `CrossModuleUnitOfWork` (shared `SqlConnection`/`SqlTransaction`) — explicitly **not** `TransactionScope` (the dev Docker SQL container does not support DTC).
- **R3** — Boilerplate explosion: 21 new projects in phase 5 (1 `Shared.Contracts` + 4 `Shared.Audit.*` + 4×4 modules — Identity, Admissions, ReferenceData, Workflows). Mitigation: the `*.Public` projects are tiny (one interface + a few read-model records); they pay for themselves at module #3 when Investigations and Medical (phase 7) start consuming `IReferenceDataApi` and `IWorkflowsApi`.
- **R4** — Audit-Identity coupling risk: putting Audit inside Identity would force every module to depend on Identity just to record an audit row. Mitigation: Audit ships first (phase 3 of this spec), Identity consumes `IAuditApi` from day one — never the reverse.
- **R5** — Lint baseline regression: moving files between projects re-triggers ESLint/dotnet-format on everything moved. Mitigation: phase 5 confines moves to the backend; the frontend lint baseline is untouched. Backend changes pass `dotnet format --verify-no-changes`.
- **R6** — ~~Workflow entity ownership~~. **Resolved 2026-05-09 (clarify Q5):** Workflow is its own module from day one — `Modules/Workflows/{Domain,Application,Infrastructure,Public}` with `WorkflowsDbContext`. Admissions reads via `IWorkflowsApi`. No phase-7 refactor needed.
