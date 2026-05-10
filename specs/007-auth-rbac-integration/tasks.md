---
description: "Tasks for spec 007 — Auth + RBAC integration (activate IdentityModule, two-step OTP login, lock policy, officer lookup, permission wildcards)"
---

# Tasks: Auth + RBAC Integration (Phase 7)

**Input**: Design documents from [`specs/007-auth-rbac-integration/`](./)
**Prerequisites**: Spec 005 (modular monolith) merged. Spec 006 (DB switching) merged. The `IdentityModule` from spec 005 is registered but its AspNet Identity stores were deliberately gated off (commit `de08f72`) — this spec re-enables them.

**Companion artifacts**:
- [plan.md](./plan.md) — technical context, project structure, constitution check, phase outline
- [research.md](./research.md) — R0.1–R0.5 architecture decisions (OTP store, transport abstraction, MOIPASS resilience, pending-bearer shape, permission evaluator placement)
- [data-model.md](./data-model.md) — entities, state transitions, migration plan
- [contracts/](./contracts/) — auth-api, lock-policy-api, officers-api, error-codes
- [quickstart.md](./quickstart.md) — operator's cutover sequence (5 steps + rollback)

**Tests**: Per Constitution Principle II (NON-NEGOTIABLE), every user story has test-first tasks. Integration tests run against Testcontainers SQL Server (no live network calls). The `RegistrationOverlapTests` introduced here permanently guards against the bug class we hit live in spec 005 when both `AddIdentityCore` and `AddIdentity` were active.

**Numbering**: Continues from spec 005's last task (T371). This spec's range is **T400–T471** (gap T372–T399 reserved for spec 006 chore work which had no formal tasks).

**Format**: `[ID] [P?] [Story] Description`

- **[P]** — can run in parallel (different files, no dependency on tasks ahead)
- **[Story]** — `Setup` / `Foundation` / `US1` (two-step OTP login) / `US4` (permission-based access) / `US2` (lock policy management) / `US3` (officer lookup) / `Cutover`

**Phase ordering rationale**:
- Setup is mechanical (config keys, package refs).
- Foundational re-enables the dormant IdentityModule + lays the entity/abstraction groundwork. Nothing else can begin until this checkpoint passes.
- US1 (Two-step OTP login) is the biggest P1 — without it nothing downstream can sign in.
- US4 (Permission-based access) is the other P1; it's mostly orthogonal to US1 (the PermissionEvaluator is a pure function), so US1 and US4 can parallelise after Foundational.
- US2 (Lock policy management) and US3 (Officer lookup) are P2; they're independent of each other and ride on top of US1.
- Cutover removes the legacy registration and verifies the rollout.

---

## Phase 1: Setup

- [ ] **T400** [Setup] Add `Polly` 8.* to `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/PACademy.Modules.Identity.Application.csproj` (per research.md R0.3 — circuit breaker for MOIPASS).

- [ ] **T401** [Setup] Add `Otp`, `OfficerLookup`, `LockPolicy` config blocks to all three appsettings files per [quickstart.md §Environment-specific config](./quickstart.md):
  - `backend/src/PACademy.Api/appsettings.json` (Production defaults: `Otp.Transport=Sms`, `OfficerLookup.Source=MOIPASS`)
  - `backend/src/PACademy.Api/appsettings.Development.json` (Dev defaults: `Otp.Transport=InMemory`, `OfficerLookup.Source=Stub`)
  - `backend/src/PACademy.Api/appsettings.Staging.json` (NEW file; same as Production for now).

- [ ] **T402** [P] [Setup] Add 12 new auth error codes to `backend/src/Shared/PACademy.Shared.Contracts/ErrorCodes.cs` per [contracts/error-codes.md](./contracts/error-codes.md): `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `OTP_MISMATCH`, `OTP_EXPIRED`, `OTP_REUSED`, `UNAUTHENTICATED`, `PERMISSION_DENIED`, `VALIDATION_FAILED`, `OFFICER_NOT_FOUND`, `OFFICER_LOOKUP_UNAVAILABLE`, `DEPRECATED`. (`NOT_FOUND` already exists from spec 005 — skip.)

- [ ] **T403** [P] [Setup] Extend `backend/tests/PACademy.Architecture.Tests/ModuleBoundariesTests.cs` with two new assertions: (a) `Identity.Application` does not reference `Microsoft.Data.SqlClient` or `System.Net.Http` directly (concrete SMS/HTTP belongs in Infrastructure); (b) `Identity.Domain` continues to have zero EF Core references (regression guard for the new domain entities).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Re-enable the dormant IdentityModule stores, scaffold the new entities, generate the migration. No user story can begin until this phase is complete.

**⚠️ CRITICAL**: Phase 2 ends with the IdentityModule fully wired against `IdentityDbContext` and the legacy `AddIdentity` registration in `DependencyInjection.cs` STILL ACTIVE. Both stores must coexist briefly for the cutover (per quickstart.md Step 1). The legacy registration is removed only in Phase 7 (T463).

### Copy existing configurations into Identity module (DO NOT DELETE LEGACY YET)

> **⚠️ Cutover-safety note**: T404/T405 **copy** the configurations into the Identity module rather than moving them. Both copies must coexist during the cutover window because PaDbContext (still wired by the legacy `AddIdentity().AddEntityFrameworkStores<PaDbContext>()` registration) needs its `system_users` mapping until T466 removes the legacy registration. Deleting the legacy files in this phase would break PaDbContext-backed `UserManager<SystemUser>` queries (table `AspNetUsers` does not exist on the GCP DB). T466 deletes the legacy copies as part of the legacy-registration removal.

- [ ] **T404** [Foundation] Copy `backend/src/PACademy.Infrastructure/Persistence/Configurations/SystemUserConfiguration.cs` to `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Persistence/Configurations/SystemUserConfiguration.cs`. Update namespace in the copy to `PACademy.Modules.Identity.Infrastructure.Persistence.Configurations` + `using PACademy.Modules.Identity.Domain;`. **Leave the original file in place** — both files map the same `system_users` table; EF Core only complains if the same entity type is configured twice in the same DbContext, but here the two copies live in different DbContexts (PaDbContext discovers the legacy one; IdentityDbContext discovers the new one).

- [ ] **T405** [Foundation] Copy `backend/src/PACademy.Infrastructure/Persistence/Configurations/SessionConfiguration.cs` to `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Persistence/Configurations/SessionConfiguration.cs`. Same posture as T404 — update namespace, leave the original alone.

### New domain entities (parallelisable)

- [ ] **T406** [P] [Foundation] Create `backend/src/Modules/Identity/PACademy.Modules.Identity.Domain/PendingOtp.cs` per [data-model.md §3](./data-model.md). Fields: `Id`, `UserId`, `CodeHash`, `MaskedPhoneTail`, `ExpiresAt`, `AttemptCount`, `CreatedAt`, `ConsumedAt`. Domain methods: `Create(...)`, `MarkConsumed()`, `IncrementAttempt()`, `IsExpired(DateTime now)`, `IsConsumed`.

- [ ] **T407** [P] [Foundation] Create `backend/src/Modules/Identity/PACademy.Modules.Identity.Domain/LockoutState.cs` per data-model.md §3. Fields: `UserId` (PK), `LockedAt`, `UnlocksAt`, `Reason`, `FailedAttemptCount`. Domain methods: `Create(...)`, `IsExpired(DateTime now)`.

- [ ] **T408** [P] [Foundation] Create `backend/src/Modules/Identity/PACademy.Modules.Identity.Domain/LockPolicy.cs` per data-model.md §3. Fields: `Id` (always 1), `MaxFailedAttempts`, `LockDurationMinutes`, `UpdatedAt`, `UpdatedBy`, `DemoOrigin`. Static factory `Default()` returns `(5, 30)`. `Update(...)` enforces the [1,10] / [5,120] ranges throwing `ArgumentOutOfRangeException` on violation.

### EF configurations (parallelisable)

- [ ] **T409** [P] [Foundation] Create `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Persistence/Configurations/PendingOtpConfiguration.cs`. Maps to `pending_otps` table; FK to `system_users(Id)`; indexes `IX_pending_otps_user_id_active` (filtered `WHERE ConsumedAt IS NULL`) and `IX_pending_otps_expires_at`. Use `Arabic_100_CI_AS_SC` collation on `MaskedPhoneTail` per spec 006.

- [ ] **T410** [P] [Foundation] Create `LockoutStateConfiguration.cs` (same path). Maps to `lockout_states`; PK on `UserId`; FK to `system_users`; index `IX_lockout_states_unlocks_at`.

- [ ] **T411** [P] [Foundation] Create `LockPolicyConfiguration.cs` (same path). Maps to `lock_policy`; PK on `Id`; check constraint `Id = 1`; FK to `system_users(Id)` on `UpdatedBy`.

### IdentityDbContext extension

- [ ] **T412** [Foundation] Add three `DbSet<>` properties to `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Persistence/IdentityDbContext.cs`: `PendingOtps`, `LockoutStates`, `LockPolicies`. Verify `OnModelCreating` already calls `ApplyConfigurationsFromAssembly` so the 5 new configurations + the 2 moved ones (T404/T405) are picked up.

- [ ] **T413** [Foundation] Generate per-context EF migration: `dotnet ef migrations add 007_AuthRbacIntegration --context IdentityDbContext --project src/Modules/Identity/PACademy.Modules.Identity.Infrastructure --startup-project src/PACademy.Api`. Inspect the generated migration: should create exactly 3 new tables (`pending_otps`, `lockout_states`, `lock_policy`), no DDL on existing AspNet/`system_users`/`sessions` tables (those are now mapped under IdentityDbContext but already exist).

- [ ] **T414** [Foundation] Apply the migration to the dev DB: `dotnet ef database update --context IdentityDbContext`. Verify via `SELECT name FROM sys.tables WHERE name IN ('pending_otps','lockout_states','lock_policy')` returns 3 rows.

### Application abstractions (parallelisable)

- [ ] **T415** [P] [Foundation] Define `IOtpTransport` interface in `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/Auth/IOtpTransport.cs`. Single method per research.md R0.2: `Task<OtpDispatchResult> SendAsync(string maskedPhoneTail, string fullPhone, string code, CancellationToken ct)`. Define `OtpDispatchResult` record alongside.

- [ ] **T416** [P] [Foundation] Define `IOfficerLookup` interface in `Identity.Application/Officers/IOfficerLookup.cs`. Single method `Task<OfficerRecord?> LookupAsync(string nationalId, string officerCode, CancellationToken ct)`. Define `OfficerRecord` DTO per data-model.md §4. Throw `OfficerLookupUnavailableException` for transient failures.

- [ ] **T417** [P] [Foundation] Define `IPendingOtpStore` interface in `Identity.Application/Auth/IPendingOtpStore.cs`. Methods: `Task<PendingOtp> CreateAsync(...)`, `Task<PendingOtp?> GetAsync(Guid pendingId, CancellationToken ct)`, `Task ConsumeAsync(Guid pendingId, CancellationToken ct)`, `Task IncrementAttemptAsync(Guid pendingId, CancellationToken ct)`, `Task InvalidateAllForUserAsync(Guid userId, CancellationToken ct)`.

- [ ] **T418** [P] [Foundation] Define `IPermissionEvaluator` interface and pure-function implementation `PermissionEvaluator` in `Identity.Application/Authorization/`. Implementation per data-model.md §5: handle `*`, exact match, `resource:*`. Single method `bool Has(IReadOnlyList<string> userPermissions, string required)`.

### Infrastructure adapter (the gate)

- [ ] **T419** [Foundation] Implement `SqlPendingOtpStore` in `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Otp/SqlPendingOtpStore.cs`. Wraps `IdentityDbContext.PendingOtps`. `CreateAsync` invalidates any prior un-consumed row for the same user before inserting (handles concurrent OTP requests edge case from spec.md).

### Re-enable AspNet Identity stores (closes spec 005's deferred T326 partially — see also T463)

- [ ] **T420** [Foundation] Edit `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/IdentityModule.cs`: un-gate the AspNet Identity registration (the block currently commented "intentionally NOT done here yet" from commit `de08f72`). Wire `AddIdentityCore<SystemUser>().AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<IdentityDbContext>().AddSignInManager<>().AddDefaultTokenProviders()` per quickstart.md Step 4 diff. Also re-register `IIdentityProvider → InSystemIdentityProvider`. **Do NOT** remove the legacy `AddIdentity` from `DependencyInjection.cs` yet — both registrations coexist during the cutover window per quickstart.md Step 1. T463 removes the legacy in Phase 7.

**Checkpoint**: Build clean. `dotnet test --filter "FullyQualifiedName~PACademy.Architecture.Tests"` green. The new tables exist on the dev DB. AspNet Identity stores resolve from `IdentityDbContext` for the new module's own consumers but the legacy `AuthController` still hits `PaDbContext` (cutover window).

---

## Phase 3: User Story 1 — Two-step OTP login (Priority: P1) 🎯 MVP

**Goal**: Staff users sign in via NID + password → SMS-delivered OTP → session, with lockout protection.

**Independent Test**: `curl -X POST /auth/login/request-otp -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'` returns `{ pendingId, otpDevice, otpExpiresAt }`. The OTP code arrives via `InMemoryOtpTransport` (logged at Debug level in dev) or SMS (in staging/prod). `curl -X POST /auth/login/verify-otp -d '{"pendingId":"…","code":"<from log>"}'` returns the AuthUser shape with a session cookie set. Five wrong codes triggers `ACCOUNT_LOCKED`.

### Tests for US1 (write FIRST — Constitution II)

- [ ] **T421** [P] [US1] Contract test `OtpFlowTests.RequestOtp_ReturnsExpectedShape` in `backend/tests/PACademy.Api.Tests/Auth/OtpFlowTests.cs`: assert 200 response shape from `/auth/login/request-otp` (pendingId is a UUID, otpDevice matches `^•+ \d{4}$`, otpExpiresAt is ~5 min in the future). Assert 401 on bad password, 403 on already-locked user.

- [ ] **T422** [P] [US1] Contract test `OtpFlowTests.VerifyOtp_HappyAndUnhappy` in same file: 200 returns AuthUser; 400 OTP_MISMATCH includes `remainingAttempts`; 400 OTP_EXPIRED, 400 OTP_REUSED, 403 ACCOUNT_LOCKED match contracts/auth-api.md exactly.

- [ ] **T423** [P] [US1] Integration test `OtpFlowTests.HappyPath_TwoStepLogin` — request-otp, read OTP from `InMemoryOtpTransport` capture, verify-otp, hit `/auth/me` with the cookie, assert authenticated user is the one we logged in as.

- [ ] **T424** [P] [US1] Integration test `OtpFlowTests.OtpExpiry_TriggersExpiredError` — request-otp, advance test clock 6 minutes, verify-otp returns 400 OTP_EXPIRED.

- [ ] **T425** [P] [US1] Integration test `OtpFlowTests.LockoutAtThreshold` — request-otp, submit 5 wrong codes; assert 5th response is 403 ACCOUNT_LOCKED with the unlocksAt payload, assert `lockout_states` row exists for the user, assert audit log has `account_locked` event.

- [ ] **T425a** [P] [US1] Regression test `OtpFlowTests.RejectsZeroBypassCode` for FR-014 / SC-006 — request-otp, then call verify-otp with `code: "000000"` against the issued pendingId; assert the response is 400 OTP_MISMATCH (NOT 200, NOT a special "dev bypass" path). Guards against accidental reintroduction of the legacy frontend's `peekOtpCode`/`DEV_BYPASS` shortcut on the backend.

### Implementation for US1 (parallelisable groups marked)

- [ ] **T426** [P] [US1] Implement `InMemoryOtpTransport` in `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Otp/InMemoryOtpTransport.cs`. Logs the code via `ILogger<InMemoryOtpTransport>` at `Debug` level **only** when `IHostEnvironment.IsDevelopment()`. Captures the most-recent dispatch in a thread-safe `ConcurrentDictionary<string, string>` keyed by phone-tail for test consumption. Returns `OtpDispatchResult(true, $"in-mem-{Guid.NewGuid()}", null)`.

- [ ] **T427** [P] [US1] Implement `OtpCodeHasher` in `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/Auth/OtpCodeHasher.cs`. Wraps `Microsoft.AspNetCore.Cryptography.KeyDerivation.Pbkdf2` with a per-row random 16-byte salt. Methods `string Hash(string code)` and `bool Verify(string code, string storedHash)`. Stored format: `<base64salt>$<base64hash>`. Used by both Request and Verify use cases.

- [ ] **T428** [US1] Implement `RequestOtpUseCase` in `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/Auth/RequestOtpUseCase.cs`. Steps: validate creds via `UserManager.CheckPasswordAsync`, abort with `INVALID_CREDENTIALS` on miss; check `LockoutState` → 403 with payload if active; generate 6-digit code, hash it via `OtpCodeHasher`, persist `PendingOtp`, dispatch via `IOtpTransport`. Emit `login_request` audit. Returns `(pendingId, otpDevice, otpExpiresAt)`.

- [ ] **T429** [US1] Implement `VerifyOtpUseCase` in `Identity.Application/Auth/VerifyOtpUseCase.cs`. Steps: load PendingOtp by id; check ConsumedAt (else OTP_REUSED); check expiry (else OTP_EXPIRED); verify code (else OTP_MISMATCH + IncrementAttempt; if AttemptCount == LockPolicy.MaxFailedAttempts then create LockoutState in same transaction and return 403 ACCOUNT_LOCKED). On success: mark consumed atomically with cookie issuance, return `AuthUser` shape. Emit `login_success` / `login_otp_failed` / `account_locked` audit per outcome.

- [ ] **T430** [US1] Move `LogoutUseCase.cs` from `backend/src/PACademy.Application/Auth/` to `backend/src/Modules/Identity/PACademy.Modules.Identity.Application/Auth/LogoutUseCase.cs`. Update namespace. Update legacy `AuthController` import.

- [ ] **T431** [US1] Move `GetMeUseCase.cs` (or `GetCurrentUserUseCase` — confirm name in legacy) from `PACademy.Application/Auth/` to `Identity.Application/Auth/`. Update namespace.

- [ ] **T432** [US1] Edit `backend/src/PACademy.Api/Controllers/Auth/AuthController.cs`: PRESERVE the existing `Login(...)` action body during cutover (it still hits the legacy `PaDbContext`-backed UserStore via the legacy registration that stays alive until T466; will become 410 GONE in T467); ADD `RequestOtp(...)` POST `/auth/login/request-otp` and `VerifyOtp(...)` POST `/auth/login/verify-otp` calling the new use cases; KEEP `Me(...)` and `Logout(...)` but switch their injected use cases to the moved ones from `Identity.Application` (per T430/T431).

- [ ] **T433** [US1] Implement `OtpExpirySweeper` in `backend/src/PACademy.Api/Hosting/OtpExpirySweeper.cs` — `BackgroundService` running every 5 minutes; `DELETE FROM pending_otps WHERE ExpiresAt < UtcNow - INTERVAL 24 HOURS` (24h grace for forensics). Register in Program.cs via `AddHostedService<OtpExpirySweeper>()`.

- [ ] **T434** [US1] Register `IOtpTransport` selection in `IdentityModule.cs`: read `Configuration:Otp:Transport`, register `InMemoryOtpTransport` when `"InMemory"`, `SmsOtpTransport` when `"Sms"` (the Sms impl arrives in a later spec — for now, register a stub that throws `OtpTransportNotConfiguredException` so non-Dev environments fail loudly at startup).

- [ ] **T435** [US1] Smoke verification (manual): start API in Dev, `curl` request-otp as super_admin, scrape OTP code from API log, `curl` verify-otp, assert AuthUser response matches the cookie-bearing endpoint shape from contracts/auth-api.md. Document the smoke result in PR description.

**Checkpoint**: US1 fully functional. Two-step login round-trips against the GCP DB. Existing single-step `/auth/login` still wired (cutover window).

---

## Phase 4: User Story 4 — Permission-based access control (Priority: P1)

**Goal**: Every authenticated request honours the user's effective permissions with `*` and `resource:*` wildcard support.

**Independent Test**: `super_admin` (perm `*`) can hit any admin endpoint and gets 200. `committee_user` (no `applicants:edit`) can `GET /admin/applicants` (200) but cannot `PATCH /admin/applicants/:id` (403 PERMISSION_DENIED).

### Tests for US4 (write FIRST)

- [ ] **T436** [P] [US4] Unit test matrix `PermissionEvaluatorTests` in `backend/tests/PACademy.Application.Tests/Authorization/PermissionEvaluatorTests.cs`: 50 `(role, required-permission, expected)` cases covering super_admin (always true), exact match, `resource:*` wildcard, deny path, edge cases (empty perms list, malformed required string). Use `[Theory]` + `[InlineData]`.

- [ ] **T437** [P] [US4] Integration test `PermissionWildcardTests.SuperAdmin_AllPass` in `backend/tests/PACademy.Api.Tests/Auth/PermissionWildcardTests.cs`: sign in as super_admin, hit a representative endpoint per resource family (`/admin/cycles`, `/admin/applicants`, `/admin/categories`, `/admin/audit`, `/admin/lookups`); assert all 200.

- [ ] **T438** [P] [US4] Integration test `PermissionWildcardTests.CommitteeUser_DenyEdit` in same file: sign in as committee_user; assert `GET /admin/applicants` returns 200 but `PATCH /admin/applicants/:id` returns 403 with `code: "PERMISSION_DENIED"` and the audit log records the denial.

### Implementation for US4

- [ ] **T439** [US4] Create `PermissionRequirement` (record carrying the required permission string) and `PermissionRequirementHandler : AuthorizationHandler<PermissionRequirement>` in `backend/src/PACademy.Api/Authorization/`. Handler resolves `ICurrentUser`, calls `IPermissionEvaluator.Has(currentUser.Permissions, requirement.Required)`, succeeds or fails. On fail, emit `permission_denied` audit row before returning the failure.

- [ ] **T440** [US4] In `Program.cs`, configure `AuthorizationOptions` with a policy convention: `options.AddPolicy("<auto>", ...)` registered lazily for any policy name containing `:`. Implementation: subclass `IAuthorizationPolicyProvider` to construct a `PermissionRequirement` policy on demand for any name shaped `<resource>:<verb>`. Register the custom provider via `services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>()`.

- [ ] **T441** [US4] Apply `[Authorize(Policy = "<resource>:<verb>")]` attributes to every existing admin controller action across `PACademy.Api/Controllers/Admin/*` and `PACademy.Api/Controllers/Auth/*`. Reference table in `INTEGRATION_HANDOFF.md §5` for the role→permission map. `super_admin` paths get `[Authorize(Policy = "*")]` (or no policy attribute, since `*` covers everything anyway). Each controller action lists exactly one policy.

- [ ] **T442** [US4] Audit emission for `permission_denied` is emitted by the handler (T439). Verify via the test in T438 that the row exists with actor (the authenticated user), target_label (the policy name), outcome `success`, action `permission_denied`.

**Checkpoint**: All admin endpoints honour the permission contract. `committee_user` cannot edit applicants. `super_admin` can do everything. Audit log has `permission_denied` rows for blocked attempts.

---

## Phase 5: User Story 2 — Lock policy management (Priority: P2)

**Goal**: Super-admin tunes lockout thresholds, views locked users, manually unlocks colleagues.

**Independent Test**: As super_admin, `GET /auth/lock-policy` returns the current row; `PATCH /auth/lock-policy {maxFailedAttempts: 7}` persists and the next failed-attempt evaluation uses 7 instead of 5; `GET /auth/lock-policy/locked-users` lists currently-locked users; `POST /auth/lock-policy/unlock {userId: ...}` clears a lock and the user can `request-otp` immediately.

### Tests for US2 (write FIRST)

- [ ] **T443** [P] [US2] Contract test `LockPolicyTests.GetAndPatch` in `backend/tests/PACademy.Api.Tests/Auth/LockPolicyTests.cs`: GET returns 200 + current row; PATCH with valid range returns 200 + updated row; PATCH with out-of-range returns 400 VALIDATION_FAILED with both fields' errors per contracts/lock-policy-api.md.

- [ ] **T444** [P] [US2] Contract test `LockPolicyTests.LockedUsersAndUnlock` in same file: list returns 200 with `items` + `total`; unlock returns 204; unlock for non-locked user returns 404 NOT_FOUND with the variant message.

- [ ] **T445** [P] [US2] Integration test `LockPolicyTests.EndToEnd_TriggerListUnlock`: trigger lockout for a test user (5 wrong codes), assert they appear in the locked-users list, unlock as super_admin, assert subsequent `request-otp` for the same user succeeds.

### Implementation for US2 (parallelisable)

- [ ] **T446** [P] [US2] Implement `GetLockPolicyUseCase` in `Identity.Application/LockPolicy/GetLockPolicyUseCase.cs`. Returns the single row from `LockPolicies`.

- [ ] **T447** [P] [US2] Implement `UpdateLockPolicyUseCase` in `Identity.Application/LockPolicy/UpdateLockPolicyUseCase.cs`. Validate ranges (1-10, 5-120) — throw `ValidationException` with field-level errors on miss. Capture before/after JSON for audit. Emit `lock_policy_updated`.

- [ ] **T448** [P] [US2] Implement `ListLockedUsersUseCase` in `Identity.Application/LockPolicy/ListLockedUsersUseCase.cs`. Joins `LockoutStates` with `SystemUsers` for display fields. Sort by `UnlocksAt ASC`.

- [ ] **T449** [P] [US2] Implement `UnlockUserUseCase` in `Identity.Application/LockPolicy/UnlockUserUseCase.cs`. Atomic: delete `LockoutState` row + `IPendingOtpStore.InvalidateAllForUserAsync(userId)`. Emit `manual_unlock` audit row capturing the deleted LockoutState as `before`. Return 404 NOT_FOUND if user is not locked (or not found).

- [ ] **T450** [US2] Create `LockPolicyController` in `backend/src/PACademy.Api/Controllers/Auth/LockPolicyController.cs`. Routes: `GET /auth/lock-policy`, `PATCH /auth/lock-policy`, `GET /auth/lock-policy/locked-users`, `POST /auth/lock-policy/unlock`. All require `[Authorize(Policy = "*")]` (super_admin only).

- [ ] **T451** [US2] Implement `LockoutAutoUnlockSweeper` in `backend/src/PACademy.Api/Hosting/LockoutAutoUnlockSweeper.cs` — `BackgroundService` running every 1 minute. For each `LockoutState` row where `UnlocksAt < UtcNow`: emit `lockout_auto_cleared` audit, DELETE the row. Register via `AddHostedService<LockoutAutoUnlockSweeper>()`.

- [ ] **T452** [US2] Verify the audit emissions land via the integration test in T445. Confirm `lock_policy_updated` (from T447), `manual_unlock` (from T449), and `lockout_auto_cleared` (from T451) all appear in `audit_entries` for the test scenarios.

**Checkpoint**: Super-admin can tune the policy, list locked users, unlock manually. Auto-unlock sweep runs in the background.

---

## Phase 6: User Story 3 — Officer lookup (Priority: P2)

**Goal**: Admin can pre-fill new SystemUser forms by looking up officers via NID + Officer Code.

**Independent Test**: `GET /v1/officers/lookup?nid=27001010150010&code=OC01000` returns the seeded super_admin's record (in dev with `Stub` source) or the live MOIPASS record (in staging/prod). Unknown pair returns 404 OFFICER_NOT_FOUND. MOIPASS unavailability returns 503 OFFICER_LOOKUP_UNAVAILABLE.

### Tests for US3 (write FIRST)

- [ ] **T453** [P] [US3] Contract test `OfficerLookupTests.HappyPathAndNotFound` in `backend/tests/PACademy.Api.Tests/Auth/OfficerLookupTests.cs`: with `OfficerLookup.Source=Stub` config, look up a seeded user → 200 with the OfficerRecord shape from contracts/officers-api.md; look up unknown pair → 404 OFFICER_NOT_FOUND; bad NID format → 400 VALIDATION_FAILED.

- [ ] **T454** [P] [US3] Integration test `OfficerLookupTests.MoipassCircuitOpen_Returns503`: register a deliberately-broken `IOfficerLookup` mock that always throws; assert the endpoint returns 503 OFFICER_LOOKUP_UNAVAILABLE after the circuit breaker opens (5 failures in 30s). Use `Polly` test extensions to advance the circuit state.

### Implementation for US3 (parallelisable)

- [ ] **T455** [P] [US3] Implement `StubOfficerLookup` in `backend/src/Modules/Identity/PACademy.Modules.Identity.Infrastructure/Officers/StubOfficerLookup.cs`. Reads from `IdentityDbContext.SystemUsers`; maps to `OfficerRecord`. Returns null when no row matches; never throws.

- [ ] **T456** [P] [US3] Implement `MoipassOfficerLookup` in `Identity.Infrastructure/Officers/MoipassOfficerLookup.cs`. Wraps `IHttpClientFactory`-issued `HttpClient`. Polly resilience pipeline per research.md R0.3: 2s timeout, 2 retries with backoff (200ms/400ms), circuit breaker (5 failures / 30s, 60s half-open). Throws `OfficerLookupUnavailableException` when circuit is open or timeout exceeded. Maps MOIPASS response shape to `OfficerRecord`.

- [ ] **T457** [P] [US3] Implement `LookupOfficerUseCase` in `Identity.Application/Officers/LookupOfficerUseCase.cs`. Calls `IOfficerLookup`. Catches `OfficerLookupUnavailableException` → returns 503 path. Returns null record → 404 path. Emits `officer_looked_up` audit on every call (success/not_found/upstream_unavailable).

- [ ] **T458** [US3] Wire `IOfficerLookup` selection in `IdentityModule.cs` based on `Configuration:OfficerLookup:Source ∈ { "Stub", "MOIPASS" }`. Throw at startup if `MOIPASS` is selected but `BaseUrl` or `ApiKey` is missing — fail loud per quickstart.md.

- [ ] **T459** [US3] Add validation: in non-Development environments, refuse to start if `Source == "Stub"` (guard against shipping the stub to production by config mistake). Throw `InvalidOperationException` with a clear message.

- [ ] **T460** [US3] Create `OfficersController` in `backend/src/PACademy.Api/Controllers/Auth/OfficersController.cs`. Single action `GET /v1/officers/lookup?nid={nid}&code={code}`. `[Authorize(Policy = "users:create")]`. Validate `nid` format with FluentValidation (14 digits) before calling the use case.

- [ ] **T461** [US3] Verify the audit emission via T453's tests. Confirm `officer_looked_up` rows have appropriate `outcome` field (`success`/`not_found`/`upstream_unavailable`) and `target_label = "{nid}/{code}"`.

**Checkpoint**: Admin can look up officers in dev (against seeded users) and in staging/prod (against MOIPASS sandbox). Resilience covers the upstream-down case cleanly.

---

## Phase 7: Polish & Cutover

**Purpose**: Remove the legacy registration, retire the legacy endpoint, run the cutover sequence end-to-end.

### Architecture guard test

- [ ] **T462** [Cutover] Add `RegistrationOverlapTests.OnlyOneIUserStoreRegistered` to `backend/tests/PACademy.Architecture.Tests/`. Build a service collection from `Program.cs`'s configuration, count `IUserStore<SystemUser>` registrations, assert exactly 1. Permanent guard against the bug class we hit live in spec 005.

### Cutover steps (run in this order)

- [ ] **T463** [Cutover] Run quickstart.md **Step 1** — Deploy with both endpoints active (legacy `/auth/login` + new request-otp/verify-otp). Verify: `curl /auth/login` works AND `curl /auth/login/request-otp` works.

- [ ] **T464** [Cutover] Run quickstart.md **Step 2** — Apply the new EF migration to staging/prod via `dotnet ef database update --context IdentityDbContext`. Verify the 3 new tables exist + `lock_policy` is seeded.

- [ ] **T465** [Cutover] Run quickstart.md **Step 3** — Frontend canary monitoring. Tail backend access log for ≥4 hours; assert zero traffic on legacy `POST /auth/login`. Document the result.

- [ ] **T466** [Cutover] Run quickstart.md **Step 4** — Remove legacy registration AND the legacy configuration copies that T404/T405 left behind. Two file edits in the same commit:
  1. Edit `backend/src/PACademy.Infrastructure/DependencyInjection.cs`: delete the entire `services.AddIdentity<SystemUser, IdentityRole<Guid>>().AddEntityFrameworkStores<PaDbContext>()` block.
  2. Delete `backend/src/PACademy.Infrastructure/Persistence/Configurations/SystemUserConfiguration.cs` and `backend/src/PACademy.Infrastructure/Persistence/Configurations/SessionConfiguration.cs` (the legacy copies left in place by T404/T405). PaDbContext no longer needs `system_users` mapping because nothing routes UserManager queries through it anymore — IdentityDbContext owns that surface from this commit forward.

  **This closes spec 005's deferred T326** and completes the configuration migration started in T404/T405.

- [ ] **T467** [Cutover] Make legacy `AuthController.Login(...)` return HTTP 410 GONE with body `{"code":"DEPRECATED","message":"Use /auth/login/request-otp + /auth/login/verify-otp"}` per contracts/auth-api.md. Redeploy.

- [ ] **T468** [Cutover] Run quickstart.md **Step 5** — All-roles smoke test. Sign in as each of the 11 seeded role users via the new flow; assert hub loads with role-appropriate apps and the `permissions` array matches `INTEGRATION_HANDOFF.md §5`.

### Cleanup

- [ ] **T469** [P] [Cutover] Update `CLAUDE.md` §15 (Backend Architecture) to mark spec 007 complete. Add a §15.1 sub-section listing the auth contract surface (request-otp, verify-otp, lock-policy, officer-lookup) for future-Claude orientation.

- [ ] **T470** [P] [Cutover] Update `specs/005-modular-monolith/tasks.md` to mark T326 as `[X]` with a footnote `(closed by spec 007 T466)`. Closes the deferred task chain.

- [ ] **T471** [P] [Cutover] Run `dotnet format` over the whole solution. Run `dotnet test --filter "Category!=LongRunning"`. PR all green.

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
    ├── Phase 3 (US1: Two-step OTP login)        ┐
    │                                            ├── parallel after Foundational
    └── Phase 4 (US4: Permission-based access)   ┘
            ↓
            ├── Phase 5 (US2: Lock policy)       ┐
            │                                    ├── parallel after US1
            └── Phase 6 (US3: Officer lookup)    ┘
                    ↓
                Phase 7 (Polish & Cutover)
```

### User story dependencies

- **US1** depends on Foundational only.
- **US4** is structurally independent of US1 (the PermissionEvaluator is pure logic), but its integration tests need US1 in place to obtain a session cookie. Implementation is parallelisable; tests serialize.
- **US2** and **US3** depend on Foundational and benefit from US1 being live for end-to-end testing (lockout is exercised through the OTP flow). Implementation is parallel.

### Within each user story

- Tests MUST be written and FAIL before implementation (Constitution II).
- Domain entity → application abstraction → application use case → infrastructure adapter → controller wiring is the standard order within each story.
- The cutover phase serializes: T462 (architecture guard) → T463–T468 (cutover steps in strict order) → T469–T471 (cleanup, parallel).

---

## Parallel execution examples

### Phase 2 (Foundational) — entity scaffolding parallelisable after T404/T405

Once T404 and T405 (configuration moves) complete, T406, T407, T408 (3 new domain entities) parallelise. After those, T409, T410, T411 (3 EF configurations) parallelise. T415–T418 (4 application abstractions) parallelise. The serial spine is `T404/T405 → T406-T408 → T409-T411 → T412 → T413 → T414 → T420`.

### Phase 3 (US1) — tests, then implementation

6 test tasks (T421–T425 + T425a) parallelise. Once they're red, T426 + T427 (transport + hasher) parallelise. T428 + T429 (use cases) parallelise after T427. T430 + T431 (move legacy use cases) parallelise. T432–T434 serialize (controller, sweeper, transport selection).

### Phase 4 (US4) — pure-logic test parallelism

T436 (unit test matrix) + T437/T438 (integration tests) all parallel. T439 + T440 (handler + provider) parallel; T441 (apply attributes) is sequential because it touches every controller. T442 verifies after.

### Phase 7 (Cutover) — strict serial

T462 first (architecture guard). T463 → T464 → T465 → T466 → T467 → T468 STRICTLY in order — this is the cutover sequence and shortcuts cause incidents. T469 + T470 + T471 parallelise as the cleanup tail.

---

## Implementation Strategy

> Operator's full guide for the cutover lives in [quickstart.md](./quickstart.md). This section covers ordering and parallelisation only.

**MVP cut**: T400–T435 (Setup + Foundational + US1). Two-step staff login works against the GCP DB. Without US4, all admin endpoints stay open to anyone signed in — fine for a controlled demo with only super_admin signed in, but ship US4 before any other role hits the system.

**Full Spec 007**: T400–T471. All four user stories shipped + cutover complete + legacy registration removed.

**Parallelisation map**: Within each phase, tests are mostly `[P]`. The Foundational entity/abstraction tasks parallelise heavily (3 entities × 3 EF configs × 4 abstractions = 10 parallel-safe tasks). The cutover serializes by design.

**Story independence**: US1 and US4 are P1 and ship together. US2 and US3 are P2 and ship after — they don't depend on each other and parallelise once US1 is in. None of US2/US3/US4 *implementation* depends on US1 implementation; only their *tests* need a working US1.

---

## Risks (mirrored from plan.md, monitored here)

| Risk | Mitigation | Tracked |
|---|---|---|
| R1 — Live auth break during cutover | Side-by-side running of legacy + new auth (T420 keeps both); frontend canary monitoring (T465) before legacy removal (T466) | quickstart.md cutover sequence |
| R2 — `IUserStore<SystemUser>` registered twice | T420 explicitly leaves the legacy registration alive; T462 architecture test asserts exactly 1 after cutover | quickstart.md "common failure modes" |
| R3 — SMS vendor not selected, OTP doesn't deliver in staging/prod | `InMemoryOtpTransport` for dev; `SmsOtpTransport` registration throws at startup if vendor config missing — fail loud, not silent drop | T426, T434 |
| R4 — MOIPASS sandbox not provisioned | `StubOfficerLookup` for dev; T459 refuses to ship Stub to non-Development; D-004 in spec.md tracks the upstream dependency | spec.md D-004 |
| R5 — Permission attribute not applied to a controller action | T441 is an exhaustive sweep; T438 integration test catches missing coverage on `PATCH /admin/applicants/:id` specifically; production audit log surfaces missed denials as missing rows on `permission_denied` | T441, T438 |

---

## Done definition

A PR titled `feat(007): auth + RBAC integration` passes when:

1. All 4 user stories' acceptance scenarios pass.
2. SC-001 through SC-007 from spec.md are objectively green in CI.
3. No `--no-verify` on the merge commit.
4. Every existing test passes (regression).
5. `frontend/` is untouched.
6. CLAUDE.md §15.1 reflects the new auth contract surface.
7. Spec 005's T326 is marked `[X]` (closed by T466).
8. The cutover sequence (T463–T468) is documented as run with timestamps in the PR description.
