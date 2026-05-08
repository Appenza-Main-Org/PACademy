# Implementation Plan: Persistent applicant intake and admin operations

**Branch**: `001-persistent-applicant-admin` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-persistent-applicant-admin/spec.md`

## Summary

Replace the mock service implementations under `frontend/src/features/applicants/api/`, `frontend/src/features/admin/api/`, `frontend/src/features/auth/api/`, and `frontend/src/features/applicant-portal/api/` with calls to a new ASP.NET Core 10 Web API backed by EF Core 10 against Microsoft SQL Server 2022. The frontend's TanStack Query hooks (`*.queries.ts`) and component contracts stay unchanged — only the service-method bodies swap from `MOCK` reads + `simulateLatency()` to typed `apiClient` calls per the integration pattern documented in CLAUDE.md §6. ASP.NET Core Identity provides in-system credential storage today, behind an `IIdentityProvider` abstraction that a follow-up feature uses to plug in Ministry directory federation. Applicant SMS verification stubs the sender behind an `ISmsSender` contract; a follow-up feature wires the real Ministry-approved provider. SQL Server row-level constraints (unique, check, FK) provide the primary conflict-prevention layer per FR-017; legitimate same-row admin edits use silent last-write-wins with both writes audited to a monotonically-growing `audit_entries` table indexed for sub-second filtered queries up to 1M rows.

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.6 (existing, `strict: true`)
- Backend: C# 13 / .NET 10 (per CLAUDE.md §1; greenfield)

**Primary Dependencies**:
- Frontend (existing): React 18.3, react-router-dom 6.26, @tanstack/react-query 5, Zustand 4.5 + persist, Tailwind 3.4, react-hook-form + zod, lucide-react, date-fns. **New**: `axios` (~14 KB gzipped) for the API client (interceptors for auth, 401-handling, error normalisation).
- Backend (new): ASP.NET Core 10 Web API, EF Core 10, Microsoft.EntityFrameworkCore.SqlServer 10, ASP.NET Core Identity (in-system credential storage), cookie auth + server-side session table (see research §2), FluentValidation, Serilog (structured JSON sink + Serilog.Sinks.MSSqlServer for the audit-table sink), MediatR (use-case dispatcher; deferred if scope stays small), xUnit + FluentAssertions, Microsoft.AspNetCore.Mvc.Testing (WebApplicationFactory), Testcontainers.MsSql.

**Storage**: Microsoft SQL Server 2022 (Ministry IT mandate). Rationale — Ministry-standard RDBMS with existing licensing and operational expertise. Capabilities used: `nvarchar(max)` JSON columns with `JSON_VALUE` / `JSON_QUERY` functions and computed-column indexes for hot JSON-path queries on `applicant_stage_submission`'s flexible per-stage shape; UTF-8 collation `Arabic_100_CI_AS_SC_UTF8` (SQL Server 2019+) for Arabic-correct sorting and search; full-text indexes for fuzzy admin-search; Query Store for tuning audit queries; report-snapshot tables refreshed by a hosted .NET `BackgroundService` (see research §6). Edition: Standard or higher (Express's 10 GB cap fails indefinite audit retention; Enterprise unlocks table partitioning if/when audit volume demands it — see research §5).

**Testing**:
- Frontend: Vitest + @testing-library/react + jest-axe; MSW for service mocks in component tests; Playwright for E2E hitting a real backend (Docker-Compose orchestrates API + SQL Server for the E2E job). Per Constitution II: every UI component → render-smoke + interaction + a11y; critical journeys (applicant intake, admin edit + audit propagation, admin auth) covered by Playwright.
- Backend: xUnit + FluentAssertions for unit tests of Domain and Application layers; WebApplicationFactory for in-process API tests; Testcontainers.PostgreSql for any test that touches EF Core or SQL — no DB mocks. Coverage gate: ≥ 80% statements / ≥ 75% branches / 100% on auth + payments + form-validation paths (Constitution II).

**Target Platform**:
- Frontend: Chromium 120+, Firefox 120+, Edge 120+, Safari 17+. Mobile-first for applicants; desktop primary for admin staff.
- Backend: Linux containers (.NET 10 on Ubuntu 24.04 LTS); SQL Server 2022 in a Linux container (`mcr.microsoft.com/mssql/server:2022-latest`) or on Windows Server per Ministry hosting choice (see research §3). Topology: 2× API container behind a reverse proxy, single SQL Server primary at MVP (Always On Availability Group added if read-load or HA demands it).

**Project Type**: Web application (frontend SPA + backend Web API in monorepo).

**Performance Goals** (per spec SC-002 / SC-004 / SC-005 / SC-008):
- Applicant-stage write → admin-list read propagation: p95 ≤ 2s, p99 ≤ 5s.
- Admin list pages: p95 ≤ 500ms @ 1k records, p95 ≤ 2s @ 10k records.
- Reports panels: staleness p95 ≤ 5 min.
- `/admin/audit` filtered queries: p95 ≤ 1s @ 1M retained entries.

**Constraints**:
- Constitution IV: LCP ≤ 2.5s / INP ≤ 200ms / CLS ≤ 0.1 on mid-tier mobile / 4G.
- Constitution IV: 170 KB gzipped landing JS, 250 KB gzipped per non-landing route incremental.
- Constitution III: WCAG 2.1 AA, RTL Arabic-first, logical properties only, `prefers-reduced-motion` respected.
- 99.5% intake-window uptime (SC-006).
- Indefinite audit retention (FR-012) → storage and index strategy must remain queryable as the table grows monotonically.

**Scale/Scope**:
- 10k applicants per cycle (target capacity); current 240-applicant mock seed preserved at rollout (FR-020).
- ~100 system users total across roles.
- Audit table grows ~300k entries/cycle; planning horizon 1M+ rows before partitioning consideration.
- Peak concurrent intake-window load: ~5k applicants, ~50 admins.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify the plan against `.specify/memory/constitution.md` v1.1.0.

- **I. Code Quality & Maintainability** — ✅ PASS.
  - Frontend stays in TS `strict: true`; service-body swap doesn't introduce `any` (typed responses via `shared/types/api.ts` + per-feature DTOs).
  - Backend: `<Nullable>enable</Nullable>` and `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` adopted in every csproj. The constitution's MUST clauses are TS-flavoured today (per its Sync Impact Report); the backend adopts the spirit until the constitution codifies backend rules.
  - No new components > 200 lines anticipated. Existing service files stay 50–200 lines per feature with method bodies swapping; controller files mirror them on the backend.
  - `useEffect` for data fetching: not introduced. TanStack Query everywhere.
  - Named exports only on frontend; no defaults. Backend uses internal-by-default visibility, public only at module boundaries.
  - **New frontend dependency**: `axios` (~14 KB gzipped) — well under Constitution I's 30 KB threshold; justified in Complexity Tracking.

- **II. Testing Standards (NON-NEGOTIABLE)** — ✅ PASS.
  - Frontend: per-feature service tests via MSW; per-component tests already required by constitution; Playwright covers cross-feature journeys (applicant intake end-to-end, admin edit + audit propagation, admin sign-in + RBAC).
  - Backend: xUnit + Testcontainers.MsSql means integration tests hit a real ephemeral SQL Server instance (no DB mocks). Each controller and each Application use-case gets a contract test; auth + audit paths get 100% coverage.
  - Snapshots used as supplementary assertions only; never the sole assertion (Constitution II addition v1.1.0).
  - Pre-commit hook runs the test subset for changed files: `vitest --related` for frontend, `dotnet test --filter` on changed projects for backend.
  - Flake-quarantine policy applies; Playwright CI step tracks per-test stability and quarantines violators per the 24h / 5-day rule (Constitution II addition v1.1.0).

- **III. UX Consistency** — ✅ PASS.
  - No new UI components — service-layer swap. Existing components already consume `var(--accent-*)`, design tokens, RTL logical properties, and the four async states. The plan inherits compliance.
  - **New error states required**: backend-down, conflict-rejected (rare given last-write-wins, but DB-constraint rejections still surface), session-expired. Strings go through the centralised string layer. **TODO captured for tasks.md**: confirm `frontend/src/shared/lib/strings.ts` exists; if not, create it as a small task before any new error copy lands.
  - Auth flows preserve RTL and `prefers-reduced-motion` (the Constitution v1.1.0 additions).

- **IV. Performance Requirements** — ⚠️ ATTENTION REQUIRED, mitigations planned.
  - Bundle budgets unaffected — backend swap doesn't ship JS to the client.
  - Real-data list pages (applicants @ 10k, audit @ 1M) risk re-render storms. Mitigation: existing `DataTable` virtualises lists > 50 items per CLAUDE.md §11 and Constitution IV; integration tests will assert this still holds against real data volumes.
  - Paginated list endpoints MUST return total-count + page-count headers so the existing `Pagination` UI keeps working in one round-trip.
  - Report aggregations risk being slow if computed on every request. **Mitigation**: report-snapshot tables for the heavy aggregates (`reports_registration_tempo`, `reports_stage_funnel`, `reports_operational_status`), refreshed every 60s by a hosted .NET `BackgroundService`. Snapshot tables are simpler than SQL Server indexed views (whose schemabound + deterministic restrictions don't fit the join shapes these aggregates need). Comfortably inside SC-005's 5-min staleness budget.
  - Audit-query performance at 1M rows: covered by composite indexes on `(target_type, target_id, occurred_at)` and `(actor_id, occurred_at)` plus a monthly partitioning plan deferred until 500k rows (research §5).

- **V. Spec-Driven Discipline** — ✅ PASS.
  - Spec is tech-agnostic — verified, no DB / framework / language names appear in `spec.md`.
  - This plan owns all the technical decisions.
  - Traceability: every FR in the spec maps to one or more tasks produced by `/speckit.tasks`; the FR → task map will live as a section in `tasks.md`.
  - PR will link the originating spec.

**Re-check after Phase 1 design**: pending — runs after `data-model.md` and `contracts/` are produced.

## Project Structure

### Documentation (this feature)

```text
specs/001-persistent-applicant-admin/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Exists, status "Clarified"
├── research.md          # Phase 0 output — open technical decisions resolved
├── data-model.md        # Phase 1 output — table-by-table schema
├── quickstart.md        # Phase 1 output — local dev setup (frontend + backend + SQL Server)
├── contracts/           # Phase 1 output — OpenAPI 3.1 fragments per resource
│   ├── applicants.yaml
│   ├── admin-users.yaml
│   ├── cycles.yaml
│   ├── categories.yaml
│   ├── workflows.yaml
│   ├── admission-rules.yaml
│   ├── reference-data.yaml
│   ├── audit.yaml
│   ├── reports.yaml
│   └── auth.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
PACademy/
├── CLAUDE.md
├── frontend/                              # existing — React 18 + TS + Vite
│   └── src/
│       ├── shared/
│       │   ├── api/                       # NEW — apiClient, error normalisation, auth header / cookie handling
│       │   │   ├── client.ts              # axios instance + interceptors
│       │   │   ├── errors.ts              # ApiError, normaliseError(), 401 → re-auth flow
│       │   │   └── index.ts
│       │   ├── lib/
│       │   │   └── strings.ts             # NEW (if missing) — centralised user-facing strings
│       │   └── types/                     # existing — domain types stay
│       └── features/
│           ├── applicants/api/            # service.ts swaps MOCK → apiClient (queries unchanged)
│           ├── admin/api/                 # ditto across users / audit / cycles / categories /
│           │                              #          workflows / admission-rules / reference-data /
│           │                              #          reports
│           ├── auth/api/                  # auth.service.ts hits backend; demo-mode auto-seed gated
│           │                              #          behind import.meta.env.VITE_DEMO_MODE
│           └── applicant-portal/api/      # stage-submission service per stage
└── backend/                               # NEW — ASP.NET Core 10 Web API
    ├── PACademy.sln
    ├── docker-compose.yaml                # sqlserver + api for local dev / E2E
    ├── src/
    │   ├── PACademy.Api/                  # entry: Program.cs, Controllers/, middleware/, OpenApi/
    │   ├── PACademy.Application/          # use cases, DTOs, FluentValidation validators,
    │   │                                  #          IIdentityProvider, ISmsSender interfaces
    │   ├── PACademy.Domain/               # entities, value objects, domain rules
    │   ├── PACademy.Infrastructure/       # EF Core DbContext, migrations, Identity adapter,
    │   │                                  #          IdentityProviderInSystem, SmsSenderStub
    │   └── PACademy.Contracts/            # public DTOs / API request-response shapes
    └── tests/
        ├── PACademy.Api.Tests/            # WebApplicationFactory + Testcontainers.PostgreSql
        ├── PACademy.Application.Tests/    # unit tests for use cases (mock infra interfaces)
        └── PACademy.Domain.Tests/         # pure unit tests for domain rules
```

**Structure Decision**: Web-application monorepo (frontend + backend). Backend uses a clean-architecture split (Domain → Application → Infrastructure → Api). The identity-provider seam (FR-006) and SMS-sender seam (FR-005) live in `Application` as interfaces with `Infrastructure` implementations, so the future federation feature is a swap of one Infrastructure class plus configuration — no Application-layer changes.

## Phase 0 — Research (open technical decisions)

These are the technical-context questions the plan flags for resolution. Each lands in `research.md` with a short decision log (decision, rationale, alternatives considered).

1. **Database**: ✅ DECIDED — **Microsoft SQL Server 2022** per Ministry IT mandate. PostgreSQL was the original recommendation (operationally simpler, no licensing cost) but is superseded by Ministry standardisation. Edition assumption: Standard or higher (Express's 10 GB cap fails indefinite audit retention; Enterprise unlocks table partitioning and Always On AGs).
2. **Auth token type**: cookie + DB-backed session table vs JWT (stateless). **Recommendation: cookie + DB-backed sessions** because (a) FR-007's short configurable timeout fits server-side session control naturally, (b) FR-009's deactivated-admin-logged-out-immediately requirement is trivial with sessions and awkward with JWT (revocation list = session table by another name), (c) frontend SPA on the same origin as API has no cookie-handling pain. JWT is appropriate later if scale demands stateless tokens.
3. **Hosting topology**: on-prem Ministry datacenter vs Egyptian-government cloud. Affects deployment but not application code; flagged for ops discussion.
4. **SQL Server collation**: `Arabic_100_CI_AS_SC_UTF8` (UTF-8, supplementary characters; SQL Server 2019+) at the column level for Arabic-correct sorting and full-text search. Verify EF Core's `UseCollation(...)` survives migration round-trip; confirm the licensed edition supports UTF-8 collations (Standard and higher do).
5. **Audit-table partitioning**: at what row count to switch from a single table to range-partitioning by month. Recommendation: defer until 500k rows (~18 months of intake at projected volume); plan for it but don't implement on day one. Note — SQL Server table partitioning is Enterprise-edition only; if Ministry licenses Standard, the fallback is filtered indexes + a scheduled archive-out job.
6. **Report-snapshot refresh strategy**: hosted .NET `BackgroundService` (in the API process) vs SQL Server Agent job (Standard+ edition). Recommendation: hosted `BackgroundService` — works across editions including Developer/Express for local dev, observable via the same Serilog pipeline, schedule lives in code with the rest of the application. SQL Server Agent is appropriate later if the refresh logic moves entirely to T-SQL.
7. **CSRF strategy** with cookie auth: SameSite=Strict + double-submit token vs SameSite=Lax + Origin header check. Recommendation: SameSite=Strict + double-submit token for the admin surface (the higher-value target); applicant surface can run Lax since SMS-verification provides a pre-auth flow.

## Phase 1 — Design (companion artifacts)

Produced together with this plan in subsequent runs (each one its own short artifact, not bundled here):

- **`data-model.md`** — entity-level schema for `applicant`, `applicant_stage_submission`, `system_user`, `cycle`, `category`, `workflow`, `admission_rule`, `reference_data`, `audit_entry`, `session`. Each table includes SQL Server column types, nullability, indexes (especially for audit-query performance), constraints (the FR-017 primary-defence layer), and EF Core mapping notes. Covers the JSON-column strategy for stage submissions (`nvarchar(max)` plus `JSON_VALUE`-indexed computed columns for hot paths) and the `archived` flag for soft-delete (FR-018).
- **`contracts/*.yaml`** — OpenAPI 3.1 fragments per resource. Frontend `*.queries.ts` files target these contracts directly; the existing `INTEGRATION CONTRACT` JSDoc headers in mock service files are upgraded to point at the OpenAPI paths so the contract is two-way-traceable.
- **`quickstart.md`** — local dev setup: `docker compose up sqlserver` brings the DB; `dotnet run --project backend/src/PACademy.Api` starts the API; `npm run dev --prefix frontend` runs the SPA against it. Includes how to seed the 240-applicant dataset (FR-020) and how to obtain a verification code in dev mode (logged to stdout via `SmsSenderStub`).

## Complexity Tracking

> Filled when Constitution Check has violations or non-trivial trade-offs to justify.

| Violation / trade-off | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Indefinite audit retention vs typical 7-year govt records standard — increases storage + query-tuning burden | FR-012, explicit business decision; audit is the legal record of system activity | Capped retention would silently drop legal records — rejected by stakeholder |
| `IIdentityProvider` seam added before federation is required | FR-006, federation is a known follow-up feature | Hardcoding in-system creds and rewriting later costs more than the small abstraction now |
| Report-snapshot tables refreshed every 60 s by a hosted `BackgroundService` | SC-005 (5-min staleness) + admin list-page latency targets | Computing aggregates on every request risks 5+ s p95 with 10k applicants — fails SC-002 / SC-004. SQL Server indexed views were considered but the join-shape doesn't fit their schemabound / deterministic restrictions; snapshot tables are the simpler equivalent. |
| `axios` (~14 KB gzipped) over built-in `fetch` | Interceptors for auth header / 401 → re-auth / structured error normalisation; ecosystem support | Hand-rolled `fetch` wrapper grows toward similar size and lacks ecosystem; well under Constitution I's 30 KB threshold |
| Silent last-write-wins for application-level conflicts (FR-017) — adds policy ambiguity vs explicit reject | Explicit business decision; DB constraints handle the higher-stakes class | Optimistic locking with reject was offered and rejected by stakeholder; this is the residual approach |
| Mock-data migration of 240 demo applicants into the live system at rollout | FR-020, demo continuity with current frontend; flagged with `demo_origin = true` so they can be filtered from operational reports | A clean-slate rollout was offered and rejected to preserve the demo storyline |

## Notes

- This plan does NOT cover backend persistence for committees, board, investigations, medical, barcode, biometric, exams (per FR-021). Each is a separate spec/plan/tasks cycle and they share the same backend codebase + auth + audit substrate this plan lays down.
- Real SMS provider, persistent file storage, and Ministry directory federation are explicit follow-up features (per FR-005, FR-022, FR-006). The seams they plug into are designed in this plan.
- The Constitution v1.1.0's MUST clauses are TS-flavoured today (per its Sync Impact Report). The backend portion of this plan adopts the spirit of Principle I (strict typing, no escape hatches) and Principle II (test-first, real DB in integration tests) until the constitution codifies backend rules. A `/speckit.constitution` amendment to add backend gates is a recommended follow-up — likely a MINOR bump (1.1.0 → 1.2.0).
