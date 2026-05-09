# Phase 0 — Research: Admin Lookups CRUD

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `004-lookups-crud` | **Date**: 2026-05-09

> Phase 0 captures the design questions that had a non-obvious answer and the decision the team landed on. Anything that was a straight replication of spec 003's pattern (auth, audit, pagination, validation, soft-delete) is not re-litigated here — see [plan.md §Technical Context](./plan.md#technical-context).

---

## R0.1 — How is admission-rule immutability enforced?

**Question**: Should `AdmissionRule` immutability (FR-R01, SC-R01) be enforced in EF Core, by a SQL trigger, or both?

**Decision**: **Application-layer only**. The use case throws `InvalidOperationException` on PATCH/DELETE attempts against an existing version; the controller maps that to `405 Method Not Allowed` with `code: ADMISSION_RULES_IMMUTABLE`. Versioning is enforced via the unique index `(CycleId, Version)`; bumping `Version = max + 1` happens inside `IsolationLevel.Serializable` to prevent concurrent v2 publishes from colliding.

**Rationale**:
- Every write path goes through EF Core; there is no second writer.
- A SQL trigger would be a one-off — spec 002 already established that audit immutability is the only trigger we ship; we do not want trigger sprawl.
- Spec 004's `T259` property test (`FsCheck.Xunit`, `seed=42`, 1000 randomized PATCH/DELETE attempts) verifies the invariant from outside the use case, satisfying SC-R01.

**Alternatives considered**:
- **SQL trigger** that rejects UPDATE on existing rows. Rejected: trigger sprawl, harder to audit, harder to test deterministically.
- **Both layers** (defense in depth). Rejected for now; revisit if a non-EF writer is ever introduced.

**Residual risk**: a direct SQL `UPDATE admission_rules` from a DBA bypasses the check. **Mitigation**: a separate prod DB user without `UPDATE` permission on `admission_rules` is provisioned as part of the operational follow-ups (see [plan.md §Operational Follow-ups](./plan.md#operational-follow-ups-post-merge)).

---

## R0.2 — Workflow stage storage: child entity vs JSON column?

**Question**: Workflows have an ordered list of stages. Store them as a child entity (`WorkflowStage` table with FK to `Workflow`) or as a JSON column on `Workflow`?

**Decision**: **Child entity**. New table `workflow_stages (Id, WorkflowId FK, [Order], Kind, PassingCriteria)` with a unique index on `(WorkflowId, Order)`.

**Rationale**:
- Stages need integer ordering for queries — e.g. "which workflow has aptitude before medical?" — that JSON would force into application code.
- Future consumers will FK against a stage: `ApplicantStageSubmission.WorkflowStageId` is the obvious next column when applicants start producing per-stage submissions. JSON cannot hold an FK target.
- Per-stage audit (when a single stage is reordered, mocked, or replaced) is cleaner with row-grain identity.

**Alternatives considered**:
- **JSON column** on `Workflow`. Rejected: the very first cross-feature use case (per-stage submissions) needs a stable stage `Id` and FK target.

**Trade-off accepted**: two-table migration; one extra `Include(...)` on the workflow read path.

---

## R0.3 — Category conditions: JSON column vs normalized child tables?

**Question**: `CategoryCondition` carries 14 fields plus a free-text array. Normalize into child tables, or store as a JSON column on `Category`?

**Decision**: **JSON column** (`nvarchar(max)`) on `Category`, with serialization happening inside the aggregate's private getters/setters so use cases never see raw strings.

**Rationale**:
- The structure is **read mostly, written rarely** — super_admin edits maybe yearly.
- The structure is **closed** — adding a new condition field is a schema change anyway, normalized or not. A JSON migration is the same effort as a column-add migration.
- The only query that walks into the structure is the eligibility check, which loads the row whole.
- Normalization across seven categories would multiply migration cost without buying a query advantage.

**Alternatives considered**:
- **Per-condition child tables** (e.g. `category_age_conditions`, `category_score_conditions`). Rejected: 14× the migration cost for zero query-side win. Eligibility is per-row, not aggregate.
- **EF Core owned types**. Rejected: still produces a flattened-column shape that locks the schema and makes optional fields awkward.

**Trade-off accepted**: query-side filtering on individual condition fields is unavailable. Acceptable — eligibility is per-row, not aggregate. Revisit if the SPA ever wants to filter categories by condition.

---

## R0.4 — Cycle's `OpenCategories` and `ConditionOverrides` JSON columns

**Question**: Same shape question for the per-cycle category overrides.

**Decision**: **Same as R0.3 — JSON column.** Both `OpenCategories` and `ConditionOverrides` are sparse maps keyed by category key, written rarely, read whole.

**Rationale**:
- Symmetry with R0.3 keeps a single mental model for the "configuration per category" pattern.
- The eligibility check already loads the cycle whole and merges `category.conditions` with `cycle.conditionOverrides[categoryKey]` — there is no pull-side query into the override.

---

## R0.5 — Public read endpoints: separate controllers or admin reuse?

**Question**: Reference-data, cycles, categories, and workflows all have a public read surface (without the `/admin/` prefix). Do they live on the same controller as the admin write endpoints, or on a separate public controller?

**Decision**: **Separate controllers.** Two controllers per entity (one `Admin*Controller` under `[Authorize(Policy = "Role:super_admin")]`, one public `*Controller` under `[Authorize]`), except admission rules — which has only the admin controller. The eligibility check uses the admission-rule use case directly, not an HTTP endpoint.

**Rationale**:
- The two surfaces have **different filters** — admin returns Draft + Archived, public returns Active/Published only. Mixing them on one controller pushes filtering into a request-shape branch.
- Authorization policy is applied per controller; splitting controllers makes the policy attribute the source of truth instead of per-action `[Authorize(Policy=...)]` re-declarations.
- Future API versioning (e.g. a public REST contract that diverges from the internal admin contract) gets a clean seam.

**Alternatives considered**:
- **Single controller, action-level policy**. Rejected: spreads the auth contract across 12 attributes instead of 5 controllers.
- **Single endpoint with role-aware filtering**. Rejected: leaks admin-only fields (e.g. `Archived`, `DemoOrigin`) into the public DTO unless we maintain a parallel projection — which is what the separate controller already does, more cleanly.

---

## Notes on what was *not* researched

These were straight replications of spec 003's pattern and did not need a Phase 0 entry:
- DTO shape (FluentValidation + record types), audit writer, CSRF, pagination headers, soft-delete, and the frontend `*.service.ts` swap from `MOCK + simulateLatency()` to `apiClient`.
- Test scaffolding — Testcontainers.MsSql for backend integration, Vitest + jest-axe for frontend, Playwright E2E. Same harness as spec 003.

If a downstream spec wants to revisit any of those, the bar is "what changed about the underlying constraint?" not "what could be done differently?"
