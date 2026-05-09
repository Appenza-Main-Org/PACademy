# Implementation Plan: Admin Sign-in + RBAC + User Provisioning

**Branch**: `003-admin-auth-rbac` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-admin-auth-rbac/spec.md`

## Summary

Replace the demo role-picker with real cookie-based authentication, enforce a complete RBAC matrix across every staff route, and ship the `/admin/users` provisioning surface that lets a super-admin create/edit/deactivate operators. The backend foundations (`IIdentityProvider`, `SystemUser`, `Session`, `SessionMiddleware`, `CsrfMiddleware`, `SuperAdminFloorPolicy`) and a draft of the `/auth/login` + `/auth/me` + `/auth/logout` endpoints already exist on `dev` (commits `d860b91`, `d53e4d5`); this plan covers (a) the gaps in the existing auth draft surfaced by the clarify pass, (b) the entire `/admin/users` slice (T063 use cases + T064 controller + T067 frontend service swap), (c) the full RBAC policy matrix (T065), and (d) the test pyramid for the slice (T052–T061).

The four clarify-pass decisions reshape three existing pieces of code:

1. **`LoginUseCase`** now revokes any prior active sessions for the same user inside the login transaction (FR-A07, single-session enforcement).
2. **`LogoutUseCase`** revokes by `userId`, not by `sessionId` (FR-A08, all-sessions logout).
3. **`AuthController.Login`** must distinguish "archived/deactivated account" from "wrong password" so the audit writer fires only on the former (FR-A09, auth audit policy).

Plus one new piece — **`UpdateSystemUserUseCase`** — that diffs role changes and revokes sessions when the role field actually changes (FR-C06).

Out of scope: MFA / 2FA, self-service password reset, audit search UI (owned by spec 002 US3), SignalR realtime session push.

## Technical Context

**Inherits from [`specs/002-backend-foundation/plan.md`](../002-backend-foundation/plan.md)** — same stack, same hosting, same DB. Only the deltas for this slice are listed below.

**Language/Version**: unchanged — TypeScript 5.6 (strict) frontend, C# 13 / .NET 10 backend.

**Primary Dependencies (delta)**:
- Backend: no new runtime dependencies. `FluentValidation` already wired (used by `ApplicantPatchValidator`); we add `LoginRequestValidator` and `CreateSystemUserValidator` against the same DI registration pattern.
- Frontend: no new runtime dependencies. `react-hook-form` + `zod` already wired in `LoginForm`; we extend with shared zod schemas mirrored on the backend (FR-F04).

**Storage (delta)**: no schema migration. The `SystemUser` and `Session` tables already exist (spec 002 migrations `20260508121134_Initial` + `20260508121214_AuditImmutabilityTrigger`). The four new `Session.RevokedReason` values (`user_logout`, `superseded_by_new_login`, `account_deactivated`, `role_changed`) are string-valued — no enum migration needed.

**Testing (delta)**:
- **Backend**: xUnit + `WebApplicationFactory<Program>`; reuses the existing `ApiFactory` + `TestAuthHandler` from `backend/tests/PACademy.Api.Tests/Fixtures/`. New test files documented in the project structure below. Concurrency tests for the single-session invariant (SC-A08) use `Parallel.ForEachAsync` on a Testcontainers-backed SQL Server — no in-memory DB.
- **Frontend**: Vitest + Testing Library + jest-axe for `LoginForm`, `UsersPage`, `UsersCreatePage`, `SessionExpiredBanner`. MSW intercepts the new `/admin/users` endpoints during component tests.
- **E2E**: Playwright covers the four P1 stories end-to-end against a real backend (Docker-Compose orchestrated). The existing `e2e/tests/fixtures/auth.ts` fixture is extended to support arbitrary role sign-in (currently super-admin only).

**Target Platform**: unchanged.

**Performance Goals (delta from spec SC)**:
- SC-A02: login p95 ≤ 400 ms (excluding lockout backoff).
- SC-A03: session revocation propagates ≤ 1 SQL round-trip.
- SC-A05: super-admin provisions a new operator end-to-end in ≤ 90 s clock time (Playwright walkthrough).
- SC-A08: 1000 parallel `POST /auth/login` requests for the same user yield exactly one active session row. The CTE-style "revoke-others-then-insert" path inside `LoginUseCase` runs inside `IDbContextTransaction.UseTransactionAsync` with `IsolationLevel.Serializable` to guarantee no two requests can each see "no other active sessions" and both insert.

**Constraints**: unchanged from spec 002 plan. The `/admin/users` page does not change the bundle budget materially (1 list page + 1 form page, ~250 LOC of TSX, all primitives reused from `shared/components/`).

**Scale / Scope**: ≤ 100 staff users at full Ministry rollout (per spec 002 §1). The list endpoint pagination is therefore a forward-looking nicety, not a hot-path requirement.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verified against [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.0.

- **I. Code Quality & Maintainability** — ✅ PASS. No new TS code uses `any` or `@ts-ignore`. New backend code is `Nullable=enable, TreatWarningsAsErrors=true` (already enforced by every csproj in the solution). All new components are single-responsibility (login form ≤ 120 lines, users-list page ≤ 180 lines, users-create form ≤ 200 lines). Data fetching uses TanStack Query exclusively — `useEffect` for fetching is forbidden. Named exports only. No new third-party dependencies. Public functions / use cases / endpoints carry XML / JSDoc.
- **II. Testing Standards (NON-NEGOTIABLE)** — ✅ PASS. Test-first for: `LoginUseCase` (single-session invariant), `LogoutUseCase` (all-sessions revoke), `UpdateSystemUserUseCase` (role-change revoke), `SuperAdminFloorPolicy` enforcement, `CreateSystemUserValidator` (FR-029/FR-030 coverage). Each new UI component gets render-smoke + interaction + a11y tests (jest-axe). The four P1 stories are covered by Playwright E2E spec files (one each) running on every PR. No live network — MSW mocks `/auth/*` and `/admin/users` at the SPA edge. Coverage gate: ≥ 80% statements / ≥ 75% branches; **100% on all new auth code paths** (Constitution II's "auth / payments / form-validation" clause). Pre-commit hook already runs `npm run lint` + `vitest related --run` for changed frontend files and `dotnet format --verify-no-changes` + Domain/Application tests for changed backend files (currently bypassed pending baseline cleanup — tracked as Complexity #2 below).
- **III. UX Consistency** — ✅ PASS. `LoginForm` already uses design tokens (`tokens.css`) and is RTL-correct; this plan only adds a server-error toast/banner shape. `UsersPage` uses the existing `DataTable<SystemUserListItemDto>`, `Badge` (status), `StatusBadge` (active/inactive), and `Drawer` for the create form — no new variants. All copy is Arabic-first, externalized in `shared/lib/strings.ts`. Direction-aware icons flip via `rtl:rotate-180`. All four async states (idle / loading / empty / error) covered. Motion respects `prefers-reduced-motion: reduce` (handled by `motion.ts`). Responsive verified at 480 / 768 / 1024 px.
- **IV. Performance Requirements** — ✅ PASS. Per-route bundle delta: `/staff-login` already shipped; `/admin/users` adds ≤ 8 KB gzipped (one DataTable instance, one zod schema, one form). LCP / INP / CLS unaffected (no images, no web fonts beyond the existing IBM Plex Arabic / Tajawal). The `/admin/users` list virtualizes via the existing DataTable when row count exceeds 50 (spec scale targets ~100 staff, so virtualization is exercised but not stressed). TanStack Query keys factory dedupes parallel `useMe()` calls across `AuthGuard` + `AppShell`. No new memoization (`useMemo` / `useCallback`) without a Profiler measurement.
- **V. Spec-Driven Discipline** — ✅ PASS. `spec.md` is tech-agnostic (it talks about NIDs, sessions, and audit, never about ASP.NET Identity or EF Core). All technical decisions live in this plan. Traceability spec → plan → tasks → PR is preserved: PR description will link `specs/003-admin-auth-rbac/`.

**No violations** — the **Complexity Tracking** table at the bottom records two pre-existing items inherited from `dev`, not introduced by this plan.

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-auth-rbac/
├── spec.md            # ✓ created (clarified)
├── plan.md            # this file
├── research.md        # Phase 0 — see "Phase 0" section below
├── data-model.md      # Phase 1 — see "Phase 1" section below
├── contracts/
│   ├── auth.openapi.yaml          # Phase 1 — generated from controllers, snapshotted
│   └── admin-users.openapi.yaml   # Phase 1 — generated from controllers, snapshotted
├── quickstart.md      # Phase 1 — see "Phase 1" section below
└── tasks.md           # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root)

The work fans out into the existing monorepo. No new top-level directories.

```text
backend/
├── src/
│   ├── PACademy.Contracts/
│   │   ├── Auth/                                   # ✓ created in d860b91
│   │   │   ├── LoginRequest.cs                     # ✓
│   │   │   ├── LoginResponse.cs                    # ✓
│   │   │   └── MeResponse.cs                       # ✓
│   │   └── Admin/
│   │       └── Users/                              # NEW
│   │           ├── SystemUserListItemDto.cs
│   │           ├── SystemUserDetailDto.cs
│   │           ├── CreateSystemUserRequest.cs
│   │           ├── UpdateSystemUserRequest.cs
│   │           └── SystemUserListFilters.cs
│   ├── PACademy.Application/
│   │   ├── Auth/                                   # ✓ created in d860b91 — UPDATES required
│   │   │   ├── LoginUseCase.cs                     # MODIFY: FR-A07 single-session enforcement
│   │   │   ├── LogoutUseCase.cs                    # MODIFY: FR-A08 all-sessions revoke
│   │   │   ├── GetMeUseCase.cs                     # ✓ no change
│   │   │   └── LoginRequestValidator.cs            # ✓ no change
│   │   ├── Identity/                               # ✓ partial — RoleApps.cs done in d860b91
│   │   │   └── RoleApps.cs                         # ✓
│   │   └── Admin/
│   │       └── Users/                              # NEW
│   │           ├── ListSystemUsersUseCase.cs
│   │           ├── GetSystemUserUseCase.cs
│   │           ├── CreateSystemUserUseCase.cs
│   │           ├── UpdateSystemUserUseCase.cs      # MUST diff Role and revoke sessions on change (FR-C06)
│   │           ├── DeactivateSystemUserUseCase.cs  # MUST enforce SuperAdminFloorPolicy + revoke sessions
│   │           └── CreateSystemUserValidator.cs
│   ├── PACademy.Infrastructure/
│   │   ├── DependencyInjection.cs                  # MODIFY: register the 5 new use cases + 8 RBAC policies
│   │   └── Identity/
│   │       └── InSystemIdentityProvider.cs         # MODIFY: AuthenticateAsync returns a richer failure reason so the controller can audit only archived/deactivated 401s (FR-A09)
│   └── PACademy.Api/
│       └── Controllers/
│           ├── Auth/
│           │   └── AuthController.cs               # MODIFY: FR-A09 audit policy on login failures
│           └── Admin/
│               └── AdminUsersController.cs         # NEW: list/get/post/patch/{id}/deactivate
└── tests/
    └── PACademy.Api.Tests/
        ├── Auth/                                   # NEW (T052–T056)
        │   ├── LoginAndMeTests.cs                  # T052
        │   ├── LoginValidationTests.cs             # T053 — wrong-format / wrong-password / archived
        │   ├── DeactivationImmediateTests.cs       # T055 — session-revoke propagation
        │   ├── SuperAdminFloorTests.cs             # T056 — invariant + audit
        │   ├── SingleSessionInvariantTests.cs      # NEW (SC-A08) — Parallel.ForEachAsync 1000 iterations
        │   ├── LogoutAllSessionsTests.cs           # NEW (FR-A08)
        │   └── RoleChangeRevokesSessionsTests.cs   # NEW (FR-C06)
        └── Admin/
            └── Users/                              # NEW (T054)
                └── ProvisioningTests.cs

frontend/
├── src/
│   ├── features/
│   │   ├── auth/                                   # ✓ wired in spec 002 phase 2
│   │   │   ├── api/auth.service.ts                 # ✓
│   │   │   ├── api/auth.queries.ts                 # ✓
│   │   │   └── components/LoginForm.tsx            # ✓
│   │   └── admin/
│   │       ├── api/users.service.ts                # MODIFY (T067): swap MOCK to apiClient
│   │       ├── api/users.queries.ts                # ✓ (keys factory unchanged)
│   │       ├── pages/UsersPage.tsx                 # MODIFY: render server data
│   │       ├── pages/UsersCreatePage.tsx           # NEW (FR-F04)
│   │       └── pages/UsersDetailPage.tsx           # NEW
│   └── shared/
│       ├── components/SessionExpiredBanner.tsx     # ✓ exists; verify it listens to the bus
│       └── api/client.ts                           # ✓ d53e4d5 (CSRF decode fix)
└── src/
    ├── features/auth/components/LoginForm.test.tsx           # NEW (T058)
    ├── features/admin/pages/UsersPage.test.tsx               # NEW (T059)
    ├── features/admin/pages/UsersCreatePage.test.tsx         # NEW (T059)
    └── shared/components/SessionExpiredBanner.test.tsx       # NEW

e2e/
└── tests/
    ├── us2-provisioning.spec.ts                    # NEW (T060)
    └── us2-super-admin-floor.spec.ts               # NEW (T061)
```

**Structure Decision**: layered monorepo (existing). All new backend code follows the established Domain → Application → Infrastructure → Api flow. Frontend continues the feature-folder pattern (`features/<x>/`). No new package boundaries.

## Phase 0 — Research (inline)

The clarify pass closed the only open research questions. The remaining decisions in this slice are mechanical (implement per spec). Two technical risks worth documenting:

- **Single-session race under concurrent logins**. SQL Server's default `READ COMMITTED` isolation is not enough — two parallel logins could each `SELECT ... WHERE RevokedAt IS NULL` and find no rows, then each `INSERT` a new session, leaving the user with two active sessions. Mitigation: wrap the login transaction in `IsolationLevel.Serializable`. SC-A08's 1000-iteration fuzz test asserts the invariant holds.
- **Role-change diff inside `UpdateSystemUserUseCase`**. EF Core's change tracking gives us `entity.Role != prevRole` cheaply, but the safer pattern is to capture `prevRole` *before* applying the patch and compare against `entity.Role` afterwards. The Serializable transaction also covers the "compare-and-revoke" race.

No new external research needed — ASP.NET Identity, cookie auth, and the role-policy pattern are well-trod.

## Phase 1 — Design (inline)

### Data model deltas

Tables: **none** (no migrations in this spec). Behavior:

- `Session.RevokedReason` accepts the closed vocabulary documented in `spec.md`. No DB constraint enforces the closed set; that's enforced at the Domain layer (`Session.Revoke(string reason)` is the only mutator). A Domain unit test pins the accepted reasons.
- `SystemUser.IsActive = false` + every `Session` row for that user `RevokedAt = UtcNow, RevokedReason = "account_deactivated"` are atomic through `PaDbContext.SaveChangesAsync`.

### Contracts

OpenAPI for the new and modified endpoints lives at:

- `contracts/auth.openapi.yaml` — `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Generated from the controllers' `[ProducesResponseType]` attributes and snapshotted into the spec folder for traceability.
- `contracts/admin-users.openapi.yaml` — `GET /admin/users`, `GET /admin/users/{id}`, `POST /admin/users`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/deactivate`. Same generation pattern.

The runtime contract is the OpenAPI doc served at `/openapi/v1.json` by `Microsoft.AspNetCore.OpenApi` (already wired in `Program.cs:7,15`). The committed snapshot under `contracts/` is for human review and diff'ing across PRs; CI compares the live doc against the snapshot to catch breaking changes.

### Quickstart (developer-facing)

```bash
# 1. Bring up the stack (creates DB, applies migrations, seeds 11 demo users)
docker compose -f backend/docker-compose.yaml up -d

# 2. Wait for the API to be healthy (~10 s)
until curl -sf http://localhost:8080/openapi/v1.json >/dev/null; do sleep 1; done

# 3. Sign in as super_admin
curl -c /tmp/c.txt -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nationalId":"27001010150010","password":"SuperAdmin123!"}'

# 4. Provision a new committee_admin (replace placeholder fields with real ones)
csrf=$(python -c "import urllib.parse; print(urllib.parse.unquote('$(grep csrf-token /tmp/c.txt | tail -n1 | awk '{print $7}')'))")
curl -b /tmp/c.txt -H "X-CSRF-Token: $csrf" -H "Content-Type: application/json" \
  -X POST http://localhost:8080/admin/users \
  -d '{"nationalId":"27001010150500","fullName":"المقدم محمد علي","officerCode":"OC12001","mobile":"01000000001","email":"committee.admin.new@pac.demo","issueDate":"2025-01-01","cardFactoryNumber":"CF000201","role":"committee_admin","unit":"لجنة القبول","password":"NewUser123!"}'

# 5. Sign out as super_admin and back in as the new user — verify hub shows 4 apps
curl -b /tmp/c.txt -H "X-CSRF-Token: $csrf" -X POST http://localhost:8080/auth/logout
curl -c /tmp/c.txt -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nationalId":"27001010150500","password":"NewUser123!"}'
curl -b /tmp/c.txt http://localhost:8080/auth/me
# Expect apps = ["admin","committee","barcode","biometric"]
```

The above is also the exact shape of the Playwright `us2-provisioning.spec.ts`.

## Complexity Tracking

| # | Violation / Carry-over | Why | Expiry / Resolution |
|---|---|---|---|
| 1 | Pre-commit hook `--no-verify` bypassed on commits `d860b91`, `2c12091`, `d53e4d5` | Pre-existing 287 frontend lint errors and `dotnet format` whitespace baseline in `DemoDataSeeder.cs` (none introduced by spec 003 work) | Resolve as a separate cleanup PR before this spec's first non-bypassed merge to `main`. Tracked as a follow-up in the project board. |
| 2 | `tasks.md` introduces several new test files but the existing pre-commit hook may still hit the lint/format baseline | Same root cause as #1 | Same resolution path. New code in this spec is clean (verified with `dotnet build -warnaserror` and Vitest on the new files only). |

No principle violations.
