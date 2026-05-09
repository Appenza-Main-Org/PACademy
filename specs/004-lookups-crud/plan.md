# Implementation Plan: Admin Lookups CRUD

**Spec**: [spec.md](./spec.md) | **Branch**: `004-lookups-crud` | **Created**: 2026-05-09 | **Last Clarified**: 2026-05-09
**Constitution**: v1.1.0 (Ratified 2026-05-07, Last Amended 2026-05-08)

**Clarifications applied** (see [spec.md §Clarifications](./spec.md#clarifications-resolved-on-2026-05-09)):
- FR-Y02: cycle uniqueness keyed on `(year, cohort)` → unique partial index `WHERE Status=Active`
- FR-W02: workflow uniqueness keyed on `(CategoryKey, CycleId)` → unique partial index `WHERE Status=Published`
- FR-K03: mid-cycle category edits are global; super-admin must pass `confirmedAffectedCount` matching server count → 422 `STALE_AFFECTED_COUNT` on mismatch
- FR-L05: reference renames propagate cosmetically via FK; old name preserved in audit only

> Translates the five user stories from spec.md into the concrete technical pattern that wires existing backend domain entities to existing frontend admin pages. The pattern is identical to spec 003's `AdminUsers*` slice: Contracts DTOs → Application use cases → API controller → frontend `*.service.ts` swap from mock to `apiClient`. This plan calls out the deltas that aren't covered by simple replication.

---

## Technical Context

| Concern | Decision |
|---|---|
| Authorization | All `/admin/*` endpoints guarded by `[Authorize(Policy = "Role:super_admin")]` registered in spec 003 T143. Public read endpoints (without `/admin/` prefix) use `[Authorize]` only. |
| Audit | Existing `IAuditWriter.RecordAsync` + `db.SaveChangesAsync` pattern from spec 003 T142 / T170. Mutations record before/after JSON for PATCH; create/delete record action + target. |
| CSRF | Existing `CsrfMiddleware` covers all mutating requests. No changes. |
| Validation | FluentValidation per request DTO, mirroring spec 003's `CreateSystemUserValidator` pattern. Arabic error messages on display fields, English error codes on `code` field. |
| Soft-delete | Existing `ISoftDeletable` + `Archived/ArchivedAt` columns + `PaDbContext.HandleSoftDeletes` change-tracker hook. Hard-delete only allowed where FR-X03 permits. |
| Pagination | Existing `PagedResult<T>` shape from spec 003. `X-Total-Count` + `X-Page-Count` headers per FR-X04. |
| Frontend integration | Each existing `*.service.ts` swaps `MOCK + simulateLatency()` for `apiClient.{get,post,patch}('/...')`. Query factories + types stay unchanged. The pattern was proven for spec 003 `users.service.ts`. |

---

## Domain entity inventory (already on disk)

All five aggregates exist in `backend/src/PACademy.Domain/`:

| Entity | File | Status |
|---|---|---|
| `ReferenceDataEntry` | `Domain/ReferenceData/ReferenceDataEntry.cs` | Present. EF config in `Persistence/Configurations/ReferenceDataEntryConfiguration.cs`. Migration applied. Only `governorate` category seeded. |
| `Cycle` | `Domain/Cycles/Cycle.cs` + `CycleStatus.cs` | Present. Status enum has 4 values matching FR-Y01. EF config + migration applied. Demo seeder creates cycles. |
| `Category` | `Domain/Categories/Category.cs` | Present. EF config + migration applied. Demo seeder creates categories. **Gap**: no `CategoryCondition` value object yet — currently a flat schema. |
| `AdmissionRule` | `Domain/AdmissionRules/AdmissionRule.cs` | Present, but a single-row entity per cycle. **Gap**: no `Version` column, no immutability guard. Needs migration. |
| `Workflow` | `Domain/Workflows/Workflow.cs` | Present. **Gap**: workflow stages are not modelled — currently just a name/cycle row. Needs `WorkflowStage` child entity + migration. |

**Schema deltas required** (call them out for /speckit.analyze):
1. `AdmissionRule` → add `Version (int)`, `EffectiveAt (datetime2)`, `ChangedById (Guid)` columns. New migration.
2. `Workflow` → add `Status (int)` column. New migration.
3. `WorkflowStage` → new table `(Id, WorkflowId FK, Order, Kind, PassingCriteria)`. New migration.
4. `Category` → add `Conditions (jsonb-style nvarchar(max))`, `RequiredTests (jsonb-style nvarchar(max))`, `Procedures (jsonb-style nvarchar(max))` columns to store the structured config. New migration.
5. `Cycle` → add `OpenCategories (nvarchar(max))`, `ConditionOverrides (nvarchar(max))` columns. New migration.

All five migrations land in the same migration file `004_LookupsCrudExtensions` to keep the schema change atomic per Constitution V (one logical change per migration).

---

## Project Structure

```
backend/
├── src/
│   ├── PACademy.Contracts/Admin/
│   │   ├── ReferenceData/   # NEW — 5 DTOs (List, Detail, Create, Update, Filters)
│   │   ├── Cycles/          # NEW — same shape
│   │   ├── Categories/      # NEW — same shape (no Create — keys are immutable)
│   │   ├── AdmissionRules/  # NEW — Create only (no Update — versioned)
│   │   └── Workflows/       # NEW — same shape + Publish endpoint contract
│   │
│   ├── PACademy.Application/Admin/
│   │   ├── ReferenceData/   # NEW — List/Get/Create/Update/Archive use cases + validator
│   │   ├── Cycles/          # NEW — same + Transition use case
│   │   ├── Categories/      # NEW — Get/Update only
│   │   ├── AdmissionRules/  # NEW — List/Get/Create only (immutable)
│   │   └── Workflows/       # NEW — List/Get/Create/Update/Publish/Archive
│   │
│   ├── PACademy.Api/Controllers/Admin/
│   │   ├── AdminReferenceDataController.cs   # NEW
│   │   ├── AdminCyclesController.cs          # NEW
│   │   ├── AdminCategoriesController.cs      # NEW
│   │   ├── AdminAdmissionRulesController.cs  # NEW
│   │   └── AdminWorkflowsController.cs       # NEW
│   │
│   ├── PACademy.Infrastructure/
│   │   ├── DependencyInjection.cs            # MODIFY — register 20+ new use cases
│   │   ├── Persistence/Migrations/004_*      # NEW — schema deltas above
│   │   └── Seeding/DemoDataSeeder.cs         # MODIFY — seed the 7 missing reference categories
│   │
│   └── PACademy.Domain/
│       ├── AdmissionRules/AdmissionRule.cs   # MODIFY — add Version, EffectiveAt, ChangedById
│       ├── Workflows/Workflow.cs             # MODIFY — add Status
│       ├── Workflows/WorkflowStage.cs        # NEW — child entity
│       ├── Workflows/WorkflowStatus.cs       # NEW — enum
│       └── Categories/Category.cs            # MODIFY — add Conditions/RequiredTests/Procedures JSON columns

frontend/
├── src/features/admin/
│   ├── api/
│   │   ├── referenceData.service.ts          # MODIFY — swap mock for apiClient
│   │   ├── cycles.service.ts                 # MODIFY — same
│   │   ├── categories.service.ts             # MODIFY — same
│   │   ├── admissionRules.service.ts         # MODIFY — same
│   │   └── workflows.service.ts              # MODIFY — same
│   │   (corresponding *.queries.ts files: type-update only, no logic change)
│   │
│   └── pages/
│       ├── ReferenceDataPage.tsx             # MODIFY — use server filters; remove MOCK fallback
│       ├── CyclesPage.tsx                    # MODIFY — server data + status transitions
│       ├── CycleNewPage.tsx + CycleDetailPage.tsx  # MODIFY — wire create/edit through apiClient
│       ├── CategoriesListPage.tsx + CategoryEditPage.tsx  # MODIFY — server data
│       ├── AdmissionRulesPage.tsx            # MODIFY — versioned list + new-version form
│       └── WorkflowsListPage.tsx + WorkflowEditorPage.tsx  # MODIFY — server data + publish action

specs/004-lookups-crud/
├── spec.md          (✓ done)
├── plan.md          (this file)
├── tasks.md         (next)
└── contracts/       # post-implementation OpenAPI snapshot (T-Polish)
```

---

## Phase 0 — Research Notes (inline)

### R0.1 — Versioned admission rules: how to enforce immutability?

**Question**: Should `AdmissionRule` immutability be enforced in EF Core or at the SQL level?

**Decision**: EF Core only — the use case throws `InvalidOperationException` on PATCH/DELETE attempts and the controller returns `405 Method Not Allowed` with `code: ADMISSION_RULES_IMMUTABLE`. We do not add a SQL trigger because (a) the audit-immutability trigger from spec 002 already established the pattern of one trigger per rule and we don't want trigger sprawl; (b) every write path goes through EF, so application-layer enforcement is sufficient; (c) tests verify via the property-based check in T-R-Property (1000 randomized attempts).

**Risk**: A direct SQL UPDATE bypasses the check. **Mitigation**: deny non-app DB users update permission on `admission_rules` once the prod DB is provisioned. Tracked in plan.md "Operational Follow-ups".

### R0.2 — Workflow stage storage: child entity vs JSON column?

**Question**: Should workflow stages be a child entity (`WorkflowStage` table) or a JSON column on `Workflow`?

**Decision**: Child entity. Stages need integer ordering for queries ("which workflow has aptitude before medical?"), foreign keys from applicant submissions (`ApplicantStageSubmission.WorkflowStageId`), and per-stage audit. JSON would defer all that to application code.

**Trade-off**: Two-table migration. Acceptable.

### R0.3 — Category conditions: JSON column vs normalized child tables?

**Question**: `CategoryCondition` has 14 fields plus a `freeText` array. JSON or normalized?

**Decision**: JSON column (`nvarchar(max)`) on `Category`. Reasons: (a) the structure is read mostly, written rarely (super_admin edits maybe yearly); (b) the structure is closed — adding a new condition field is a schema change anyway, JSON or not; (c) the only query that walks into the structure is the eligibility check, which loads the row whole; (d) normalized tables would multiply migration cost across the seven categories.

**Trade-off**: We lose query-side filtering on individual condition fields. Acceptable — the eligibility check is per-row, not aggregate.

### R0.4 — Cycle's `openCategories` and `conditionOverrides` JSON columns

**Decision**: Same as R0.3. Both are sparse maps keyed by category key, written rarely, read whole.

### R0.5 — Public read endpoints (without `/admin/` prefix)

**Question**: Do reference-data, cycles, categories, workflows need separate public-read controllers or can the admin controllers serve both?

**Decision**: Separate controllers. `/admin/*` endpoints require `Role:super_admin` and return all rows (including draft/archived). `/reference-data`, `/cycles`, `/categories`, `/workflows` (no `/admin/` prefix) require `[Authorize]` only and filter to active/published rows. Two controllers per entity; admission rules has only the admin controller (the eligibility check uses the use case directly, not an HTTP endpoint).

---

## Phase 1 — Design (inline)

### Data model changes

The five migration deltas in the inventory section above land as a single migration. Pseudocode:

```
ALTER TABLE admission_rules ADD Version INT NOT NULL DEFAULT 1;
ALTER TABLE admission_rules ADD EffectiveAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
ALTER TABLE admission_rules ADD ChangedById UNIQUEIDENTIFIER NULL;
CREATE UNIQUE INDEX IX_admission_rules_cycle_version ON admission_rules (CycleId, Version);

ALTER TABLE workflows ADD Status INT NOT NULL DEFAULT 1;  -- 1=Draft
-- Spec 002 already gave Workflow CategoryKey + CycleId. Per FR-W02 clarification:
CREATE UNIQUE INDEX IX_workflows_categorykey_cycleid_published
  ON workflows (CategoryKey, CycleId)
  WHERE Status = 2;  -- 2=Published; only one Published per (cat, cycle)

CREATE TABLE workflow_stages (
  Id UNIQUEIDENTIFIER PRIMARY KEY,
  WorkflowId UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES workflows(Id),
  [Order] INT NOT NULL,
  Kind NVARCHAR(64) NOT NULL,
  PassingCriteria NVARCHAR(500) NOT NULL,
);
CREATE UNIQUE INDEX IX_workflow_stages_workflow_order ON workflow_stages (WorkflowId, [Order]);

-- Spec 002 already gave Cycle (Year, Cohort, Status). Per FR-Y02 clarification:
CREATE UNIQUE INDEX IX_cycles_year_cohort_active
  ON cycles (Year, Cohort)
  WHERE Status = 2;  -- 2=Active

ALTER TABLE categories ADD Conditions NVARCHAR(MAX) NOT NULL DEFAULT '{}';
ALTER TABLE categories ADD RequiredTests NVARCHAR(MAX) NOT NULL DEFAULT '[]';
ALTER TABLE categories ADD Procedures NVARCHAR(MAX) NOT NULL DEFAULT '[]';

ALTER TABLE cycles ADD OpenCategories NVARCHAR(MAX) NOT NULL DEFAULT '{}';
ALTER TABLE cycles ADD ConditionOverrides NVARCHAR(MAX) NOT NULL DEFAULT '{}';
```

### Contracts surface

Each entity ships a quintet of DTOs (where applicable):
- `<Entity>ListItemDto` — narrow shape for table rendering
- `<Entity>DetailDto` — full read model
- `Create<Entity>Request` — write model
- `Update<Entity>Request` — patch model (omitted for AdmissionRules — no PATCH)
- `<Entity>ListFilters` — query parameters

Plus operation-specific DTOs:
- `TransitionCycleStatusRequest { CycleStatus newStatus }` — for `PATCH /admin/cycles/{id}/status`
- `PublishWorkflowResponse { Guid PublishedId, Guid? ArchivedId }` — for `POST /admin/workflows/{id}/publish`. `ArchivedId` is the prior `Published` workflow for the same `(categoryKey, cycleId)` if any; null on first publish.
- `UpdateCategoryRequest` carries an extra `int ConfirmedAffectedCount` field (FR-K03 clarification). The use case verifies it matches the live count before applying the patch; mismatch returns 422 `STALE_AFFECTED_COUNT`.
- `CategoryConditionImpactDto { int InFlightApplicantCount, string[] FieldsChanging }` — returned by `GET /admin/categories/{key}/impact?proposedConditions=<json>` so the SPA can populate the risk-confirmation modal before the user clicks save.

### API surface

```
# Reference data
GET    /reference-data?category=...           Authorize         (all 8 categories readable by any user)
GET    /admin/reference-data?category=...     Role:super_admin  (includes archived)
GET    /admin/reference-data/{id}             Role:super_admin
POST   /admin/reference-data                  Role:super_admin
PATCH  /admin/reference-data/{id}             Role:super_admin
POST   /admin/reference-data/{id}/archive     Role:super_admin

# Cycles
GET    /cycles?status=Active                  Authorize
GET    /admin/cycles?status=...               Role:super_admin
GET    /admin/cycles/{id}                     Role:super_admin
POST   /admin/cycles                          Role:super_admin
PATCH  /admin/cycles/{id}                     Role:super_admin
POST   /admin/cycles/{id}/status              Role:super_admin   (transition)
DELETE /admin/cycles/{id}                     Role:super_admin   (Draft + zero applicants only)

# Categories
GET    /categories                            Authorize
GET    /admin/categories                      Role:super_admin
GET    /admin/categories/{key}                Role:super_admin
PATCH  /admin/categories/{key}                Role:super_admin

# Admission rules (versioned, immutable)
GET    /admin/admission-rules?cycleId=...     Role:super_admin
GET    /admin/admission-rules/{id}            Role:super_admin
POST   /admin/admission-rules                 Role:super_admin
# No PATCH or DELETE

# Workflows
GET    /workflows?categoryKey=...             Authorize          (Published only)
GET    /admin/workflows                       Role:super_admin
GET    /admin/workflows/{id}                  Role:super_admin
POST   /admin/workflows                       Role:super_admin
PATCH  /admin/workflows/{id}                  Role:super_admin
POST   /admin/workflows/{id}/publish          Role:super_admin
POST   /admin/workflows/{id}/archive          Role:super_admin
```

### Frontend Quickstart (per entity)

The integration is mechanical and identical for each of the five surfaces. Per-entity steps:

1. Update the `*.service.ts` — replace each method body with `apiClient.{verb}('/admin/<entity>...', ...)`. Keep the export shape (`*.list, .get, .create, .update, .archive, etc.`) so consumers don't change.
2. Update the `*.queries.ts` types if DTO shapes shifted (mostly identical to existing frontend types — the catalog lookup spec maps them).
3. Update the page(s):
   - Replace `MOCK + simulateLatency()` references with the query hook.
   - Add the four async-state cases per Constitution III: idle, loading, empty, error.
   - For mutations, add success toast + error toast + field-level error mapping for `code: *_TAKEN`.
4. Add filter chips / search input where the existing UI has them; they pass to the service via the filters object.

---

## Constitution Check (v1.1.0)

### Gate I — Code Quality & Maintainability

- ✅ Strict TS, no `any`. Each frontend page stays ≤ 200 lines (current pages are well under). New use case classes ≤ 150 lines each.
- ✅ Named exports only. New DTOs are records (single named export per file).
- ✅ JSDoc on every new public function and use case.
- ⚠ Five new migrations at once is more than the spec-001/002/003 norm; mitigated by bundling into ONE migration file.

### Gate II — Testing Standards (NON-NEGOTIABLE)

- ✅ Test-first per use story. Each US gets backend integration tests (Testcontainers.MsSql) + frontend Vitest + at least one Playwright E2E.
- ✅ 100% coverage on auth-adjacent code paths is preserved (we don't touch `Auth.*` namespaces).
- ⚠ Coverage on `Application.Admin.{ReferenceData,Cycles,Categories,AdmissionRules,Workflows}.*` MUST hit 100% on success paths. Negative paths (validation errors) require ≥ 80% per Principle II baseline.
- ⚠ AdmissionRule immutability needs a property-based test (T-R-Property) per SC-R01.

### Gate III — User Experience Consistency

- ✅ Every existing admin page already follows the design system. We're not redesigning UI; only wiring data.
- ✅ Four async states per Constitution III handled via existing `LoadingState`, `EmptyState`, `ErrorState` primitives.
- ✅ Per-app accent (`var(--accent-*)`) flows through existing `data-app="admin"` shell.

### Gate IV — Performance Requirements

- ⚠ Per-route bundle budget — `ReferenceDataPage` currently lazy-loads in the admin chunk. Wiring backend data does not increase bundle size (we're removing mock data, which is in the chunk too — net negative).
- ⚠ List endpoints with `pageSize=200` — verify no waterfalls. Each list page does one paginated GET, no dependent fetches.

### Gate V — Spec-Driven Discipline

- ✅ `spec.md` stays tech-agnostic; tech terms (REST, JSON, EF Core, etc.) live only in this `plan.md` and `tasks.md`.
- ✅ Spec → plan → tasks → PR traceability via the spec's task IDs (T200+).
- ✅ This spec branches from `dev` after spec 003 lands. No premature merge from another branch.

**No constitution violations.**

---

## Complexity Tracking

| # | Concern | Mitigation | Expiry |
|---|---|---|---|
| 1 | 5 migrations bundled into one file | Atomic schema change is preferable to a partial Phase 4. Reviewed by lead before merge. | At merge of `004-lookups-crud` |
| 2 | JSON columns for category conditions and cycle overrides | See R0.3 / R0.4. The structure is closed and read mostly. | Re-evaluate if a query-side filter on a specific condition field is requested. |
| 3 | Pre-commit hook still requires `--no-verify` from spec 003 | Spec 003 T196 already tracks the lint+format baseline cleanup. Spec 004 must not commit with `--no-verify` once T196 lands. | Spec 003 merge completion |

---

## Operational Follow-ups (post-merge)

- Provision a separate prod DB user with no `UPDATE admission_rules` permission, per R0.1 mitigation.
- Add a Lighthouse CI job for `/admin/reference-data` to track p95 list-render time as the dictionary grows.
- Wire a cache invalidation hook for FR-L04 (consuming apps see ref-data changes within 1 min). React Query's `staleTime` + manual `invalidateQueries` on the super-admin's mutations is sufficient for SPA; the public site (when it ships) needs ETags.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| JSON column drift — frontend and backend schemas of `CategoryCondition` diverge silently | Medium | High (eligibility decisions on the wrong shape) | Generate the TS interface from the C# record via OpenAPI snapshot; compare on every PR via the existing OpenAPI drift check (spec 003 T191). |
| Workflow stage reordering races — two super-admins reorder simultaneously | Low | Medium | Use `RowVersion` on `Workflow`; concurrent PATCH returns 409 (existing `DomainConflictException` mapping). |
| Admission rule "lock at applicant creation" needs an applicant snapshot column | Medium | High | Add `Applicant.AdmissionRuleVersionId` FK in spec 005 (out of scope for this spec — eligibility check uses the rule version that was current at applicant `CreatedAt` for now, reading from `effectiveAt`). |

The third risk is explicitly **deferred**: this spec wires the admission rule CRUD; the applicant-side lock-in column is a separate spec (call it spec 005 — applicant-rule version snapshot). Calling it out so /speckit.analyze flags the gap.

---

## Acceptance gates for spec 004 merge

1. All five user stories' Acceptance Scenarios pass via integration + E2E tests.
2. All five Success Criteria are objectively measurable and pass.
3. OpenAPI snapshot regenerated; CI drift check passes.
4. Pre-commit hook passes without `--no-verify` (depends on spec 003 T196 first).
5. Frontend bundle audit: admin chunk size unchanged or reduced (mock data removal offsets new TanStack Query plumbing).
6. CLAUDE.md §13 quick-reference table updated with the new endpoints and the `/admin/reference-data/<tab>` real-data status.
