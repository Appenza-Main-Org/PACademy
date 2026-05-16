# Implementation Plan: Admission-Setup Wizard Persistence

> **⚠ Amendment 001 active (2026-05-12)** — see [`AMENDMENT-001-wizard-step-count.md`](AMENDMENT-001-wizard-step-count.md).

**Branch**: `009-admission-setup-persistence` | **Date**: 2026-05-11 (amended 2026-05-12) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-admission-setup-persistence/spec.md`

## Summary

The admission-setup wizard's 13 steps must read from and write to the database.
Today they straddle two storage strategies on this branch — in-memory mocks
for existing service layers (steps 2, 3, 4, 5, 6, 10, 12) and brand-new
in-memory shapes that don't exist on the backend at all (steps 7, 8, 9, 11,
13). Step 1 (`application_settings`) is owned by **spec 011** (Application
Settings Persistence) and is out of scope here.

See [`AMENDMENT-001-wizard-step-count.md`](AMENDMENT-001-wizard-step-count.md)
for the full transition from the original 15-step plan to the canonical
13-step set after the `origin/main` merge of 2026-05-12.

This plan closes the in-scope gaps in one sequenced delivery on a single
branch, layered to match the spec's four prioritised user stories (P1 → P4).

**Technical approach** (validated against the four clarifications resolved in
spec session 2026-05-11):

1. **Backend** extends the existing modular monolith (per spec 005) with two
   new modules and one set of extensions:
   - **`Modules/Committees/`** (new) — owns the `Committee` aggregate.
     Committees are cross-cutting (consumed by Board, Investigations,
     Biometric, Barcode in addition to the wizard), so they get their own
     bounded context, DbContext, and `*.Public` contract surface.
   - **`Modules/Notifications/`** (new) — owns `NotificationTemplate`
     and the per-applicant `NotificationDelivery` log. Also cross-cutting.
   - **`Modules/Admissions/` extensions** — five new entities for the
     wizard-owned shapes (`CommitteeMergeSplitRule`,
     `CommitteeScoreThreshold`, `ExamDateConfig`, `TotalScoreConfig`,
     `ElectronicDeclaration`), plus a `WizardStepStatus` table to track
     the admin-marked completion state per (cycle, step). The Admissions
     module already owns Cycle / Category / AdmissionRule, so the new
     wizard entities live with their natural parents. Exam plans become a
     `CycleExam` relationship inside Admissions (each exam is tied to a
     cycle's plan), not a separate module.
2. **Optimistic locking** is implemented via SQL Server's `rowversion`
   column on every persisted wizard entity (new and existing). EF Core
   maps `rowversion` to a `byte[] RowVersion` property with the
   `IsConcurrencyToken()` configuration. Stale-version saves raise
   `DbUpdateConcurrencyException`, which middleware translates to a 409
   response carrying the Arabic conflict message from FR-012.
3. **Wizard step status** is tracked in a single new table
   `wizard_step_statuses (cycle_id, step_key, status, completed_at,
   completed_by, row_version)` — one row per (cycle, step). Status is
   admin-marked (FR-014); a `POST /admin/admission-setup/cycles/{id}/steps/{stepKey}/complete`
   endpoint flips it to `complete`, and a corresponding endpoint reopens
   it. The `in_progress` transition is automatic — triggered by the
   first save of any field on a step (a middleware hook ensures status
   is bumped without explicit admin action).
4. **Merge/split lifecycle** (FR-018a/018b) follows the spec's manual
   "Apply" semantics. The entity carries a `status` enum (`planned` /
   `applied` / `cancelled`). The "Apply" action runs inside a
   `CrossModuleUnitOfWork` (per spec 005) so the applicant re-allocation
   across committees is atomic with the rule's status flip. An
   impact-preview endpoint (`POST .../preview`) returns the change set
   without committing.
5. **Cross-cycle copy** (FR-021/FR-022) is one endpoint —
   `POST /admin/cycles/{targetId}/copy-from/{sourceId}` — that opens a
   `CrossModuleUnitOfWork`, clones every wizard table's rows for the
   source cycle into the target, remaps cross-entity ids by name/key
   match, and emits a single summary audit entry. Failures rollback
   the entire transaction (FR-022).
6. **Frontend** swaps four mock-only services to real `apiClient`
   calls and finishes the partial wiring on cycles + categories. No new
   React pages — the wizard's screens are already built; this is a
   service-layer migration plus two new drawers (one for the merge/split
   Apply preview, one for the cross-cycle copy). The existing
   `wizard-draft.ts` localStorage helper stays, but its reconciliation
   logic (FR-013) is updated to prefer server state on conflict and
   surface the diff to the admin.

## Technical Context

**Language/Version (backend)**: C# 13 / .NET 10, EF Core 10. Modular
monolith per spec 005 (see CLAUDE.md §15).
**Language/Version (frontend)**: TypeScript 5.6 strict mode (no `any`,
no `!`, `@ts-expect-error` with reason only). React 18.

**Primary Dependencies (backend)**:
- **EF Core 10** — already in use; one new migration per affected
  context (Admissions, Committees, Notifications).
- **Polly** — already in use for transient retry; no new policies.
- **Microsoft.AspNetCore.Authorization** — existing `[Authorize(Policy = "*")]`
  pattern for super-admin gating; new policies added for
  `admission-setup:write`, `admission-setup:apply`,
  `admission-setup:clone`.
- No new external NuGet packages.

**Primary Dependencies (frontend)**:
- **@tanstack/react-query 5** — existing; no changes.
- **axios** (via `@/shared/api`) — existing; no changes.
- **zod** — existing; the existing wizard schemas may need extension
  but no new libraries.
- No new client-side npm packages.

**Storage**: SQL Server (existing, shared across modular monolith).
**New tables**:
- Admissions: 5 wizard entities + `wizard_step_statuses` + a `cycle_exams`
  table (replaces the frontend MOCK exam plan) + extensions on `cycles`
  / `categories` for partial-wire completion.
- Committees: `committees`, `committee_members`,
  `committee_date_bindings` (the per-date capacity binding from step 12),
  `committee_specializations` (the existing scope mapping).
- Notifications: `notification_templates`, optionally
  `notification_deliveries` (only if needed for trigger evaluation —
  may defer to a later spec).

**Testing**:
- **Backend**: xUnit + Testcontainers SQL Server (existing pattern from
  spec 005). NetArchTest gates for the two new modules. New integration
  tests for the merge/split apply transaction, the cross-cycle copy,
  and the optimistic-locking 409 path.
- **Frontend**: Vitest + @testing-library/react + jest-axe (existing).
  Component tests for the wizard pages whose service layer flips from
  MOCK to real. MSW for HTTP mocks.
- **E2E**: Playwright for one happy-path scenario per priority
  (configure → save → reload → see saved state) on one representative
  step per priority band.

**Target Platform**: Modern evergreen browsers (Chrome / Edge / Firefox /
Safari current releases). RTL Arabic-first. Backend runs as the existing
.NET host.

**Project Type**: Web application — frontend + backend. Both touched.

**Performance Goals**:
- Page load for any wizard step ≤ **2 s** on a mid-tier laptop with 100 ms
  simulated network latency (SC-007).
- Re-opened wizard step displays persisted data within **500 ms** of mount
  (SC-008).
- Cross-cycle copy completes in **≤ 5 s** for a fully-populated source
  cycle (SC-011) — bounded mostly by the row count, not network round
  trips, since the whole copy is server-side.
- Apply action on a merge/split rule completes the transactional move
  of up to **5 000 applicants** in **≤ 10 s**.

**Constraints**:
- No data is silently overwritten — optimistic locking enforced
  server-side (FR-012).
- Closed/archived cycle: reads succeed, writes return 403 with Arabic
  message (FR-006).
- Cross-module transactions go through `CrossModuleUnitOfWork`;
  `TransactionScope` / DTC remains forbidden per spec 005.
- Per-module DbContext boundary is honoured — Committees has its own
  history table (`__EFMigrationsHistory_Committees`) per the FR-X01
  pattern from spec 005.
- **Retention (FR-015)**: Closed-cycle wizard data stays online for
  7 years from cycle close, then moves to a cold-archive store (read-only,
  restorable). Hard-delete is forbidden. The archival pipeline itself is
  out of spec-009 scope — only the contract is specified here so a
  future archival spec has a hard target.

**Scale/Scope**:
- 13 wizard steps (per Amendment 001 — step 1 `application_settings` is
  owned by spec 011), 5 new entities, 2 new modules, ~35 new endpoints
  (List / Get / Create / Update / Archive / Restore × 5 wizard entities,
  plus committees / notifications / wizard-status / clone / apply).
- ~5 000 applicants per cycle (current dev seed); merge/split rule apply
  must scale to this volume in one transaction.
- Single concurrent admin per step expected; concurrent saves are
  tolerated via rowversion conflicts (FR-012 / spec edge case).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify the plan against `.specify/memory/constitution.md` v1.1.0.

- **I. Code Quality & Maintainability** — Backend follows the existing
  modular-monolith conventions (single-responsibility use cases per
  endpoint, named handlers, no `dynamic`). Frontend stays in TypeScript
  strict mode; no `any`, no `!`, JSDoc on every exported function. New
  service files mirror the existing service-layer JSDoc `INTEGRATION
  CONTRACT` pattern. Component size ≤ 200 lines; wizard pages are
  already built and stay within budget — this feature is a service swap.
  No new client dependencies; no new server NuGet packages. Named
  exports only on the frontend; backend follows existing C# conventions.
  **PASS**.
- **II. Testing Standards (NON-NEGOTIABLE)** — Test-first:
  - Backend: integration tests for every new endpoint (List / Get /
    Create / Update / Archive / Restore × 5 wizard entities), the apply
    action's transactional move, the cross-cycle copy's atomic clone,
    the optimistic-locking 409, the permission-deny path.
  - Frontend: unit tests for the swapped services; component tests for
    the wizard pages whose mode flips (especially the Apply preview /
    Apply confirm flow on step 9 and the clone-confirmation drawer);
    jest-axe on every new component.
  - One Playwright E2E per priority band (P1, P2, P3, P4).
  - Coverage budgets met by construction: every branch in the wizard
    status state machine, every conflict response, every clone path is
    exhaustively tested.
  - No `.skip` / `.only`. MSW-only on frontend; Testcontainers SQL
    Server on backend. Pre-commit hook + CI run.
  **PASS**.
- **III. UX Consistency** — Wizard pages already consume `var(--accent-*)`
  via the AdmissionSetupShell's `data-app="admin"` scope. Logical
  properties throughout. New affordances added by this feature — the
  Apply preview drawer, the clone-from-cycle wizard, the conflict-409
  toast — reuse existing shared components (`Drawer`, `AlertDialog`,
  `Toast`, `DataTable`). No new design tokens. All four async states
  designed: idle (form ready), loading (skeleton), empty (first save
  on a draft cycle), error (409 conflict, validation rejection,
  network failure). Reduced-motion respected. Responsive at the
  existing breakpoints. **PASS**.
- **IV. Performance Requirements** — No new client bundle weight (the
  feature is a service-layer migration; existing UI shells stay).
  Wizard step skeletons already in place sized to prevent CLS. Server
  endpoints stay under the 200 ms p95 target via indexed queries on
  `(cycle_id, step_key)` and per-cycle row scopes. The cross-cycle
  copy and merge/split apply transactions are background-friendly: the
  UI shows a progress indicator and disables save during the apply.
  TanStack Query cache invalidation on save keeps re-renders bounded.
  **PASS**.
- **V. Spec-Driven Discipline** — `spec.md` was reviewed end-to-end after
  this plan was drafted; no tech terms leaked back. Traceability spec
  → plan → tasks (next step) → PR → tests will be preserved; the PR
  description will link `specs/009-admission-setup-persistence/spec.md`.
  The Clarifications session is preserved in `spec.md`. **PASS**.

Violations: none.

### Post-design re-check (after Phase 1)

All five principles re-checked against the structures in `data-model.md`,
`contracts/admission-setup-api.md`, and `quickstart.md`:

- **I. Code Quality**: 2 new modules + ~35 new endpoints. Each use case
  is a sealed class with one `ExecuteAsync` method (≤ 80 lines each by
  construction). Frontend service files are ≤ 250 lines each (one per
  resource). **Confirmed PASS.**
- **II. Testing**: data-model identifies the test surface; contracts list
  the exact endpoints to integration-test. Coverage budgets are met by
  construction. **Confirmed PASS.**
- **III. UX**: Quickstart walks through the wizard from a draft cycle to
  a fully-configured one. All affordances reuse the shared library;
  no new design tokens proposed. **Confirmed PASS.**
- **IV. Performance**: No frontend bundle growth. Server side: indexed
  queries, capped pagination, transactional Apply scoped to one cycle
  at a time. **Confirmed PASS.**
- **V. Spec discipline**: `spec.md` was re-checked end-to-end after this
  plan was drafted — no tech terms leaked back. **Confirmed PASS.**

No violations surfaced during design; **Complexity Tracking** below is
empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-admission-setup-persistence/
├── plan.md                          # This file
├── research.md                      # Phase 0 — module strategy, locking, copy approach
├── data-model.md                    # Phase 1 — entity shapes + relationships
├── quickstart.md                    # Phase 1 — operator's guide (migrations, seed)
├── contracts/
│   └── admission-setup-api.md       # Internal REST contract for new endpoints
└── tasks.md                         # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── Modules/
│   │   ├── Admissions/                                       # EXISTING — extended
│   │   │   ├── PACademy.Modules.Admissions.Domain/
│   │   │   │   ├── CommitteeMergeSplitRule.cs                # NEW
│   │   │   │   ├── CommitteeScoreThreshold.cs                # NEW
│   │   │   │   ├── ExamDateConfig.cs                         # NEW
│   │   │   │   ├── TotalScoreConfig.cs                       # NEW
│   │   │   │   ├── ElectronicDeclaration.cs                  # NEW
│   │   │   │   ├── WizardStepStatus.cs                       # NEW
│   │   │   │   ├── CycleExam.cs                              # NEW (replaces frontend MOCK)
│   │   │   │   └── ...
│   │   │   ├── PACademy.Modules.Admissions.Application/
│   │   │   │   ├── WizardEntities/                           # NEW folder (5 entities × 6 use cases)
│   │   │   │   ├── WizardStatus/                             # NEW folder (Complete / Reopen / Get)
│   │   │   │   ├── MergeSplit/                               # NEW folder (Preview / Apply / Cancel)
│   │   │   │   ├── CrossCycleCopy/                           # NEW folder (CloneFromCycle use case)
│   │   │   │   └── ...
│   │   │   └── PACademy.Modules.Admissions.Infrastructure/
│   │   │       ├── Migrations/009_AdmissionSetupEntities/    # NEW migration
│   │   │       └── ...
│   │   ├── Committees/                                       # NEW MODULE
│   │   │   ├── PACademy.Modules.Committees.Domain/
│   │   │   │   ├── Committee.cs
│   │   │   │   ├── CommitteeMember.cs
│   │   │   │   ├── CommitteeDateBinding.cs                   # step 12
│   │   │   │   └── CommitteeStatus.cs
│   │   │   ├── PACademy.Modules.Committees.Application/
│   │   │   │   ├── List / Get / Create / Update / Archive / Restore (use cases)
│   │   │   │   ├── Members/                                  # add/remove/swap chair
│   │   │   │   ├── DateBindings/                             # step 12 endpoints
│   │   │   │   └── ...
│   │   │   ├── PACademy.Modules.Committees.Infrastructure/
│   │   │   │   ├── CommitteesDbContext.cs
│   │   │   │   ├── Migrations/009_CommitteesInitial/
│   │   │   │   └── CommitteesModule.cs
│   │   │   └── PACademy.Modules.Committees.Public/
│   │   │       └── ICommitteeApi.cs                          # for other modules
│   │   ├── Notifications/                                    # NEW MODULE
│   │   │   ├── PACademy.Modules.Notifications.Domain/
│   │   │   │   ├── NotificationTemplate.cs
│   │   │   │   └── NotificationTriggerEvent.cs               # enum
│   │   │   ├── PACademy.Modules.Notifications.Application/
│   │   │   │   ├── Templates/                                # CRUD + publish
│   │   │   │   └── ...
│   │   │   ├── PACademy.Modules.Notifications.Infrastructure/
│   │   │   │   ├── NotificationsDbContext.cs
│   │   │   │   ├── Migrations/009_NotificationsInitial/
│   │   │   │   └── NotificationsModule.cs
│   │   │   └── PACademy.Modules.Notifications.Public/
│   │   ├── Identity/                                         # EXISTING — unchanged
│   │   ├── ReferenceData/                                    # EXISTING — unchanged
│   │   └── Workflows/                                        # EXISTING — unchanged
│   ├── PACademy.Api/
│   │   └── Controllers/Admin/
│   │       ├── AdmissionSetup/                               # NEW folder
│   │       │   ├── AdminMergeSplitRulesController.cs         # step 9
│   │       │   ├── AdminCommitteeScoreThresholdsController.cs # step 10
│   │       │   ├── AdminExamDateConfigController.cs          # step 11
│   │       │   ├── AdminTotalScoreConfigController.cs        # step 13
│   │       │   ├── AdminElectronicDeclarationController.cs   # step 15
│   │       │   ├── AdminWizardStatusController.cs            # step status
│   │       │   └── AdminCrossCycleCopyController.cs          # P4
│   │       ├── AdminCommitteesController.cs                  # NEW (replaces mock)
│   │       ├── AdminNotificationTemplatesController.cs       # NEW (replaces mock)
│   │       └── AdminCycleExamsController.cs                  # NEW (step 7 exam plan)
│   └── Shared/                                               # EXISTING — unchanged
│       └── Contracts/PACademy.Shared.Contracts/
│           └── Concurrency/RowVersionConflictResult.cs       # NEW shared 409 shape
└── tests/
    ├── PACademy.Api.Tests/                                   # Integration tests grow
    ├── PACademy.Architecture.Tests/                          # NetArchTest grows
    └── PACademy.Application.Tests/                           # Use-case unit tests grow

frontend/
└── src/
    └── features/
        └── admin/
            ├── admission-setup/
            │   ├── api/
            │   │   ├── admission-setup.service.ts            # MUTATED: MOCK to real apiClient
            │   │   ├── admission-setup.queries.ts            # MUTATED: cache keys + invalidation
            │   │   └── cross-cycle-copy.queries.ts           # NEW
            │   ├── components/
            │   │   ├── MergeSplitApplyDrawer.tsx             # NEW (impact preview + confirm)
            │   │   └── CopyFromCycleDrawer.tsx               # NEW (P4)
            │   └── pages/...                                 # UNCHANGED (no UI rewrite)
            ├── api/
            │   ├── cycles.service.ts                         # MUTATED: finish partial wiring
            │   ├── categories.service.ts                     # MUTATED: finish partial wiring
            │   ├── examPlans.service.ts                      # MUTATED: MOCK to real apiClient
            │   └── notifications.service.ts                  # MUTATED: MOCK to real apiClient
            └── ...
        └── committees/
            └── api/
                ├── committee.service.ts                      # MUTATED: MOCK to real apiClient
                └── committee.queries.ts                      # MUTATED: cache keys + invalidation
```

**Structure Decision**: Web application (frontend + backend) layout from the
repo root. Backend grows by two new modules (Committees, Notifications) plus
extensions to the existing Admissions module — no new monolith hosts, no
external services. Frontend gains zero new wizard pages (the wizard is
already built); the change is a service-layer migration plus two new drawers
for the Apply preview and the Cross-cycle copy flow. The wizard's
`:stepKey` route table and the `WizardModeContext` are unchanged.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|

(No violations — plan stays within constitution v1.1.0.)
