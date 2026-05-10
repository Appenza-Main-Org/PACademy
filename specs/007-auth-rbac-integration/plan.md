# Implementation Plan: Auth + RBAC Integration (Phase 7)

**Branch**: `007-auth-rbac-integration` (fork from `006-switching-database` once that PR merges) | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-auth-rbac-integration/spec.md`

## Summary

Activate the dormant `IdentityModule` from spec 005 and switch the staff authentication surface from the legacy single-step login (against `PaDbContext`) to a two-step OTP flow (against `IdentityDbContext`). The frontend already speaks the new contract (`requestOtp` + `verifyOtp` + lock policy + officer lookup per `docs/INTEGRATION_HANDOFF.md §2`); this plan wires the backend to match it. Adds three new transient/policy entities (`PendingOtp`, `LockoutState`, `LockPolicy`), a pluggable `IOtpTransport` (SMS-only per Q1=A, FR-016), a pluggable `IOfficerLookup` (MOIPASS per Q2=A, FR-017), and per-call permission evaluation that honours both `*` and `resource:*` wildcards. The 5-minute pending-session bearer issued by request-otp (per Q3=A, FR-018) lives in the same store as the OTP code itself. Closes the deferred T326 from spec 005 by removing the legacy `AddIdentity<SystemUser, IdentityRole<Guid>>().AddEntityFrameworkStores<PaDbContext>()` registration once IdentityModule's stores are re-enabled. Critical-path for the 2026-05-29 demo: blocks every other backend spec, so cutover strategy emphasises side-by-side running + canary validation rather than big-bang.

## Technical Context

**Language/Version**: C# 13 / .NET 10 (matches spec 005)
**Primary Dependencies**: ASP.NET Core 10 Web API, EF Core 10 (`Microsoft.EntityFrameworkCore.SqlServer`), AspNet Core Identity (re-enabled inside IdentityModule with `IdentityDbContext` as the store backend), FluentValidation 11, Microsoft.AspNetCore.Authentication.Cookies (existing cookie auth retained — frontend uses `withCredentials: true`). New: a thin SMS-gateway abstraction (`IOtpTransport`) and a MOIPASS HTTP client (`IOfficerLookup`). Concrete SMS provider TBD with ops; backend ships the abstraction + an in-memory dev implementation (`InMemoryOtpTransport`) so development never blocks on vendor procurement.
**Storage**: SQL Server 2017+ (matches spec 006 portability). Three new tables under `IdentityDbContext`: `pending_otps`, `lockout_states`, `lock_policy`. The legacy `system_users` and `sessions` tables move under `IdentityDbContext`'s migration ownership (the data does not move — only the configuration source). AspNet Identity tables (`AspNetUserClaims`, `AspNetRoles`, etc.) likewise transition to `IdentityDbContext`. No data migration needed; the cutover is pure metadata.
**Testing**: xUnit 2.9, FluentAssertions, Testcontainers.MsSql for integration. Existing `Auth/*` integration tests (`Login*Tests`) carry over with namespace rewrites. New tests required: (a) `OtpFlowTests` — happy path + expired + reused + locked, (b) `LockPolicyTests` — range validation + audit, (c) `OfficerLookupTests` — found / not-found / upstream-unavailable (against `IOfficerLookup` stub), (d) `PermissionWildcardTests` — `*`, `resource:*`, deny path, (e) `RegistrationOverlapTests` — verify only one `IUserStore<SystemUser>` is registered after the cutover.
**Target Platform**: Same as spec 005 — Linux containers + Windows dev workstations, single deployable.
**Project Type**: Modular monolith (continuation). No new csproj files; this spec lives entirely inside `Modules/Identity/*` plus the `PACademy.Api` host.
**Performance Goals**: OTP request → SMS dispatch ≤ 1 s p95 (network-bound on the SMS gateway). OTP verify ≤ 200 ms p95. Officer lookup ≤ 2 s p95 / ≤ 5 s p99 (SC-005, MOIPASS-bound). Permission check ≤ 1 ms p95 (in-process, no DB round-trip).
**Constraints**: Cannot break the existing demo super_admin login during the cutover window — the existing cookie session shape (`AuthUser` in §5 of `INTEGRATION_HANDOFF.md`) is preserved. Cannot ship the dev-only OTP bypass `000000` to production (FR-014 / SC-006). Cannot store OTP codes in clear-text logs (treat them as secrets). MOIPASS sandbox availability is the gating ops dependency (D-004); a `StubOfficerLookup` returning seeded `system_users` rows is the fallback for dev/staging.
**Scale/Scope**: ~12 new use-case files, ~6 new domain types, ~4 new infrastructure adapters, 3 new EF migrations on `IdentityDbContext`, 2 controllers rewired (`AuthController`, `AdminUsersController`). Frontend untouched; the frontend's existing service shapes (`auth.service.ts`, `users.service.ts`) are the integration test fixture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against `.specify/memory/constitution.md` v1.1.0. The constitution is currently frontend-focused; spec 007 is a **backend-only refactor** (`frontend/` is explicitly out of scope per spec.md A-005), so frontend gates pass trivially by non-application — same posture as spec 005.

- **I. Code Quality & Maintainability** — N/A (no TypeScript / React changes). Backend keeps `<Nullable>enable</Nullable>` and the `dotnet format --verify-no-changes` gate from the pre-commit hook. New SMS-transport / officer-lookup abstractions follow the same single-responsibility shape as the existing `IIdentityProvider`. No new external NuGet packages required (cookie auth, FluentValidation, EF Core, AspNet Identity all already referenced from spec 005). **Pass**.
- **II. Testing Standards** — Spec 007 ships with 5 new test classes covering OTP flow, lock policy, officer lookup, permission wildcards, and registration-overlap (the bug class we hit live in spec 005 when both `AddIdentityCore` and `AddIdentity` were active). Existing auth tests carry over with namespace rewrites only. Integration tests run against Testcontainers SQL Server — no live network calls. The architecture tests in `PACademy.Architecture.Tests` are extended to assert that `Identity.Application` does not reference any concrete SMS or HTTP client (only the abstractions). **Pass**.
- **III. UX Consistency** — N/A (no UI changes). The user-facing API contract for staff sign-in changes shape (single-step → two-step), but the change is purely additive on the wire and the frontend already speaks the new shape. **Pass by non-application**.
- **IV. Performance Requirements** — N/A (no frontend bundle changes). Backend perf budgets above (≤ 200 ms verify-otp p95, ≤ 1 ms permission check) are tracked in tasks.md and verified by integration tests. **Pass**.
- **V. Spec-Driven Discipline** — `spec.md` stays tech-agnostic (no `IUserStore<>` mention, no SQL Server table names, no AspNet Identity API references in requirements — those live in this plan). Traceability spec → plan → tasks → PR → tests preserved. The PR will link `specs/007-auth-rbac-integration/spec.md`. **Pass**.

No violations to record in **Complexity Tracking**.

## Project Structure

### Documentation (this feature)

```text
specs/007-auth-rbac-integration/
├── spec.md                # Feature spec (signed off after /speckit.specify Q1-Q3 resolution)
├── plan.md                # This file
├── research.md            # Phase 0 — SMS gateway + MOIPASS resilience + OTP storage decisions
├── data-model.md          # Phase 1 — PendingOtp, LockoutState, LockPolicy entities + state transitions
├── quickstart.md          # Phase 1 — operator's guide: cutover sequence, rollback, verification
├── contracts/             # Phase 1 — endpoint shapes + error codes
│   ├── auth-api.md        # /auth/login/request-otp, /verify-otp, /me, /logout
│   ├── lock-policy-api.md # /auth/lock-policy + /locked-users + /unlock
│   ├── officers-api.md    # /v1/officers/lookup
│   └── error-codes.md     # Auth-flavoured ErrorCodes additions
├── checklists/
│   └── requirements.md    # Spec-quality checklist (already green)
└── tasks.md               # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root) — backend changes only

```text
backend/
├── src/
│   ├── Modules/Identity/
│   │   ├── PACademy.Modules.Identity.Domain/
│   │   │   ├── SystemUser.cs                              ← existing
│   │   │   ├── Session.cs                                 ← existing
│   │   │   ├── PendingOtp.cs                              ← NEW (§3 of data-model.md)
│   │   │   ├── LockoutState.cs                            ← NEW
│   │   │   └── LockPolicy.cs                              ← NEW
│   │   │
│   │   ├── PACademy.Modules.Identity.Application/
│   │   │   ├── Auth/
│   │   │   │   ├── RequestOtpUseCase.cs                   ← NEW (FR-001..006, FR-016)
│   │   │   │   ├── VerifyOtpUseCase.cs                    ← NEW (FR-001, FR-004)
│   │   │   │   ├── LogoutUseCase.cs                       ← move from legacy
│   │   │   │   └── GetCurrentUserUseCase.cs               ← move from legacy
│   │   │   ├── LockPolicy/
│   │   │   │   ├── GetLockPolicyUseCase.cs                ← NEW (FR-007)
│   │   │   │   ├── UpdateLockPolicyUseCase.cs             ← NEW (FR-007)
│   │   │   │   ├── ListLockedUsersUseCase.cs              ← NEW (FR-008)
│   │   │   │   └── UnlockUserUseCase.cs                   ← NEW (FR-009)
│   │   │   ├── Officers/
│   │   │   │   └── LookupOfficerUseCase.cs                ← NEW (FR-010)
│   │   │   ├── Admin/Users/                               ← existing — stays
│   │   │   ├── IOtpTransport.cs                           ← NEW abstraction
│   │   │   ├── IOfficerLookup.cs                          ← NEW abstraction
│   │   │   ├── IPendingOtpStore.cs                        ← NEW abstraction
│   │   │   ├── IPermissionEvaluator.cs                    ← NEW (wildcard logic)
│   │   │   └── PermissionEvaluator.cs                     ← NEW pure impl
│   │   │
│   │   ├── PACademy.Modules.Identity.Infrastructure/
│   │   │   ├── Persistence/
│   │   │   │   ├── IdentityDbContext.cs                   ← existing — extended
│   │   │   │   └── Configurations/
│   │   │   │       ├── SystemUserConfiguration.cs         ← MOVE from legacy (T323 from spec 005)
│   │   │   │       ├── SessionConfiguration.cs            ← MOVE from legacy
│   │   │   │       ├── PendingOtpConfiguration.cs         ← NEW
│   │   │   │       ├── LockoutStateConfiguration.cs       ← NEW
│   │   │   │       └── LockPolicyConfiguration.cs         ← NEW
│   │   │   ├── Otp/
│   │   │   │   ├── SqlPendingOtpStore.cs                  ← NEW (impl IPendingOtpStore over IdentityDbContext)
│   │   │   │   ├── InMemoryOtpTransport.cs                ← NEW (dev/test default — logs to console)
│   │   │   │   └── SmsOtpTransport.cs                     ← NEW (gated by config; throws if vendor not configured)
│   │   │   ├── Officers/
│   │   │   │   ├── StubOfficerLookup.cs                   ← NEW (dev — returns seeded SystemUsers)
│   │   │   │   └── MoipassOfficerLookup.cs                ← NEW (HTTP client; gated by sandbox availability)
│   │   │   ├── InSystemIdentityProvider.cs                ← existing — re-enabled (was gated off in commit de08f72)
│   │   │   └── IdentityModule.cs                          ← rewrite: re-register AspNet Identity stores against IdentityDbContext
│   │   │
│   │   └── PACademy.Modules.Identity.Public/
│   │       └── IIdentityApi.cs                            ← existing — unchanged
│   │
│   ├── PACademy.Api/
│   │   ├── Controllers/
│   │   │   ├── Auth/AuthController.cs                     ← rewrite: two-step OTP routes
│   │   │   ├── Auth/LockPolicyController.cs               ← NEW
│   │   │   ├── Auth/OfficersController.cs                 ← NEW
│   │   │   └── Admin/AdminUsersController.cs              ← rewire to new use cases (T327)
│   │   ├── Authorization/
│   │   │   └── PermissionRequirementHandler.cs            ← NEW: ASP.NET authz handler that consumes IPermissionEvaluator
│   │   └── Program.cs                                     ← remove duplicate Identity registration
│   │
│   └── PACademy.Infrastructure/
│       └── DependencyInjection.cs                         ← remove AddIdentity<SystemUser, IdentityRole<Guid>>().AddEntityFrameworkStores<PaDbContext>() (closes T326 from spec 005)
│
└── tests/
    ├── PACademy.Api.Tests/
    │   ├── Auth/
    │   │   ├── OtpFlowTests.cs                            ← NEW
    │   │   ├── LockPolicyTests.cs                         ← NEW
    │   │   ├── OfficerLookupTests.cs                      ← NEW
    │   │   └── PermissionWildcardTests.cs                 ← NEW
    │   └── (existing Login*Tests rewritten)
    └── PACademy.Architecture.Tests/
        └── ModuleBoundariesTests.cs                       ← extended: assert no concrete SMS/HTTP in Application

frontend/                                                  # UNTOUCHED
```

**Structure Decision**: Stay inside the modular monolith from spec 005. No new csproj files. The new functionality lives in three new directories under existing module projects (`Auth/`, `LockPolicy/`, `Officers/`) plus the controllers in `PACademy.Api`. The `IdentityDbContext` schema gains 3 tables (`pending_otps`, `lockout_states`, `lock_policy`) and re-takes ownership of the AspNet Identity tables that currently sit under `PaDbContext`. The legacy `PaDbContext` shrinks correspondingly — it stops being an `IdentityDbContext<SystemUser, ...>` subclass at the end of this spec (a backward-compatible change since spec 008+ will own the rest of `PaDbContext`'s tables anyway).

## Phase 0: Outline & Research

Five technical decisions need consolidation before Phase 1 entity design can lock in:

1. **OTP store: DB table vs distributed cache** — frontend treats OTP storage as opaque; the backend chooses. Decide whether `pending_otps` is a SQL table or a Redis hash.
2. **SMS gateway abstraction shape** — what does `IOtpTransport.SendAsync(...)` look like, and how does the eventual vendor (Vonage / Twilio / Egyptian local) plug in?
3. **MOIPASS resilience pattern** — circuit breaker / retry / timeout config given officer-lookup is on the user-visible critical path during admin user creation.
4. **Pending-session bearer format** — opaque-id-in-cookie vs short-lived JWT vs double-submit pattern. Q3=A says "short-lived bearer"; Phase 0 picks the wire shape.
5. **Permission evaluator placement** — pure function next to the entity, ASP.NET authorization handler, or a custom middleware? Affects how endpoints declare requirements.

Output: [research.md](./research.md) with one **Decision / Rationale / Alternatives considered** block per item.

## Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete (decisions locked in)

1. **Entities** → [data-model.md](./data-model.md):
   - `PendingOtp` — `{ id (pendingId), userId, codeHash, maskedPhoneTail, expiresAt, attemptCount, createdAt }`. State transitions: pending → consumed | expired | locked-out.
   - `LockoutState` — per-user transient state. Cleared on successful verify or manual unlock.
   - `LockPolicy` — single row carrying `maxFailedAttempts ∈ [1,10]`, `lockDurationMinutes ∈ [5,120]`. Range validation lives in the use case (FR-007).
   - `OfficerRecord` (read-only DTO from MOIPASS — not persisted; documented for clarity).
   - State machine for `LockoutState`: `Active | Locked` ↔ derived from `LockPolicy.maxFailedAttempts` and `LockoutState.failedCount`.
   - JSON shapes for inline `before/after` fields on emitted audit rows.

2. **Contracts** → [contracts/](./contracts/):
   - **auth-api.md** — `POST /auth/login/request-otp` (request body: `{ nationalId, password }`; response: `{ pendingId, otpDevice, otpExpiresAt }`), `POST /auth/login/verify-otp` (`{ pendingId, code }` → `AuthUser` shape from `INTEGRATION_HANDOFF.md §5`), `GET /auth/me`, `POST /auth/logout`. Each documents the typed error envelope from the integration handoff §4.
   - **lock-policy-api.md** — `GET /auth/lock-policy`, `PATCH /auth/lock-policy`, `GET /auth/lock-policy/locked-users`, `POST /auth/lock-policy/unlock`. Range validation rules, audit emissions.
   - **officers-api.md** — `GET /v1/officers/lookup?nid=&code=`. Found / not-found / 503 upstream-unavailable.
   - **error-codes.md** — adds `OTP_EXPIRED`, `OTP_REUSED`, `OTP_MISMATCH`, `ACCOUNT_LOCKED`, `INVALID_CREDENTIALS`, `OFFICER_NOT_FOUND`, `OFFICER_LOOKUP_UNAVAILABLE`, `PERMISSION_DENIED` to `Shared.Contracts/ErrorCodes.cs` (extending the spec 005 registry).

3. **Quickstart** → [quickstart.md](./quickstart.md):
   - **Cutover sequence** (5 ordered steps, each with verification): (1) deploy with new endpoints active *and* legacy `/auth/login` still wired, (2) frontend canary uses new endpoints exclusively, (3) verify zero traffic on legacy `/auth/login` for 24h, (4) remove legacy registration in `DependencyInjection.cs` + redeploy, (5) verify all 11 seeded role users sign in via the new flow.
   - **Rollback plan**: legacy `/auth/login` registration is git-revertable in a single commit. Idempotent rollback (no schema changes on rollback because the new tables are additive).
   - **Migration runner**: `dotnet ef database update --context IdentityDbContext` applies the 3 new tables + transfers AspNet Identity ownership.

4. **Agent context update**: append the spec-007 plan reference between the `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` markers in `CLAUDE.md` (when /speckit.tasks runs, not now).

**Output**: data-model.md, contracts/*.md, quickstart.md.

## Phase 2 (preview)

`/speckit.tasks` will slice this plan into ~30–35 T-numbered tasks continuing from spec 005's last (T371). Expected breakdown: 5 setup tasks (entity scaffolding, DbContext extension, EF migration), 8 use-case tasks (request-otp / verify-otp / lock policy ×4 / officer lookup / permission evaluator), 4 infrastructure tasks (OTP transport / officer lookup adapters / pending-OTP store), 5 controller tasks (rewire), 4 cutover tasks (registration removal, legacy retirement, frontend canary verification, rollback drill), and ~5 test tasks. Critical path runs setup → use-cases → controllers in series; infrastructure adapters parallelise.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No constitution violations. Two design choices that look like complexity but aren't:

| Apparent complexity | Why it's actually the simple answer |
|-----------|------------|
| Two `IOtpTransport` implementations (`InMemoryOtpTransport` for dev + `SmsOtpTransport` for staging/prod) | Required because the SMS gateway vendor isn't selected yet (D-003). The in-memory dev impl logs to console + writes the OTP code into the response under `__DEV_ONLY_DO_NOT_LOG` — fully gated by `ASPNETCORE_ENVIRONMENT == "Development"`. Removes the dev/prod-parity foot-gun where the dev experience differs from the prod one. |
| Two `IOfficerLookup` implementations (`StubOfficerLookup` for dev/test + `MoipassOfficerLookup` for prod) | MOIPASS sandbox availability is the gating ops dependency (D-004). The stub returns seeded `system_users` rows so admin user-create flows are exercisable end-to-end without waiting on the Ministry of Interior's identity team. Auto-selected based on `Configuration:OfficerLookup:Source ∈ {Stub, MOIPASS}`. |
