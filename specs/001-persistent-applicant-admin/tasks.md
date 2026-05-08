---

description: "Task list for feature 001-persistent-applicant-admin"
---

# Tasks: Persistent applicant intake and admin operations

**Input**: Design documents from `specs/001-persistent-applicant-admin/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories). `research.md`, `data-model.md`, `contracts/` are deferred — the plan has enough shape for a competent task split; companion docs land alongside their phases.

**Tests**: Per constitution Principle II (NON-NEGOTIABLE), test tasks are MANDATORY — not optional. Every user story includes test-first tasks for: business logic (failing test before implementation), each new UI component (render smoke + interaction + a11y), and the critical user journey it represents (Playwright E2E). MSW for frontend network mocking; Testcontainers.PostgreSql for backend integration. Coverage thresholds enforced in CI: ≥ 80% statements, ≥ 75% branches, 100% on auth / payments / form-validation paths.

**Organization**: Tasks are grouped by user story so each story can be independently implemented and tested. Phase 1 (Setup) and Phase 2 (Foundational) block all stories — that's where the greenfield backend and the test/lint infrastructure land.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6, or `Setup` / `Foundation` / `Polish` for cross-cutting work)
- File paths are repo-root-relative.

## Path Conventions

Web-application monorepo (per plan §Project Structure):
- Frontend: `frontend/src/`, `frontend/tests/` (new)
- Backend: `backend/src/`, `backend/tests/`
- Specs: `specs/001-persistent-applicant-admin/`
- Constitution: `.specify/memory/constitution.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Greenfield backend skeleton + frontend infrastructure required by the constitution that isn't yet committed (test runner, lint, pre-commit hooks). All stories depend on this phase.

### Backend skeleton

- [x] T001 [P] [Setup] Create `backend/PACademy.sln` and the five projects: `PACademy.Api`, `PACademy.Application`, `PACademy.Domain`, `PACademy.Infrastructure`, `PACademy.Contracts`. Wire project references per clean-arch direction (Api → Application + Infrastructure + Contracts; Application → Domain + Contracts; Infrastructure → Application + Domain).
- [x] T002 [P] [Setup] In every backend `.csproj`, set `<Nullable>enable</Nullable>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`, `<LangVersion>latest</LangVersion>`, target `net10.0`.
- [x] T003 [P] [Setup] Create `backend/tests/PACademy.Api.Tests`, `PACademy.Application.Tests`, `PACademy.Domain.Tests` projects (xUnit + FluentAssertions). Wire references.
- [x] T004 [P] [Setup] Add backend NuGet deps to the relevant projects: `Microsoft.AspNetCore.OpenApi 10`, `Microsoft.EntityFrameworkCore.SqlServer 10`, `Microsoft.AspNetCore.Identity.EntityFrameworkCore 10`, `FluentValidation.AspNetCore`, `Serilog.AspNetCore`, `Serilog.Sinks.MSSqlServer`, `MediatR` (deferred-load — list but don't use yet). Test deps: `Microsoft.AspNetCore.Mvc.Testing`, `Testcontainers.MsSql`, `xunit`, `FluentAssertions`.
- [x] T005 [Setup] Add `backend/docker-compose.yaml` with two services: `mcr.microsoft.com/mssql/server:2022-latest` (env `ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD=<dev-only secret>`, `MSSQL_PID=Developer`) and `api` (built from `backend/src/PACademy.Api`). Expose SQL Server on `localhost:1433`, API on `localhost:8080`. Include a healthcheck that waits for SQL Server to accept connections before the API container starts (the image takes ~20–30 s to be ready).

### Frontend infrastructure (constitution gaps)

- [x] T006 [P] [Setup] Add `axios` to `frontend/package.json` (~14 KB gzipped, justified in plan Complexity Tracking). Run install, commit lockfile.
- [x] T007 [P] [Setup] Create `frontend/src/shared/api/client.ts` (axios instance with `baseURL` from `import.meta.env.VITE_API_URL`, `withCredentials: true`, request interceptor for CSRF double-submit token, response interceptor that maps non-2xx to a typed `ApiError`).
- [x] T008 [P] [Setup] Create `frontend/src/shared/api/errors.ts` with `ApiError` class (status, code, message, fieldErrors) and `normaliseError(unknown): ApiError`. Export from `frontend/src/shared/api/index.ts`.
- [x] T009 [P] [Setup] Add Vitest + @testing-library/react + @testing-library/user-event + jest-axe + @testing-library/jest-dom to frontend dev deps. Add `vitest.config.ts` with `jsdom` env, jest-axe matcher setup, and a `vitest.setup.ts` that registers the matchers.
- [x] T010 [P] [Setup] Add MSW to frontend dev deps. Create `frontend/src/test/msw/server.ts` and `frontend/src/test/msw/handlers.ts` (initially empty — handlers grow per user-story phase).
- [x] T011 [P] [Setup] Add Playwright to a new `e2e/` workspace root (`e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tests/` directory). Wire it to spin up `docker compose up sqlserver api` + `npm run dev --prefix frontend` in `webServer` config.
- [x] T012 [P] [Setup] Add ESLint config (`frontend/.eslintrc.cjs`) extending `eslint-plugin-react`, `@typescript-eslint`, `eslint-plugin-react-hooks`, with custom rules: `no-restricted-imports` to forbid `useEffect` for fetching (heuristic via `no-restricted-syntax`), `import/no-default-export`. Add Prettier config (`frontend/.prettierrc`).
- [x] T013 [P] [Setup] Add `eslint-plugin-boundaries` to enforce Clean Arch (`shared/` cannot import `features/`; cross-feature imports go through barrels).
- [x] T014 [Setup] Add Husky to repo root (`package.json` at root or new `.husky/` dir). Pre-commit hook: `cd frontend && npm run lint && npx vitest related --run` for changed frontend files; `cd backend && dotnet format --verify-no-changes && dotnet test --filter "FullyQualifiedName~Domain|FullyQualifiedName~Application"` for changed backend files.
- [x] T015 [P] [Setup] Add Lighthouse CI config (`frontend/lighthouserc.json`) with budgets per Constitution IV (LCP 2.5s, INP 200ms, CLS 0.1, landing JS 170 KB, per-route 250 KB).
- [x] T016 [P] [Setup] Create `frontend/src/shared/lib/strings.ts` if missing — Arabic + English keys for the new error states this feature introduces (backend-down, conflict-rejected, session-expired). Export `strings.ar` / `strings.en`; consumer code reads via `useStrings()` hook (also new).

**Checkpoint**: Backend solution builds cleanly; frontend lint + Vitest + Playwright runners installed; pre-commit gate active. No business logic yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, auth substrate, audit substrate, error model, and the apiClient wiring that every user story depends on.

**⚠️ CRITICAL**: No user story (US1–US6) can begin until this phase is complete.

### Database + EF Core core

- [ ] T017 [P] [Foundation] Create `backend/src/PACademy.Domain/Common/AggregateRoot.cs`, `Entity.cs`, `ValueObject.cs`, `ISoftDeletable.cs` (interface marking `Archived` flag). Pure POCO, no EF refs.
- [ ] T018 [P] [Foundation] Create `backend/src/PACademy.Domain/Audit/IAuditableWrite.cs` — marker interface for entities whose writes emit audit entries.
- [ ] T019 [Foundation] Create `backend/src/PACademy.Infrastructure/Persistence/PaDbContext.cs` (inherits `IdentityDbContext`). Override `SaveChangesAsync` to (a) honour soft-delete by translating `Remove` to `Archived = true`, (b) emit audit entries for every `IAuditableWrite` change.
- [ ] T020 [Foundation] Create `backend/src/PACademy.Infrastructure/Persistence/Configurations/` and add EF Core fluent-API configurations matching `data-model.md` (deferred companion doc). Until that doc lands, configurations are sketched per plan §Storage.
- [ ] T021 [Foundation] Create initial EF Core migration `Initial`: `applicants`, `applicant_stage_submissions`, `system_users`, `cycles`, `categories`, `workflows`, `admission_rules`, `reference_data`, `audit_entries`, `sessions`, plus ASP.NET Core Identity tables. Include all FR-017 DB constraints (unique on national_id-within-cycle, FKs, check constraints on enum-modelled status fields). Include indexes on `audit_entries(target_type, target_id, occurred_at)` and `audit_entries(actor_id, occurred_at)`.
- [ ] T021a [Foundation] Enforce audit immutability (FR-011). Create SQL Server trigger `tr_audit_entries_immutable` on `audit_entries` that raises on `UPDATE` and `DELETE` (`THROW 51000, 'audit_entries are immutable', 1;`). Belt-and-braces: the migration also revokes `UPDATE` and `DELETE` on `audit_entries` from the application's runtime DB user (separate from the migration user). Add an integration test in `PACademy.Api.Tests/Audit/ImmutabilityTests.cs` asserting that direct `UPDATE` and `DELETE` against the table both fail.
- [ ] T022 [Foundation] Apply SQL Server collation `Arabic_100_CI_AS_SC_UTF8` (UTF-8, supplementary characters; SQL Server 2019+) at the column level on text fields that participate in admin search (applicant names, audit `target_label`). Verify EF Core's `UseCollation(...)` survives the migration round-trip.

### Auth substrate

- [ ] T023 [P] [Foundation] Define `IIdentityProvider` in `backend/src/PACademy.Application/Identity/IIdentityProvider.cs` (methods: `AuthenticateAsync(username, password)`, `GetUserAsync(id)`, `CreateUserAsync(...)`, `DeactivateAsync(id)`).
- [ ] T024 [P] [Foundation] Implement `InSystemIdentityProvider` in `backend/src/PACademy.Infrastructure/Identity/InSystemIdentityProvider.cs` — wraps ASP.NET Core Identity's `UserManager` + `SignInManager`.
- [ ] T024a [Foundation] Define `ISmsSender` in `backend/src/PACademy.Application/Sms/ISmsSender.cs` (single method `SendVerificationCodeAsync(phoneNumber, code, ct)`). Implement `SmsSenderStub` in `backend/src/PACademy.Infrastructure/Sms/SmsSenderStub.cs` — logs the issued code via Serilog under category `SmsSender:Stub` and stores the most recent unconsumed code per phone in an in-memory dictionary. Register a dev-only endpoint `GET /dev/last-code/{phone}` (registered only when `IsDevelopment()`) that returns the last unconsumed code, so Playwright E2E tests read the verification code without scraping stdout. Real provider wiring is deferred (FR-005).
- [ ] T025 [Foundation] Configure cookie auth + CORS in `backend/src/PACademy.Api/Program.cs`. Auth: `AddAuthentication(CookieAuthenticationDefaults...).AddCookie(...)` with `SameSite=Strict`, `HttpOnly=true`, `Secure=true`, sliding expiration tied to the configurable session-timeout setting (FR-007). Bind from `appsettings.json`: `Auth:SessionTimeoutMinutes` (staff) and `Auth:ApplicantSessionTimeoutMinutes` (applicant — defaults to a few hours so a single intake sitting completes; addresses analyze finding M1). CORS: read allowed origins from `Cors:AllowedOrigins`; enable `AllowCredentials()` so the frontend's `withCredentials: true` apiClient (T007) can send cookies; deny all other origins by default. Wildcard origin alongside credentials is forbidden — assert via test in `PACademy.Api.Tests/Cors/CorsConfigTests.cs`.
- [ ] T026 [Foundation] Create `Session` entity + DbSet for server-side session tracking (FR-007 / FR-009 — deactivation must take effect immediately). Sessions store `user_id`, `created_at`, `last_seen_at`, `revoked_at`. Add a request middleware that loads the session per request, refreshes `last_seen_at`, and rejects revoked sessions with 401.
- [ ] T027 [P] [Foundation] Add CSRF middleware: double-submit token on every non-GET admin-surface request; applicant surface uses SameSite=Lax cookies + Origin check (per plan research §7).

### Audit substrate

- [ ] T028 [Foundation] Implement `AuditWriter` (consumed by `PaDbContext.SaveChangesAsync`): capture actor from `IHttpContextAccessor`, target type + id, before/after JSON diff per changed property, outcome (success / permission-denied / validation-failed). Write to `audit_entries` in the same transaction as the originating change.
- [ ] T029 [Foundation] Wire global exception middleware: `ValidationException` → 400 + `ApiProblemDetails`; `DomainConflictException` → 409; `UnauthorizedAccessException` → 403 + audit entry with outcome `permission-denied`.

### Mock-data seed migration (FR-020)

- [ ] T030 [Foundation] Port the frontend's deterministic mock dataset (`frontend/src/shared/mock-data/seed.ts`, LCG seed=42) and dictionaries to `backend/src/PACademy.Infrastructure/Seeding/DemoDataSeeder.cs`. The seeder MUST produce, in order: the active **cycles**, **categories**, **workflows**, **admission_rules**, and **reference_data** that the frontend already shows; **10 system_users** (one per RBAC role with development-only passwords sealed in `appsettings.Development.json`); **240 applicants** + their stage submissions; **80 audit_entries** matching the existing `/admin/audit` page. All rows carry `demo_origin = true` so a future feature can filter them out of operational reports. Hook into `Program.cs` startup behind a `--seed-demo` CLI arg (default off in non-dev environments). Out-of-scope-feature seeds (committees, board, investigations, medical, barcode, biometric, exams) are NOT ported here — each lands in its own feature cycle. Include a parity test (`PACademy.Infrastructure.Tests/Seeding/SeedParityTests.cs`) asserting specific applicant national_ids exist at known indices after seeding, to catch JS-LCG vs C#-LCG drift early.
- [ ] T031 [Foundation] Add seeded super-admin and one user per of the 11 RBAC roles. Passwords come from a sealed dev-only secrets file (committed gitignore'd) so the demo continues to work.

### Reports substrate

- [ ] T032 [P] [Foundation] Add migration creating report-snapshot tables `reports_registration_tempo`, `reports_stage_funnel`, `reports_operational_status`. Each table carries a `last_refreshed_at` UTC timestamp column; schema mirrors the aggregation output for the corresponding panel.
- [ ] T033 [Foundation] Add a hosted .NET `BackgroundService` (`ReportSnapshotsRefresher` in `PACademy.Infrastructure/Reports/`) that fires every 60 seconds, runs the aggregation queries against live tables, and `MERGE`s the results into the snapshot tables in a single transaction per snapshot. Wire it as a hosted service in `Program.cs`. Update each snapshot's `last_refreshed_at`.

### Frontend wiring

- [ ] T034 [Foundation] Update `frontend/src/App.tsx` to disable `ensureDemoUser()` auto-seed when `import.meta.env.VITE_DEMO_MODE !== 'true'` — backend auth is the new source of truth; demo mode keeps the role-picker shortcut.
- [ ] T035 [Foundation] Update `frontend/src/features/auth/api/auth.service.ts` body: `login` → `apiClient.post('/auth/login', { username, password })`; `logout` → `apiClient.post('/auth/logout')`; `me` → `apiClient.get('/auth/me')`. Keep the JSDoc `INTEGRATION CONTRACT` block updated to point at the OpenAPI path.
- [ ] T036 [Foundation] Update `frontend/src/features/auth/AuthGuard.tsx` (existing) to drive off a `useMe()` query (TanStack Query) instead of Zustand-only state. Persistence of session lives server-side (FR-007); the Zustand store is now a UX cache only.
- [ ] T037 [P] [Foundation] Add `frontend/src/shared/components/SessionExpiredBanner.tsx` (new component) shown when `apiClient` 401-interceptor fires; uses centralised strings; Constitution III four-state compliance.

### Test infrastructure

- [ ] T038 [P] [Foundation] Create `backend/tests/PACademy.Api.Tests/Fixtures/SqlServerFixture.cs` — Testcontainers.MsSql singleton fixture (image `mcr.microsoft.com/mssql/server:2022-latest`, `ACCEPT_EULA=Y`, Developer edition). Ephemeral DB per test class; applies migrations automatically. Note: the SQL Server image is ~2 GB and takes ~20–30 s to boot; CI test wallclock is materially longer than a Postgres equivalent — budget for it in the test plan.
- [ ] T039 [P] [Foundation] Create `backend/tests/PACademy.Api.Tests/Fixtures/ApiFactory.cs` — `WebApplicationFactory<Program>` configured to use the `SqlServerFixture`'s connection string.
- [ ] T040 [P] [Foundation] Add `e2e/tests/fixtures/auth.ts` — Playwright fixture that signs in as a given role using a real backend session.

**Checkpoint**: Foundation ready — all six user stories can begin in parallel. Backend serves `/auth/login` + `/auth/me`. Schema + audit + report-snapshots in place. Frontend's `apiClient` wired and demo-mode toggle works.

---

## Phase 3: User Story 1 — Applicant data survives sessions and device switches (Priority: P1) 🎯 MVP

**Goal**: An applicant fills part of the wizard, returns later on a different device, and finds their text data preserved exactly. (File uploads remain mock per FR-022.)

**Independent Test**: Per spec §US1 — auth via phone + code, save Stages 3 & 4, close browser, reopen on different device, re-auth, resume at Stage 5 with prior values populated.

### Tests for User Story 1 (REQUIRED — Constitution Principle II) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation. UI components additionally require render smoke + interaction + a11y.**

- [ ] T041 [P] [US1] Backend integration test: POST `/applicant/auth/request-code` → returns 200 + delivers code via `SmsSenderStub` (visible in test output). In `backend/tests/PACademy.Api.Tests/ApplicantAuth/RequestCodeTests.cs`.
- [ ] T042 [P] [US1] Backend integration test: full auth flow request-code → verify-code → cookie issued → `/applicant/me` returns the applicant. In `ApplicantAuth/VerifyCodeTests.cs`.
- [ ] T043 [P] [US1] Backend integration test: POST stage-3 data, fetch `/applicant/me/stages` → returns stage-3 with the same values. In `ApplicantStages/SaveAndRetrieveTests.cs`.
- [ ] T044 [P] [US1] Backend unit test: stage-3 validator rejects missing required fields (FluentValidation). In `PACademy.Application.Tests/Stages/Stage3ValidatorTests.cs`.
- [ ] T045 [P] [US1] Frontend Vitest: `Stage3PersonalInfoPage` renders all required fields; submit-disabled until all required fields filled; a11y assertion via jest-axe; persisted values populate on remount.
- [ ] T046 [P] [US1] Playwright E2E: cross-device recovery — fill Stage 3 + 4 in browser context A, close, open browser context B, re-auth with same phone, verify Stage 5 is the resume point and Stages 3 + 4 fields are pre-filled.

### Implementation for User Story 1

- [ ] T047 [P] [US1] Domain entities: `Applicant`, `ApplicantStageSubmission` (`data` column mapped as `nvarchar(max)` containing JSON; hot query paths get `JSON_VALUE`-based computed-column indexes via EF Core fluent config) in `PACademy.Domain/Applicants/`.
- [ ] T048 [P] [US1] DTOs in `PACademy.Contracts/Applicants/`: `RequestCodeDto`, `VerifyCodeDto`, `ApplicantSelfDto`, `StageSubmissionDto<TStageData>`.
- [ ] T049 [US1] Application use cases in `PACademy.Application/Applicants/`: `RequestCodeUseCase`, `VerifyCodeUseCase`, `GetMyApplicantUseCase`, `SaveStageUseCase`. Validators with FluentValidation per stage.
- [ ] T050 [US1] Controllers in `PACademy.Api/Controllers/Applicant/`: `ApplicantAuthController` (POST request-code, verify-code, logout), `ApplicantSelfController` (GET me, GET me/stages, PUT me/stages/{stageId}).
- [ ] T051 [US1] Frontend: `frontend/src/features/applicant-portal/api/applicant-portal.service.ts` — swap method bodies from MOCK to apiClient. JSDoc `INTEGRATION CONTRACT` updated to OpenAPI paths.
- [ ] T052 [US1] Frontend: `Stage1AuthPhone` and `Stage2AuthSms` components hit real backend. Verification code displayed in dev-mode alert banner only (visible if `VITE_DEMO_MODE=true`).
- [ ] T053 [US1] Frontend: each Stage 3 / 4 / 5 / 7 page wires `react-hook-form` to `applicantPortalService.saveStage(stageId, data)` on Next; loads via `useMyStage(stageId)` query.
- [ ] T054 [US1] Frontend: wizard root computes "first unfilled stage" from server data and routes there on resume.

**Checkpoint**: Applicant intake persists end-to-end; cross-device test passes. Demo-able as MVP.

---

## Phase 4: User Story 2 — Admin staff see real applicants in real time (Priority: P1)

**Goal**: Admin staff open the applicants list and see actual applicants with bounded propagation lag.

**Independent Test**: Per spec §US2 — applicant submits Stage 6 → admin on a different machine sees them in `/admin/applicants` within the agreed window.

### Tests for User Story 2 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T055 [P] [US2] Backend integration test: applicant inserts stage-3 → GET `/admin/applicants` (as committee_admin) returns the applicant within p99 budget. In `Admin/ApplicantsListTests.cs`.
- [ ] T056 [P] [US2] Backend integration test: pagination + filtering + sorting on 1k seeded applicants returns p95 ≤ 500 ms. In `Admin/ApplicantsListPerfTests.cs` (asserts wallclock < 500 ms with a generous CI margin).
- [ ] T057 [P] [US2] Backend test: applicant in cycle A is not visible to admin filtering by cycle B (FR-019, isolation).
- [ ] T058 [P] [US2] Frontend Vitest: `ApplicantsListPage` renders DataTable with the four async states; filters update the URL search params; row-click navigates to detail.
- [ ] T059 [P] [US2] Playwright E2E: applicant submits Stage 3 in one browser context; committee_admin in another context refreshes `/admin/applicants` within 5s and sees the row.

### Implementation for User Story 2

- [ ] T060 [US2] Application use case `ListApplicantsUseCase` with filter + sort + pagination args.
- [ ] T061 [US2] Controller `AdminApplicantsController.List` returns paginated response with `X-Total-Count` and `X-Page-Count` headers (per plan Constitution Check IV mitigation).
- [ ] T062 [US2] Frontend: `frontend/src/features/applicants/api/applicants.service.ts` — swap `list` and `get` method bodies from MOCK to apiClient. Keep `applicantKeys` factory unchanged.
- [ ] T063 [US2] Frontend: `frontend/src/features/admin/pages/ApplicantsListPage.tsx` — no logic change, but verify DataTable virtualisation kicks in at 10k rows (manual-test task documented).

**Checkpoint**: Admin list is live. US1 + US2 deployable.

---

## Phase 5: User Story 3 — Admin edits propagate and are auditable (Priority: P1)

**Goal**: Admin edits an applicant; another admin sees it; both see an audit entry.

**Independent Test**: Per spec §US3 — Admin A flips status, Admin B sees new value, both see audit entry with diff.

### Tests for User Story 3 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T064 [P] [US3] Backend integration test: PATCH `/admin/applicants/{id}` with status change → audit_entry row appears with actor, target, field, old/new values, occurred_at, outcome=success.
- [ ] T065 [P] [US3] Backend integration test: PATCH attempt by a role without permission → 403 + audit_entry with outcome=permission-denied.
- [ ] T066 [P] [US3] Backend integration test: two concurrent PATCHes to same applicant — both succeed, second wins (silent last-write-wins per FR-017), both writes audited.
- [ ] T067 [P] [US3] Backend integration test: GET `/admin/audit` with filter by actor returns p95 ≤ 1 s against a seeded 1M-row table (uses a heavier seeded fixture; `[Trait("Category", "Heavy")]`).
- [ ] T068 [P] [US3] Frontend Vitest: `ApplicantDetailPage` save-status flow renders idle → loading → success / error states; failure state preserves form values and announces error to AT.
- [ ] T069 [P] [US3] Playwright E2E: Admin A on context A flips status, Admin B on context B sees new value within 2 s, both visit `/admin/audit` and see the same entry.

### Implementation for User Story 3

- [ ] T070 [P] [US3] Application use case `UpdateApplicantUseCase` (per-field patch, RBAC pre-check).
- [ ] T071 [P] [US3] Application use case `ListAuditEntriesUseCase` with filter (actor, target, action, date range) + pagination.
- [ ] T072 [US3] Controller `AdminApplicantsController.Patch` + `AuditController.List`.
- [ ] T073 [US3] Frontend: `frontend/src/features/applicants/api/applicants.service.ts.update` body swap; mutation hook already exists.
- [ ] T074 [US3] Frontend: `frontend/src/features/audit/api/audit.service.ts.list` body swap.
- [ ] T075 [US3] Frontend: `ApplicantDetailPage` consumes server-returned `lastModifiedBy` + `lastModifiedAt` and renders the "by X at Y" indicator.

**Checkpoint**: Audit is the legal record. US1 + US2 + US3 deployable.

---

## Phase 6: User Story 4 — Admin staff sign in with their actual identity (Priority: P1)

**Goal**: Real provisioning + sign-in + RBAC enforcement; deactivation takes effect immediately.

**Independent Test**: Per spec §US4 — super-admin provisions committee_admin → that person signs in → sidebar matches role; deactivation logs them out on next request.

### Tests for User Story 4 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T076 [P] [US4] Backend integration test: super-admin provisions committee_admin → new user signs in → cookie issued → `/auth/me` returns the right role.
- [ ] T077 [P] [US4] Backend integration test: user signs in, super-admin deactivates them, next request from the deactivated user returns 401.
- [ ] T078 [P] [US4] Backend integration test: configurable session timeout (set to 1 minute via test override) — request after timeout returns 401.
- [ ] T079 [P] [US4] Backend integration test: applicant cannot reach any `/admin/*` endpoint (RBAC denial + audit entry).
- [ ] T080 [P] [US4] Frontend Vitest: `LoginForm` submits credentials, shows loading state, on 401 shows error preserving username; jest-axe passes.
- [ ] T081 [P] [US4] Playwright E2E: 11-role grid — for each role, sign in, assert sidebar contains exactly the apps the role allows.

### Implementation for User Story 4

- [ ] T082 [P] [US4] Application use cases: `LoginUseCase`, `LogoutUseCase`, `GetCurrentUserUseCase`, `ProvisionUserUseCase`, `DeactivateUserUseCase`.
- [ ] T083 [US4] Controllers: `AuthController` (login, logout, me, request-deactivation-self), `AdminUsersController` (list, create, deactivate, reactivate).
- [ ] T084 [US4] RBAC enforcement: `[RequireRole("committee_admin")]` filter or policy, evaluated against current session's user.
- [ ] T085 [US4] Frontend: `frontend/src/features/auth/components/LoginForm.tsx` swaps from role-picker derivation to real backend call; on success, redirects to `/hub`.
- [ ] T086 [US4] Frontend: `frontend/src/features/admin/pages/UsersPage.tsx` — service swap (provisioning + deactivation).
- [ ] T087 [US4] Frontend: `apiClient` 401 interceptor → redirect to `/staff-login` with toast (using `SessionExpiredBanner` strings).

**Checkpoint**: Auth is real. US1 + US2 + US3 + US4 deployable as a coherent MVP.

---

## Phase 7: User Story 5 — Admin reference data, cycles, categories, workflows, admission rules persist (Priority: P2)

**Goal**: Configuration objects (cycles, categories, workflows, rules, reference data) are durable, audited, and propagate within the admin staleness window.

**Independent Test**: Per spec §US5 — super-admin creates "2027 Female" cycle + 3 reference rows → another super-admin sees them; applicant at Stage 4 sees the new faculty in their dropdown.

### Tests for User Story 5 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T088 [P] [US5] Backend integration tests, one per resource (cycles, categories, workflows, admission_rules, reference_data): full CRUD + audit-emission.
- [ ] T089 [P] [US5] Backend integration test: workflows reference an admission_rule via FK; deleting the rule fails with FR-017 DB-constraint reject.
- [ ] T090 [P] [US5] Backend integration test: historical applicant references a renamed reference_data row → applicant detail still shows the historical value (FR-004).
- [ ] T091 [P] [US5] Frontend Vitest: each editor page (`CyclesEditPage`, `CategoryEditPage`, `WorkflowEditPage`, `AdmissionRulesPage`, `ReferenceDataPage`) — render + save flow + four async states + a11y.
- [ ] T092 [P] [US5] Playwright E2E: super-admin creates new cycle in browser A; super-admin in browser B refreshes `/admin/cycles` and sees it within 5 s.

### Implementation for User Story 5

- [ ] T093 [P] [US5] Domain entities + EF Core configurations: `Cycle`, `Category`, `Workflow`, `AdmissionRule`, `ReferenceDataEntry`. All implement `IAuditableWrite` and `ISoftDeletable`.
- [ ] T094 [P] [US5] Application use cases per resource: `Create*UseCase`, `Update*UseCase`, `List*UseCase`, `Get*UseCase`, `Archive*UseCase`.
- [ ] T095 [P] [US5] Controllers per resource: `AdminCyclesController`, `AdminCategoriesController`, `AdminWorkflowsController`, `AdminAdmissionRulesController`, `AdminReferenceDataController`.
- [ ] T096 [P] [US5] Frontend: service-body swaps in `frontend/src/features/admin/api/cycles.service.ts`, `categories.service.ts`, `workflows.service.ts`, `admissionRules.service.ts`, `referenceData.service.ts`.
- [ ] T097 [US5] Frontend: applicant-portal Stage 4 reference-data dropdown consumes the new live `referenceDataService.list({ category: 'faculty' })` (was MOCK).
- [ ] T098 [US5] Frontend: historical-value rendering — `ReferenceDataValue` component now shows the captured-at-submission label, with the current-name in a tooltip if they differ.

**Checkpoint**: Configuration is real. Through US1–US5 the system can run a live cycle.

---

## Phase 8: User Story 6 — Reports reflect the live state (Priority: P2)

**Goal**: `/admin/reports` panels reflect data committed within 5 minutes; on data-layer failure, render an explicit "data unavailable" state.

**Independent Test**: Per spec §US6 — five new applicants in last hour → registration-tempo panel reflects them within 5 min.

### Tests for User Story 6 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T099 [P] [US6] Backend integration test: insert 5 applicants → wait for next snapshot refresh tick → GET `/admin/reports/registration-tempo` reflects them. (Test forces an immediate refresh via test-only endpoint.)
- [ ] T100 [P] [US6] Backend integration test: simulate database unavailable → `/admin/reports/*` returns 503 + `Last-Updated-At` header so UI can show staleness state.
- [ ] T101 [P] [US6] Frontend Vitest: each reports panel — render four async states explicitly; "data unavailable" surface shows the last-updated timestamp.
- [ ] T102 [P] [US6] Playwright E2E: super-admin refreshes reports after a known-recent applicant insert; KPI panel reflects within 5 minutes (test runs at fast-tick refresh interval).

### Implementation for User Story 6

- [ ] T103 [P] [US6] Application use cases: `GetRegistrationTempoUseCase`, `GetStagePipelineFunnelUseCase`, `GetOperationalStatusUseCase`, `GetTestResultsUseCase`, `GetGovernanceUseCase`, `GetDepartmentBreakdownUseCase`, `GetStatusPulseUseCase` — each reads from the corresponding snapshot.
- [ ] T104 [US6] Controller `AdminReportsController` with one endpoint per panel. Returns `Last-Updated-At` header from the snapshot's `last_refreshed_at` metadata.
- [ ] T105 [US6] Frontend: `frontend/src/features/admin/api/reports.service.ts` — swap method bodies for each of the 12 sections.
- [ ] T106 [US6] Frontend: each `reports/<Section>.tsx` component reads `data` + `lastUpdatedAt` and renders a discreet "آخر تحديث: HH:MM" stamp. On 503, renders the explicit "data unavailable" state per Constitution III.

**Checkpoint**: All six user stories live. The applicant + admin frontend is no longer mock-backed.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Performance hardening, regression sweeps, doc updates, mock-removal.

- [ ] T107 [P] [Polish] Performance audit: profile `/admin/applicants` and `/admin/audit` against 10k + 1M seeded rows with React DevTools Profiler. Assert no unrelated re-renders per Constitution IV. Capture findings in `docs/performance/01-applicant-admin.md`.
- [ ] T108 [P] [Polish] Lighthouse CI gate active on every PR (per T015). Bundle-budget violations block merge.
- [ ] T109 [P] [Polish] Run a11y sweep on every new error-state component with `axe` CLI; capture findings; fix.
- [ ] T110 [P] [Polish] RTL regression sweep: open every applicant-portal page and every admin page in browser zoomed to 200%, mobile viewport (390px) and tablet (768px). Capture screenshots, fix any physical-property leaks (Constitution III addition v1.1.0).
- [ ] T111 [P] [Polish] Reduced-motion sweep: enable `prefers-reduced-motion` in DevTools; verify no animation > 200ms persists (Constitution III addition v1.1.0).
- [ ] T112 [Polish] Update CLAUDE.md §6 (mock service layer) — note that `applicants/`, `admin/`, `auth/`, `applicant-portal/` are now real-backend; other features remain mock until their own feature-cycles ship.
- [ ] T113 [Polish] Remove `simulateLatency()` calls from migrated services. Keep `MOCK` exports for the still-mock features (committees, board, investigations, medical, barcode, biometric, exams) per FR-021.
- [ ] T114 [P] [Polish] Quickstart doc: produce `specs/001-persistent-applicant-admin/quickstart.md` covering local dev (docker compose, dotnet run, npm run dev), seeding, and how to obtain the verification code from `SmsSenderStub`.
- [ ] T115 [P] [Polish] Run `npm run typecheck` + `dotnet build` — zero errors gate.
- [ ] T116 [Polish] Run full Playwright suite against the deployed staging build. Track flake budget (Constitution II addition v1.1.0).
- [ ] T117 [Polish] Recommend a Constitution amendment to add backend gates (was a follow-up in v1.1.0's Sync Impact Report). Open the PR after this feature lands; expect a MINOR bump (1.1.0 → 1.2.0).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. **BLOCKS all user stories.**
- **User Stories (Phases 3–8)**: All depend on Foundational. Within Phase 2:
  - US1 (P1) depends on T017–T031 (schema, auth, audit, seed) + T035 (auth.service swap).
  - US2 (P1) depends on US1's schema + auth pieces.
  - US3 (P1) depends on US2 schema + audit substrate (T028).
  - US4 (P1) depends on T023–T027 (auth substrate) + T031 (seed users).
  - US5 (P2) depends on schema + audit + auth.
  - US6 (P2) depends on T032–T033 (report-snapshots).
- **Polish (Phase N)**: Depends on all P1 stories (US1–US4) at minimum. P2 stories (US5–US6) and remaining polish tasks can run in parallel after MVP demo.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundation.
- **US2 (P1)**: Reads applicant data persisted by US1 — but tests can use seeded data, so the *implementation* is independent. Coordinate on the `applicants.service.ts` file (US1 swaps wizard methods, US2 swaps list/get) to avoid merge conflicts.
- **US3 (P1)**: Builds on US2's list/detail endpoints. Tests can run independently against seeded data.
- **US4 (P1)**: Independent — auth substrate is in Foundation; this story consumes it.
- **US5 (P2)**: Independent — different resource files.
- **US6 (P2)**: Depends on Foundation report-snapshots; otherwise independent.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution II).
- Domain entities → Application use cases → Controllers → Frontend service swap → Frontend page wiring.
- Story complete → checkpoint → next priority.

### Parallel Opportunities

- All [P]-marked tasks within a phase are file-disjoint and can run in parallel.
- Setup tasks T001–T016 are largely [P] (different files / different concerns).
- Foundation: T017, T018, T023, T024, T032, T037, T038, T039, T040 are [P]; T019–T022, T025–T031, T033–T036 sequentially share dependencies.
- US1–US6 can run in parallel after Foundation, given enough hands.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (REQUIRED — Constitution Principle II):
Task: "T041 Backend integration test: POST /applicant/auth/request-code"
Task: "T042 Backend integration test: full auth flow"
Task: "T043 Backend integration test: stage save and retrieve"
Task: "T044 Backend unit test: stage-3 validator rejects missing fields"
Task: "T045 Frontend Vitest: Stage3PersonalInfoPage render + interaction + a11y"
Task: "T046 Playwright E2E: cross-device recovery"

# Launch domain entities + DTOs in parallel:
Task: "T047 Domain entities Applicant + ApplicantStageSubmission"
Task: "T048 DTOs in PACademy.Contracts/Applicants/"
```

---

## Implementation Strategy

### MVP First (P1 stories only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — applicant intake persists
4. **STOP and VALIDATE**: Cross-device test passes; demo this slice
5. Complete Phase 4: US2 — admin list shows real data
6. Complete Phase 5: US3 — edits propagate + audit
7. Complete Phase 6: US4 — real auth + RBAC
8. **MVP complete**: deployable for the 2026-05-29 demo

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → cross-device intake → demo (slice 1)
3. Add US2 → admin sees applicants → demo (slice 2)
4. Add US3 → audit-traceable edits → demo (slice 3)
5. Add US4 → real RBAC → MVP complete (demo this version)
6. Add US5 → configuration objects live (post-MVP)
7. Add US6 → live reports (post-MVP)
8. Phase N polish

### Parallel Team Strategy

With multiple developers after Foundation completes:

- **Dev A**: US1 — applicant-portal flow (frontend + backend)
- **Dev B**: US2 + US3 — admin applicants list + edit + audit
- **Dev C**: US4 — auth + provisioning + RBAC
- **Dev D**: US5 — configuration resources (5 resources, can be split further)
- **Dev E**: US6 — reports + snapshot performance

US1 + US2 share `applicants.service.ts`; coordinate on the file.

---

## FR → Task Map (traceability per Principle V)

| Spec FR | Implementing Task(s) |
|---|---|
| FR-001 (applicant data persists) | T021, T047, T049, T051–T054 |
| FR-002 (admin edits persist + propagate) | T021, T060, T070, T072 |
| FR-003 (admin reference data persists) | T093–T096 |
| FR-004 (historical value preservation) | T090, T098 |
| FR-005 (SMS via stub contract) | T024a, T030, T041–T042, T049 |
| FR-006 (in-system identity + IIdentityProvider seam) | T023, T024, T025, T076, T082 |
| FR-007 (configurable session timeout) | T025, T026, T078 |
| FR-008 (applicant only own data) | T050, T079 |
| FR-009 (RBAC) | T029, T077, T084, T087 |
| FR-010 (audit on every write) | T028, T064 |
| FR-011 (audit immutable) | T021, T021a (immutability trigger + permission revoke), T028 |
| FR-012 (indefinite audit retention) | T021, T067 |
| FR-013 (audit filtering) | T071, T074 |
| FR-014 (admin list ops) | T060, T061, T093–T095 |
| FR-015 (reports against live data) | T103, T104 |
| FR-016 (four async states on data-unavailable) | T100, T101, T106 |
| FR-017 (DB constraints + last-write-wins) | T021, T066, T089 |
| FR-018 (soft-delete) | T017, T019, T093 |
| FR-019 (cycles isolated) | T057, T093 |
| FR-020 (240-applicant migration) | T030 |
| FR-021 (out of scope) | T112, T113 |
| FR-022 (file uploads stay mock) | (no implementation; T045 explicitly excludes file fields) |
| SC-001 (cross-device recovery) | T046 |
| SC-002 (2s p95 propagation) | T055, T059 |
| SC-003 (100% audit coverage) | T064, T065 |
| SC-004 (list page performance) | T056, T107 |
| SC-005 (5-min report staleness) | T032, T033, T099, T102 |
| SC-006 (99.5% uptime) | (operations gate; pilot validates) |
| SC-007 (no data loss in pilot) | (pilot validates) |
| SC-008 (audit at 1M rows) | T021, T067, T107 |
| SC-009 (admin onboarding ≤ 5 min) | (UX validation; pilot) |

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate the slice independently.
- Avoid: vague tasks, same-file conflicts (US1+US2 on `applicants.service.ts` is the one to watch), cross-story dependencies that break independence.
- Companion design docs (`research.md`, `data-model.md`, `quickstart.md`, `contracts/`) are deferred. They land alongside their tasks: `data-model.md` is filled out together with T020/T021; OpenAPI fragments in `contracts/` land alongside their controllers (T050, T061, T072, T083, T095, T104); `research.md` collects the decision logs from Phase 0 items (database, auth-token type, hosting, collation, partitioning, snapshot scheduler, CSRF) once they're answered; `quickstart.md` lands as T114.
