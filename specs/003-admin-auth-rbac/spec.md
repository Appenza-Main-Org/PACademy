# Feature Specification: Admin Sign-in + RBAC + User Provisioning

**Feature Branch**: `003-admin-auth-rbac`
**Created**: 2026-05-08
**Last Clarified**: 2026-05-09
**Status**: Draft (clarified)
**Input**: User description: "Admin sign-in cookie auth + RBAC + Admin Users CRUD with super-admin floor (US2 of spec 002)"

## Clarifications resolved on 2026-05-09

| Q | Decision | Drives |
|---|---|---|
| Audit policy on auth failures | Audit successes + archived/deactivated 401s only; wrong-password 401s are silent (avoids audit-log DoS) | FR-A09 |
| Concurrent sessions per user | One active session per user — new login revokes prior sessions | FR-A07 |
| Logout scope | Revokes all active sessions for the user (not just the calling cookie's) | FR-A08 |
| Role change via PATCH | Auto-revoke active sessions; new role's `apps` claim takes effect on next login | FR-C06 |

> Carves the auth/RBAC slice out of [spec 002 Phase 4](../002-backend-foundation/tasks.md#phase-4) into a focused, independently shippable spec. The role-picker shortcut shipped in spec 001 is being replaced with real authentication backed by ASP.NET Identity, server-side sessions, RBAC policies, and an Admin → Users surface that lets a super-admin provision and deactivate operators. Some of the foundational seams already exist (IIdentityProvider, SessionMiddleware, CsrfMiddleware, SuperAdminFloorPolicy) and the `/auth/login`, `/auth/me`, `/auth/logout` endpoints are drafted on the `dev` branch (commit `d860b91`); this spec frames the remaining work to make Phase 4 production-ready.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operator signs in and is restricted to their apps (Priority: P1) 🎯 MVP

An operator (e.g. a committee admin) opens the staff sign-in page, enters their 14-digit national ID and the password they were issued, and lands on the hub. The hub and sidebar only show the apps their role grants them access to. Trying to navigate (or call an API) for an app outside that set returns 403.

**Why this priority**: This is the hinge of the entire admin platform. Without real auth + RBAC, every other staff workflow is gated by a demo role-picker that has no security guarantees. P1 because it is the prerequisite for any production deployment beyond the demo.

**Independent Test**: Provision two seeded users with different roles. Sign in as each. Verify the hub shows the right app cards, the sidebar shows the right routes, and a deep-link to a route outside the role's app set returns 403. No cross-contamination between sessions.

**Acceptance Scenarios**:

1. **Given** the seeded super_admin user, **When** they POST `/auth/login` with `{nationalId, password}`, **Then** the response is 200, a `pa-session` cookie is issued (HttpOnly + SameSite=Strict), and the body matches the `LoginResponse` shape with `apps` containing all 9 apps + `architecture`.
2. **Given** an authenticated committee_admin, **When** they GET `/auth/me`, **Then** the response is 200 with their identity + `apps = ["admin","committee","barcode","biometric"]`.
3. **Given** an authenticated committee_user (no `admin` app), **When** they GET `/admin/applicants`, **Then** the response is 403 with an audit entry recording `outcome=permission-denied`.
4. **Given** an authenticated user, **When** they POST `/auth/logout` with the CSRF header, **Then** the response is 204, **all** of the user's active session rows are marked `revoked` (reason `user_logout`), the response clears the `pa-session` cookie, and any subsequent request that replays a pre-logout cookie from any device returns 401 with `code: SESSION_REVOKED`.
5. **Given** an authenticated user already signed in on device A, **When** they sign in successfully on device B, **Then** device A's session is revoked with reason `superseded_by_new_login`; device A's next request returns 401 with `code: SESSION_REVOKED`. Device B continues with the new session.
6. **Given** an unauthenticated request, **When** it hits any `[Authorize]` endpoint, **Then** the response is 401 (no redirect body) — the SPA's `SessionExpiredBanner` listens for this and re-prompts.

---

### User Story 2 — Super-admin provisions a new operator (Priority: P1)

A super-admin opens `/admin/users`, fills out the new-operator form (national ID, officer code, full name, mobile, email, issue date, card factory number, role, optional unit, password), submits, and the new user appears in the list. That user can immediately sign in and they see only the apps their role grants.

**Why this priority**: Without provisioning, every operator has to be seeded by hand into the database. P1 because the platform is multi-role (11 roles, ~35 staff at scale) and Ministry workflows require auditable user creation, not back-office SQL.

**Independent Test**: Sign in as super_admin → POST `/admin/users` with a valid committee_admin payload → see the new user in `GET /admin/users` → sign out → sign in as the new user with the password used at provisioning → land on hub showing 4 apps (admin, committee, barcode, biometric).

**Acceptance Scenarios**:

1. **Given** an authenticated super_admin, **When** they POST `/admin/users` with valid FR-029/FR-030 fields, **Then** the response is 201 with the created user DTO and an audit entry records `action=create, target=user/{id}`.
2. **Given** an authenticated super_admin, **When** they POST `/admin/users` with a duplicate national ID, **Then** the response is 422 with `code: NATIONAL_ID_TAKEN` and a validation-error audit entry.
3. **Given** an authenticated super_admin, **When** they POST `/admin/users` with a national ID that fails the Egyptian NID format, **Then** the response is 400 with the field-specific Arabic error message.
4. **Given** a non-super-admin authenticated user, **When** they POST `/admin/users`, **Then** the response is 403 with a permission-denied audit entry.
5. **Given** an authenticated super_admin, **When** they GET `/admin/users?role=committee_admin&q=...`, **Then** the response paginates filtered users with `X-Total-Count` + `X-Page-Count` headers (matching the applicants list pattern).
6. **Given** a target user X currently signed in, **When** the super_admin PATCHes X's role from `committee_user` to `committee_admin`, **Then** all of X's active sessions are revoked (reason `role_changed`), the response is 200 with the updated DTO, and X's next request returns 401 with `code: SESSION_REVOKED` so the next sign-in picks up the new role's `apps` claim.

---

### User Story 3 — Super-admin deactivates an operator immediately (Priority: P1)

A super-admin selects a user from `/admin/users`, confirms a deactivation prompt, and the user's active sessions are revoked at once. That user's next request returns 401 even if their browser still holds a fresh-looking cookie.

**Why this priority**: Required by FR-027/§US2: when an operator leaves or is reassigned, their access must end immediately, not on session timeout. P1 because the only alternatives are a) leaving the account active until cookie expiry (security gap) or b) restarting the API (operationally unacceptable).

**Independent Test**: Sign in as user X in browser A. Sign in as super_admin in browser B. Deactivate X from B. Refresh any authenticated page in A → 401 with `code: SESSION_REVOKED`. Verify X cannot sign in again (account flagged inactive).

**Acceptance Scenarios**:

1. **Given** a super_admin authenticated in one browser and a target user X authenticated in another, **When** the super_admin POSTs `/admin/users/{X.id}/deactivate`, **Then** all of X's active sessions are marked `revoked` (reason `account_deactivated`), X's `IsActive` flag is set false, the response is 204, and an audit entry records `action=deactivate, target=user/{id}`.
2. **Given** the deactivated user X, **When** they replay any authenticated request with their pre-deactivation cookie, **Then** the response is 401 with `code: SESSION_REVOKED`.
3. **Given** the deactivated user X, **When** they attempt to POST `/auth/login` with their credentials, **Then** the response is 401 with `code: INVALID_CREDENTIALS` (no leak that the account exists but is deactivated).

---

### User Story 4 — Super-admin floor prevents bricking (Priority: P1)

A super-admin attempts to deactivate themselves (or the only remaining super-admin). The system blocks the action and surfaces a clear Arabic error message. Self-deactivation is allowed only when at least one other active super-admin exists.

**Why this priority**: Without this guardrail, a single misclick — or a malicious super-admin — can lock every operator out of the platform with no recourse short of a database fix. P1 because it is a one-way operational hazard.

**Independent Test**: With a single super_admin in the DB, attempt self-deactivation → 403 + `code: SUPER_ADMIN_FLOOR_BLOCKED`. Add a second super_admin, repeat → 204 (allowed). Verify both attempts produce audit entries with the correct outcomes.

**Acceptance Scenarios**:

1. **Given** the database has exactly one active super_admin (themselves) authenticated, **When** they POST `/admin/users/{self.id}/deactivate`, **Then** the response is 403 with `code: SUPER_ADMIN_FLOOR_BLOCKED`, the audit entry records `outcome=permission-denied`, and the user remains active.
2. **Given** two active super_admins, **When** one POSTs `/admin/users/{self.id}/deactivate`, **Then** the response is 204 and the floor invariant remains satisfied (one active super_admin remains).
3. **Given** two active super_admins, **When** one POSTs `/admin/users/{other.id}/deactivate` and the other's deactivation reduces the count to one, **Then** the response is 204; subsequent attempt to deactivate the last one returns 403 with the same code.

---

### User Story 5 — Failed-login lockout (Priority: P2)

After 5 failed sign-in attempts within a short window, the user's account is locked for 5 minutes. During lockout, even the correct password fails. The system surfaces this in Arabic without leaking whether the lockout vs. wrong-password path triggered.

**Why this priority**: Brute-force defence. P2 because the lockout primitives (`opt.Lockout.MaxFailedAccessAttempts = 5`, `opt.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5)`) are already wired in `DependencyInjection`; this story is asserting + testing the behaviour, not building it.

**Independent Test**: Hit `/auth/login` 5 times with a valid NID + wrong password. The 6th attempt with the correct password also fails. Wait 5 minutes (or fast-forward in test) — correct password now succeeds.

**Acceptance Scenarios**:

1. **Given** a valid NID and wrong password, **When** repeated 5 times, **Then** all return 401 and the user record's `AccessFailedCount` reaches 5 with `LockoutEnd` set ~5 minutes ahead.
2. **Given** the locked account, **When** the correct password is sent, **Then** the response is still 401 (and an audit entry records `outcome=permission-denied`).

---

### Edge Cases

- **CSRF on cross-origin cookie**: When the SPA reads the `csrf-token` cookie via `document.cookie`, the value is URL-encoded (base64 contains `/`, `+`, `=`). The SPA must `decodeURIComponent` before sending it as `X-CSRF-Token` so the middleware's decoded comparison matches. Already addressed in commit `d53e4d5`.
- **Cookie-scheme mismatch**: `services.AddIdentity()` registers `Identity.Application` as the default scheme. Sign-in calls must explicitly target `IdentityConstants.ApplicationScheme` and configure the cookie via `ConfigureApplicationCookie(...)`, not a separately-named `AddCookie("Cookies", ...)`. Already addressed in commit `d860b91`.
- **Session revoke vs. cookie expiry**: A revoked session in the DB outranks a fresh-looking cookie. `SessionMiddleware` runs after `UseAuthentication` and short-circuits with `SESSION_REVOKED` regardless of cookie validity.
- **Single-session enforcement under concurrent logins**: Two parallel `POST /auth/login` requests for the same user (extremely rare race) MUST both succeed-or-both-fail without leaving the user with two active sessions. The implementation MUST serialize "revoke any other active sessions for this user, then insert the new session row" inside a single transaction.
- **SignalR / long-lived connection drift**: Out of scope for this spec — there is no realtime channel yet. When introduced, `SessionMiddleware` will need a hub-filter analogue.
- **Demo bypass**: When `VITE_DEMO_MODE=true` (frontend) or `SeedDemo=true` (backend), the system MUST still pass all real-auth tests. Demo-mode short-circuits are UX shortcuts, not security relaxations.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication

- **FR-A01**: System MUST authenticate users via national ID + password (no role hint from the client). The role is read from the `SystemUser` row, never trusted from the request.
- **FR-A02**: System MUST issue a server-side session row on successful login and embed the session id (`sid`) as a claim in the auth cookie. Subsequent requests MUST be rejected with `code: SESSION_REVOKED` if the row is revoked.
- **FR-A03**: System MUST use HttpOnly, SameSite=Strict, secure-when-https cookies for the auth principal (`pa-session`). The CSRF cookie (`csrf-token`) MUST be readable by the SPA (not HttpOnly) but enforced via double-submit on every mutation by an authenticated user.
- **FR-A04**: System MUST validate national ID format with the Egyptian 14-digit `CYYMMDDGGGGGSD` rule before consulting the user store.
- **FR-A05**: System MUST surface authentication failures as 401 with a generic Arabic message; it MUST NOT leak whether the failure was wrong-password vs. unknown-user vs. archived-account.
- **FR-A06**: System MUST refresh `Sessions.LastSeenAt` on each authenticated request (already in `SessionMiddleware`).
- **FR-A07**: **Single-session enforcement.** A successful login MUST first revoke every other active session for that user (reason `superseded_by_new_login`), then insert the new session row in the same transaction. At any moment a user MUST have at most one active (non-revoked) session.
- **FR-A08**: **All-sessions logout.** `POST /auth/logout` MUST revoke every active session belonging to the current user (reason `user_logout`), not only the session referenced by the calling cookie. (In single-session mode, this is at most one row, but the API MUST still query by user-id to remain correct under any future relaxation.)
- **FR-A09**: **Auth audit policy.** Audit entries MUST be written for: (a) every successful login (`action=login, outcome=success`); and (b) every 401 originating from an archived or deactivated account (`action=login, outcome=permission-denied`). Audit entries MUST NOT be written for wrong-password or unknown-NID 401s — these are tracked by ASP.NET Identity's `AccessFailedCount` and the FR-A11 lockout, not the audit log, to avoid audit-log DoS under credential-stuffing.
- **FR-A10**: **Cookie / session lifetime.** The `pa-session` cookie MUST be sliding-expiration with a default 480-minute (8-hour) window, configurable via `Auth:SessionTimeoutMinutes`. Inactive sessions are reaped server-side by relying on `Sessions.LastSeenAt`; revocation cleanup is out of scope for this spec.
- **FR-A11**: **Account lockout.** ASP.NET Identity lockout policy is in force: 5 consecutive failed password attempts lock the account for 5 minutes. Inside the lockout window, even a correct password returns 401. (See US5.)

#### RBAC

- **FR-B01**: System MUST register one `AppAccess:<key>` policy per app (`admin`, `committee`, `board`, `investigations`, `medical`, `barcode`, `biometric`, `exams`, `applicant`, `architecture`) and one `Role:<role>` policy per RBAC role.
- **FR-B02**: Every staff endpoint MUST be guarded by the policy matching its app (per the table in `CLAUDE.md §5`). Cross-app navigation in the frontend MUST also reflect the user's `apps` claim — sidebar entries hidden for unauthorized apps; deep-links rejected with a redirect to `/hub` and a toast.
- **FR-B03**: 403 responses from RBAC denials MUST always emit an audit entry with `outcome=permission-denied`.
- **FR-B04**: The role→apps mapping is a single source of truth; both `IIdentityProvider.AuthenticateAsync` and `GetMeUseCase` MUST resolve it through the same `RoleApps.ForRole` helper. *(Already done.)*

#### User Provisioning (Admin → Users)

- **FR-C01**: System MUST expose `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/deactivate` — all guarded by `Role:super_admin`.
- **FR-C02**: The list endpoint MUST support filter (`role`, `q`, `isActive`), sort, and pagination, mirroring `/admin/applicants` (returns `X-Total-Count` + `X-Page-Count`).
- **FR-C03**: User creation MUST validate every FR-029/FR-030 field and reject with 400 (format) or 422 (domain conflict, e.g., duplicate national ID).
- **FR-C04**: Created users MUST default to `IsActive=true`, `Archived=false`, `DemoOrigin=false`. The password MUST be hashed via ASP.NET Identity's default hasher.
- **FR-C05**: Deactivation MUST: (a) set `IsActive=false`, (b) revoke every active session for that user with reason `account_deactivated`, (c) audit-record `action=deactivate`, (d) enforce the super-admin floor invariant.
- **FR-C06**: **Role-change session revocation.** A `PATCH /admin/users/{id}` that changes the user's `Role` field MUST revoke every active session for that user (reason `role_changed`) inside the same transaction as the role update. The user is forced to re-login so the new `apps` claim takes effect immediately. PATCHes that touch any other field (mobile, email, unit, etc.) MUST NOT revoke sessions.

#### Frontend

- **FR-F01**: `LoginForm` MUST be the only authentication entry point for staff. The form MUST drive `useLoginMutation`, on success refetch `useMe()`, then redirect to `/hub`.
- **FR-F02**: `AuthGuard` MUST drive off the server-truth `useMe()` query. The Zustand store is a UX cache only.
- **FR-F03**: `SessionExpiredBanner` MUST listen for the `sessionExpiredBus` 401 event and present a localized re-login prompt without losing the current route.
- **FR-F04**: `/admin/users` page MUST exist with a `DataTable` listing seeded + provisioned users; the create/edit forms MUST validate FR-029/FR-030 client-side using the same shared zod schemas the backend mirrors.

### Key Entities

- **SystemUser**: An ASP.NET Identity user augmented with FR-029/FR-030 fields (officer code, issue date, card factory number, role, unit). Soft-deletable (`Archived`, `ArchivedAt`). `DemoOrigin` is permanent provenance from FR-017. `NationalId` mirrors `UserName`.
- **Session**: A row in `sessions` linking a `SystemUser` to a `pa-session` cookie via `Id` (which is embedded as the `sid` claim). Tracks `IpAddress`, `UserAgent`, `CreatedAt`, `LastSeenAt`, `RevokedAt`, `RevokedReason`. The `RevokedReason` vocabulary is closed: `user_logout` (FR-A08), `superseded_by_new_login` (FR-A07 single-session enforcement), `account_deactivated` (FR-C05), `role_changed` (FR-C06). New reasons require a spec amendment.
- **AuditEntry**: Immutable row recording every authentication, provisioning, and authorization-failure event. Already in place from spec 002.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-A01**: 100% of staff endpoints in the route table reject unauthenticated requests with 401 and reject app-mismatched requests with 403, verified by a coverage test that walks the route table and asserts each route's policy chain.
- **SC-A02**: Login p95 ≤ 400 ms against the seeded user table on the dev SQL Server (excluding lockout backoff).
- **SC-A03**: Session revocation propagates to the next request in ≤ 1 SQL round-trip (verified by `SessionMiddleware` test).
- **SC-A04**: Super-admin floor invariant holds across 1000 randomized deactivation orderings in a property-based test.
- **SC-A05**: A super-admin can provision a new operator end-to-end (form submit → user can sign in) in ≤ 90 seconds of clock time during a Playwright walkthrough.
- **SC-A06**: 0 known cookie-scheme or CSRF-decoding regressions of the kind addressed in `d860b91` and `d53e4d5` — covered by integration tests that exercise the full login → me → mutate-with-CSRF → logout → replay round-trip.
- **SC-A07**: Frontend Vitest coverage for `LoginForm`, `AuthGuard`, `UsersPage`, `UsersCreatePage`, and `SessionExpiredBanner` ≥ 80% (statements + branches), with at least one a11y assertion (jest-axe) per component.
- **SC-A08**: **Single-session invariant** holds across a 1000-iteration concurrent-login fuzz test: at no point does any user have more than one row in `sessions` with `RevokedAt IS NULL`. Verified against the seeded user table with parallel `POST /auth/login` requests under `xUnit + Parallel.ForEachAsync`.

---

## Out of Scope

The following are explicitly NOT in this spec; they belong to later phases or other specs:

- **MFA / second factor** — The `IIdentityProvider.RequiresSecondFactorAsync` seam exists (FR-031) but always returns false until the Ministry's external 2FA API is integrated.
- **OAuth / external IdP** — Login is national ID + password only.
- **Password reset / forgot password** — Out of scope; passwords are issued by super-admin at provisioning. (Worth a follow-up spec.)
- **Self-service profile edits** — A user editing their own row beyond the bare `me` read. (Worth a follow-up spec.)
- **SignalR / realtime session push** — Revocation propagates on next HTTP request only.
- **Audit search UI** — Spec 002 US3 owns the audit query surface; this spec only writes audit rows.
