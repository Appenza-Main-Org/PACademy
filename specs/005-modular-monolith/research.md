# Phase 0 Research: Modular-Monolith Refactor (Phase 5)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

> The clarify pass on 2026-05-09/2026-05-10 resolved the open architecture decisions; this document consolidates them in the canonical "Decision / Rationale / Alternatives" format so future contributors understand *why* before they touch the *what*.

---

## R0.1 — Bounded-context split for the initial carve

**Decision**: Phase 5 carves five modules from the monolith — `Modules/Identity`, `Modules/Admissions`, `Modules/ReferenceData`, `Modules/Workflows`, plus a cross-cutting `Shared/Audit`. The remaining contexts (Committees, Board, Investigations, Medical, Exams, Barcode, Biometric, Reports) stay in legacy `PACademy.*` until phase 6+.

**Rationale**:
- Identity is the gateway — every other module reads the current user. Carving it first means downstream modules never leak `HttpContextAccessor` into use cases.
- Admissions is the largest domain and the one most actively touched (applicants, cycles, categories, admission rules). Modularising it proves the pattern under load.
- ReferenceData is consumed by ~half the planned modules (Admissions today; Investigations, Medical later). Carving now avoids a phase-7 refactor where Investigations reaches into Admissions for case-types.
- Workflows is consumed by the same set (Admissions today; Investigations, Medical, Exams later). Same logic — carve now.
- Audit is consumed by every module's writes; placing it inside any single module would invert the dependency graph (every module depending on whichever module owns audit). `Shared/` is the right home.

**Alternatives considered**:
- **Big-bang carve all 13 contexts at once.** Rejected — too large a PR (~150+ files moved), high blast radius if any single move breaks compilation, two-week branch hold-up.
- **Carve only Identity + Admissions; leave ReferenceData and Workflows in Admissions.** Rejected during clarify Q5 — Investigations and Medical (phase 7) will need both; deferring forces a refactor when the second consumer arrives.
- **Carve only Audit + Identity; defer Admissions to a later phase.** Rejected — the largest domain proves the pattern best; deferring the heaviest case means later phases find architectural problems that should have surfaced now.

---

## R0.2 — One physical DB, five `DbContext`s

**Decision**: Single SQL Server database (`ConnectionStrings:Default`); one `DbContext` per module (`AdmissionsDbContext`, `IdentityDbContext`, `ReferenceDataDbContext`, `WorkflowsDbContext`, `AuditDbContext`). Each context owns its tables and its own migrations history table (`__EFMigrationsHistory_<Module>`).

**Rationale**:
- Single deployable, single SQL container, single connection-string env var. Operationally identical to phase 4.
- Per-context migrations let modules evolve independently — adding a column to `applicants` shows up only in `Admissions.Infrastructure/Migrations/`. The other 4 contexts report no pending changes (verified by SC-D02).
- Cross-context atomic writes are still possible via a shared `SqlConnection` + `SqlTransaction` (see R0.3).
- Future "extract to its own DB" path stays open — the contexts are already physically isolated except for the shared connection string. Switching one context to a different DB is a configuration change, not a schema rewrite.

**Alternatives considered**:
- **Database per module.** Rejected — strongest isolation but breaks the single-deployable goal; cross-module reads need an outbox/saga; seeding becomes a multi-DB orchestration. Heavy upfront for a still-monolithic deployment story.
- **Schema per module (single DB, `admissions.applicants`, `identity.users`).** Rejected — middle ground but adds a permission-management surface (per-schema GRANT/REVOKE) and complicates EF Core schema-based filters. The per-context migrations history table achieves the same evolution-independence with less ceremony.
- **Single `DbContext` with namespace-organised configurations.** Rejected — it's what we have today and exactly what the spec is moving away from. One context = one model snapshot = every change touches every module's compile.

---

## R0.3 — Cross-context atomic writes via `CrossModuleUnitOfWork`

**Decision**: A host-level helper (`PACademy.Api/Hosting/CrossModuleUnitOfWork.cs`) opens one `SqlConnection` + `SqlTransaction` and exposes a `Use<T>()` accessor that instantiates each affected `DbContext` over that shared connection (`UseConnection(conn).UseTransaction(tx)`). All-or-nothing semantics: if any `SaveChangesAsync` fails after another succeeded, the shared transaction is rolled back and the original exception is rethrown (FR-D06, clarify Q1).

**Rationale**:
- Same connection + same transaction = no DTC promotion. Works against the dev Docker SQL container (which doesn't support DTC) and against any production SQL Server.
- Explicit; the use case sees the UoW and asks for a context (`uow.Use<AdmissionsDbContext>()`). No surprising replacement of DI-scoped instances. (Clarify Q4.)
- All-or-nothing matches the audit invariant — every successful CRUD writes its row AND its audit entry, full stop. No "cycle exists, no audit row" race window.
- Caller-driven retry; no outbox/dead-letter complexity. Consistent with phase-5's "no message bus, no outbox" out-of-scope rule.

**Alternatives considered**:
- **`TransactionScope`.** Rejected — on Windows + multiple `DbContext` instances, even same-DB scopes can promote to MSDTC. The dev Docker SQL container does not support DTC, so the test suite would fail intermittently. Plan §A4 forbids it explicitly.
- **Eventual consistency (each module saves alone, audit lags).** Rejected during clarify Q1 — breaks the audit invariant from spec 003 and forces an outbox to recover it. Adds operational surface for no gain.
- **Outbox pattern from day one.** Rejected — overkill for same-DB modules. Useful when modules sit on different DBs; not phase 5's problem.

---

## R0.4 — `*.Public` separate csproj per module (DI-only)

**Decision**: Every module ships a separate `Modules.<X>.Public` project (4 projects per module total). Public projects contain only `interface I<Module>Api` and the read-model records that interface returns. They reference only `Shared.Contracts`. Other modules reference the `*.Public` csproj — never `*.Domain`/`*.Application`/`*.Infrastructure`. The interfaces are **DI-only**: no `[ApiController]` may inject or expose a public interface over HTTP/gRPC (FR-M05, clarify Q2).

**Rationale**:
- Separate csproj = enforced boundary at compile time. A use case in Admissions cannot accidentally `using PACademy.Modules.Identity.Domain.Users;` because the Identity.Domain assembly isn't on its reference path.
- DI-only forever closes a back door — if a future phase wants HTTP service-to-service exposure of a public interface, that's a new spec, not an undocumented capability of phase 5. Surface area is smaller and intentional.
- `*.Public` projects are tiny (one interface + a couple of records). The boilerplate cost amortises at module #3.

**Alternatives considered**:
- **Public namespace inside Application** (no extra csproj, soft boundary). Rejected during clarify question round — relies on convention; analyzers would have to enforce it. Compile-time enforcement is worth the extra csproj.
- **Allow HTTP exposure of public APIs** behind a feature flag. Rejected during clarify Q2 — adds permanent surface area (auth/authorization/error-shaping/OpenAPI) for a hypothetical future need. If/when that need is real, ship a dedicated spec.
- **Tagged `IIdentityHttpApi` / `IIdentityApi` separation** to hold the door open. Rejected — over-engineering; YAGNI.

---

## R0.5 — Cross-module foreign keys: bare `Guid`, no DB constraint

**Decision**: Cross-module FKs (e.g. `applicants.created_by_user_id` → `system_users.Id`, `audit_entries.user_id` → `system_users.Id`) are stored as `Guid` columns with **no EF navigation property AND no DB-level `FOREIGN KEY` constraint** (FR-D04, clarify Q3). Integrity is the writing module's responsibility.

**Rationale**:
- Each `DbContext` only sees its own model — EF can't add a FK constraint across contexts anyway. The choice is whether to add one in raw SQL.
- Adding the constraint would couple the two contexts at the schema level. A future "extract Identity to its own DB" plan would have to drop the constraint first.
- The migration order would also be constrained — Identity tables must exist before any cross-referencing module's migrations run. SC-X01 says any context-update order works; a DB-level FK would violate that.
- Application-layer integrity is sufficient: every audit row is written by code that just authenticated the user, so the user id is always valid at write time.

**Alternatives considered**:
- **DB-level FK via raw SQL migration.** Rejected during clarify Q3 — strongest integrity but couples contexts at the schema level and breaks migration ordering independence.
- **App-level integrity check via `IIdentityApi.UserExistsAsync()` before every audit write.** Rejected — adds a round-trip per audit row; expensive for a value that's already guaranteed by the calling context.
- **Mixed (DB FK for some cross-module references, not others).** Rejected — inconsistent rules are hard to defend and harder to enforce.

---

## R0.6 — DbContext lifetime: scoped DI for non-UoW; UoW-supplied for atomic writes

**Decision**: Each module's `DbContext` is registered as `Scoped` (default for `AddDbContext<T>()`) — single instance per HTTP request, injected into use cases via constructor. Use cases participating in **cross-module atomic writes** ignore the DI-injected instance and accept a `CrossModuleUnitOfWork` parameter, calling `uow.Use<T>()` for a context bound to the shared `SqlConnection`/`SqlTransaction`. Two instances coexist; change tracking is local to each. No `IServiceProvider` magic that silently replaces the scoped instance with the UoW instance (FR-D07, clarify Q4).

**Rationale**:
- Explicit beats clever. A use case's signature says whether it participates in a cross-module UoW (`Func(CrossModuleUnitOfWork uow, …)`) or not.
- Scoped DI for non-UoW reads is what every use case in spec 003 / 004 already does. Phase 5 doesn't disrupt that path.
- UoW-supplied instances are throwaway — they exist for the duration of the transaction, then dispose. No surprise interaction with the DI container's scope.

**Alternatives considered**:
- **Magic ScopedFactory replacement** (UoW swaps the DI-resolved instance for a UoW-bound one mid-request). Rejected during clarify Q4 — looks magical, fails test fixtures, hard to debug.
- **UoW for every request** (single-context paths get a no-op UoW). Rejected — small per-request overhead even for read-only single-context reads. YAGNI.
- **No use cases touch UoW; only controllers compose UoWs and call repository methods.** Rejected — would force a phase-5-sized rewrite of spec 003/004 use cases away from the `IPaDbContext` injection pattern.

---

## R0.7 — Audit lives in `Shared/`, not under `Modules/Identity`

**Decision**: Audit is a `Shared/Audit` concern with its own 4-project layout (Domain, Application, Infrastructure, Public). Every module references `Shared.Audit.Public` to write audit rows; the `audit_entries` table belongs to `AuditDbContext`. The immutability triggers from spec 003 (block UPDATE/DELETE on audit rows) are recreated by `AuditDbContext`'s migration. (Clarify Q after Q4 — assigned to the Shared.Audit decision in the spec's clarification table; spec FR-S05/S06.)

**Rationale**:
- Audit is consumed by every module's writes. Inverting the dependency graph (every module → Identity) just to record an audit row is the antipattern modular monoliths exist to prevent.
- Shared placement signals ownership: it's not Admissions-specific, not Identity-specific, it's infrastructure that every domain consumes.
- The Shared.Audit boundary (4 projects, with its own DbContext + migration history) is consistent with how a module is structured. Calling it "Shared" is naming, not architecture.

**Alternatives considered**:
- **Audit inside Identity** (since audit is keyed to user actions). Rejected — every module would depend on Identity.Public just to record an audit row. Phase 5's whole point is reducing inter-module coupling.
- **Audit inside `Shared.Contracts` as DTOs only**, with each module hand-writing its own audit-table EF config. Rejected — duplicates the immutability trigger across N modules; worst-of-both-worlds.
- **Async audit via a message bus.** Rejected — adds a runtime dependency (message broker) for a feature that the API already commits synchronously today. Phase 5's out-of-scope rule.

---

## R0.8 — NetArchTest.Rules for boundary enforcement

**Decision**: A new test project `backend/tests/PACademy.Architecture.Tests/` uses `NetArchTest.Rules` (NuGet) to assert module-reference rules on every CI run. The rule library is small (~50 KB), test-only (no production binary impact), and produces clear failure messages with the offending type names.

**Rationale**:
- Enforced architecture > documented architecture. Without an automated check, the boundary erodes one PR at a time.
- NetArchTest is the de-facto .NET library for this — alternatives (Roslyn analyzers) require more setup and have steeper learning curves.
- Failures show exactly which type violates the rule and which forbidden assembly it references; reviewers don't have to guess.

**Alternatives considered**:
- **Hand-rolled csproj XML parsing tests.** Rejected during clarify question round — works for "csproj has zero refs" but doesn't catch type-level violations (a using statement that smuggles a type from an internal namespace).
- **Roslyn analyzers.** Rejected — heavier setup; the NetArchTest API is sufficient for what spec 5 needs.
- **Skip arch tests this phase, document rules only.** Rejected — drift would start within weeks; the boundary is the whole point of phase 5.

---

## R0.9 — Migration cutover paths: dev drop-and-recreate + idempotent prod SQL

**Decision**: Two migration paths ship in phase 5:
1. **Dev**: `dotnet ef database drop --force` → `dotnet ef database update --context X` for each of the 5 contexts (any order) → start API with `--seed-demo`. Always available; cleanest reset.
2. **Prod (and any non-fresh DB)**: `backend/scripts/migrations/005_split_migration_history.sql` — idempotent SQL that splits the existing single `__EFMigrationsHistory` into 5 per-context histories. Auto-applied at startup in non-prod environments via a `MigrationHistoryCutover` hosting hook; prod requires explicit opt-in.

(FR-X01, FR-X02, clarify table at top of spec.)

**Rationale**:
- The single-history → multi-history split is the highest-risk operation in phase 5. Two paths give us a tested production migration AND an always-available "if it breaks, drop the DB and start over" escape hatch for dev.
- Idempotency means CI can run the script as part of every test setup, then run it again, and get the same result. Catches drift early.
- Auto-apply in non-prod = zero ceremony for devs joining the project mid-phase. Manual opt-in in prod = no surprise schema rewrites in production.

**Alternatives considered**:
- **Drop-and-recreate everywhere (no SQL cutover).** Rejected — fine until the day someone needs to run phase 5 against a non-empty prod DB.
- **SQL cutover everywhere (use it in dev too).** Rejected — drop-and-recreate is dramatically faster for dev iteration; SQL cutover should exist but doesn't need to be the daily-driver path.
- **EF migration that calls `Sql("…")`.** Rejected — coupling the cutover to EF means any context's migration could in principle execute it; the standalone SQL script is clearer about its one-time nature.

---

## Open items deferred to plan-execution

| Item | Why deferred | Owner |
|---|---|---|
| Observability of cross-module calls (OpenTelemetry spans, log correlation) | Plan-level; phase 5's API contract is unchanged so existing tracing still works. Revisit when the second module starts cross-calling heavily. | Plan §A7 |
| `PACademy.Domain` cleanup post-carve | Cleanup phase (T370). The remaining types are reports-snapshot related and stay until phase 10. | T370 |
| Frontend constitution coverage for backend rules | Constitution is currently frontend-focused; backend rules will be added in a future amendment when the backend matures. | constitution.md follow-ups |
