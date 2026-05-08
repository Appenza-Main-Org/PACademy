---

description: "Task list for feature 002-backend-foundation"
---

# Tasks: Backend foundation — durable admin-app data, identity, audit

**Input**: Design documents from `specs/002-backend-foundation/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories). `research.md`, `data-model.md`, `contracts/` are deferred — the plan has enough shape for a competent task split; companion docs land alongside their phases.

**Tests**: Per constitution Principle II (NON-NEGOTIABLE), test tasks are MANDATORY — not optional. Every user story includes test-first tasks for: business logic (failing test before implementation), each new UI component (render smoke + interaction + a11y), and the critical user journey it represents (Playwright E2E). MSW for frontend network mocking; Testcontainers.MsSql for backend integration. Coverage thresholds enforced in CI: ≥ 80% statements, ≥ 75% branches, 100% on auth + bulk-import-validation paths.

**Organization**: Tasks are grouped by user story so each story can be independently implemented and tested. Phase 1 (Setup) carries forward from spec 001 Phase 1 — already on disk. Phase 2 (Foundational) blocks every user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US7, or `Setup` / `Foundation` / `Polish` for cross-cutting work)
- File paths are repo-root-relative.

## Path Conventions

Web-application monorepo (per plan §Project Structure):
- Frontend: `frontend/src/`, `frontend/src/**/*.test.tsx` (co-located unit tests)
- Backend: `backend/src/`, `backend/tests/`
- E2E: `e2e/tests/`
- Specs: `specs/002-backend-foundation/`
- Constitution: `.specify/memory/constitution.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Backend skeleton + frontend infrastructure. Carries forward from spec 001 Phase 1 (T001–T016 of that spec), still on disk after the Phase 2/3 rollback. Spec 002 adds a thin delta for ClosedXML and a confirm step on the substrate.

- [x] T001 [Setup] **Carry forward from spec 001 Phase 1** — backend solution + 5 src + 3 test projects (`PACademy.Api`, `Application`, `Domain`, `Infrastructure`, `Contracts` + matching test projects), Phase 1 NuGet set (EF Core SqlServer 10, ASP.NET Identity EF 10, FluentValidation.AspNetCore, Serilog.AspNetCore, Serilog.Sinks.MSSqlServer, MediatR, Mvc.Testing, Testcontainers.MsSql, FluentAssertions, xUnit), `<Nullable>enable</Nullable>` + `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` + `<LangVersion>latest</LangVersion>` per csproj, `backend/docker-compose.yaml` with SQL Server 2022 + API and a 30 s healthcheck, `backend/src/PACademy.Api/Dockerfile`. **Verification only — no new code**.
- [x] T002 [Setup] **Carry forward from spec 001 Phase 1** — frontend infrastructure: `axios` + `frontend/src/shared/api/{client,errors,index}.ts` (CSRF interceptor, typed `ApiError`), Vitest + Testing Library + jest-axe + `vitest.config.ts` + `vitest.setup.ts`, MSW + `frontend/src/test/msw/{server,handlers}.ts`, `e2e/` workspace + Playwright + Chromium, `frontend/.eslintrc.cjs` (boundaries + no-default-export + no-useEffect-fetch heuristic) + `frontend/.prettierrc`, `.husky/pre-commit`, `frontend/lighthouserc.json`, `frontend/src/shared/lib/strings.ts`, `frontend/src/vite-env.d.ts`. **Verification only — no new code**.
- [x] T003 [P] [Setup] Add **`ClosedXML`** NuGet package to `backend/src/PACademy.Infrastructure/PACademy.Infrastructure.csproj` (latest stable, MIT-licensed, ~250 KB). Plan §10 / Complexity Tracking justification — required for FR-025 .xlsx ingestion.
- [x] T004 [P] [Setup] Extend `frontend/src/shared/lib/strings.ts` with the new error-state copy this feature introduces: `superAdminFloorBlocked` (FR-005a), `bulkImportInProgress`, `bulkImportPartialSuccess` (with row-count placeholders), `bulkImportRowCapExceeded`, `nationalIdLoginInvalidFormat`. Both `ar` and `en` keys.

**Checkpoint**: Backend solution builds cleanly with ClosedXML restored; frontend strings expanded for the new error states. No business logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth substrate, audit substrate, demo-seed scaffolding, report-snapshot infrastructure, and the apiClient wiring that every user story depends on.

**⚠️ CRITICAL**: No user story (US1–US7) can begin until this phase is complete.

### Database + EF Core core

- [x] T005 [P] [Foundation] Create `backend/src/PACademy.Domain/Common/AggregateRoot.cs`, `Entity.cs`, `ValueObject.cs`, `ISoftDeletable.cs` (interface marking `Archived` flag + `ArchivedAt`). Pure POCO, no EF refs.
- [x] T006 [P] [Foundation] Create `backend/src/PACademy.Domain/Audit/IAuditableWrite.cs` — marker interface for entities whose writes emit audit entries.
- [x] T007 [P] [Foundation] Domain entity files in `PACademy.Domain/`: `Applicants/Applicant.cs` (+ `ApplicantStatus.cs` enum), `Applicants/ApplicantStageSubmission.cs` (column reserved for the future applicant-portal feature), `Cycles/Cycle.cs` (+ `CycleStatus.cs`), `Categories/Category.cs`, `Workflows/Workflow.cs`, `AdmissionRules/AdmissionRule.cs`, `ReferenceData/ReferenceDataEntry.cs` (+ soft-delete fields per FR-015), `Sessions/Session.cs`, `Audit/AuditEntry.cs` (+ self-referencing `BatchId` per research §9 + plan Complexity Tracking) (+ `AuditAction.cs`, `AuditOutcome.cs` enums). All implement `IAuditableWrite` where their writes must be audited (per FR-007).
- [x] T008 [P] [Foundation] Create `backend/src/PACademy.Infrastructure/Identity/SystemUser.cs` — `SystemUser : IdentityUser<Guid>` with the FR-029 fields: `OfficerCode`, `FullName`, `Mobile`, `IsActive`, `IssueDate`, `CardFactoryNumber`, `Role`, `Unit`, `DemoOrigin`, plus `Archived` + `ArchivedAt` (FR-015). `NationalId` is mirrored to `IdentityUser.UserName` per plan research §12 (set on every user; not a separate column). `Email` comes from `IdentityUser` directly.
- [x] T009 [Foundation] Create `backend/src/PACademy.Infrastructure/Persistence/PaDbContext.cs` (inherits `IdentityDbContext<SystemUser, IdentityRole<Guid>, Guid>`). Override `SaveChangesAsync` to (a) honour soft-delete by translating `Remove` → `Archived = true` + `ArchivedAt = utcNow`, (b) emit audit entries for every `IAuditableWrite` change directly via change-tracker (circular-dep-safe redesign: PaDbContext writes directly to AuditEntries DbSet; IAuditWriter is used only by external callers).
- [x] T010 [Foundation] Create `backend/src/PACademy.Infrastructure/Persistence/Configurations/` — one EF Core fluent-API configuration per entity (Applicant, ApplicantStageSubmission, Cycle, Category, Workflow, AdmissionRule, ReferenceDataEntry, Session, AuditEntry, SystemUser). Apply collation `Arabic_100_CI_AS_SC_UTF8` on Arabic search-participating fields (applicant FullName, audit TargetLabel, cycle / category / workflow / reference-data Arabic name fields, system_user FullName). Configure unique constraints per FR-029 on `system_users` filtered to active rows: `NationalId` (mirrored from `UserName`), `OfficerCode`, `Email`, `Mobile`, `CardFactoryNumber`. Configure unique on `applicants` `(CycleId, NationalId)` per FR-016. CHECK constraints on enum-modelled status fields.
- [x] T011 [Foundation] Create initial EF Core migration `Initial` covering all tables in T010 plus the ASP.NET Core Identity tables. Include all FR-014 DB constraints (uniques, FKs, CHECKs) and indexes on `audit_entries(target_type, target_id, occurred_at)` and `audit_entries(actor_id, occurred_at)` plus `audit_entries(batch_id)` (the bulk-children drilldown index). Include the `archived` filtered indexes for soft-delete-aware queries.
- [x] T012 [Foundation] Enforce audit immutability (FR-008). Add a follow-up migration `AuditImmutabilityTrigger` that creates SQL Server trigger `tr_audit_entries_immutable` on `audit_entries` raising on `UPDATE` and `DELETE` (`THROW 51000, 'audit_entries are immutable', 1;`). The migration also `DENY UPDATE, DELETE` on `audit_entries` to the application's runtime DB user (separate from the migration user). Add an integration test in `PACademy.Api.Tests/Audit/ImmutabilityTests.cs` asserting that direct `UPDATE` and `DELETE` against the table both fail.
- [x] T013 [Foundation] Add a follow-up migration applying SQL Server collation `Arabic_100_CI_AS_SC_UTF8` (UTF-8, supplementary characters; SQL Server 2019+) at the column level on text fields that participate in admin search (covers what T010 declared via fluent-API; this migration is the wire-level confirmation). Verify EF Core's `UseCollation(...)` survives the migration round-trip. _(collation applied via fluent-API config in T010; migration generated and builds cleanly)_

### Auth substrate

- [x] T014 [P] [Foundation] Define `IIdentityProvider` in `backend/src/PACademy.Application/Identity/IIdentityProvider.cs` (methods: `AuthenticateAsync(nationalId, password)`, `GetUserAsync(id)`, `CreateUserAsync(...)`, `DeactivateAsync(id)`). The `nationalId` parameter (not `username`) reflects FR-003.
- [x] T015 [P] [Foundation] Implement `InSystemIdentityProvider` in `backend/src/PACademy.Infrastructure/Identity/InSystemIdentityProvider.cs` — wraps ASP.NET Core Identity's `UserManager` + `SignInManager`. Looks up users by `UserName` (which we've mirrored from `NationalId` per plan §12). On `CreateUserAsync`, sets `UserName = NationalId` and the FR-029 profile fields.
- [x] T015a [P] [Foundation] Define `IIdentityProvider.RequiresSecondFactorAsync(nationalId)` returning `false` always — the seam for FR-031 2FA. The 2FA follow-up feature swaps the implementation to call the external Ministry API; today it's a no-op.
- [x] T016 [Foundation] Configure cookie auth + CORS in `backend/src/PACademy.Api/Program.cs`. Auth: `AddAuthentication(CookieAuthenticationDefaults...).AddCookie(...)` with `SameSite=Strict`, `HttpOnly=true`, `SecurePolicy=SameAsRequest` (so `WebApplicationFactory` HTTP TestServer accepts cookies; production runs on HTTPS so the cookie is still Secure-only on the wire), sliding expiration tied to `Auth:SessionTimeoutMinutes` setting (FR-004). CORS: read allowed origins from `Cors:AllowedOrigins`; enable `AllowCredentials()` so the frontend's `withCredentials: true` apiClient (from spec 001 Phase 1) can send cookies; deny all other origins by default. Wildcard origin alongside credentials is forbidden — assert via test in `PACademy.Api.Tests/Cors/CorsConfigTests.cs`.
- [x] T017 [Foundation] Server-side session middleware (FR-005). Add a `Session` DbSet (already in T007). Add a request middleware in `PACademy.Api/Middleware/SessionMiddleware.cs` that loads the session per request (claim `sid`), refreshes `LastSeenAt`, and rejects revoked sessions with 401 + `code: SESSION_REVOKED`.
- [x] T018 [P] [Foundation] CSRF middleware in `PACademy.Api/Middleware/CsrfMiddleware.cs`: double-submit token on every non-GET admin request. Issue cookie `csrf-token` (HttpOnly=false so the SPA can read it); require header `X-CSRF-Token` matching the cookie on mutating requests. Skip for any `/dev/*` route in Development.

### Audit substrate

- [x] T019 [Foundation] Define `IAuditWriter` in `backend/src/PACademy.Application/Audit/IAuditWriter.cs`. Single-row method `RecordAsync(action, targetType, targetId, targetLabel, outcome, beforeJson?, afterJson?)`. Bulk-method overload `RecordBulkAsync(summary, children)` per plan §10 / FR-028 — used when `SqlBulkCopy` bypasses the EF audit hook.
- [x] T020 [Foundation] Implement `AuditWriter` in `backend/src/PACademy.Infrastructure/Audit/AuditWriter.cs`. Single-row path appends to `PaDbContext.AuditEntries`. Bulk path opens a `SqlConnection` + `SqlTransaction`, writes the summary entry via `INSERT`, then `SqlBulkCopy` the per-row children with `BatchSize = 10000` and `CheckConstraints = true`, all inside the same transaction so a chunk failure rolls back coherently.
- [x] T021 [Foundation] Implement `ICurrentUser` in `PACademy.Application/Common/ICurrentUser.cs` + `HttpContextCurrentUser` in `PACademy.Infrastructure/Identity/HttpContextCurrentUser.cs` (claims-based: `NameIdentifier`, `Name`, IP). PaDbContext's audit override (T009) calls this for the actor.
- [x] T022 [Foundation] Wire global exception middleware in `PACademy.Api/Middleware/GlobalExceptionMiddleware.cs`: `ValidationException` → 400 + `ApiProblemDetails`; `DomainConflictException` → 409; `UnauthorizedAccessException` → 403 + an audit entry with outcome=permission-denied via `IAuditWriter` (T019).
- [x] T023 [P] [Foundation] Define `DomainConflictException` in `PACademy.Application/Common/DomainConflictException.cs`.

### Domain rules

- [x] T024 [P] [Foundation] Implement `SuperAdminFloorPolicy` in `PACademy.Domain/Identity/SuperAdminFloorPolicy.cs` enforcing FR-005a — refuse to deactivate the last active super-admin. Pure domain rule, takes a count of active super-admins as input, returns allow/deny + reason. Unit-tested in `PACademy.Domain.Tests/Identity/SuperAdminFloorPolicyTests.cs`.
- [x] T025 [P] [Foundation] Implement `EgyptianNationalIdParser` in `PACademy.Application/Common/EgyptianNationalIdParser.cs` — validates 14-digit format + parses century / DoB / gender. Used by the SystemUser validator (FR-030). Unit-tested in `PACademy.Application.Tests/Common/EgyptianNationalIdParserTests.cs`.
- [x] T026 [P] [Foundation] FluentValidation `SystemUserValidator` in `PACademy.Application/Identity/SystemUserValidator.cs` enforcing FR-030: `nationalId` (14-digit + parser-valid), `mobile` (Egyptian 010/011/012/015 + 11 digits), `email` (standard format), `issueDate` (not in future), `officerCode` + `cardFactoryNumber` (alphanumeric ≤ 32 chars). All required (FR-029). Unit-tested in `PACademy.Application.Tests/Identity/SystemUserValidatorTests.cs`.

### Mock-data seed migration scaffold (FR-017 / FR-018)

- [x] T027 [Foundation] Port the frontend's deterministic mock dataset (`frontend/src/shared/mock-data/seed.ts`, LCG seed=42) and dictionaries to `backend/src/PACademy.Infrastructure/Seeding/DemoDataSeeder.cs`. The seeder produces, in order: the active **cycles**, **categories**, **workflows**, **admission_rules**, and **reference_data** that the frontend already shows; **11 system_users** (one per RBAC role with development-only passwords sealed in `appsettings.Development.json` — each user carries the FR-029 fields populated with deterministic synthetic values: valid `nationalId`, unique `officerCode`, Arabic `fullName` matching the role label, unique Egyptian-format `mobile`, unique `email`, `isActive=true`, an `issueDate` in the recent past, unique `cardFactoryNumber`); **240 applicants** + their audit-trail row stubs; **80 audit_entries** matching the existing `/admin/audit` page. All rows carry `demo_origin = true` (permanent provenance per FR-017). Hook into `Program.cs` startup behind a `--seed-demo` CLI arg (default off in non-dev environments).
- [x] T028 [Foundation] Parity test in `PACademy.Api.Tests/Seeding/SeedParityTests.cs` asserting specific applicant national_ids exist at known indices after seeding (catches JS-LCG vs C#-LCG drift). Plus assertions that all 11 RBAC role users exist with valid FR-029 fields.

### Reports substrate

- [x] T029 [P] [Foundation] Add migration creating report-snapshot tables `reports_registration_tempo`, `reports_stage_funnel`, `reports_operational_status`. Each table carries a `last_refreshed_at` UTC timestamp column; schema mirrors the aggregation output for the corresponding panel.
- [x] T030 [Foundation] Add a hosted .NET `BackgroundService` (`ReportSnapshotsRefresher` in `PACademy.Infrastructure/Reports/`) that fires every 60 seconds, runs the aggregation queries against live tables, and `MERGE`s the results into the snapshot tables in a single transaction per snapshot. Wire it as a hosted service in `Program.cs`. Update each snapshot's `last_refreshed_at`.

### Frontend wiring

- [x] T031 [Foundation] Update `frontend/src/App.tsx` to gate `ensureDemoUser()` auto-seed behind `import.meta.env.VITE_DEMO_MODE === 'true'`. Backend auth is the new source of truth; demo mode keeps the role-picker shortcut.
- [x] T032 [Foundation] Update `frontend/src/features/auth/api/auth.service.ts`: `login(nationalId, password)` → `apiClient.post('/auth/login', { nationalId, password })`; `logout` → `apiClient.post('/auth/logout')`; `me` → `apiClient.get('/auth/me')`. Update the `LoginCredentials` type to use `nationalId` (not `username`). Update the JSDoc `INTEGRATION CONTRACT` block to point at the OpenAPI path.
- [x] T033 [Foundation] `frontend/src/features/auth/components/LoginForm.tsx` field label already "الرقم القومي" (14-digit, ltr direction). Updated mutation call from `username:` to `nationalId:`.
- [x] T034 [Foundation] Update `frontend/src/features/auth/AuthGuard.tsx` to drive off a `useMe()` query (TanStack Query) instead of Zustand-only state. Persistence of session lives server-side (FR-004); the Zustand store is now a UX cache only. Add `useMe()` to `frontend/src/features/auth/api/auth.queries.ts`.
- [x] T035 [P] [Foundation] Add `frontend/src/shared/components/SessionExpiredBanner.tsx` (new component) shown when `apiClient` 401-interceptor fires; uses centralised strings; Constitution III four-state compliance. Mounted once in `App.tsx`.

### Test infrastructure

- [x] T036 [P] [Foundation] Create `backend/tests/PACademy.Api.Tests/Fixtures/SqlServerFixture.cs` — Testcontainers.MsSql singleton fixture (image `mcr.microsoft.com/mssql/server:2022-latest`, `ACCEPT_EULA=Y`, Developer edition). Ephemeral DB per test class; applies migrations automatically. Note: the SQL Server image is ~2 GB and takes ~20–30 s to boot; CI test wallclock is materially longer than a Postgres equivalent — budget for it in the test plan.
- [x] T037 [P] [Foundation] Create `backend/tests/PACademy.Api.Tests/Fixtures/ApiFactory.cs` — `WebApplicationFactory<Program>` configured to use the `SqlServerFixture`'s connection string. Optional `seedDemo` flag triggers `DemoDataSeeder.SeedAsync()` before tests run.
- [x] T038 [P] [Foundation] Add `e2e/tests/fixtures/auth.ts` — Playwright fixture that signs in as a given role using a real backend session. Reads the seeded password from `appsettings.Development.json` via env-var override.

**Checkpoint**: Foundation ready — all seven user stories can begin in parallel. Backend serves `/auth/login` (nationalId-keyed) + `/auth/me`. Schema + audit + report-snapshots in place. Frontend's `apiClient` wired and demo-mode toggle works.

---

## Phase 3: User Story 1 — Admin edits persist + propagate (Priority: P1) 🎯 MVP

**Goal**: An admin updates an applicant or configuration record; another admin on a different machine sees the change after a refresh; the change survives server restart. (US1 is the spec's MVP — the foundational story that proves storage + propagation work end-to-end.)

**Independent Test**: Per spec §US1 — Admin A flips applicant X's status to "مقبول"; Admin B on a separate browser context refreshes `/admin/applicants/X` within the propagation window and sees the new value. Restart the API process; the value is still readable.

### Tests for User Story 1 (REQUIRED — Constitution Principle II) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation. UI components additionally require render smoke + interaction + a11y.**

- [x] T039 [P] [US1] Backend integration test: PATCH `/admin/applicants/{id}` with status change → applicant fetch returns the new status; audit_entry row appears with actor, target, field, old/new values, occurred_at, outcome=success. **Additionally** assert that editing a `demo_origin = true` applicant preserves the flag — re-fetch after PATCH and confirm `demoOrigin === true` (FR-017 permanence per resolved-clarification #3). In `backend/tests/PACademy.Api.Tests/Admin/Applicants/UpdateAndPropagateTests.cs`.
- [x] T040 [P] [US1] Backend integration test: applicant insert → GET `/admin/applicants` returns within the SC-002 propagation budget (p95 ≤ 2 s on the test SQL Server; relaxed wall-clock budget on CI to absorb container spin-up). In `Admin/Applicants/PropagationTests.cs`.
- [x] T041 [P] [US1] Backend integration test: pagination + filtering + sorting on 1k seeded applicants returns p95 ≤ 500 ms (SC-003 lower-bound). `[Trait("Category", "Heavy")]` to gate behind a CI tier. In `Admin/Applicants/ListPerfTests.cs`.
- [x] T042 [P] [US1] Backend integration test: applicant in cycle A is not visible to admin filtering by cycle B (FR-016 isolation). In `Admin/Applicants/CycleIsolationTests.cs`.
- [x] T043 [P] [US1] Frontend Vitest: `ApplicantsListPage` renders DataTable with the four async states; filters update the URL search params; row-click navigates to detail; a11y assertion via jest-axe.
- [x] T044 [P] [US1] Frontend Vitest: `ApplicantDetailPage` and `ApplicantEditPage` render saved values from the fetched applicant; submit flow renders idle → loading → success / error states; failure preserves form values and announces error to AT.
- [x] T045 [P] [US1] Playwright E2E: Admin A flips applicant X's status; Admin B in a separate browser context refreshes within 5 s and sees the new status; both visit `/admin/audit` and see the same entry with diff. In `e2e/tests/us1-edit-propagation.spec.ts`. _(Self-skips when backend isn't reachable.)_

### Implementation for User Story 1

- [x] T046 [P] [US1] DTOs in `PACademy.Contracts/Admin/Applicants/`: `ApplicantListItemDto`, `ApplicantDetailDto`, `ApplicantPatchDto`, `ApplicantListFilters` (cycleId, status, q, page, pageSize, sortBy, sortDir).
- [x] T047 [US1] Application use cases in `PACademy.Application/Admin/Applicants/`: `ListApplicantsUseCase` (pagination + filter + sort), `GetApplicantUseCase`, `UpdateApplicantUseCase` (per-field PATCH; RBAC pre-check; concurrent writes use silent last-write-wins per FR-014). Validators with FluentValidation.
- [x] T048 [US1] Controllers in `PACademy.Api/Controllers/Admin/`: `AdminApplicantsController` — GET list (returns paginated payload with `X-Total-Count` and `X-Page-Count` headers per plan Constitution Check IV mitigation), GET `/{id}`, PATCH `/{id}`. Routes guarded by `[Authorize(Policy = "AppAccess:admin")]` _(policy carved out from T065; full RBAC matrix lands in Phase 4)_.
- [x] T049 [US1] Frontend: `frontend/src/features/applicants/api/applicants.service.ts` — swap `list`, `get`, `update` method bodies from MOCK to apiClient. Keep `applicantKeys` factory unchanged so consuming `*.queries.ts` files don't break. _(VITE_DEMO_MODE=true keeps the entire service on MOCK for the role-picker shortcut.)_
- [ ] T050 [US1] Frontend: `frontend/src/features/admin/pages/ApplicantsListPage.tsx` — verify DataTable virtualisation kicks in at 10k rows (manual-test task documented; the page itself doesn't change because the service swap is contract-compatible). _(Manual verification deferred — backend can't yet seed 10k rows.)_
- [x] T051 [US1] Frontend: `ApplicantDetailPage` and `ApplicantEditPage` — render server-returned `lastModifiedBy` + `lastModifiedAt` indicator on the detail page so US1's "by X at Y" acceptance scenario is visible. The edit page consumes `useUpdateApplicantMutation` (already exists from MOCK days).

**Checkpoint**: Admin list + detail + edit are live against real storage. Audit propagation visible. US1 deployable as MVP.

---

## Phase 4: User Story 2 — Admin sign-in + RBAC (Priority: P1)

**Goal**: A super-admin provisions a new account; the new admin signs in with their `nationalId` + password, lands on the hub showing only the apps their role permits, and gets logged out immediately when the super-admin deactivates them. The super-admin floor (FR-005a) prevents bricking.

**Carry-forward from Phase 3** (per [plan.md §Plan reconciliation](./plan.md#plan-reconciliation--2026-05-08-post-phase-3-implementation--clarify-pass)):
- `AppAccess:admin` policy already registered → T065 scope shrunk to the remaining 8 app policies + `Role:super_admin`.
- `TestAuthHandler` already exists in `PACademy.Api.Tests/Fixtures/` for integration-test auth bypass. Phase 4 tests can also use it OR exercise the real `/auth/login` flow (preferred for T052/T053). Either works against the same `ApiFactory`.
- `IIdentityProvider` + `InSystemIdentityProvider` already implement `AuthenticateAsync(nationalId, password)` and `RequiresSecondFactorAsync` (FR-031 seam, returns false). T063's `LoginUseCase` calls these.
- `ICurrentUser` + `HttpContextCurrentUser` already wired. Auth controllers can pull actor info from there for audit emission.
- `DomainConflictException` → 422 globally (per Resolved Clarification #19). Super-admin floor (T056) keeps `UnauthorizedAccessException` → 403 because permission-denied semantics fit better than "unprocessable entity".

**Additional `strings.ts` keys** needed by Phase 4 are folded into T068 (see updated wording below). The `superAdminFloorBlocked` key already exists from T004.

**Independent Test**: Per spec §US2 — super-admin provisions a committee_admin → that user signs in with the assigned nationalId + password → sidebar shows admin/committee/barcode/biometric only → super-admin deactivates them → next request fails with 401.

### Tests for User Story 2 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T052 [P] [US2] Backend integration test: POST `/auth/login` with valid nationalId + password → 200 + cookie; subsequent `/auth/me` returns the user. In `Auth/LoginAndMeTests.cs`.
- [ ] T053 [P] [US2] Backend integration test: POST `/auth/login` with nationalId in wrong format → 400. With wrong password → 401. With archived account → 401 + audit-entry outcome=permission-denied. In `Auth/LoginValidationTests.cs`.
- [ ] T054 [P] [US2] Backend integration test: super-admin POST `/admin/users` to create a committee_admin → that user's `/auth/login` succeeds; their `/auth/me` returns the seeded apps from RBAC matrix; their attempt to GET an unauthorised app's endpoint returns 403. In `Admin/Users/ProvisioningTests.cs`.
- [ ] T055 [P] [US2] Backend integration test: super-admin POST `/admin/users/{id}/deactivate` → the deactivated user's next request returns 401 (session middleware revokes). In `Auth/DeactivationImmediateTests.cs`.
- [ ] T056 [P] [US2] Backend integration test: super-admin attempts to deactivate the last active super-admin → 403 + audit-entry outcome=permission-denied + `code: SUPER_ADMIN_FLOOR_BLOCKED`. In `Auth/SuperAdminFloorTests.cs`. _Note: deliberate 403 (not 422) — `DeactivateUserUseCase` raises `UnauthorizedAccessException` (mapped to 403 + permission-denied audit entry) rather than `DomainConflictException` (now mapped to 422 per Resolved Clarification #19)._
- [ ] T057 [P] [US2] Backend unit test: `SystemUserValidator` covered for all FR-030 rules. Already declared in T026; this task is the assertion that all 8 fields have positive + negative cases.
- [ ] T058 [P] [US2] Frontend Vitest: `LoginForm` renders nationalId field with 14-digit mask + ltr direction; submit-disabled until valid format; renders idle → loading → success → error states; a11y assertion.
- [ ] T059 [P] [US2] Frontend Vitest: `UsersPage` (admin user-mgmt) renders DataTable with the 11 seeded RBAC users; the deactivate action shows a confirmation dialog; the create-user form validates the FR-029/FR-030 rules client-side.
- [ ] T060 [P] [US2] Playwright E2E: super-admin signs in → navigates to `/admin/users` → creates a new committee_admin user → signs out → signs in as the new user → lands on hub with only the four committee_admin apps visible. In `e2e/tests/us2-provisioning.spec.ts`.
- [ ] T061 [P] [US2] Playwright E2E: super-admin deactivates self when other super-admin exists (allowed) → next request fails. Then attempts to deactivate the only remaining super-admin (blocked) → 403. In `e2e/tests/us2-super-admin-floor.spec.ts`.

### Implementation for User Story 2

- [ ] T062 [P] [US2] DTOs in `PACademy.Contracts/Auth/`: `LoginRequest { nationalId, password }`, `LoginResponse` (mirrors `AuthUser`), `MeResponse`. In `PACademy.Contracts/Admin/Users/`: `SystemUserListItemDto`, `SystemUserDetailDto`, `CreateSystemUserRequest`, `UpdateSystemUserRequest`.
- [ ] T063 [US2] Application use cases in `PACademy.Application/Auth/`: `LoginUseCase` (calls `IIdentityProvider.AuthenticateAsync(nationalId, password)`, mints `Session`, signs cookie, audits the login event), `LogoutUseCase` (revokes the session row, signs out the cookie, audits). In `PACademy.Application/Admin/Users/`: `ListUsersUseCase`, `GetUserUseCase`, `CreateUserUseCase` (validates FR-029/FR-030 via `SystemUserValidator`; calls `IIdentityProvider.CreateUserAsync`), `DeactivateUserUseCase` (calls `SuperAdminFloorPolicy` first; if allowed, calls `IIdentityProvider.DeactivateAsync` and revokes all active sessions for that user).
- [ ] T064 [US2] Controllers: `AuthController` (POST login, POST logout, GET me) in `PACademy.Api/Controllers/Auth/`. `AdminUsersController` (GET list, GET `/{id}`, POST, PATCH `/{id}`, POST `/{id}/deactivate`) in `PACademy.Api/Controllers/Admin/`. Routes guarded by `[Authorize(Policy = "Role:super_admin")]` for user-management endpoints.
- [ ] T065 [US2] RBAC policy registration in `Infrastructure/DependencyInjection.cs`. **Scope shrunk** in Phase 3 — `AppAccess:admin` already registered (carved out from this task). T065 now adds the remaining policies: `AppAccess:committee`, `AppAccess:board`, `AppAccess:investigations`, `AppAccess:medical`, `AppAccess:barcode`, `AppAccess:biometric`, `AppAccess:exams`, `AppAccess:applicant`, plus role-tier `Role:super_admin` (used by user-management endpoints). The `apps` claim list is populated on cookie issue from the seeded RBAC matrix (mirrors `frontend/src/features/auth/rbac.ts`).
- [ ] T066 [US2] Frontend: `auth.queries.ts` `useLoginMutation` → server-truth `useMe` query refetches on success; the existing `useAuthStore` becomes a UX cache only (already wired in T034).
- [ ] T067 [US2] Frontend: `frontend/src/features/admin/api/users.service.ts` — swap `list`, `get`, `create`, `update`, `deactivate` method bodies from MOCK to apiClient. Keep `userKeys` factory.
- [ ] T068 [US2] Frontend: `UsersPage` (`frontend/src/features/admin/pages/UsersPage.tsx`) — render the FR-029 fields in the DataTable columns (nationalId, officerCode, fullName, role, isActive). Wire the create-user form to validate the FR-030 rules client-side via zod (mirrors `SystemUserValidator`). Wire the deactivate action with a confirmation dialog plus the `SUPER_ADMIN_FLOOR_BLOCKED` error-state copy if the API returns it (T004 strings). **Also extend [`frontend/src/shared/lib/strings.ts`](../../frontend/src/shared/lib/strings.ts) with `accountDeactivated` (used when a 401 fires after the actor's session was revoked by deactivation) and `loginInvalid` (generic catch-all for `/auth/login` 401s — wrong NID or password). Both `ar` + `en`.**

**Checkpoint**: Real auth replaces the role-picker. RBAC enforced. Provisioning + deactivation work. The super-admin floor prevents bricking. US1 + US2 deployable.

---

## Phase 5: User Story 3 — Audit log queryable (Priority: P1)

**Goal**: Admin opens `/admin/audit`, filters by actor / target / action / date range, and sees the live audit log. Direct UPDATE / DELETE against the audit table is rejected by the storage layer.

**Independent Test**: Per spec §US3 — Admin A flips applicant X's status; Admin B opens `/admin/audit`, filters by actor=A, sees the entry with diff. Direct SQL `UPDATE audit_entries SET ... WHERE id = ...` raises 51000.

### Tests for User Story 3 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T069 [P] [US3] Backend integration test: GET `/admin/audit` with filter by actor returns p95 ≤ 1 s against a seeded 1M-row table (uses the heavier seeded fixture; `[Trait("Category", "Heavy")]`). In `Admin/Audit/AuditQueryPerfTests.cs`.
- [ ] T070 [P] [US3] Backend integration test: GET `/admin/audit` with filter by target_type + target_id returns only entries matching that target. In `Admin/Audit/AuditFilterTests.cs`.
- [ ] T071 [P] [US3] Backend integration test: A failed validation attempt produces an audit_entry with outcome=validation-failed. A 403 from RBAC produces an entry with outcome=permission-denied. In `Admin/Audit/AuditOutcomeTests.cs`.
- [ ] T072 [P] [US3] Backend integration test: T012's `ImmutabilityTests.cs` asserts UPDATE / DELETE against `audit_entries` both raise `'audit_entries are immutable'`. (Already declared in Phase 2; this task is the cross-reference.)
- [ ] T073 [P] [US3] Frontend Vitest: `AuditPage` renders DataTable with the four async states; filters update URL search params; clicking a target navigates to the target's detail page.
- [ ] T074 [P] [US3] Playwright E2E: Admin A flips applicant X's status, Admin B in another context visits `/admin/audit`, finds the entry, drills into it and sees the field-level diff. In `e2e/tests/us3-audit-flow.spec.ts`.

### Implementation for User Story 3

- [ ] T075 [P] [US3] DTOs in `PACademy.Contracts/Admin/Audit/`: `AuditEntryDto`, `AuditListFilters` (actor, targetType, targetId, action, dateFrom, dateTo, page, pageSize).
- [ ] T076 [US3] Application use case `ListAuditEntriesUseCase` in `PACademy.Application/Admin/Audit/`. Composite-index-friendly filter: `(target_type, target_id, occurred_at)` and `(actor_id, occurred_at)` — choose the index based on which filters are populated.
- [ ] T077 [US3] Controller `AuditController.List` in `PACademy.Api/Controllers/Admin/`. Returns paginated payload with `X-Total-Count` + `X-Page-Count` headers.
- [ ] T078 [US3] Frontend: `frontend/src/features/audit/api/audit.service.ts` — swap `list` method body from MOCK to apiClient. Keep `auditKeys`.
- [ ] T079 [US3] Frontend: `AuditPage` — wire filter form to URL search params and `useAuditQuery`. Render the diff inline using the existing field-diff component (no UI work; consumes the DTO).

**Checkpoint**: Audit is the legal record. US1 + US2 + US3 deployable. The system meets the Ministry's compliance bar.

---

## Phase 6: User Story 4 — Cycles / categories / workflows / admission rules / reference-data CRUD (Priority: P2)

**Goal**: Super-admin creates / edits / archives the configuration objects that drive every applicant decision. Historical applicant records preserve the values that applied at the time of submission (FR-002).

**Independent Test**: Per spec §US4 — super-admin creates "2027 Female" cycle + 3 reference-data rows; another super-admin sees them within propagation window; a historical applicant who selected the prior name of a renamed faculty still shows the prior name on their record.

### Tests for User Story 4 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T080 [P] [US4] Backend integration test: cycle CRUD round-trip (create / list / get / patch / archive) — assert audit entries on every write. In `Admin/Cycles/CrudTests.cs`.
- [ ] T081 [P] [US4] Backend integration test: category CRUD round-trip; same assertions. In `Admin/Categories/CrudTests.cs`.
- [ ] T082 [P] [US4] Backend integration test: workflow CRUD round-trip; the workflow's nested stage / test JSON survives serialise / deserialise. In `Admin/Workflows/CrudTests.cs`.
- [ ] T083 [P] [US4] Backend integration test: admission-rule CRUD round-trip + version bump on each save (FR-002 historical preservation). In `Admin/AdmissionRules/CrudTests.cs`.
- [ ] T084 [P] [US4] Backend integration test: reference-data row archive → historical applicant referencing the archived row still displays the original value. In `Admin/ReferenceData/HistoricalPreservationTests.cs`.
- [ ] T085 [P] [US4] Frontend Vitest: each of `CyclesPage`, `CategoriesListPage`, `WorkflowsListPage`, `AdmissionRulesPage`, `ReferenceDataPage` smoke + filter + a11y. (Five test files.)
- [ ] T086 [P] [US4] Playwright E2E: super-admin creates a cycle + adds 3 reference-data rows; second super-admin context refreshes and sees them. In `e2e/tests/us4-config-propagation.spec.ts`.

### Implementation for User Story 4

- [ ] T087 [P] [US4] DTOs in `PACademy.Contracts/Admin/{Cycles,Categories,Workflows,AdmissionRules,ReferenceData}/` — list-item, detail, create, update shapes. Five resource families.
- [ ] T088 [US4] Application use cases per resource: `List`, `Get`, `Create`, `Update`, `Archive`. Five resource families × 5 = 25 use cases. Co-located in `PACademy.Application/Admin/<Resource>/`.
- [ ] T089 [US4] Controllers per resource in `PACademy.Api/Controllers/Admin/`: `CyclesController`, `CategoriesController`, `WorkflowsController`, `AdmissionRulesController`, `ReferenceDataController`. Standard REST shape (GET list, GET `/{id}`, POST, PATCH `/{id}`, DELETE `/{id}` — DELETE soft-deletes per FR-015).
- [ ] T090 [US4] Frontend: swap `cycles.service.ts`, `categories.service.ts`, `workflows.service.ts`, `admissionRules.service.ts`, `referenceData.service.ts` method bodies from MOCK to apiClient. Five service files.
- [ ] T091 [US4] Frontend: verify `CyclesPage`, `CategoriesListPage`, `WorkflowsListPage`, `AdmissionRulesPage`, `ReferenceDataPage` and their detail/edit/new pages still work — no UI changes expected (service-body swap).

**Checkpoint**: Configuration is durable + audited. US1–US4 deployable.

---

## Phase 7: User Story 5 — Demo seed migration (Priority: P2)

**Goal**: A fresh platform can be brought up against a clean SQL Server, the migration runs, the demo seed lands, and `/admin/applicants` lists 240 demo applicants identical to the legacy frontend mock.

**Independent Test**: Per spec §US5 — bring up a fresh platform, run migrations + `--seed-demo`, confirm `/admin/applicants` lists 240 rows + `/admin/users` lists 11 RBAC users + super-admin can sign in.

### Tests for User Story 5 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T092 [P] [US5] Backend test: `SeedParityTests` (T028) extended to cover all FR-017 / FR-018 outputs (240 applicants with stable IDs, 11 RBAC users, cycles / categories / workflows / rules / reference-data counts).
- [ ] T093 [P] [US5] Backend test: re-running the seeder against an already-seeded database is idempotent (no duplicate rows, no errors). In `Seeding/IdempotencyTests.cs`.
- [ ] T094 [P] [US5] Playwright E2E: drop and re-create the test database, run `--seed-demo`, sign in as the seeded super-admin, navigate to `/admin/applicants`, confirm 240 rows render. In `e2e/tests/us5-fresh-seed.spec.ts`.

### Implementation for User Story 5

- [ ] T095 [US5] Polish on `DemoDataSeeder` (T027) — confirm idempotency guard (`if (await _db.Cycles.AnyAsync(c => c.DemoOrigin)) return;` already in place from T027); add the 240-applicant generation loop using the C# port of the JS LCG (deterministic seed=42).
- [ ] T096 [US5] Polish on the seeded passwords mechanism — `appsettings.Development.json` carries a single `Seed:DefaultUserPassword` value used for all 11 demo users; document the rotation expectation when the platform first runs in production.
- [ ] T097 [US5] Document the migration story in `specs/002-backend-foundation/quickstart.md`: how to bring up a fresh stack, run migrations, seed, and sign in.

**Checkpoint**: Demo continuity preserved. The May 29 demo storyline survives the cutover.

---

## Phase 8: User Story 6 — Reports panels reflect live state (Priority: P2)

**Goal**: `/admin/reports` panels reflect data committed within the previous 5 minutes. When the data layer is unavailable, the panels render an explicit "data unavailable, last updated at HH:MM" state.

**Independent Test**: Per spec §US6 — five new applicants registered in the last hour appear in the registration-tempo panel within 5 minutes.

### Tests for User Story 6 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T098 [P] [US6] Backend integration test: insert 5 applicants → wait < 65 s → `reports_registration_tempo` snapshot table reflects them. In `Reports/SnapshotRefreshTests.cs`.
- [ ] T099 [P] [US6] Backend integration test: GET `/admin/reports/registration-tempo` returns the snapshot + its `last_refreshed_at`. In `Admin/Reports/EndpointTests.cs`.
- [ ] T100 [P] [US6] Frontend Vitest: each of the 12 reports section components renders the four async states explicitly; the "data unavailable" state shows `last_refreshed_at` (uses `useReportSnapshotsQuery` and the existing `EmptyState` / `ErrorState` primitives).
- [ ] T101 [P] [US6] Playwright E2E: super-admin opens `/admin/reports`; the registration-tempo panel renders; simulate the API returning 503; the panel renders the "data unavailable" state with a timestamp. In `e2e/tests/us6-reports-states.spec.ts`.

### Implementation for User Story 6

- [ ] T102 [P] [US6] DTOs in `PACademy.Contracts/Admin/Reports/` mirroring the 12 panels' frontend shapes (CycleSnapshot, StageFunnelPoint, OperationalStatus, …).
- [ ] T103 [US6] Application use cases per panel — read from the snapshot tables (T029 / T030), return DTO + `last_refreshed_at`.
- [ ] T104 [US6] Controller `AdminReportsController` in `PACademy.Api/Controllers/Admin/` — GET endpoints per panel. Returns `last_refreshed_at` in the response body so the UI can render it.
- [ ] T105 [US6] Frontend: `frontend/src/features/admin/api/reports.service.ts` — swap method bodies from MOCK to apiClient. Keep `reportKeys`.
- [ ] T106 [US6] Frontend: `frontend/src/features/admin/components/reports/SectionHeading.tsx` — render the `last_refreshed_at` indicator on every section. The 12 section components consume their respective queries; no UI structural change required because the existing components already handle the four async states.

**Checkpoint**: Reports are live within the staleness budget. US1–US6 deployable.

---

## Phase 9: User Story 7 — Bulk operations (Priority: P2)

**Goal**: Super-admin uploads an Excel file (.xlsx) of up to 100,000 rows, the platform processes it row-by-row, commits valid rows via SqlBulkCopy, returns a downloadable error report listing the invalid rows, and emits one batch-summary audit entry plus per-row child diffs.

**Independent Test**: Per spec §US7 — super-admin uploads a 500-row .xlsx of governorates with 480 valid + 20 invalid rows; 480 commit; the response includes the per-row error report; `/admin/audit` shows one summary entry with row counts plus 480 per-row children.

### Tests for User Story 7 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T107 [P] [US7] Backend unit test: `XlsxRowReader` (the streaming wrapper around ClosedXML) reads a 100k-row test fixture and yields rows lazily without loading the whole sheet into memory. In `PACademy.Application.Tests/BulkOps/XlsxRowReaderTests.cs`.
- [ ] T108 [P] [US7] Backend unit test: `BulkImportValidator` per resource type (governorates first as the lead case) collects per-row errors with row numbers + reasons. In `PACademy.Application.Tests/BulkOps/BulkImportValidatorTests.cs`.
- [ ] T109 [P] [US7] Backend integration test: bulk import of 1,000 valid governorate rows → all 1,000 commit; one batch-summary audit entry + 1,000 children. SC-010 perf check at this volume (relaxed wall-clock for CI). In `Admin/BulkOps/SmallImportTests.cs`.
- [ ] T110 [P] [US7] Backend integration test (heavy, `[Trait("Category", "Heavy")]`): bulk import of 100,000 rows of valid governorates → SC-010 check (60 s p95). In `Admin/BulkOps/LargeImportTests.cs`.
- [ ] T111 [P] [US7] Backend integration test: mixed batch (480 valid + 20 invalid) → 480 commit; response includes the per-row error report (row # + reason); audit captures both committed children (outcome=success) and rejected children (outcome=validation-failed). In `Admin/BulkOps/PartialSuccessTests.cs`.
- [ ] T112 [P] [US7] Backend integration test: 100,001-row batch → 400 + `BULK_IMPORT_ROW_CAP_EXCEEDED` before any row touches SQL. In `Admin/BulkOps/RowCapTests.cs`.
- [ ] T113 [P] [US7] Backend integration test: bulk import attempted by a role lacking the resource's write permission → 403 + a single permission-denied audit entry; no per-row children created. In `Admin/BulkOps/RbacTests.cs`.
- [ ] T114 [P] [US7] Frontend Vitest: `BulkImportDialog` renders idle → uploading → success / partial / error states; the partial state shows committed/rejected counts + a download button for the error report; a11y assertion.
- [ ] T115 [P] [US7] Playwright E2E: super-admin opens `/admin/reference-data/governorates`, opens the bulk-import dialog, uploads a fixture .xlsx with mixed rows, sees the partial-success state with counts, downloads the error report, fixes the bad rows in a separate fixture, re-uploads, sees full success. In `e2e/tests/us7-bulk-import.spec.ts`.

### Implementation for User Story 7

- [ ] T116 [P] [US7] DTOs in `PACademy.Contracts/Admin/BulkOps/`: `BulkImportRequest` (multipart form-data — Resource type + file), `BulkImportResult` (totalRows, committedCount, rejectedCount, errors: row+reason). Plus `BatchUpdateRequest` and `BatchArchiveRequest` for the non-import paths.
- [ ] T117 [US7] Implement `XlsxRowReader` in `PACademy.Infrastructure/BulkOps/XlsxRowReader.cs` — streams rows via ClosedXML's `Worksheet.RowsUsed()` lazy enumerator. Yields `IDictionary<string, string>` per row keyed by header label.
- [ ] T118 [US7] Implement `IBulkImportRunner` in `PACademy.Application/BulkOps/IBulkImportRunner.cs` and `Infrastructure/BulkOps/SqlBulkCopyImportRunner.cs`. Per plan §10: pre-load existing keys into a HashSet for dedup; stream via XlsxRowReader; per-row validate via the per-resource validator; chunk valid rows into 10,000-row batches; for each chunk open a `SqlConnection` + `SqlTransaction`, write rows via `SqlBulkCopy` (CheckConstraints=true, BatchSize=10000), then write per-row audit children via a second `SqlBulkCopy` on `audit_entries` with `batch_id` populated, commit. On chunk-level failure: collect the chunk's rows into the rejected list and continue (per FR-026 partial-success). Emit one batch-summary audit entry at the end via `IAuditWriter.RecordBulkAsync`.
- [ ] T119 [P] [US7] Per-resource bulk-import validators in `PACademy.Application/BulkOps/Validators/`: `GovernorateBulkValidator` (lead case), then `CollegeBulkValidator`, `QualificationBulkValidator`, `NationalityBulkValidator`, `RelationshipBulkValidator`, `CaseTypeBulkValidator`, `RankBulkValidator`, `SpecializationBulkValidator` (8 reference-data tabs). Plus `ApplicantBulkValidator`, `SystemUserBulkValidator`, `CycleBulkValidator`, `CategoryBulkValidator`, `WorkflowBulkValidator`, `AdmissionRuleBulkValidator` for the other resource families.
- [ ] T120 [US7] Application use case `BulkImportUseCase` in `PACademy.Application/Admin/BulkOps/`: orchestrates RBAC pre-check → row-cap check (FR-027) → resource resolution → validator selection → `IBulkImportRunner.ExecuteAsync` → return `BulkImportResult`.
- [ ] T121 [US7] Controllers in `PACademy.Api/Controllers/Admin/BulkOpsController.cs`: POST `/admin/bulk-import/{resource}` (multipart upload) → returns `BulkImportResult`. POST `/admin/bulk-update/{resource}` and POST `/admin/bulk-archive/{resource}` for the non-import paths (smaller surface — accept JSON arrays of IDs + the field-to-set).
- [ ] T122 [P] [US7] Add `BulkImportDialog` component in `frontend/src/shared/components/BulkImportDialog.tsx`: drag-drop or file-picker accepting `.xlsx`; upload progress indicator; renders the four async states + a custom partial-success state with committed/rejected counts and a download button for the error report (which the API returns inline as a JSON array — the dialog turns it into a downloadable .xlsx client-side using a tiny ad-hoc writer or just a CSV blob to keep the bundle thin). Export from `frontend/src/shared/components/index.ts`.
- [ ] T123 [US7] Frontend: `frontend/src/features/admin/api/bulkOps.service.ts` (new file) — `import(resource, file)` → multipart `apiClient.post('/admin/bulk-import/{resource}', formData)`. `update(resource, ids, field, value)` and `archive(resource, ids)` for the other paths. JSDoc INTEGRATION CONTRACT block points at the OpenAPI paths.
- [ ] T124 [US7] Frontend: integrate `BulkImportDialog` into the relevant admin pages: `ReferenceDataPage` (8 tabs), `ApplicantsPage`, `UsersPage`, `CyclesPage`, `CategoriesListPage`, `WorkflowsListPage`, `AdmissionRulesPage`. Each page's existing toolbar gets an "Import / Update / Archive" dropdown that opens the dialog with the appropriate resource pre-selected.

**Checkpoint**: Full bulk surface is live. US1–US7 deployable. The platform is ready for Ministry-scale data loads.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Performance hardening, regression sweeps, doc updates, mock-removal.

- [ ] T125 [P] [Polish] Performance audit: profile `/admin/applicants` and `/admin/audit` against 10k + 1M seeded rows with React DevTools Profiler. Assert no unrelated re-renders per Constitution IV. Capture findings in `docs/performance/02-admin-foundation.md`.
- [ ] T126 [P] [Polish] Performance audit: profile bulk import at 100k rows. Verify SC-010 budget holds (60 s p95). Capture findings in `docs/performance/02-admin-foundation.md`.
- [ ] T127 [P] [Polish] Lighthouse CI gate active on every PR (per Phase 1 of spec 001). Bundle-budget violations block merge.
- [ ] T128 [P] [Polish] Run a11y sweep on every new component (BulkImportDialog, SessionExpiredBanner, the LoginForm nationalId variant) with `axe` CLI; capture findings; fix.
- [ ] T129 [P] [Polish] RTL regression sweep: open every admin page and the new bulk-import dialog at 200% zoom, mobile (390px), tablet (768px). Capture screenshots; fix any physical-property leaks (Constitution III addition v1.1.0).
- [ ] T130 [P] [Polish] Reduced-motion sweep: enable `prefers-reduced-motion` in DevTools; verify no animation > 200 ms persists (Constitution III addition v1.1.0).
- [ ] T131 [Polish] Update CLAUDE.md §6 (mock service layer) — note that `applicants/`, `admin/`, `auth/`, `audit/` are now real-backend; other features (committees, board, investigations, medical, barcode, biometric, exams, applicant-portal) remain mock until their own feature-cycles ship.
- [ ] T132 [Polish] Remove `simulateLatency()` calls from migrated services. Keep `MOCK` exports for the still-mock features per FR-021 / FR-019.
- [ ] T133 [P] [Polish] Quickstart doc: produce `specs/002-backend-foundation/quickstart.md` covering local dev (docker compose, dotnet run, npm run dev), seeding, sign-in as the seeded super-admin, and a sample bulk-import smoke run.
- [ ] T134 [P] [Polish] Run `npm run typecheck` + `dotnet build` — zero errors gate.
- [ ] T135 [Polish] Run full Playwright suite against the deployed staging build. Track flake budget (Constitution II addition v1.1.0).
- [ ] T136 [Polish] Recommend a Constitution amendment to add backend gates (was a follow-up in v1.1.0's Sync Impact Report). Open the PR after this feature lands; expect a MINOR bump (1.1.0 → 1.2.0).
- [ ] T137 [Polish] **Audit reconciliation** (SC-001 + SC-011). Add a hosted .NET `BackgroundService` (`AuditReconciliationJob` in `PACademy.Infrastructure/Audit/`) that fires once daily (default 02:00 UTC, configurable via `Audit:ReconciliationCron`) and runs two checks: (a) `audit_entries` row count ≥ count of write operations against `IAuditableWrite` entities since the last reconciliation watermark (catches missing audit emissions); (b) every bulk-summary entry (`batch_id IS NULL` AND `action LIKE 'Bulk%'`) has at least one child (`batch_id = summary_id`), and every child has a parent (catches orphaned summaries / orphans). Drift is logged at `Warning` via Serilog under category `Audit:Reconciliation`; CI integration test in `PACademy.Api.Tests/Audit/ReconciliationTests.cs` seeds a known-good and a known-bad scenario and asserts the job flags the bad one. Mark this task `[P]` against T030 (the reports refresher uses the same hosted-service pattern).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Mostly already done (carried from spec 001 Phase 1). The thin delta (T003 ClosedXML, T004 strings) has no dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion. **BLOCKS all user stories.**
- **User Stories (Phases 3–9)**: All depend on Foundational. Within Phase 2:
  - US1 (P1) depends on T005–T013 (schema) + T031–T035 (frontend wiring).
  - US2 (P1) depends on T014–T018 (auth substrate) + T024 (super-admin floor) + T026 (validator) + T027 (seeded users) + T031–T035 (frontend wiring).
  - US3 (P1) depends on US1's schema + audit substrate (T019–T022) + the immutability trigger (T012).
  - US4 (P2) depends on schema + audit + auth substrates.
  - US5 (P2) depends on T027 (seeder scaffold).
  - US6 (P2) depends on T029–T030 (report-snapshots).
  - US7 (P2) depends on T011 (audit_entries.batch_id), T020 (`AuditWriter.RecordBulkAsync`), and T003 (ClosedXML).
- **Polish (Phase N)**: Depends on all P1 stories (US1–US3) at minimum. P2 stories (US4–US7) and remaining polish tasks can run in parallel after MVP demo.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundation. The MVP slice.
- **US2 (P1)**: Independent — auth substrate is in Foundation; this story consumes it.
- **US3 (P1)**: Builds on US1's writes (which produce audit entries). Tests can run independently against seeded data.
- **US4 (P2)**: Independent — different resource files. Five resource families share a similar pattern; one developer can knock out the lead case (cycles) and templatise the rest.
- **US5 (P2)**: Polish on the seeder scaffold; depends on US4 for reference-data shape consistency.
- **US6 (P2)**: Independent — reads from snapshot tables already populated by Phase 2 hosted service.
- **US7 (P2)**: Largest phase. Depends on US4 (CRUD endpoints) for the batch-update / batch-archive companions; bulk-import is independent of US4 since it goes straight to SQL.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution II).
- DTOs before use cases.
- Use cases before controllers.
- Service swaps before page/component changes.
- Story complete before moving to next priority.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- All Foundational tasks marked [P] can run in parallel within Phase 2 (most do — domain entities, validators, fixtures).
- Once Foundational is done, US1 + US2 + US3 can proceed in parallel with separate developers.
- Within US4, the five resource families (cycles / categories / workflows / admission-rules / reference-data) are independent files and can parallelise.
- Within US7, the per-resource bulk validators (T119) parallelise — 14 files, no cross-deps.
- Different user stories can be worked on in parallel by different team members after Phase 2.

### MVP cut

For the May 29 Ministry demo, the minimum cut is the three P1 user stories plus the demo seed:
1. Phase 1 (already done) + Phase 2 (Foundation)
2. Phase 3 (US1 — admin edits persist + propagate) — P1
3. Phase 4 (US2 — admin sign-in + RBAC) — P1
4. Phase 5 (US3 — audit log queryable) — P1; the Ministry compliance story they ask about
5. Phase 7 (US5 — demo seed migration) — P2 but needed for the demo storyline

US4, US6, US7 (all P2) can ship post-demo. US7 (bulk ops) is the largest post-demo workstream.

---

## FR ↔ Task Map

| FR | Tasks |
|---|---|
| FR-001 (writes persist + propagate) | T011, T046–T051, T087–T091 |
| FR-002 (historical values preserved) | T010 (soft-delete config), T084 (test) |
| FR-003 (in-system creds, nationalId login, identity seam) | T014, T015, T015a, T032, T033, T062, T063 |
| FR-004 (configurable session timeout) | T016 |
| FR-005 (deactivation immediate) | T017, T055, T063 |
| FR-005a (super-admin floor) | T024, T056, T061 |
| FR-006 (RBAC) | T065, T054 |
| FR-007 (audit emission) | T009, T019, T020 |
| FR-008 (audit immutability) | T012 |
| FR-009 (audit retention indefinite) | T011 (no purge), T125 (perf audit) |
| FR-010 (audit query filters) | T076–T079 |
| FR-011 (filtering / sorting / pagination) | T046–T048, T087–T089, T075–T077 |
| FR-012 (reports staleness) | T029, T030, T102–T106 |
| FR-013 (4 async states) | T035, T100, T106, T122 |
| FR-014 (concurrency layers) | T010 (constraints), T047 (last-write-wins) |
| FR-015 (soft-delete extended to ref-data) | T005, T010 |
| FR-016 (cycle isolation) | T010 (unique on `(CycleId, NationalId)`), T042 |
| FR-017 (demo migration with permanent flag) | T027, T028, T092, T095 |
| FR-018 (11 RBAC seeded users) | T027 |
| FR-024 (bulk operations) | T116–T124 |
| FR-025 (Excel .xlsx ingestion) | T003, T117 |
| FR-026 (per-row partial success) | T118, T111 |
| FR-027 (100k row cap) | T120, T112 |
| FR-028 (audit summary + per-row children) | T019, T020, T118, T109 |
| FR-029 (System User fields) | T008, T010 |
| FR-030 (System User validation) | T026, T057 |
| FR-031 (2FA seam) | T015a |
| SC-001 + SC-011 (audit reconciliation) | T137 |

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
- Phase 1 of spec 001 (T001–T016) is **carried forward** — this spec's Phase 1 is a small delta (T003 + T004). When implementing, do not re-do the spec 001 Phase 1 work; it's still on disk after the rollback.
- Companion design docs (`research.md`, `data-model.md`, `quickstart.md`, `contracts/*.yaml`) are **deferred** — they land alongside their phase per the spec-kit workflow. `research.md` is largely captured in `plan.md`'s Phase 0 already; `data-model.md` lands with Phase 2; `contracts/*.yaml` land per-story; `quickstart.md` lands with US5 (T097 / T133).
