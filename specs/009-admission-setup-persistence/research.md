# Phase 0 — Research: Admission-Setup Wizard Persistence

**Branch**: `009-admission-setup-persistence` | **Date**: 2026-05-11

This document captures the three architecturally-significant decisions made
during plan drafting, the alternatives considered, and the evidence behind
each choice.

---

## 1. Backend module strategy

**Decision**: Add two new modules (`Committees`, `Notifications`) and extend
the existing `Admissions` module with five wizard-owned entities plus a
`WizardStepStatus` table.

### Alternatives considered

**A. Single new "AdmissionSetup" module owning everything.**
Pros: one new module, one DbContext, simpler dependency graph.
Cons: committees are consumed by 5 apps (Board, Investigations, Biometric,
Barcode, Admin) — pulling them into an admission-setup-scoped module would
invert the Clean Arch direction (those apps would have to depend on
AdmissionSetup to access Committee). Same problem for notification
templates. **Rejected.**

**B. One module per wizard-owned entity (5 new modules).**
Pros: maximum bounded-context isolation.
Cons: thrashes the dependency graph for entities that are clearly
co-located (merge/split rules and score thresholds are both
committee-scoped wizard configuration; total-score and exam-date are
both cycle-wide scoring configuration). The five entities are all
strongly cycle-coupled and have natural homes in Admissions. **Rejected.**

**C. Keep everything in the existing modules; no new modules at all.**
Pros: zero new module wiring.
Cons: Committees and Notifications have no current home and don't fit
inside Admissions (they're not cycle-scoped) or Identity (they're not
auth-scoped) or ReferenceData (they're not lookups) or Workflows (those
are stage transitions). **Rejected.**

### Why the chosen approach

- Two new modules carry their natural bounded contexts (Committees is a
  cross-cutting concern; Notifications is a cross-cutting concern).
- Five new entities + WizardStepStatus stay inside Admissions because
  they are intrinsically cycle-scoped and reference Cycle / Category /
  Committee (the last via the Committees module's `*.Public` API).
- The architecture remains compatible with spec 005's FR-M02 (modules
  may only reference `Shared.Contracts` + sibling `*.Public` projects).

### Evidence

- `frontend/src/features/committees/api/committee.service.ts` is
  imported by board, investigations, biometric, barcode, and admin
  features today (grep confirms 5 consumers).
- `Notification` type is used by `notifications.service.ts` (mock-only)
  but `useNotifications()` is called from at least the admin
  `NotificationsPage` and the applicant wizard's status panel — also
  cross-cutting.
- The existing Admissions DbContext already migrates Cycle + Category
  + AdmissionRule + Applicant + ApplicantStageSubmission together;
  adding six more cycle-scoped tables to the same context fits the
  pattern.

---

## 2. Concurrency strategy

**Decision**: Optimistic locking via SQL Server `rowversion` columns on
every persisted wizard entity, enforced by EF Core's
`IsConcurrencyToken()` configuration and surfaced as a 409 response.

### Alternatives considered

**A. Last-write-wins with a visible toast.**
Pros: simplest implementation — just don't check anything; emit a
notification when the server detects a conflicting write *after the
fact*.
Cons: data is lost. Admins miss toasts. Two admins editing the same
total-score config would clobber each other and the older admin's edit
disappears. **Rejected — directly contradicts FR-012 "no data is
silently overwritten".**

**B. Pessimistic locking (admin acquires an editing lease).**
Pros: strong guarantee that two admins can't be in edit mode on the
same row simultaneously.
Cons: operational complexity — stale leases, force-release UI, lease
renewal, admin who closed their tab without releasing. For a tool used
by ~5 super-admins concurrently at most, this is overkill. **Rejected
per the clarification answer.**

**C. Application-level version stamps (manual version column).**
Pros: explicit, easy to reason about.
Cons: must remember to increment on every write; easy to drift. SQL
Server's `rowversion` does this automatically. **Rejected — reinvents
what the database does for free.**

### Why the chosen approach

- The clarification answer explicitly picked optimistic locking with
  rowVersion / ETag.
- EF Core's first-class support means each entity adds one `byte[]
  RowVersion { get; set; }` property and one fluent configuration line.
- Translation to a 409 response is a single middleware that catches
  `DbUpdateConcurrencyException` and emits the standard
  `RowVersionConflictResult` shape (defined in `Shared.Contracts`).

### Evidence

- EF Core docs: `IsRowVersion()` is the recommended pattern for SQL
  Server optimistic concurrency.
- spec 005's `CrossModuleUnitOfWork` already coordinates `SqlTransaction`
  across contexts — the same transaction will participate in the
  rowversion check natively because each `SaveChanges` runs the
  concurrency token comparison inline.

### Open question (resolved)

- Should `rowversion` exist on every wizard table or only the
  wizard-owned ones? → Decision: every wizard-touched persistent entity
  (Cycle, Category, AdmissionRule, Committee, NotificationTemplate, and
  the 5 new ones). The existing Cycle / Category / AdmissionRule
  migrations don't have `rowversion` yet; spec 009's migration adds
  them retroactively.

---

## 3. Cross-cycle copy strategy

**Decision**: Single server-side endpoint that runs the entire clone
inside one `CrossModuleUnitOfWork`. Identity-bound fields (cycle
name/year/dates) are reset on the target; cross-entity references are
remapped by key/name match against the target cycle's catalogue; broken
references are flagged for admin resolution rather than blocking the
clone.

### Alternatives considered

**A. Client-side orchestration: frontend reads source data, then
issues N POST requests against the target cycle.**
Pros: no new server endpoint; reuses existing CRUD endpoints.
Cons: not atomic — a network drop mid-clone leaves the target cycle
partially populated. Slow — N round trips. Hard to handle reference
remapping client-side because the client can't see the target cycle's
private id space efficiently. **Rejected.**

**B. Database-level INSERT...SELECT clone.**
Pros: fast.
Cons: bypasses EF Core's audit hooks and concurrency tokens; no
remapping logic; very fragile to schema changes. **Rejected.**

**C. Background-job clone with progress polling.**
Pros: doesn't tie up the API request.
Cons: adds operational complexity (job queue, monitoring, retry). The
clone is bounded (≤ 5 s for typical cycle volumes per SC-011), so a
synchronous endpoint is fine. **Rejected as premature.**

### Why the chosen approach

- Atomicity (FR-022) is satisfied by `CrossModuleUnitOfWork`'s single
  transaction.
- Reference remapping is centralized: a `CycleCloneRemapper` service
  reads the source cycle's references and looks them up in the target
  cycle by stable keys (committee key, exam type key, lookup key,
  category key). Anything not found is logged on a
  `CloneBrokenReference` projection returned to the client.
- One endpoint, one summary audit entry, one response shape — easier to
  test than N CRUD calls.

### Evidence

- spec 005 already proves `CrossModuleUnitOfWork` works across the 5
  DbContexts.
- The 5 wizard entities + Cycle + Category + AdmissionRule + Committee
  + Notification are all cycle-scoped or key-stable — the remap by
  key/name is well-defined for every table.

### Implementation outline

```text
POST /admin/cycles/{targetId}/copy-from/{sourceId}
  Body: { confirmReplace?: boolean }     // required if target non-empty

  1. Open CrossModuleUnitOfWork
  2. Validate source exists, is not in error state
  3. Validate target exists and is in 'draft' status (FR-022)
  4. If target non-empty and confirmReplace !== true → 409 with hint
  5. For each wizard table in [Categories, AdmissionRules, CycleExams,
       Committees-by-key, CommitteeDateBindings, CommitteeMergeSplitRules,
       CommitteeScoreThresholds, ExamDateConfig, TotalScoreConfig,
       ElectronicDeclaration, NotificationTemplates, WizardStepStatus]:
       - Read source rows
       - Remap cycleId → targetId
       - Remap cross-entity ids via key match (or flag broken)
       - Reset identity-bound fields (cycle name/year/dates if Cycle itself
         is touched — it isn't here; target Cycle pre-exists)
       - Insert into target
  6. Emit one summary audit entry (action: cycle_cloned)
  7. Commit transaction
  8. Return CloneSummary { copied: int, brokenReferences: [...] }
```

---

## 4. Apply action for merge/split rules

**Decision**: Synchronous endpoint that runs the applicant re-allocation
inside one `CrossModuleUnitOfWork`. Preview endpoint runs the same logic
without committing.

### Alternatives considered

**A. Asynchronous Apply via background job.**
Pros: doesn't block the request for large applicant volumes.
Cons: applicant move-counts are bounded (≤ 5 000 per cycle per
performance target); 10 s is acceptable for a synchronous request the
admin explicitly initiated. **Rejected as premature.**

**B. Apply-on-effectiveAt cron job.**
Pros: hands-off.
Cons: directly rejected by the clarification — admins want manual
control. **Rejected.**

### Why the chosen approach

- Manual Apply matches the clarification answer.
- One transaction for the rule flip + the applicant moves is the only
  way to guarantee SC-010 (atomic, idempotent rule application).
- Preview endpoint shares 90% of the code path with Apply (same
  remapping logic, just `Commit` vs. `Rollback`).

### Implementation outline

```text
POST /admin/admission-setup/merge-split-rules/{id}/preview
  Returns: { applicantsMoved: [...], capacityChanges: [...],
             brokenReferences: [...] }

POST /admin/admission-setup/merge-split-rules/{id}/apply
  Body: { confirmPreviewHash: string }   // prevents stale-preview apply
  Returns: { applied: true, applicantsMoved: int, durationMs: int }
  Side-effects: rule.status flips to 'applied', applicants reassigned,
                CommitteeMemberships updated, audit entry emitted
```

The `confirmPreviewHash` is a deterministic hash of the preview's
content; if the underlying state changed between Preview and Apply, the
hash differs and the Apply returns 409 — protects against
"another admin reassigned an applicant while you were looking at the
preview".

---

## 5. Step-status auto-promotion to `in_progress`

**Decision**: Middleware hook on the Admissions DbContext's
`SaveChanges` that detects any save touching a wizard-scoped table for
a `(cycle_id, step_key)` whose status is `not_started`, and inserts /
updates a `wizard_step_statuses` row to `in_progress` in the same
transaction.

### Why

- FR-014 says the `not_started → in_progress` transition is
  automatic. Implementing it as a middleware on the save itself
  guarantees no save can land without bumping the status — eliminates
  drift between data state and pill state.
- The `in_progress → complete` transition is admin-driven via an
  explicit endpoint, so the same hook doesn't get involved there.

### Open question

- Should the hook also handle the `complete → in_progress` demotion
  when an admin edits a completed step? **Yes** — symmetrical with the
  promotion path. The hook detects "save into a step whose status is
  `complete`" and bumps it back to `in_progress` in the same
  transaction. The admin re-clicks "إكمال الخطوة" after re-saving to
  re-complete it. Audit entry on the demotion uses action
  `wizard_step_reopened`.

---

## Resolved post-plan clarifications

### Session 2026-05-16

- **FR-015 — Retention/purge for closed-cycle wizard data.**
  - **Decision**: 7-year online retention from cycle close, then move to a
    cold-archive store (read-only, restorable on request). **No hard-delete**.
  - **Rationale**: Aligns with Egyptian government audit retention practice
    (لائحة المحفوظات). Bounds hot-DB growth so query latency on active cycles
    stays predictable, while preserving full compliance-grade access for the
    admission file's legal life.
  - **Alternatives considered**:
    - *Live DB forever, no archive*: simplest, but hot-DB grows unbounded —
      after 5+ admission seasons the cycles/categories joins start showing
      up in slow-query logs.
    - *10-year online retention*: bigger hot-DB footprint than the chosen 7,
      no compliance argument that requires the extra 3 years online.
    - *Nightly cold snapshot from day 1*: best DR posture, but most operational
      complexity; not justified for an internal admin tool with already
      append-only audit on every mutation.
  - **Implementation note**: The archival job itself is **out of scope for
    spec 009** — only the retention contract is specified here. Designing
    the archival pipeline (job scheduling, cold-store choice, restore API)
    is a future spec. Spec 009's contribution is FR-015's contract so the
    archival design has a hard target to hit.

---

## P3 gap inventory (T103)

Audit run 2026-05-16, against branch `009-admission-setup-persistence` at
commit `16537ab`. Inputs:

- `CycleEndpointsCoverageTests` (T099) — `backend/tests/PACademy.Api.Tests/Audit/CycleEndpointsCoverageTests.cs`
- `CategoryEndpointsCoverageTests` (T100) — `backend/tests/PACademy.Api.Tests/Audit/CategoryEndpointsCoverageTests.cs`
- Manual sweep of `frontend/src/features/admin/api/*.service.ts` for `simulateLatency` / `MOCK.` references.

Both coverage tests **PASS** — every property exposed on `CycleDetailDto`,
`CycleListItemDto`, `CategoryDetailDto`, `CategoryListItemDto` either has a
matching property name in `CreateCycleRequest` / `UpdateCycleRequest` /
`TransitionCycleStatusRequest` / `CreateCategoryRequest` / `UpdateCategoryRequest`
or is on the read-only allow-list (`Id`, `CreatedAt`, `UpdatedAt`,
`ArchivedAt`, `ApplicantCount`, `IsSpec`, `DemoOrigin`).

The audit did surface five real gaps that the DTO-coverage test cannot see
because they sit on the *entity side* or in the *frontend service layer*:

### Gap P3-1 — `RowVersion` missing from Cycle + Category read DTOs (CRITICAL)

- **What**: `Cycle` and `Category` entities carry a `RowVersion` concurrency
  token (added in migration `009_AdmissionSetupEntities` per Phase-2 T008),
  but neither `CycleDetailDto` / `CycleListItemDto` nor `CategoryDetailDto` /
  `CategoryListItemDto` expose it on the wire.
- **Impact**: The frontend cannot send `If-Match` / `rowVersion` on PATCH,
  so the optimistic-locking middleware that returns 409 `RowVersionConflictResult`
  (T004) has nothing to compare against. Two admins editing the same cycle
  or category will silently last-write-wins.
- **Fix shape**: Extend the four DTOs with `string RowVersion` (hex-encoded
  like `ElectronicDeclarationDto.RowVersion`). Extend `UpdateCycleRequest`
  and `UpdateCategoryRequest` to accept `RowVersion`. Wire the controller
  through to `Database.UseTransaction` / `OriginalValues.SetValues` so the
  EF concurrency token check fires.
- **Frontend follow-up**: Add `rowVersion` to `AdmissionCycle` and
  `ApplicantCategory` types in `frontend/src/shared/types/domain.ts`. Each
  PATCH mutation in `cycles.service.ts` / `categories.service.ts` sends
  the stored `rowVersion` back.

### Gap P3-2 — 10 admin services still on `simulateLatency` / `MOCK.*` (BREADTH)

Grep across `frontend/src/features/admin/api/` shows **158 occurrences** of
`simulateLatency` or `MOCK.` reads/writes across 10 files:

| Service | Occurrences | Notes |
|---|---|---|
| `cycles.service.ts` | 25 | `updateStatus` partly wired (GUID branch added in `16537ab`); list/get/create/patch still mock-driven for the legacy seeded ids |
| `notifications.service.ts` | 15 | Step 14 — full mock |
| `examPlans.service.ts` | 13 | Step 7 — full mock |
| `categories.service.ts` | 14 | Steps 1–6 share this |
| `workflows.service.ts` | 18 | Outside the wizard but still admin-managed |
| `roles.service.ts` | 10 | Cloud RBAC matrix consumer |
| `users.service.ts` | 14 | Admin users page |
| `payments.service.ts` | 8 | Reports cross-link |
| `nid-lookup.service.ts` | 2 | Officer lookup proxy |
| `reports.service.ts` | 39 | Largest mock surface — Reports command-center |

P3 scope is steps 1–6, so the in-scope migration set is **cycles + categories**.
Notifications + exam-plans are P2 work (T071–T074). The remaining services
(workflows, roles, users, payments, nid-lookup, reports) are outside spec
009 — they migrate under their own specs once backend endpoints land.

### Gap P3-3 — `FawryConfigCard` still imports but the fees step dropped it — ✅ CLOSED 2026-05-17

- **What**: CLAUDE.md §11 records "Dropped the optional fee inputs and the
  `FawryConfigCard` — only the application-fee input remains" but the
  component still lived at `frontend/src/features/admin/components/cycles/FawryConfigCard.tsx`.
- **Resolution**: Grep confirmed zero importers (the file referenced only
  itself; not re-exported from any barrel). Deleted the file. Two further
  fawry leftovers — `step-status.ts` `case 'fees'` requiring
  `fawryConfig.merchantCode` for completion, and `cycles.service.ts`
  `collectActivationIssues` emitting `"إعدادات بوابة فوري غير مكتملة"` —
  were also trimmed, since the wizard no longer authors `fawryConfig`
  anywhere and the gates therefore permanently blocked any non-seeded cycle
  with no way for an admin to satisfy them.
- **Preserved**: The `FawryConfig` type, the seeded `fawryConfig` value on
  the demo cycle, and the read-only consumer `Stage6PaymentPage.tsx` that
  reads `fees.fawryConfig?.retryWindowHours` with a `48` fallback. Backend
  integration can re-introduce an authoring surface (or move it to a
  payment-gateway settings page) without churning the data model.

### Gap P3-4 — `CategoryConditionBuilder` writes go through `ConditionsJson` (OK in principle)

- **What**: T107 calls out `CategoryConditionBuilder` rule-type writes
  (age / marital / score / education). The component lives at
  `frontend/src/features/admin/components/categories/CategoryConditionBuilder.tsx`
  and is a pure controlled form — the parent (CategoryEditPage) owns the
  draft and decides when to save.
- **Status**: The conditions are persisted on `Category.ConditionsJson`
  via `UpdateCategoryRequest.Conditions` (typed as `JsonElement?`). That
  path *is* wired through the backend audit and is in `UpdateCategoryRequest`,
  so the field passes the T100 coverage test.
- **Outstanding verification**: The frontend's `categories.service.ts` is
  still on mocks (Gap P3-2), so the live round-trip can't be exercised yet.
  Once P3-2 lands for `categories.service.ts.updateCategory`, exercise an
  edit of each rule type and confirm the JSON shape persists unchanged.

### Gap P3-5 — `IsActive` on `Category` is set by Update only, not Create

- **What**: `CreateCategoryRequest` has no `IsActive` field, so newly-created
  categories take whatever default the domain factory picks (currently
  `true` in `Category.Create`).
- **Impact**: Minor — admin can immediately PATCH to deactivate. But if the
  UX surfaces an "add as inactive" toggle on the create form, it can't be
  honored at create time.
- **Recommendation**: Defer. Not worth a contract change unless the
  create-as-inactive UX is actually wanted. Track on TODO.md if it surfaces.

### Recommended execution order for the remaining P3 work

1. **P3-1 (RowVersion exposure)** — small, well-scoped, unlocks optimistic
   locking on the two highest-traffic edit surfaces. ~1 file per layer.
2. **P3-3 (FawryConfigCard cleanup)** — 10 min: grep + delete or wire.
3. **P3-2 (cycles + categories mock-to-real)** — bigger; finishes the
   service-layer migration for steps 1–6.
4. **P3-4 verification** — only after P3-2 lands.
