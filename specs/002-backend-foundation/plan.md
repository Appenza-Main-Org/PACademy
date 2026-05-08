# Implementation Plan: Backend foundation — durable admin-app data, identity, audit

**Branch**: `002-backend-foundation` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-backend-foundation/spec.md`

## Summary

Replace the in-memory MOCK arrays that back `frontend/src/features/admin/api/*.service.ts` and `frontend/src/features/auth/api/auth.service.ts` with a real ASP.NET Core 10 Web API on top of EF Core 10 against Microsoft SQL Server 2022. Frontend `*.queries.ts` hooks and component contracts stay unchanged — only service-method bodies swap from `MOCK + simulateLatency()` to typed `apiClient` calls per CLAUDE.md §6. ASP.NET Core Identity provides in-system credential storage today behind an `IIdentityProvider` seam that a follow-up feature uses to plug Ministry directory federation; the same seam also gates a future Ministry-approved 2FA API. **Login credential is the user's `nationalId`** (FR-003) — implemented by setting `IdentityUser.UserName = nationalId` on every system user so `SignInManager.PasswordSignInAsync` works without custom lookups, with the Ministry-officer profile fields (`officerCode`, `fullName`, `mobile`, `email`, `isActive`, `issueDate`, `cardFactoryNumber`) extending `SystemUser : IdentityUser<Guid>` (FR-029). Audit is a single `audit_entries` table with a self-referencing `batch_id` column — bulk ops emit one summary row plus N child rows, both immutable via a SQL Server `INSTEAD OF UPDATE, DELETE` trigger. Bulk ingestion uses **ClosedXML** (.xlsx parsing, MIT, ~250 KB NuGet — backend-side, not subject to the frontend bundle budget) for streaming row reads, in-memory per-row validation, and **`Microsoft.Data.SqlClient.SqlBulkCopy`** for both the resource INSERT and the per-row audit children (already part of the EF Core SqlServer transitive deps; no new package). The bulk path caps at 100,000 rows synchronous (FR-027), comfortably handling the 60k+ files the Ministry produces today. The 240-applicant demo dataset migrates into durable storage at first run with a permanent `demo_origin = true` flag. Reports panels read from snapshot tables refreshed every 60 s by a hosted .NET `BackgroundService`, comfortably inside SC-005's 5-minute staleness budget.

The applicant portal (Stage 1–11 wizard, SMS verification, cross-device recovery) is **explicitly out of scope** here per spec FR-019; it ships as a separate feature on this same foundation.

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.6 (existing, `strict: true`)
- Backend: C# 13 / .NET 10 (greenfield per CLAUDE.md §1)

**Primary Dependencies**:
- Frontend (existing): React 18.3, react-router-dom 6.26, @tanstack/react-query 5, Zustand 4.5 + persist, Tailwind 3.4, react-hook-form + zod, lucide-react, date-fns. **New** (Phase 1 of spec 001 already wired): `axios` (~14 KB gzipped) for the API client (interceptors for auth, 401-handling, error normalisation).
- Backend (new): ASP.NET Core 10 Web API, EF Core 10, `Microsoft.EntityFrameworkCore.SqlServer` 10, ASP.NET Core Identity (in-system credential storage), cookie auth + server-side session table, FluentValidation, Serilog (structured JSON sink + `Serilog.Sinks.MSSqlServer` for the audit-table tee), MediatR (use-case dispatcher; deferred if scope stays small), **ClosedXML** (Excel .xlsx parser for bulk import — see Complexity Tracking), xUnit + FluentAssertions + Microsoft.AspNetCore.Mvc.Testing (`WebApplicationFactory`) + Testcontainers.MsSql.

**Storage**: Microsoft SQL Server 2022 (Ministry IT mandate). Capabilities used:
- `nvarchar(max)` JSON columns with `JSON_VALUE` / `JSON_QUERY` for flexible payloads (workflow stage configs, audit field-diff blobs).
- UTF-8 collation `Arabic_100_CI_AS_SC_UTF8` (SQL Server 2019+) at the column level for Arabic-correct sorting and full-text search.
- `INSTEAD OF UPDATE, DELETE` trigger on `audit_entries` for FR-008 immutability; `DENY UPDATE, DELETE` to the application's runtime DB user as belt-and-braces.
- Snapshot tables (`reports_registration_tempo`, `reports_stage_funnel`, `reports_operational_status`) refreshed every 60 s by a hosted `BackgroundService`. SQL Server indexed views were considered but their schemabound + deterministic restrictions don't fit the join shapes these aggregates need.
- Edition: Standard or higher (Express's 10 GB cap fails indefinite audit retention; Enterprise unlocks table partitioning if/when audit volume demands it — see research §5).

**Testing**:
- Frontend: Vitest + @testing-library/react + jest-axe; MSW for service mocks in component tests; Playwright for E2E hitting a real backend (Docker-Compose orchestrates API + SQL Server for the E2E job). Per Constitution II: every UI component → render-smoke + interaction + a11y; critical journeys (admin sign-in, admin edit + audit propagation, bulk import) covered by Playwright.
- Backend: xUnit + FluentAssertions for unit tests of Domain and Application layers; `WebApplicationFactory<Program>` for in-process API tests; Testcontainers.MsSql for any test that touches EF Core or SQL — no DB mocks. Coverage gate: ≥ 80% statements / ≥ 75% branches / 100% on auth + bulk-import-validation paths (Constitution II).

**Target Platform**:
- Frontend: Chromium 120+, Firefox 120+, Edge 120+, Safari 17+. Desktop primary for admin staff (≥ 1024px). Mobile/tablet verification still required by Constitution III but admin is desktop-first by use case.
- Backend: Linux containers (.NET 10 on Ubuntu 24.04 LTS); SQL Server 2022 in a Linux container (`mcr.microsoft.com/mssql/server:2022-latest`) or on Windows Server per Ministry hosting choice. Topology: 2× API container behind a reverse proxy, single SQL Server primary at MVP (Always On AG added later if demand requires).

**Performance Goals** (per spec SC-002 / SC-003 / SC-004 / SC-005 / SC-010):
- Admin write → admin-list read propagation: p95 ≤ 2 s, p99 ≤ 5 s.
- Admin list pages: p95 ≤ 500 ms @ 1k records, p95 ≤ 2 s @ 10k records.
- `/admin/audit` filtered queries: p95 ≤ 1 s @ 1M retained entries.
- Reports panels: staleness p95 ≤ 5 min.
- Bulk import 100k rows: p95 ≤ 60 s end-to-end (SC-010), synchronous request-response. Field validation in-memory; row INSERT and audit-child INSERT both via `SqlBulkCopy`.

**Constraints**:
- Constitution IV: LCP ≤ 2.5 s / INP ≤ 200 ms / CLS ≤ 0.1 on mid-tier mobile / 4G.
- Constitution IV: 170 KB gzipped landing JS, 250 KB gzipped per non-landing route incremental.
- Constitution III: WCAG 2.1 AA, RTL Arabic-first, logical properties only, `prefers-reduced-motion` respected.
- 99.5% admin-app uptime during the 4-week intake window of a live cycle (SC-006).
- Indefinite audit retention (FR-009) — storage and index strategy must remain queryable as the table grows monotonically.

**Scale/Scope**:
- 10k applicants per cycle (target capacity); 240-applicant mock seed preserved at rollout (FR-017).
- ~100 system users across roles.
- Audit table grows ~300k single-row entries / cycle plus bulk-op summaries + children. Bulk imports of up to 100k rows generate ~100k child entries each. Planning horizon 1M+ rows before partitioning consideration; a single large bulk import can move that horizon by a full cycle's worth of single-row entries — partitioning may need to land sooner if multiple 100k-row imports stack within a quarter (research §5 + §10).
- Peak concurrent intake-window load: ~50 admins online; ~5k applicants reading their own (out-of-scope) status. Admin app traffic is order of magnitude lower than applicant.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify the plan against `.specify/memory/constitution.md` v1.1.0.

- **I. Code Quality & Maintainability** — ✅ PASS, with one approved dependency.
  - Frontend stays in TS `strict: true`; service-body swap doesn't introduce `any` (typed responses via `shared/types/api.ts` + per-feature DTOs).
  - Backend: `<Nullable>enable</Nullable>` and `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` adopted in every csproj per Phase 1 of spec 001 (already in place). The constitution's MUST clauses are TS-flavoured today; the backend adopts the spirit until the constitution codifies backend rules (T117 follow-up).
  - No new components > 200 lines anticipated. Service files stay 50–200 lines with method bodies swapping; controllers mirror them on the backend.
  - `useEffect` for data fetching: not introduced. TanStack Query everywhere.
  - Named exports only on frontend; no defaults. Backend uses internal-by-default visibility, public only at module boundaries via DI extension methods.
  - **New backend dependency**: `ClosedXML` (~250 KB NuGet, MIT, .xlsx parsing) for FR-025. Backend NuGet size is not subject to the frontend 30 KB gzipped bundle rule, but the spirit of dependency justification applies. Tracked in Complexity Tracking.

- **II. Testing Standards (NON-NEGOTIABLE)** — ✅ PASS.
  - Frontend: per-feature service tests via MSW; per-component tests already required by constitution; Playwright covers cross-feature journeys (admin sign-in + RBAC, admin edit + audit propagation, bulk import).
  - Backend: xUnit + Testcontainers.MsSql means integration tests hit a real ephemeral SQL Server instance (no DB mocks). Each controller and each Application use case gets a contract test; auth + audit + bulk-validation paths get 100% coverage.
  - Snapshots used as supplementary assertions only; never the sole assertion (Constitution II addition v1.1.0).
  - Pre-commit hook runs the test subset for changed files: `vitest --related` for frontend, `dotnet test --filter` on changed projects for backend (Phase 1 of spec 001 already wired this in `.husky/pre-commit`).
  - Flake-quarantine policy applies; Playwright CI step tracks per-test stability and quarantines violators per the 24h / 5-day rule (Constitution II addition v1.1.0).

- **III. UX Consistency** — ✅ PASS.
  - No new UI surfaces beyond the bulk-import dialog (US7) — service-layer swap covers the rest. Existing components already consume `var(--accent-*)`, design tokens, RTL logical properties, and the four async states.
  - **New error states required**: backend-down, conflict-rejected (rare given last-write-wins, but DB-constraint rejections still surface), session-expired, super-admin-floor-rejected (FR-005a), bulk-import-error-report. Strings go through `frontend/src/shared/lib/strings.ts` (Phase 1 of spec 001 already created the file).
  - **New UI**: Bulk-import dialog (drag-drop or file-picker), error-report download button, batch-summary audit drilldown. Each MUST honour Constitution III four async states; the error-report state is non-trivial — explicit "X of Y rows failed; download report" rendering, not just a generic toast.
  - Auth flows preserve RTL and `prefers-reduced-motion` (Constitution v1.1.0 additions).

- **IV. Performance Requirements** — ⚠️ ATTENTION REQUIRED, mitigations planned.
  - Bundle budgets unaffected — backend swap doesn't ship JS to the client. The bulk-import dialog uses native `<input type="file">` plus a small XLSX-preview component; no new heavy frontend libs needed (XLSX parsing happens server-side).
  - Real-data list pages (applicants @ 10k, audit @ 1M) risk re-render storms. Mitigation: existing `DataTable` virtualises lists > 50 items per CLAUDE.md §11 and Constitution IV; integration tests assert this still holds against real data volumes.
  - Paginated list endpoints MUST return `X-Total-Count` and `X-Page-Count` headers so the existing `Pagination` UI keeps working in one round-trip.
  - Report aggregations risk being slow if computed on every request. **Mitigation**: report-snapshot tables for the heavy aggregates (`reports_registration_tempo`, `reports_stage_funnel`, `reports_operational_status`), refreshed every 60 s by a hosted `BackgroundService`. Snapshot tables are simpler than SQL Server indexed views (whose schemabound + deterministic restrictions don't fit the join shapes these aggregates need). Comfortably inside SC-005's 5-min staleness budget.
  - Audit-query performance at 1M rows: covered by composite indexes on `(target_type, target_id, occurred_at)` and `(actor_id, occurred_at)` plus a monthly partitioning plan deferred until 500k rows (research §5).
  - **Bulk import 100k-row budget** (SC-010): 60 s p95 synchronous. Mitigation: streaming row reader (ClosedXML's `Worksheet.RowsUsed()` enumerates lazily), per-row validation in-memory (field rules + dedup HashSet + pre-loaded reference-data cache for FK checks), then **`Microsoft.Data.SqlClient.SqlBulkCopy`** for the resource-row INSERT and a second `SqlBulkCopy` pass for the audit children. Both copy operations run inside one explicit `SqlTransaction` per chunk so a chunk failure doesn't roll back already-committed chunks (FR-026 partial-success). Chunk size: 10,000 rows (10 chunks for a max-size 100k import). EF's `DbContext.SaveChangesAsync` audit hook is bypassed for bulk paths; the bulk-import use case emits the summary entry + children explicitly via the same `IAuditWriter` seam called with a "bulk mode" overload.

- **V. Spec-Driven Discipline** — ✅ PASS.
  - Spec is tech-agnostic — verified, no DB / framework / language names appear in `spec.md` (the only lib mention is "Excel (.xlsx)" in FR-025, which is a file-format choice, not a tech choice).
  - This plan owns all the technical decisions.
  - Traceability: every FR in the spec maps to one or more tasks produced by `/speckit.tasks`; the FR → task map will live as a section in `tasks.md`.
  - PR will link the originating spec.

**Re-check after Phase 1 design**: pending — runs after `data-model.md` and `contracts/` are produced.

## Project Structure

### Documentation (this feature)

```text
specs/002-backend-foundation/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Exists, status "Clarified"
├── research.md          # Phase 0 output — open technical decisions resolved
├── data-model.md        # Phase 1 output — table-by-table schema (incl. audit_entries.batch_id, demo_origin)
├── quickstart.md        # Phase 1 output — local dev setup (frontend + backend + SQL Server)
├── contracts/           # Phase 1 output — OpenAPI 3.1 fragments per resource
│   ├── auth.yaml
│   ├── admin-applicants.yaml
│   ├── admin-users.yaml
│   ├── cycles.yaml
│   ├── categories.yaml
│   ├── workflows.yaml
│   ├── admission-rules.yaml
│   ├── reference-data.yaml
│   ├── audit.yaml
│   ├── reports.yaml
│   └── bulk-ops.yaml    # multipart upload + per-row error-report response shape
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
PACademy/
├── CLAUDE.md
├── frontend/                              # existing — React 18 + TS + Vite
│   └── src/
│       ├── shared/
│       │   ├── api/                       # apiClient, error normalisation, auth header / cookie handling
│       │   │                              # (Phase 1 of spec 001 already created this)
│       │   ├── lib/
│       │   │   └── strings.ts             # centralised user-facing strings (Phase 1 already created)
│       │   ├── components/
│       │   │   ├── BulkImportDialog.tsx   # NEW — drag-drop .xlsx + error-report download
│       │   │   └── SessionExpiredBanner.tsx
│       │   └── types/                     # existing — domain types stay
│       └── features/
│           ├── admin/api/                 # service.ts swaps MOCK → apiClient across users / cycles /
│           │                              #   categories / workflows / admission-rules / reference-data /
│           │                              #   reports / bulk-ops
│           ├── applicants/api/            # admin-side list + detail + edit; queries unchanged
│           ├── audit/api/                 # service.ts swap; new audit-batch drilldown query hook
│           └── auth/api/                  # auth.service.ts hits backend; demo-mode auto-seed gated
│                                          #   behind import.meta.env.VITE_DEMO_MODE
└── backend/                               # NEW per spec 001 Phase 1; populated here
    ├── PACademy.slnx                      # exists (Phase 1)
    ├── docker-compose.yaml                # exists (Phase 1) — sqlserver + api for local dev / E2E
    ├── src/
    │   ├── PACademy.Api/                  # Program.cs, Controllers/Admin/, middleware/, OpenApi/
    │   ├── PACademy.Application/          # use cases, DTOs, FluentValidation validators,
    │   │                                  #   IIdentityProvider, IAuditWriter, IBulkImportRunner
    │   │                                  #   interfaces
    │   ├── PACademy.Domain/               # entities, value objects, domain rules incl.
    │   │                                  #   SuperAdminFloorPolicy (FR-005a)
    │   ├── PACademy.Infrastructure/       # EF Core DbContext, migrations, Identity adapter,
    │   │                                  #   InSystemIdentityProvider, ClosedXmlImportRunner,
    │   │                                  #   ReportSnapshotsRefresher
    │   └── PACademy.Contracts/            # public DTOs / API request-response shapes
    └── tests/
        ├── PACademy.Api.Tests/            # WebApplicationFactory + Testcontainers.MsSql
        ├── PACademy.Application.Tests/    # unit tests for use cases (mock infra interfaces)
        └── PACademy.Domain.Tests/         # pure unit tests for domain rules (incl. floor policy)
```

**Structure Decision**: Web-application monorepo (frontend + backend). Backend uses a clean-architecture split (Domain → Application → Infrastructure → Api). The identity-provider seam (FR-003) and bulk-import runner seam (FR-024) live in `Application` as interfaces with `Infrastructure` implementations, so the future federation feature is a swap of one Infrastructure class plus configuration — no Application-layer changes. This is the same skeleton spec 001 Phase 1 already laid down (still on disk after the rollback); we populate it here.

## Phase 0 — Research (open technical decisions)

These are the technical-context questions the plan flags for resolution. Each lands in `research.md` with a short decision log (decision, rationale, alternatives considered).

1. **Database**: ✅ DECIDED — **Microsoft SQL Server 2022** per Ministry IT mandate. Edition: Standard or higher.
2. **Auth token type**: cookie + DB-backed session table vs JWT (stateless). **Recommendation: cookie + DB-backed sessions** because (a) FR-004's short configurable timeout fits server-side session control naturally, (b) FR-005's deactivated-admin-logged-out-immediately requirement is trivial with sessions and awkward with JWT (revocation list = session table by another name), (c) frontend SPA on the same origin as API has no cookie-handling pain. JWT is appropriate later if scale demands stateless tokens.
3. **Hosting topology**: on-prem Ministry datacenter vs Egyptian-government cloud. Affects deployment but not application code; flagged for ops discussion.
4. **SQL Server collation**: `Arabic_100_CI_AS_SC_UTF8` (UTF-8, supplementary characters; SQL Server 2019+) at the column level for Arabic-correct sorting and full-text search. Verify EF Core's `UseCollation(...)` survives migration round-trip; confirm the licensed edition supports UTF-8 collations (Standard and higher do).
5. **Audit-table partitioning**: at what row count to switch from a single table to range-partitioning by month. Recommendation: defer until 500k rows (~18 months of intake at projected volume); plan for it but don't implement on day one. SQL Server table partitioning is Enterprise-edition only; if Ministry licenses Standard, the fallback is filtered indexes + a scheduled archive-out job.
6. **Report-snapshot refresh strategy**: hosted .NET `BackgroundService` (in the API process) vs SQL Server Agent job (Standard+ edition). Recommendation: hosted `BackgroundService` — works across editions including Developer/Express for local dev, observable via the same Serilog pipeline, schedule lives in code with the rest of the application.
7. **CSRF strategy** with cookie auth: SameSite=Strict + double-submit token. Admin surface only this feature; applicant surface (different SameSite policy) is a follow-up.
8. **Excel parser library** (FR-025): **ClosedXML** chosen.
   - **ClosedXML** (MIT, ~250 KB) — clean fluent API, good Arabic support, lazy-row enumeration via `Worksheet.RowsUsed()`. Best fit.
   - EPPlus 5+ requires a commercial licence for production use; non-starter for a Ministry deploy without procurement sign-off. EPPlus 4.x (LGPL) is unmaintained.
   - OpenXML SDK (Microsoft, MIT) is lower-level — handles Office Open XML markup directly. Hardest to use, biggest learning curve. Reach for it only if ClosedXML can't handle a Ministry-supplied template shape.
   - ExcelDataReader / Sylvan.Excel are read-only and skinnier (~100–150 KB) but the eventual export feature will need write capability — better to commit to one library now.
9. **Audit batch-summary storage shape**: single `audit_entries` table with self-referencing `batch_id` column (NULL for single-row entries, set on bulk children pointing to the bulk-summary row's id) vs a separate `audit_batches` parent table. **Recommendation: single table, self-referencing FK** — simpler queries (one composite index covers both single-row and bulk drilldown), one immutability trigger covers everything, fewer joins. Drilldown query: `WHERE batch_id = @summaryId ORDER BY occurred_at`.
10. **Bulk import insert path**: at 100k rows × ~20 columns = ~2M cells, chunked `SaveChangesAsync` (even at 500 rows/chunk, 10k EF round-trips per import) cannot meet SC-010's 60 s p95 — single-row INSERT throughput tops out around 1–2k/sec end-to-end on commodity hardware once you account for change-tracking, audit hook firing, and the SQL Server log writer. **Recommendation: `Microsoft.Data.SqlClient.SqlBulkCopy`** for the resource-row INSERT (millions of rows/sec native throughput) **and a second `SqlBulkCopy` pass for the audit children** (same throughput; same transaction). Configuration: `SqlBulkCopyOptions.CheckConstraints` ON (so CHECK constraints — status enum range, etc. — still fire), `KeepIdentity` OFF (server-generated GUIDs / IDs), `BatchSize = 10000`, explicit `SqlTransaction` per chunk for FR-026 partial-success.

   Per-row validation stays in-memory (ClosedXML lazy reader + dedup HashSet + pre-loaded reference-data cache for FK checks) so only the rows that pass validation reach SqlBulkCopy. Rows that fail validation are collected into the per-row error report (FR-026) without touching SQL.

   Edge case: a row passes in-memory validation but violates a unique constraint at INSERT time (e.g., race with a concurrent import). `SqlBulkCopy` is all-or-nothing within its batch, so a single bad row fails the whole chunk. Mitigation: pre-load existing keys into the dedup HashSet at the start of the import — closes the race window for non-concurrent imports. For genuine concurrent-import collisions, the chunk fails and admin retries with the conflicting rows excluded; documented as a known small-population edge case rather than over-engineered around.

   EF's `DbContext.SaveChangesAsync` audit hook (which catches single-row writes via `IAuditableWrite`) is **bypassed** by `SqlBulkCopy`. The bulk-import use case emits audit explicitly via `IAuditWriter.RecordBulkAsync(summary, children)` — the seam stays clean; the implementation in Infrastructure routes the children through a third `SqlBulkCopy` pass on `audit_entries` with `batch_id` populated.
11. **Bulk import file storage**: do we keep the uploaded .xlsx on disk after processing? **Recommendation: discard after processing** — the audit log carries the per-row diffs, and the row-level error report is regenerable from the same diffs. Storing the file would add another retention surface (FR-009 indefinite, even on the file?) without a clear use case. Defer file storage to the broader file-storage feature (FR-020, separate spec).

12. **System User login by `nationalId` (FR-003)**: ASP.NET Identity's `SignInManager.PasswordSignInAsync` looks users up by `IdentityUser.UserName` (and falls back to `Email` if `UserManager.Options.User.RequireUniqueEmail = true` and the input contains `@`). Three implementation choices:
    - **(Chosen) Set `UserName = NationalId` on every system user**. `SignInManager` works out of the box; existing Identity password hashing, lockout, and 2FA hooks all apply unchanged. Trade-off: `UserName` and `NationalId` are now redundant columns on `AspNetUsers` — costs ~14 bytes per row (negligible). The unique constraint Identity already maintains on `UserName` doubles as the unique constraint on `NationalId` per FR-029.
    - Override `UserStore` to look up by a custom `NationalId` column. Cleanest schema (one source of truth for the credential field), but every Identity API surface (password reset, 2FA, lockout) needs to know to call `FindByNationalIdAsync` instead of `FindByNameAsync`. More moving parts.
    - Build a custom auth handler that bypasses `SignInManager` entirely. Most flexible, but discards ~80% of Identity's value.
    The chosen path is the smallest delta from default Identity and the safest seam for the FR-031 2FA follow-up — Identity's built-in 2FA pipeline keys off `UserName`, so 2FA "just works" once the external API contract is wired up.

13. **Two-factor authentication seam (FR-031)**: deferred. The `IIdentityProvider` interface (FR-003) stays the only seam Application code sees; the Infrastructure adapter (`InSystemIdentityProvider` today, federated/2FA tomorrow) owns the second-factor handshake. Identity's built-in `UserManager.GenerateTwoFactorTokenAsync` + `SignInManager.TwoFactorAuthenticatorSignInAsync` are the integration points when the external 2FA API ships; no domain-layer change required.

## Phase 1 — Design (companion artifacts)

Produced together with this plan in subsequent runs (each one its own short artifact, not bundled here):

- **`data-model.md`** — entity-level schema for `applicants`, `applicant_stage_submissions` (column reserved for the future applicant-portal feature; not populated here), `system_users` (extends ASP.NET `IdentityUser<Guid>` with `OfficerCode`, `FullName`, `Mobile`, `Email`*, `IsActive`, `IssueDate`, `CardFactoryNumber`, `NationalId`*; `UserName` mirrors `NationalId` for SignInManager compatibility — *some fields already supplied by `IdentityUser`), `cycles`, `categories`, `workflows`, `admission_rules`, `reference_data`, `audit_entries` (with `batch_id` self-ref), `sessions`. Each table includes SQL Server column types, nullability, indexes (especially for audit-query performance), constraints (the FR-014 primary-defence layer; plus the FR-029 unique constraints on `system_users.NationalId / OfficerCode / Email / Mobile / CardFactoryNumber` filtered to non-archived rows), the `archived` + `archived_at` columns for soft-delete (FR-015), the `demo_origin` column (FR-017), and EF Core mapping notes. Covers the JSON-column strategy for stage submissions and the `JSON_VALUE`-indexed computed columns for hot paths.
- **`contracts/*.yaml`** — OpenAPI 3.1 fragments per resource. Frontend `*.queries.ts` files target these contracts directly; the existing `INTEGRATION CONTRACT` JSDoc headers in mock service files are upgraded to point at the OpenAPI paths. `bulk-ops.yaml` documents the multipart-upload request shape and the per-row error-report response (FR-026).
- **`quickstart.md`** — local dev setup: `docker compose up sqlserver` brings the DB; `dotnet run --project backend/src/PACademy.Api -- --seed-demo` starts the API and runs the demo migration; `npm run dev --prefix frontend` runs the SPA against it. Includes how to sign in as the seeded super-admin (FR-018) and how to upload a sample bulk-import .xlsx for smoke testing.

## Complexity Tracking

> Filled when Constitution Check has violations or non-trivial trade-offs to justify.

| Violation / trade-off | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Indefinite audit retention vs typical 7-year govt records standard — increases storage + query-tuning burden | FR-009, explicit business decision; audit is the legal record of platform activity | Capped retention would silently drop legal records — rejected by stakeholder |
| `IIdentityProvider` seam added before federation is required | FR-003, federation is a known follow-up feature | Hardcoding in-system creds and rewriting later costs more than the small abstraction now |
| Report-snapshot tables refreshed every 60 s by a hosted `BackgroundService` | SC-005 (5-min staleness) + admin list-page latency targets | Computing aggregates on every request risks 5+ s p95 with 10k applicants — fails SC-002 / SC-003. SQL Server indexed views were considered but the join-shape doesn't fit their schemabound / deterministic restrictions; snapshot tables are the simpler equivalent. |
| `axios` (~14 KB gzipped) over built-in `fetch` (already added in spec 001 Phase 1) | Interceptors for auth header / 401 → re-auth / structured error normalisation; ecosystem support | Hand-rolled `fetch` wrapper grows toward similar size and lacks ecosystem; well under Constitution I's 30 KB threshold |
| **`ClosedXML` (~250 KB NuGet) over hand-rolling .xlsx parsing** | FR-025 (Excel-only ingestion); .xlsx is a zipped XML format with multi-sheet support and Arabic encoding subtleties hand-rolling would miss | OpenXML SDK is lower-level and Microsoft-blessed but ~5× the work and harder to test. EPPlus is licence-incompatible with Ministry procurement. ExcelDataReader is read-only and we'll need write capability for export later. ClosedXML is MIT-licensed, well-maintained, and the smallest dependency that covers both directions. Backend NuGet size is not subject to the frontend 30 KB rule, but we still justify it here for spec-discipline. |
| Silent last-write-wins for application-level conflicts (FR-014) — adds policy ambiguity vs explicit reject | Explicit business decision; DB constraints handle the higher-stakes class | Optimistic locking with reject was offered and rejected by stakeholder; this is the residual approach |
| Mock-data migration of 240 demo applicants into the live system at rollout | FR-017, demo continuity with current frontend; flagged with permanent `demo_origin = true` so they can be filtered from operational reports | A clean-slate rollout was offered and rejected to preserve the demo storyline |
| Permanent `demo_origin` flag (persists through admin edits) | FR-017 explicit decision; provenance is a different concept from "untouched" | Resetting the flag on first admin edit conflated origin with provenance; rejected during clarification round |
| Single `audit_entries` table with self-referencing `batch_id` for bulk children | FR-028; one immutability trigger and one composite index cover both single-row and bulk-drilldown queries | A separate `audit_batches` parent table doubled the schema surface and the trigger surface for marginal semantic gain; rejected during research §9 |
| 100,000-row hard cap on bulk operations (FR-027) — synchronous request-response | SC-010 perf budget (60 s p95). Picks "comfortable headroom over the 60k+ files stakeholder cited" without crossing into async-job territory. Validation is the bottleneck (~1ms / row in-memory); SqlBulkCopy itself is fast enough that bigger caps are technically feasible | 250k synchronous-with-progress-poll and 1M+ async-job options were offered during clarification follow-up and rejected — keeps the architecture simpler at the cost of a higher-than-100k import being split client-side. Cap can be lifted later by adding an async-job layer behind the same controller endpoint without breaking callers. |
| `SqlBulkCopy` for both resource INSERT and audit-child INSERT (plan §10) — bypasses EF's `DbContext.SaveChangesAsync` audit hook | SC-010's 60s budget. Chunked `SaveChangesAsync` at 10k EF round-trips per max-size import cannot meet that. SqlBulkCopy is part of `Microsoft.Data.SqlClient` (already a transitive dep of `Microsoft.EntityFrameworkCore.SqlServer`) so no new package is added | EF Core 10's `AddRangeAsync` + `SaveChanges` with batched INSERTs benchmarks ~10× slower than SqlBulkCopy at this volume. Third-party `EFCore.BulkExtensions` (~1MB, MIT) keeps EF semantics but loses ~30% of SqlBulkCopy's throughput and adds a real dependency where SqlBulkCopy adds none. Trade-off: bulk path bypasses the audit hook → bulk-import use case must emit audit explicitly via the same `IAuditWriter` seam (`RecordBulkAsync` overload). Acceptable given the use case is one place. |
| Super-admin floor of 1 (FR-005a) — adds a domain rule the deactivation endpoint must enforce | Prevents the platform from being orphaned by a self-deactivation; chosen by stakeholder over confirmation-prompt and backup-provisioning alternatives | Allow-with-confirm was rejected for safety; require-replacement was rejected for ceremony. Block is the safest default and the same pattern Ministry-tier IAM systems use. |
| `SystemUser.UserName = NationalId` (research §12) — duplicates the credential field across `AspNetUsers.UserName` and `system_users.NationalId` (~14 bytes/row) | FR-003 picks `nationalId` as the login credential. Setting Identity's `UserName` to the same value lets `SignInManager` and Identity's built-in 2FA / lockout / password-reset pipelines work without overriding `UserStore`. Smallest delta from default Identity. | Override `UserStore` to look up by custom column (more moving parts; every Identity surface needs custom resolution); build a bespoke auth handler (discards 80% of Identity's value). Both rejected for higher maintenance cost. |
| External 2FA API integration deferred (FR-031) — login is single-factor today | Stakeholder explicitly deferred 2FA to a follow-up feature ("integrate with external API for 2FA but later"). The seam (FR-003) is the integration point | Building the 2FA wiring now without the external API contract would require mocking the second factor and migrating later. Cleaner to land the seam and add the factor when the API spec is available. |

## Plan reconciliation — 2026-05-08 (post Phase-3 implementation + clarify pass)

The retrospective `/speckit.clarify` on Phase 3 (US1) added clarifications #15–#19 (see [spec.md](./spec.md#phase-3-us1-clarifications--2026-05-08-retrospective)). They are deltas, not rewrites — the rest of this plan stands.

### Deltas baked in (no further work needed)

| Clarification | Plan delta |
|---|---|
| **#15** PATCH does not accept status | `ApplicantPatchDto` (§6 contract) drops `Status`. Status changes route through a new `POST /admin/applicants/{id}/transition` endpoint that lands with the workflow engine (deferred to a follow-up feature, not in spec 002 scope). |
| **#16** Edit guard on locked applicants | Domain invariant in `Applicant.IsLocked`. Use cases throw `DomainConflictException("APPLICANT_LOCKED")` before any setter runs. Belt-and-braces — UI is a defence-in-depth layer, not the gate. |
| **#17** Backend canonical status enum | The `ApplicantStatus` enum in Domain stays the single source of truth (Pending/UnderReview/Accepted/Rejected/Withdrawn/Deferred). Frontend translation layer in `applicant.service.ts` is the only place that knows about kebab-case. |
| **#18** Demo-origin: app-layer invariant only | No DB trigger. The `DemoDataSeeder` is the sole writer; use cases never touch the field. Reconsider only if regression observed. |
| **#19** `DomainConflictException` → 422 | `GlobalExceptionMiddleware` mapping updated. Refines T022's original `→ 409`. 409 reserved for true concurrency conflicts when ETag/version checks land (currently silent last-write-wins per FR-014, so 409 is unused in practice). |

### Forward-look — Phase 4 (US2) implications

Phase 4 = admin sign-in + RBAC + user CRUD + super-admin floor. The Phase 3 clarifications quietly resolve a few Phase 4 ambiguities:

1. **Auth-policy registration** is no longer "all 9 app policies in T065" — Phase 3 already carved out `AppAccess:admin`. T065's effective scope shrinks to: register the remaining 8 (committee, board, investigations, medical, barcode, biometric, exams, applicant) + the `Role:super_admin` policy used by user-management endpoints. Note in tasks.md when Phase 4 starts.
2. **`POST /admin/users/{id}/deactivate`** uses `UnauthorizedAccessException` (→ 403) for the super-admin floor block per T056, NOT `DomainConflictException` (→ 422). The two exceptions now have semantically distinct mappings — keep the floor block as 403 + permission-denied audit, so the spec text `403 + audit-entry outcome=permission-denied + code: SUPER_ADMIN_FLOOR_BLOCKED` is the right shape.
3. **Frontend `LoginCredentials` already has `nationalId`** (Phase 2 / T032). Phase 4's `LoginUseCase` just needs to honour the FR-031 2FA seam (`RequiresSecondFactorAsync` returning `false` always for now) and emit the cookie. The frontend's `useMe()` query is already wired to call `GET /auth/me`.

### New research questions for the transition-endpoint follow-up (out of spec 002)

> **TODO**: A `/speckit.specify "applicant workflow engine"` has not yet been authored. The questions below are durable notes intended to seed that spec when it's prioritised — they are **not** prerequisites for spec 002 to ship.

Captured for the workflow-engine follow-up feature, not for spec 002:

- Allowed-status transitions per workflow stage — does the backend store the matrix in the workflow JSON config (matches frontend MOCK), or as a normalised `workflow_stage_transitions` table (queryable, but more migrations)?
- Reason-text validation rules — minimum length, profanity filter, mandatory templated reasons by transition class? (Frontend MOCK does a `.length < 3` floor; that's looser than the Ministry standard probably warrants.)
- Concurrent transition attempts — silent last-write-wins like FR-014, or 409 with the latest known status echoed back? (Probably the latter for state-machine integrity, even though FR-014 says LWW for profile fields.)

These are tracked here so the next `/speckit.specify` for the workflow engine starts informed.

## Notes

- This plan does NOT cover backend persistence for committees, board, investigations, medical, barcode, biometric, exams (per FR-021). Each is a separate spec/plan/tasks cycle and they share the same backend codebase + auth + audit substrate this plan lays down.
- This plan does NOT cover the applicant portal (Stage 1–11 wizard, SMS verification, cross-device recovery — per FR-019). It's a separate feature on this same foundation; the `applicant_stage_submissions` table is reserved in `data-model.md` so the schema doesn't migrate twice.
- Real SMS provider, persistent file storage, and Ministry directory federation are explicit follow-up features (per FR-019, FR-020, FR-003). The seams they plug into are designed in this plan.
- The Constitution v1.1.0's MUST clauses are TS-flavoured today (per its Sync Impact Report). The backend portion of this plan adopts the spirit of Principle I (strict typing, no escape hatches) and Principle II (test-first, real DB in integration tests) until the constitution codifies backend rules. A `/speckit.constitution` amendment to add backend gates is a recommended follow-up — likely a MINOR bump (1.1.0 → 1.2.0).
- Phase 1 of spec 001 (T001–T016) is still on disk after the rollback — backend skeleton, frontend infrastructure (axios, Vitest, MSW, Playwright, ESLint, Husky, Lighthouse, strings.ts) all carry forward. Spec 002's `/speckit.tasks` will reuse them; expect Phase 1 of spec 002 to be a thin delta over the existing Phase 1 work, mostly limited to confirming the substrate matches what spec 002 needs (e.g. ClosedXML wasn't on the spec 001 dep list).
