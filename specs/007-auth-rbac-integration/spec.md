# Feature Specification: Auth + RBAC Integration

**Feature Branch**: `007-auth-rbac-integration`
**Created**: 2026-05-10
**Status**: Draft
**Input**: User description: "Spec 007 — Auth + RBAC integration. Bind the existing AuthController and AdminUsersController to the new IdentityModule (currently dormant). Implement two-step OTP login flow replacing the current single-step legacy login. Implement lock policy, locked users management, and officer lookup. Honor typed-error contracts and the auth+RBAC contract from docs/INTEGRATION_HANDOFF.md (login response includes effective permissions array; permission wildcards `*` and `resource:*` must work). Demo deadline 2026-05-29; this spec is critical-path because everything downstream depends on a working auth+RBAC layer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Staff member signs in with two-step verification (Priority: P1)

A staff member opens the staff-login page, enters their National ID and password, picks their role, and submits. The system validates credentials, sends a one-time 6-digit code to the phone number on file, and presents an OTP entry screen. The staff member enters the code; on success they land on the hub with a session that exposes their role's effective permissions. On the third consecutive wrong code, the system warns them; after the configured threshold of failed attempts the account is locked for the configured lockout window and a clear Arabic message tells them to contact the system administrator.

**Why this priority**: Every other downstream user (admin, applicant-flow staff, board members, doctors, examiners) cannot do their job until they can sign in. The applicant portal depends on a separately-modeled applicant auth flow (out of scope here), but the entire staff-facing surface is gated on this story.

**Independent Test**: Sign in as the seeded super_admin (NID `27001010150010`, password `SuperAdmin123!`) → receive an OTP code on the configured channel → enter it → land on `/hub` with `permissions: ['*']` resolvable via the permission helper. Repeat with a deliberately wrong OTP code five times to confirm lockout fires. Verify the audit log records every successful login, every failed attempt, and the lockout event with actor + IP + timestamp.

**Acceptance Scenarios**:

1. **Given** a seeded staff user with valid credentials, **When** they submit NID + password + role on the login page, **Then** the system responds with a pending-OTP descriptor (including a masked phone tail) and emits an audit row of type `login_request` with outcome `pending`.
2. **Given** a pending OTP, **When** the user enters the correct 6-digit code within the OTP validity window, **Then** the system returns a session token, the authenticated user shape (with a non-empty effective permissions array), and emits an audit row of type `login_success`.
3. **Given** a pending OTP, **When** the user enters a wrong code, **Then** the system increments the failed-attempt counter, returns a typed "code mismatch" error, and emits an audit row of type `login_otp_failed`.
4. **Given** a user has reached the configured maximum failed attempts, **When** the next failure happens, **Then** the account becomes locked for the configured lockout window, the response carries a typed "account locked" error code, and an audit row of type `account_locked` is emitted.
5. **Given** the configured lockout window has elapsed, **When** a previously-locked user requests a new OTP, **Then** the system clears the lock, allows the new request, and emits an audit row of type `lockout_auto_cleared`.

---

### User Story 2 — Super-admin tunes the lockout policy and rescues a locked colleague (Priority: P2)

A super-admin needs to adjust how aggressive the lockout is during a calm operational period (e.g. raise the threshold from 5 to 7 attempts) or to extend the lockout duration during a suspected incident. The same admin must be able to view the current list of locked users and to manually unlock any of them after a phone-call verification.

**Why this priority**: Lockout policy is set once and rarely adjusted, but the manual-unlock path is exercised whenever a legitimate user fat-fingers their OTP enough times to lock themselves out — operationally common during onboarding and demo prep. Without this, every lockout becomes a help-desk escalation that requires a backend deploy.

**Independent Test**: As super_admin, change `maxFailedAttempts` from 5 to 7 and verify the new threshold takes effect for the next failed attempt. Trigger a lockout for a test user, view the locked-users list, manually unlock that user, and verify they can request a new OTP immediately. Every policy mutation and unlock event must appear in the audit log.

**Acceptance Scenarios**:

1. **Given** the super-admin is authenticated, **When** they request the current lock policy, **Then** the system returns `{ maxFailedAttempts, lockDurationMinutes }` from the configuration store.
2. **Given** the super-admin submits a new lock policy with `maxFailedAttempts` between 1 and 10 and `lockDurationMinutes` between 5 and 120, **Then** the system persists the new values, applies them to subsequent failed-attempt evaluations, and emits an audit row of type `lock_policy_updated` with before/after diff.
3. **Given** the super-admin submits an out-of-range value (e.g. `maxFailedAttempts: 0`, `lockDurationMinutes: 999`), **Then** the system rejects the change with a validation error and the policy is unchanged.
4. **Given** any user is currently locked, **When** the super-admin requests the locked-users list, **Then** the system returns one row per locked user with `{ userId, name, role, reason, lockedAt, unlocksAt }`.
5. **Given** a target user is currently locked, **When** the super-admin issues an unlock for that user, **Then** the lock is cleared, the failed-attempt counter is reset, the target can immediately request a new OTP, and an audit row of type `manual_unlock` is emitted naming the unlocking admin.

---

### User Story 3 — Admin provisions a new staff user by looking up an officer (Priority: P2)

An admin adding a new staff user does not type the officer's name and unit by hand — they enter the officer's National ID and officer code, the system looks the officer up against the source-of-truth identity service, and pre-fills the new SystemUser form with name, mobile, email, issue date, card factory number, and unit. The admin then assigns a role and saves.

**Why this priority**: This is the entry point for every new staff account. Without it, admins fall back to manual data entry, which is error-prone and bypasses the canonical identity record. Critical for onboarding the demo evaluator team but not blocking for the demo itself (a small fixed set of seeded users covers demo scenarios).

**Independent Test**: As an admin, look up an officer by NID + code → receive the officer's full record → submit the create-user form → verify a new SystemUser row exists with the looked-up data and the chosen role. Verify the lookup surfaces a typed "not found" error for an unknown pair.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they request an officer by valid NID + officer code, **Then** the system returns the officer's record (name, mobile, email, issue date, card factory number, unit).
2. **Given** the same admin, **When** they request an officer by a NID + code pair that doesn't exist in the source-of-truth, **Then** the system returns a typed not-found error with an Arabic message ready for direct display.
3. **Given** the officer-source service is unreachable, **When** the admin attempts a lookup, **Then** the system returns a typed transient-error response that the UI can surface as "service temporarily unavailable" without losing the admin's in-progress form data.

---

### User Story 4 — Permission-based access on every authenticated request (Priority: P1)

Every authenticated request carries the user's effective permissions. When a staff member who only has `applicants:view` tries to invoke an endpoint that requires `applicants:edit`, the request is denied with a typed authorization error before any business logic runs. Super-admin users hold the wildcard permission `*` and pass every check; role-scoped wildcards like `committees:*` grant every action under that resource.

**Why this priority**: Without consistent permission enforcement, role separation collapses and every endpoint must implement its own ad-hoc check. The wildcard convention is the contract the frontend already relies on (`hasPermission` in `features/auth/rbac.ts`); the backend must mirror it or the frontend silently silently authorizes the wrong actions.

**Independent Test**: Sign in as `committee_user` (no `applicants:edit` permission). Attempt to update an applicant. Confirm a 403 response with the expected error code. Sign in as `super_admin`. Attempt the same update. Confirm it succeeds. Sign in as `committee_admin` (which has `committees:manage`). Attempt every committee endpoint. Confirm all succeed.

**Acceptance Scenarios**:

1. **Given** a user with permissions `['applicants:view']`, **When** they invoke an endpoint that requires `applicants:view`, **Then** the request is allowed.
2. **Given** the same user, **When** they invoke an endpoint that requires `applicants:edit`, **Then** the request is denied with a typed authorization error and an audit row of type `permission_denied`.
3. **Given** a user with permissions `['*']`, **When** they invoke any endpoint, **Then** the request is allowed.
4. **Given** a user with permissions `['committees:*']`, **When** they invoke any endpoint that requires a permission of shape `committees:<verb>`, **Then** the request is allowed.

---

### Edge Cases

- **Concurrent OTP requests for the same user**: a second request invalidates the first; only the latest pending OTP is acceptable.
- **OTP entered after expiry**: typed `OTP_EXPIRED` error; the user is told to request a new code.
- **OTP code reused after success**: rejected; codes are single-use.
- **Lockout window elapses while user is mid-OTP-entry**: the next OTP submission is treated as a fresh attempt — failed counter reset.
- **Permission revoked mid-session**: the user keeps their existing token until expiry, but every authorization check uses the *current* permission state, so the next protected action fails. (Token TTL is the implicit revocation window.)
- **Officer lookup returns a record that already has a SystemUser**: admin sees a typed "duplicate user" error rather than the form being filled in.
- **Demo OTP bypass code**: the dev-only `000000` shortcut documented in `docs/INTEGRATION_HANDOFF.md §5` MUST NOT be honored by the production backend. (Frontend is responsible for stripping its `peekOtpCode` helper at the same time.)
- **Audit emissions during failed login**: even when credentials are wrong, the system emits an audit row identifying the *attempted* NID — which means the audit log surface accepts events not associated with an authenticated actor. Resolved by recording such events under a synthetic actor `_anonymous_` with the requesting IP.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate staff users via a two-step flow: (a) NID + password to request an OTP, (b) the issued OTP to mint a session.
- **FR-002**: System MUST authenticate users to the role recorded on their `SystemUser` row at the time of authentication. The login flow MUST NOT accept a client-supplied role override; the role-picker on the legacy single-step login page is dropped from the new two-step flow.
- **FR-003**: System MUST issue OTPs that expire after a fixed validity window of 5 minutes.
- **FR-004**: System MUST mark each OTP as single-use; a code that has been successfully verified cannot be re-verified.
- **FR-005**: System MUST track failed OTP attempts per user and lock the account after the configured `maxFailedAttempts` threshold.
- **FR-006**: System MUST automatically clear an account lock once `lockDurationMinutes` have elapsed since the lockout.
- **FR-007**: System MUST allow a super-admin to read the current lock policy and to update both `maxFailedAttempts` (range 1–10) and `lockDurationMinutes` (range 5–120). Out-of-range submissions MUST be rejected.
- **FR-008**: System MUST allow a super-admin to list all currently-locked users with the fields `{ userId, name, role, reason, lockedAt, unlocksAt }`.
- **FR-009**: System MUST allow a super-admin to manually unlock any locked user; manual unlock resets both the lock and the failed-attempt counter.
- **FR-010**: System MUST allow an authenticated admin to look up an officer by `(nationalId, officerCode)` against the source-of-truth identity service. The response MUST surface either the officer record or a typed not-found error.
- **FR-011**: System MUST include the authenticated user's effective permissions array in every login success response and in every "current user" probe response.
- **FR-012**: System MUST evaluate permission checks with two wildcard conventions: `*` grants everything; `resource:*` grants every action under the named resource (e.g. `committees:*` matches `committees:view`, `committees:manage`, etc.).
- **FR-013**: System MUST emit an append-only audit row for every authentication event: `login_request`, `login_success`, `login_otp_failed`, `account_locked`, `lockout_auto_cleared`, `manual_unlock`, `lock_policy_updated`, `permission_denied`. Each row carries actor (or `_anonymous_` for pre-auth events), IP address, target NID where applicable, outcome, and timestamp.
- **FR-014**: System MUST NOT honor the development-only OTP bypass code `000000`.
- **FR-015**: System MUST replace the existing single-step legacy login path with the two-step flow. The legacy `POST /auth/login` endpoint MAY remain wired during a single transition release for non-staff use cases (none currently identified) but MUST NOT be the documented contract for staff sign-in.
- **FR-016**: System MUST deliver OTP codes via SMS to the mobile number on file for the authenticating staff user. The OTP-request response MUST surface a masked phone-tail (e.g. `•••• 4521`) so the user can confirm the channel before checking their device.
- **FR-017**: System MUST source officer records for the lookup endpoint from MOIPASS — the Ministry of Interior's federated identity service. Lookups are live (no internal cache); upstream latency is the user-visible latency. The system MUST handle MOIPASS unavailability per the User Story 3 acceptance scenario "officer-source service is unreachable".
- **FR-018**: System MUST handle the two-step session-token lifecycle as: (a) the OTP-request endpoint issues a short-lived "pending-session" bearer (validity matching the OTP — 5 minutes); (b) the OTP-verify endpoint accepts the pending-session bearer plus the 6-digit code, and on success exchanges it for the full session token. The pending-session bearer MUST be single-use (consumed by either successful verification or the first failed-attempt-that-hits-the-threshold).

### Key Entities *(include if feature involves data)*

- **SystemUser**: A staff member who can authenticate and act on the platform. Carries National ID, name, mobile, email, role, unit, active flag, and the role's effective permissions resolved at login.
- **LockoutState**: Per-user transient state tracking consecutive failed OTP attempts and the timestamp at which the lock auto-clears. Cleared on either successful verification or manual unlock.
- **LockPolicy**: Org-wide policy carrying `maxFailedAttempts` and `lockDurationMinutes`. Single tenant; one row.
- **PendingOtp**: Short-lived record holding the 6-digit code, the masked phone tail shown back to the user, the expiry timestamp, and the per-attempt failure counter scoped to this pending request.
- **OfficerRecord**: Read-only projection of an officer fetched from the source-of-truth identity service. Carries name, mobile, email, issue date, card factory number, and unit. Not persisted in the academy database — looked up live each time.
- **AuditEvent**: Append-only record of every auth-relevant action. Carries actor (or `_anonymous_`), IP, action verb, target, outcome, before/after JSON where applicable, and timestamp. Reused from existing Shared.Audit module.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A staff member can complete a successful sign-in (NID + password → OTP → land on hub) in under 30 seconds end-to-end on a normal-latency network.
- **SC-002**: 100% of successful logins, failed OTP attempts, lockouts, manual unlocks, and lock-policy mutations appear in the audit log within 5 seconds of the event, identifying actor, target, IP, and outcome.
- **SC-003**: Account lockout fires on exactly the attempt that crosses the configured threshold — no earlier, no later. Auto-unlock fires within 1 minute of `unlocksAt`.
- **SC-004**: All 12 seeded roles' permission arrays evaluate correctly for the wildcard conventions: 100% of authorized actions pass, 100% of unauthorized actions are denied with a typed error, across a representative test matrix of 50 (role × endpoint) pairs.
- **SC-005**: Officer lookup returns within 2 seconds for any valid `(nationalId, officerCode)` pair under normal upstream latency, and within 5 seconds under p99 upstream latency.
- **SC-006**: The development-only OTP bypass `000000` is rejected with the same typed error as any other wrong code; no code path accepts it.
- **SC-007**: Demo evaluators can sign in as any of the 11 seeded role users and reach the hub on the first attempt 100% of the time over a 5-day demo window.

## Assumptions

- **A-001**: OTP validity window is 5 minutes (industry-standard; matches the legacy frontend's hardcoded value).
- **A-002**: Default `maxFailedAttempts` is 5 and default `lockDurationMinutes` is 30 (matches the legacy frontend's hardcoded defaults; admin can tune via FR-007).
- **A-003**: Permission wildcards use `*` for super-admin and `resource:*` for full-resource grants (already used by the frontend `hasPermission` helper; backend mirrors the convention).
- **A-004**: The `finance_review` role is seeded, but no SystemUser is automatically assigned it; operations team assigns post-integration.
- **A-005**: Applicant authentication is a separate flow (specified in spec 011 — Applicant Portal API) and is out of scope here. This spec covers staff authentication only.
- **A-006**: The Shared.Audit module from spec 005 is the audit sink for all events emitted by this spec. No new audit table is introduced.
- **A-007**: AspNet Core Identity remains the underlying user store implementation. The user table is the existing `system_users` table mapped by the legacy `SystemUserConfiguration` and surfaced through the IdentityModule's DbContext once stores are re-enabled.
- **A-008**: The legacy `AddIdentity<SystemUser, IdentityRole<Guid>>().AddEntityFrameworkStores<PaDbContext>()` registration in `PACademy.Infrastructure/DependencyInjection.cs` is removed at the end of this spec; the IdentityModule becomes the sole owner of the AspNet Identity wiring (closes the deferred T326 from spec 005).

## Dependencies

- **D-001**: Spec 005 (Modular Monolith) — the IdentityModule, ICurrentUser, IIdentityApi, and HttpContextCurrentUser exist and are wired into DI but currently dormant.
- **D-002**: Shared.Audit module — exists and accepts `RecordAsync(AuditAction, ...)` from this module for FR-013.
- **D-003**: SMS gateway vendor contract for OTP delivery (FR-016). Specific provider not yet named; backend abstracts it behind an `IOtpTransport` so the choice is reversible. Must support Egyptian mobile-number formats (`010|011|012|015` prefixes).
- **D-004**: MOIPASS federated identity service sandbox credentials and API contract (FR-017). Requires coordination with the Ministry of Interior's identity team before implementation can verify against a real upstream. A stub `IOfficerLookup` implementation MAY be used during development that returns the seeded SystemUsers, but integration must not ship without a real MOIPASS handshake.

## Out of Scope

- Applicant-side authentication (handled in spec 011).
- Federated identity (the MOI portal redirect harness discussed in `docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md §4` was resolved as Option B = standalone for the demo).
- Custom role creation UI (existing roles are sufficient for the demo; the spec preserves the system-row protection so custom roles can be added in a later spec).
- Session expiry / refresh-token semantics — this spec assumes the existing 8-hour cookie session from `appsettings.json:Auth.SessionTimeoutMinutes`.
- Two-factor reset workflow for staff who lose access to their phone — handled by the existing `users.service.ts:reset2fa` endpoint, scope of admin governance spec (010).
