---

description: "Tasks for spec 003 — Admin sign-in + RBAC + user provisioning"
---

# Tasks: Admin Sign-in + RBAC + User Provisioning

**Input**: Design documents from [`specs/003-admin-auth-rbac/`](./)
**Prerequisites**: [spec.md](./spec.md) (clarified), [plan.md](./plan.md)

**Tests**: Per Constitution II (NON-NEGOTIABLE), test tasks below are MANDATORY. Auth code paths require **100% coverage** (statements + branches). Live network is forbidden — MSW intercepts all `/auth/*` and `/admin/users/*` calls in component tests; backend integration tests use Testcontainers.MsSql against a real SQL Server.

**Numbering**: tasks continue from spec 002's last task (T137). This spec's range is **T138–T192**.

**Format**: `[ID] [P?] [Story] Description`

- **[P]** — can run in parallel (different files, no dependency on tasks ahead)
- **[Story]** — `Foundation` / `US1` / `US2` / `US3` / `US4` / `US5` / `Polish`

---

## Phase 1: Setup

Most tooling is already in place from spec 002. One delta required:

- [ ] **T138** [P] [Foundation] Extend `e2e/tests/fixtures/auth.ts` so the Playwright auth fixture accepts an arbitrary role + credentials and signs in via real `POST /auth/login` against the test API container. Currently only super-admin sign-in is wired (per spec 002 T038). New helper signature: `signInAs(page, { nationalId, password, role })`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: apply the four clarify-pass decisions to the existing auth draft (`d860b91`) and register the full RBAC policy matrix. Every user story below assumes these are in place.

**⚠️ CRITICAL**: No US1–US5 tasks may begin until this phase is complete.

- [ ] **T139** [Foundation] Extend `IIdentityProvider.AuthenticateAsync` (`backend/src/PACademy.Application/Identity/IIdentityProvider.cs`) to return a richer failure reason. Replace `bool Succeeded` with an enum `AuthenticationOutcome { Success, InvalidCredentials, ArchivedOrDeactivated, Locked }`. Update `InSystemIdentityProvider` (`backend/src/PACademy.Infrastructure/Identity/InSystemIdentityProvider.cs`) to return the discriminated failure path. **Reason**: FR-A09 audit policy requires the controller to know which 401 path fired so it can audit only the archived/deactivated case.

- [ ] **T140** [Foundation] Modify `LoginUseCase` (`backend/src/PACademy.Application/Auth/LoginUseCase.cs`) to enforce FR-A07 single-session invariant. Wrap the body in `IDbContextTransaction` with `IsolationLevel.Serializable`; revoke every active session for `auth.UserId` (reason `superseded_by_new_login`); insert the new session row; commit. Use case signature unchanged.

- [ ] **T141** [Foundation] Modify `LogoutUseCase` (`backend/src/PACademy.Application/Auth/LogoutUseCase.cs`) to enforce FR-A08 all-sessions revoke. Change parameter from `Guid sessionId` to `Guid userId`. Revoke every `Sessions` row where `UserId == userId AND RevokedAt IS NULL` (reason `user_logout`). Update `AuthController.Logout` caller accordingly.

- [ ] **T142** [Foundation] Modify `AuthController.Login` (`backend/src/PACademy.Api/Controllers/Auth/AuthController.cs`) to enforce FR-A09 audit policy. On `Success` → emit `IAuditWriter.RecordAsync(AuditAction.Login, "user", userId, fullName, AuditOutcome.Success)`. On `ArchivedOrDeactivated` → emit `outcome=PermissionDenied` with the same target. On `InvalidCredentials` → no audit entry (lockout counter handles brute-force tracking). All three failure outcomes still return 401 with the same generic Arabic body to prevent enumeration.

- [ ] **T143** [Foundation] Register the full RBAC policy matrix in `backend/src/PACademy.Infrastructure/DependencyInjection.cs` (replaces the single Phase-3 carve-out for `AppAccess:admin`). Register one `AppAccess:<key>` policy per app key (`admin`, `committee`, `board`, `investigations`, `medical`, `barcode`, `biometric`, `exams`, `applicant`, `architecture`) — each `RequireAuthenticatedUser().RequireClaim("apps", "<key>")` — plus one `Role:<role>` policy for each of the 11 RBAC roles in `RoleApps.cs`. **Spec 002 cross-ref: T065.**

- [ ] **T144** [Foundation] Apply `[Authorize(Policy = "AppAccess:<key>")]` to every existing staff controller per the CLAUDE.md §5 table. Currently `AdminApplicantsController` is the only one wired (spec 002 Phase 3 carve-out). This task adds the attribute to every other controller as it ships in subsequent specs (no controllers exist yet for committee/board/investigations/medical/barcode/biometric/exams) — so for THIS spec the only wiring is the new `AdminUsersController` (T167) which uses `Role:super_admin`. Document the rule in [CLAUDE.md §5](../../CLAUDE.md#5-rbac--11-roles) so future specs follow it.

**Checkpoint**: clarify-pass deltas applied. All US1–US5 phases can begin in parallel.

---

## Phase 3: User Story 1 — Operator signs in and is restricted to their apps (P1) 🎯 MVP

**Goal**: Replace the demo role-picker with real cookie-based auth. Operators sign in with their NID + password, land on `/hub`, and only see/access apps their role grants.

**Independent Test**: Provision two users with different roles. Sign in as each. Verify hub + sidebar contents differ; deep-link to unauthorized app → 403; logout in browser A while signed in on browser B revokes both sessions per FR-A08.

### Tests for User Story 1 (write FIRST — must fail before T139–T142 implementation lands)

- [ ] **T145** [P] [US1] Backend integration test — full happy path: `POST /auth/login` (valid super_admin) → 200 + `pa-session` cookie (HttpOnly, SameSite=Strict) + `LoginResponse` body. Then `GET /auth/me` with the cookie → 200 + same body shape. In `backend/tests/PACademy.Api.Tests/Auth/LoginAndMeTests.cs`. **Spec 002 cross-ref: T052.**

- [ ] **T146** [P] [US1] Backend integration test — failure paths per FR-A05/A09: (a) wrong-format NID → 400 with field-specific validation errors; (b) valid NID + wrong password → 401, **no audit entry**, `AccessFailedCount` incremented; (c) archived account → 401 + audit entry with `action=login, outcome=permission-denied`; (d) deactivated account → same as archived. In `backend/tests/PACademy.Api.Tests/Auth/LoginValidationTests.cs`. **Spec 002 cross-ref: T053.**

- [ ] **T147** [P] [US1] Backend integration test — single-session invariant (SC-A08). Spawn 1000 parallel `POST /auth/login` requests for the same user via `Parallel.ForEachAsync(degreeOfParallelism: 32)`. Assert every response is 200 (no deadlocks under Serializable isolation), AND `SELECT COUNT(*) FROM Sessions WHERE UserId = @uid AND RevokedAt IS NULL` returns exactly 1 at end. Tag `[Trait("Category","Heavy")]`. In `backend/tests/PACademy.Api.Tests/Auth/SingleSessionInvariantTests.cs`.

- [ ] **T148** [P] [US1] Backend integration test — FR-A08 logout revokes ALL sessions. Login the same user from two synthetic devices (different cookie jars). From device A `POST /auth/logout`. Assert: device A request returns 204; device B's next `GET /auth/me` returns 401 with `code: SESSION_REVOKED`; both `Sessions` rows have `RevokedReason = 'user_logout'`. In `backend/tests/PACademy.Api.Tests/Auth/LogoutAllSessionsTests.cs`.

- [ ] **T149** [P] [US1] Backend integration test — RBAC enforcement: a `committee_user` (no `admin` app) `GET /admin/applicants` returns 403, an `IIdentityProvider.AuthenticateAsync` integration audit entry exists with `outcome=permission-denied`. In `backend/tests/PACademy.Api.Tests/Authorization/AppAccessPolicyTests.cs`.

- [ ] **T150** [P] [US1] Frontend Vitest — `frontend/src/features/auth/components/LoginForm.test.tsx`: NID field renders with 14-digit `inputMode="numeric"` and `dir="ltr"`; submit disabled when invalid; idle → loading → success transitions render the right copy; on 401 the form shows the generic Arabic error without leaking which path failed; jest-axe assertion. **Spec 002 cross-ref: T058.**

- [ ] **T151** [P] [US1] Frontend Vitest — `frontend/src/shared/components/SessionExpiredBanner.test.tsx`: subscribes to `sessionExpiredBus`, renders re-login prompt when fired, focus trap on the prompt, escape clears banner without losing route state, jest-axe assertion.

- [ ] **T152** [P] [US1] Playwright E2E — `e2e/tests/us1-rbac.spec.ts`: in two browser contexts, sign in as super_admin and committee_user simultaneously; assert each hub renders the correct app cards; assert deep-link to `/admin/applicants` from committee_user redirects to `/hub` with toast; assert logout from one device 401s the other.

### Implementation for User Story 1

The use cases + controller are already drafted in `d860b91`; the foundational tasks (T139–T142) close the clarify-pass gaps. No additional implementation work for US1 backend.

- [ ] **T153** [US1] Frontend wiring check — verify `<SessionExpiredBanner />` is mounted at app root in `frontend/src/App.tsx` and subscribes to `sessionExpiredBus` (already exposed by `frontend/src/shared/api/client.ts`). Add the mount if missing.

**Checkpoint**: US1 is deployable as MVP. Real auth replaces the role-picker. RBAC enforced at the controller.

---

## Phase 4: User Story 2 — Super-admin provisions a new operator (P1)

**Goal**: Ship `/admin/users` CRUD so a super-admin can create, list, view, edit, and deactivate operators without DB access.

**Independent Test**: Sign in as super_admin → POST `/admin/users` with valid committee_admin payload → see new user in `GET /admin/users` → sign out → sign in as the new user → land on hub showing `[admin, committee, barcode, biometric]`.

### Tests for User Story 2 (write FIRST)

- [ ] **T154** [P] [US2] Backend integration test — happy path provisioning. Super_admin POSTs a valid `CreateSystemUserRequest` → 201 + `SystemUserDetailDto`; verify audit entry `action=create, target=user/{id}`; verify `GET /admin/users` returns the new row. In `backend/tests/PACademy.Api.Tests/Admin/Users/ProvisioningTests.cs`. **Spec 002 cross-ref: T054.**

- [ ] **T155** [P] [US2] Backend test — validation paths: (a) duplicate national ID → 422 + `code: NATIONAL_ID_TAKEN`; (b) malformed NID → 400; (c) password not meeting `RequiredLength=8 + RequireDigit` → 400; (d) duplicate email → 422 + `code: EMAIL_TAKEN`. In `backend/tests/PACademy.Api.Tests/Admin/Users/ValidationTests.cs`.

- [ ] **T156** [P] [US2] Backend test — RBAC: a `committee_admin` (not super_admin) POSTs `/admin/users` → 403 + permission-denied audit entry. In `backend/tests/PACademy.Api.Tests/Admin/Users/RbacTests.cs`.

- [ ] **T157** [P] [US2] Backend test — list pagination + filters: `GET /admin/users?role=committee_admin&q=...&page=2&pageSize=10` returns 200 with `X-Total-Count` + `X-Page-Count` headers. In `backend/tests/PACademy.Api.Tests/Admin/Users/ListPagingTests.cs`.

- [ ] **T158** [P] [US2] Backend test — FR-C06 role-change session revocation. Sign in user X. Super_admin PATCHes X.Role from `committee_user` → `committee_admin`. Verify: 200 response; X's `Sessions` row marked `revoked` (reason `role_changed`); X's next request returns 401 `SESSION_REVOKED`; PATCHing X.Mobile (no role change) does NOT revoke sessions. In `backend/tests/PACademy.Api.Tests/Admin/Users/RoleChangeRevokesSessionsTests.cs`.

- [ ] **T159** [P] [US2] Frontend Vitest — `frontend/src/features/admin/pages/UsersPage.test.tsx`: DataTable renders 11 seeded users + pagination; filter chips update URL search params; row click navigates to detail; jest-axe assertion. **Spec 002 cross-ref: T059.**

- [ ] **T160** [P] [US2] Frontend Vitest — `frontend/src/features/admin/pages/UsersCreatePage.test.tsx`: form validates each FR-029/FR-030 field client-side; submit-disabled until valid; mutation flows through idle → loading → success → toast → navigate to list; failure case preserves form values + announces error to AT.

- [ ] **T161** [P] [US2] Playwright E2E — `e2e/tests/us2-provisioning.spec.ts`: super_admin signs in → opens `/admin/users` → submits create form → signs out → signs in as new user → lands on hub showing 4 apps. **Spec 002 cross-ref: T060.**

### Implementation for User Story 2

DTOs (parallel; one file each):

- [ ] **T162** [P] [US2] `backend/src/PACademy.Contracts/Admin/Users/SystemUserListItemDto.cs` — narrow shape for list rendering: `Id, NationalId, FullName, Role, Mobile, Email, Unit, IsActive, CreatedAt, DemoOrigin`.

- [ ] **T163** [P] [US2] `backend/src/PACademy.Contracts/Admin/Users/SystemUserDetailDto.cs` — full read model adding `OfficerCode, IssueDate, CardFactoryNumber, ArchivedAt?, LastModifiedBy?, LastModifiedAt?`.

- [ ] **T164** [P] [US2] `backend/src/PACademy.Contracts/Admin/Users/CreateSystemUserRequest.cs` — write model: every FR-029/FR-030 field plus `Password`. **`Password` MUST never appear in any response DTO.**

- [ ] **T165** [P] [US2] `backend/src/PACademy.Contracts/Admin/Users/UpdateSystemUserRequest.cs` — patch model: nullable fields for `FullName, Mobile, Email, Unit, Role` (every other field is immutable post-creation).

- [ ] **T166** [P] [US2] `backend/src/PACademy.Contracts/Admin/Users/SystemUserListFilters.cs` — `(string? Role, string? Q, bool? IsActive, int Page, int PageSize, string? SortBy, string? SortDir)`.

Application layer (mostly parallel; share `IPaDbContext`):

- [ ] **T167** [P] [US2] `backend/src/PACademy.Application/Admin/Users/CreateSystemUserValidator.cs` — FluentValidation rules per FR-029/FR-030. NID matches `^\d{14}$` and parses via `EgyptianNationalIdParser`; password meets Identity rules; email RFC valid; mobile matches Egyptian mobile pattern; role in `RoleApps.AllRoles`.

- [ ] **T168** [P] [US2] `backend/src/PACademy.Application/Admin/Users/ListSystemUsersUseCase.cs` — paginated, filterable, sortable list. Mirror `ListApplicantsUseCase` pattern from spec 002.

- [ ] **T169** [P] [US2] `backend/src/PACademy.Application/Admin/Users/GetSystemUserUseCase.cs` — single-user read returning `SystemUserDetailDto`.

- [ ] **T170** [P] [US2] `backend/src/PACademy.Application/Admin/Users/CreateSystemUserUseCase.cs` — calls `IIdentityProvider.CreateUserAsync` (already exists) and audit-records `action=create`. Wraps in transaction so audit + user creation succeed-or-fail together.

- [ ] **T171** [US2] `backend/src/PACademy.Application/Admin/Users/UpdateSystemUserUseCase.cs` — implements **FR-C06**: capture `prevRole = entity.Role` before applying patch; if `req.Role != null && req.Role != prevRole`, revoke every active `Sessions` row for the user (reason `role_changed`) inside the same transaction. Audit-records `action=update` with before/after role diff.

API layer:

- [ ] **T172** [US2] `backend/src/PACademy.Api/Controllers/Admin/AdminUsersController.cs` — wire 5 endpoints: `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users`, `PATCH /admin/users/{id}`, plus the deactivate endpoint stubbed (filled in by US3 / US4). All guarded by `[Authorize(Policy = "Role:super_admin")]`. `X-Total-Count` + `X-Page-Count` on the list response per spec 002 plan Constitution Check IV mitigation. **Spec 002 cross-ref: T064 (Admin Users half).**

- [ ] **T173** [US2] DI registration in `backend/src/PACademy.Infrastructure/DependencyInjection.cs` — add `services.AddScoped<{List,Get,Create,Update,Deactivate}SystemUserUseCase>()` + `services.AddScoped<IValidator<CreateSystemUserRequest>, CreateSystemUserValidator>()`.

Frontend:

- [ ] **T174** [US2] `frontend/src/features/admin/api/users.service.ts` — swap method bodies for `list`, `get`, `create`, `update`, `deactivate` from `MOCK + simulateLatency()` to `apiClient.{get,post,patch}('/admin/users…')`. Keep `userKeys` factory unchanged. **Spec 002 cross-ref: T067.**

- [ ] **T175** [US2] `frontend/src/features/admin/pages/UsersPage.tsx` — render server data via `useUsers()`; add filter chips for role + active/inactive; reuse `DataTable<SystemUserListItemDto>`. RTL-correct, design-token-only.

- [ ] **T176** [US2] `frontend/src/features/admin/pages/UsersCreatePage.tsx` — react-hook-form + shared zod schema; `Drawer` shell; error mapping from server validation problem-detail to per-field errors.

- [ ] **T177** [US2] `frontend/src/features/admin/pages/UsersDetailPage.tsx` — read-only view + edit-in-place via PATCH; deactivate button (confirm modal) wired to US3's mutation.

**Checkpoint**: US2 deployable. Super-admin can provision operators end-to-end via the SPA.

---

## Phase 5: User Story 3 — Super-admin deactivates an operator (P1)

**Goal**: A `POST /admin/users/{id}/deactivate` flips `IsActive=false`, revokes all of that user's sessions, and surfaces an Arabic confirmation in the SPA.

**Independent Test**: User X signed in on device A. Super_admin deactivates X from device B. Refresh on A → 401 `SESSION_REVOKED`. X's next login attempt → 401 `INVALID_CREDENTIALS` (no leak).

### Tests for User Story 3 (write FIRST)

- [ ] **T178** [P] [US3] Backend test — happy path: super_admin POSTs `/admin/users/{id}/deactivate` → 204; user's `IsActive=false`, `ArchivedAt=null` (deactivation is reversible flag, not soft-delete); every active session revoked with `reason=account_deactivated`; audit entry `action=deactivate`. In `backend/tests/PACademy.Api.Tests/Auth/DeactivationImmediateTests.cs`. **Spec 002 cross-ref: T055.**

- [ ] **T179** [P] [US3] Backend test — propagation: deactivated user X's pre-deactivation cookie replay returns 401 `SESSION_REVOKED` on the very next request (not after some delay). Tests `SessionMiddleware`'s short-circuit.

- [ ] **T180** [P] [US3] Backend test — login lockout-by-deactivation: deactivated user attempts `POST /auth/login` with valid password → 401 `INVALID_CREDENTIALS` (NOT a different code that would leak the deactivation status). Verifies FR-A05.

### Implementation for User Story 3

- [ ] **T181** [US3] `backend/src/PACademy.Application/Admin/Users/DeactivateSystemUserUseCase.cs` — atomic: load user → set `IsActive=false` → revoke every active `Sessions` row (`reason=account_deactivated`) → audit-write → SaveChanges. Check super-admin floor BEFORE mutating (US4's responsibility, but the use case carries the call).

- [ ] **T182** [US3] Wire `DeactivateSystemUserUseCase` into `AdminUsersController.Deactivate` (the stub from T172). Returns 204 on success.

- [ ] **T183** [US3] Frontend deactivate UX — confirmation modal in `UsersDetailPage.tsx` and row action in `UsersPage.tsx`. Modal copy in Arabic, destructive style, requires explicit confirmation click. Surface server's `code: SUPER_ADMIN_FLOOR_BLOCKED` error from US4 with a tailored Arabic toast.

**Checkpoint**: US3 deployable. Operator off-boarding works end-to-end.

---

## Phase 6: User Story 4 — Super-admin floor (P1)

**Goal**: Block self-deactivation when the actor is the only active super-admin. Audit the block.

**Independent Test**: Single super_admin self-deactivates → 403 `SUPER_ADMIN_FLOOR_BLOCKED`. Add a second super_admin → first can self-deactivate → 204. Attempt to deactivate the last → 403.

### Tests for User Story 4 (write FIRST)

- [ ] **T184** [P] [US4] Backend test — sole super_admin self-deactivation: 403 + `code: SUPER_ADMIN_FLOOR_BLOCKED` + audit `outcome=permission-denied` + user remains active. In `backend/tests/PACademy.Api.Tests/Auth/SuperAdminFloorTests.cs`. **Spec 002 cross-ref: T056.**

- [ ] **T185** [P] [US4] Backend test — two super_admins: first self-deactivates → 204; second's attempt to self-deactivate → 403 (last super-admin standing).

- [ ] **T186** [P] [US4] Backend property-based test — `SuperAdminFloorPolicy` invariant holds across **1000 randomized deactivation orderings** (SC-A04). Use `FsCheck.Xunit` or hand-rolled randomized harness with `seed=42` for determinism.

- [ ] **T187** [P] [US4] Playwright E2E — `e2e/tests/us4-super-admin-floor.spec.ts`: in single-super-admin DB, super_admin opens own detail page → click Deactivate → modal → confirm → toast surfaces `SUPER_ADMIN_FLOOR_BLOCKED` Arabic error → super_admin remains active. **Spec 002 cross-ref: T061.**

### Implementation for User Story 4

- [ ] **T188** [US4] Wire `SuperAdminFloorPolicy.Check(targetUserId, dbContext)` into `DeactivateSystemUserUseCase` (T181). Throw `UnauthorizedAccessException("SUPER_ADMIN_FLOOR_BLOCKED")` when the policy refuses. Map this exception in `GlobalExceptionMiddleware` to `403 + code: SUPER_ADMIN_FLOOR_BLOCKED + permission-denied audit`. **Reason for `UnauthorizedAccessException` (mapped to 403) instead of `DomainConflictException` (mapped to 422)**: spec 002 plan reconciliation note line 166 of its tasks.md mandates 403 for super-admin-floor specifically — it's a permission decision (only "another super-admin can do this"), not a domain rule violation.

**Checkpoint**: US4 deployable. The platform cannot be bricked by a single misclick or malicious super-admin.

---

## Phase 7: User Story 5 — Failed-login lockout (P2)

**Goal**: Verify ASP.NET Identity's lockout primitives (already wired in `DependencyInjection`) behave as spec'd.

**Independent Test**: 5 wrong-password attempts → user locked. Correct password during lockout → still 401. After 5 minutes (or fast-forward in test) → correct password succeeds.

### Tests for User Story 5

- [ ] **T189** [P] [US5] Backend integration test — lockout trigger: 5 consecutive wrong-password `POST /auth/login` for a valid NID → all 401, `User.AccessFailedCount = 5`, `User.LockoutEnd ≈ now + 5 min`. In `backend/tests/PACademy.Api.Tests/Auth/LockoutTests.cs`.

- [ ] **T190** [P] [US5] Backend integration test — locked-out account rejects correct password: during lockout window, `POST /auth/login` with the *correct* password returns 401 (NOT 200). Audit entry `outcome=permission-denied`. After advancing test clock past `LockoutEnd`, correct password succeeds.

### Implementation for User Story 5

No code changes — lockout is configured in `DependencyInjection.cs:43-45`. T189–T190 verify the existing wiring matches spec.

**Checkpoint**: US5 verified.

---

## Phase 8: Polish

- [ ] **T191** [P] [Polish] OpenAPI snapshot — capture `/openapi/v1.json` after the API rebuilds with new endpoints; split + commit as `specs/003-admin-auth-rbac/contracts/auth.openapi.yaml` and `specs/003-admin-auth-rbac/contracts/admin-users.openapi.yaml`. Add a CI job (`backend/scripts/check-openapi-drift.ps1`) that fails the build when the live doc and committed snapshot diverge.

- [ ] **T192** [P] [Polish] Coverage check — run `dotnet test --collect:"XPlat Code Coverage"` and `vitest --coverage` after merge. Confirm 100% on auth code paths (`PACademy.Application.Auth.*`, `PACademy.Application.Admin.Users.*`, `frontend/src/features/auth/`, `frontend/src/features/admin/api/users.*`). Block PR if coverage drops below thresholds.

- [ ] **T193** [P] [Polish] Lighthouse CI — run against `/admin/users` and `/admin/users/new`. Verify perf ≥ existing baseline minus 5pt; a11y ≥ 100. Block PR on regression > 5pt per Constitution IV.

- [ ] **T194** [P] [Polish] Update [`CLAUDE.md` §5](../../CLAUDE.md#5-rbac--11-roles) — add `/admin/users` rows to the route table, marked `Role:super_admin`. Add `/auth/login`, `/auth/logout`, `/auth/me` to the PUBLIC + STAFF auth section.

- [ ] **T195** [Polish] Tick-back to spec 002 tasks.md — mark T032, T033, T034 as `[x]` (already done); reference `d860b91` and this spec on T052–T067 lines so reviewers can trace.

- [ ] **T196** [Polish] Pre-commit hook baseline cleanup so spec 003's first non-bypassed merge stops triggering --no-verify. Two sub-tasks (parallel-safe — different file sets):
  - **a.** Run `npx eslint --fix frontend/src/` and review the diff. Anything not auto-fixable is fixed by hand. Re-run `npm run lint` until clean. Frontend portion of pre-commit hook now passes.
  - **b.** Run `dotnet format` against the entire backend solution. Whitespace-only diff. Backend portion of pre-commit hook now passes. (Drops the `--no-verify` requirement called out in plan.md Complexity Tracking #1.)

- [ ] **T197** [Polish] Constitution feedback — document phase-4 lessons learned for the next constitution amendment: (a) cookie-scheme mismatch (d860b91) and CSRF decode (d53e4d5) are bug classes worth a dedicated test pattern, (b) audit-on-every-401 vs. audit-on-archived-only is a project-policy decision worth surfacing, (c) single-session vs. multi-session is similar. Keep notes in `docs/constitution-amendments-pending.md` (create if absent).

---

## Implementation Strategy

**MVP cut**: T138–T153 (Phase 1 + Phase 2 + Phase 3). Real auth replaces the role-picker, RBAC is enforced, the existing `/admin/applicants` is properly gated. Deployable on its own — addresses the most urgent security gap.

**Full Phase 4**: T138–T197. All P1 stories shipped + P2 lockout verified + polish.

**Parallelization map**: within each phase, every test file (T145–T152, T154–T161, T178–T180, T184–T187, T189–T190) is `[P]` — they touch separate files and have no dependencies. Backend DTO files (T162–T166) are `[P]`. Use case files (T167–T170) are `[P]`. Frontend page files (T175–T177) are `[P]`. The serial spine is: T139 → T140/T141/T142 (foundation) → T172 (controller) → T173 (DI) → T181 → T182 (deactivate path) → T188 (super-admin floor wiring).

**Story independence**: US1 ships standalone (auth + RBAC). US2 depends on US1 for the super-admin sign-in path. US3 depends on US2 for the user list page. US4 depends on US3 for the deactivation entrypoint. US5 stands alone (verifies pre-existing lockout primitives). Skip a story → the others in the dependency chain still ship cleanly.

**Test pyramid**: ~26 backend integration tests (Testcontainers.MsSql), ~6 frontend Vitest files, ~3 Playwright e2e specs. Heavy tests (T147 single-session fuzz, T186 1000-iteration property test) gated behind `[Trait("Category","Heavy")]` and run on a separate CI tier.
