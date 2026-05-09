---

description: "Tasks for spec 004 — Admin Lookups CRUD (reference-data, cycles, categories, admission-rules, workflows)"
---

# Tasks: Admin Lookups CRUD

**Input**: Design documents from [`specs/004-lookups-crud/`](./)
**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md). Spec 003 (`003-admin-auth-rbac`) must be merged to `dev` before this spec begins (carries the `Role:super_admin` policy and audit infrastructure).

**Companion artifacts** (Phase 0/1 outputs — read these instead of grepping `plan.md` when you want a focused view):
- [research.md](./research.md) — Phase 0 decisions (R0.1–R0.5: admission-rule immutability, workflow-stage storage, JSON columns, public-read controllers)
- [data-model.md](./data-model.md) — schema deltas, JSON shapes, invariants per aggregate
- [quickstart.md](./quickstart.md) — operator's guide for the per-story slice (use this when starting a US)
- [contracts/](./contracts/) — endpoint matrix, per-entity DTOs, and error-code registry; the authoritative OpenAPI YAML lands here at T281

**Tests**: Per Constitution II (NON-NEGOTIABLE), tests are written FIRST and MUST fail before implementation lands. Coverage targets: ≥ 80% statements / ≥ 75% branches across the new namespaces; 100% on success paths of `Application.Admin.{ReferenceData,Cycles,Categories,AdmissionRules,Workflows}.*`.

**Numbering**: tasks continue from spec 003's last task (T197). This spec's range is **T200–T291** (extended after the 2026-05-09 clarify pass added T288–T291 for the FR-K03 risk-confirmation flow).

**Clarifications applied** (see [spec.md §Clarifications](./spec.md#clarifications-resolved-on-2026-05-09)):
- FR-Y02 → T206 unique-index migration includes `IX_cycles_year_cohort_active`
- FR-W02 → T206 unique-index migration includes `IX_workflows_categorykey_cycleid_published`; T276 publish use case scopes auto-archive to `(CategoryKey, CycleId)`
- FR-K03 → new T288–T291 wire the impact-preview endpoint + `confirmedAffectedCount` validation + risk-confirmation modal
- FR-L05 → no task delta (cosmetic FK propagation is the default; no snapshot column needed)

**Format**: `[ID] [P?] [Story] Description`

- **[P]** — can run in parallel (different files, no dependency on tasks ahead)
- **[Story]** — `Foundation` / `US1` / `US2` / `US3` / `US4` / `US5` / `Polish`

---

## Phase 1: Setup

- [ ] **T200** [Setup] Create branch `004-lookups-crud` from `dev` after spec 003 merges. Cherry-picks not needed — spec 003's `Role:super_admin` policy and `IAuditWriter` are already on `dev`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema deltas + domain entity changes that every user story depends on. **No US1–US5 task may begin until Phase 2 is complete.**

### Schema deltas (single migration `004_LookupsCrudExtensions`)

- [ ] **T201** [Foundation] Modify `backend/src/PACademy.Domain/AdmissionRules/AdmissionRule.cs` — add `Version (int, not-null, default 1)`, `EffectiveAt (DateTime, not-null, default UtcNow)`, `ChangedById (Guid?, nullable FK to SystemUser)`. Add `[Index(nameof(CycleId), nameof(Version), IsUnique = true)]` via the configuration.

- [ ] **T202** [Foundation] Modify `backend/src/PACademy.Domain/Workflows/Workflow.cs` — add `Status (WorkflowStatus enum, not-null, default Draft)`. Add new file `Domain/Workflows/WorkflowStatus.cs` with values `Draft = 1, Published = 2, Archived = 3`.

- [ ] **T203** [Foundation] Create `backend/src/PACademy.Domain/Workflows/WorkflowStage.cs` — child entity `(Id, WorkflowId FK, Order, Kind, PassingCriteria)`. Implements `IAuditableWrite`. Configuration in `Persistence/Configurations/WorkflowStageConfiguration.cs` with unique index on `(WorkflowId, Order)`.

- [ ] **T204** [Foundation] Modify `backend/src/PACademy.Domain/Categories/Category.cs` — add `Conditions (string, nvarchar(max), JSON)`, `RequiredTests (string, nvarchar(max), JSON)`, `Procedures (string, nvarchar(max), JSON)`. JSON serialization via `JsonSerializer` in private getters/setters of the aggregate; do not surface raw strings to use cases.

- [ ] **T205** [Foundation] Modify `backend/src/PACademy.Domain/Cycles/Cycle.cs` — add `OpenCategories (string, nvarchar(max), JSON)`, `ConditionOverrides (string, nvarchar(max), JSON)`. Same serialization pattern as T204.

- [ ] **T206** [Foundation] Generate EF migration: `dotnet ef migrations add 004_LookupsCrudExtensions --project src/PACademy.Infrastructure --startup-project src/PACademy.Api`. Verify the generated migration matches the SQL pseudocode in [data-model.md §Schema deltas](./data-model.md#schema-deltas-all-in-migration-004_lookupscrudextensions). Single migration covering all of T201–T205. Migration MUST include the two clarification-driven unique partial indexes: `IX_cycles_year_cohort_active WHERE Status=Active` (FR-Y02) and `IX_workflows_categorykey_cycleid_published WHERE Status=Published` (FR-W02). EF Core: use `HasIndex(...).HasFilter("[Status] = 2").IsUnique()`.

- [ ] **T207** [Foundation] Apply the migration to the dev DB and verify via `sqlcmd` that the new columns + the new `workflow_stages` table exist. Re-seed if needed via `SeedDemo: "true"`.

### Demo seeder extension

- [ ] **T208** [Foundation] Extend `backend/src/PACademy.Infrastructure/Seeding/DemoDataSeeder.cs` — seed the seven missing reference categories (`specialization`, `rank`, `college`, `qualification`, `nationality`, `relationship`, `case-type`) using the data from [`frontend/src/shared/mock-data/referenceData.ts`](../../frontend/src/shared/mock-data/referenceData.ts) ported to a static C# dictionary. Each row: `(category, key, nameAr, nameEn?, sortOrder, isActive=true, demoOrigin=true)`.

- [ ] **T209** [Foundation] Extend `DemoDataSeeder.SeedCyclesAsync` to populate `OpenCategories` and `ConditionOverrides` JSON columns with sensible defaults (all 7 categories open in the active 2026-male cycle; female cycle gets only the categories that admit women).

- [ ] **T210** [Foundation] Extend `DemoDataSeeder.SeedCategoriesAsync` to populate `Conditions`, `RequiredTests`, `Procedures` JSON columns from the frontend mock-data category definitions. Verify all 7 categories seed cleanly.

**Checkpoint**: schema deltas are live, demo data is complete. All US1–US5 phases can begin in parallel.

---

## Phase 3: User Story 1 — Reference data CRUD (P1) 🎯 MVP

### Tests for US1 (write FIRST)

- [ ] **T211** [P] [US1] Backend integration test — happy path: super_admin POSTs `/admin/reference-data` for each of the 8 categories → 201 + `ReferenceDataDetailDto`; GET list returns 200 with seeded rows + new row; archive returns 204. In `backend/tests/PACademy.Api.Tests/Admin/ReferenceData/CrudTests.cs`.

- [ ] **T212** [P] [US1] Backend test — validation paths: (a) duplicate `(category, key)` → 422 + `code: REFERENCE_KEY_TAKEN`; (b) invalid category → 400; (c) missing `nameAr` → 400 + Arabic message; (d) archive of a row referenced by an applicant or rule → 422 + `code: REFERENCE_IN_USE`. In `Admin/ReferenceData/ValidationTests.cs`.

- [ ] **T213** [P] [US1] Backend test — RBAC: a `committee_admin` GETs `/admin/reference-data` → 403; a `committee_admin` GETs the public `/reference-data?category=governorate` → 200. In `Admin/ReferenceData/RbacTests.cs`.

- [ ] **T214** [P] [US1] Frontend Vitest — `frontend/src/features/admin/pages/ReferenceDataPage.test.tsx`: tab switching pulls correct data; add/edit/archive row flows mutate via apiClient mock; empty/loading/error states render per Constitution III; jest-axe assertion.

- [ ] **T215** [P] [US1] Playwright E2E — `e2e/tests/us1-reference-data.spec.ts`: super_admin opens `/admin/reference-data/case-types`, adds row, edits row, archives row, verifies the row no longer appears in the consuming `/investigations/create` case-type picker.

### Implementation for US1

DTOs (parallel; one file each):

- [ ] **T216** [P] [US1] `backend/src/PACademy.Contracts/Admin/ReferenceData/ReferenceDataListItemDto.cs` — `(Id, Category, Key, NameAr, NameEn?, SortOrder, IsActive, Archived)`.
- [ ] **T217** [P] [US1] `ReferenceDataDetailDto.cs` — adds `Metadata?, CreatedAt, ArchivedAt?, DemoOrigin`.
- [ ] **T218** [P] [US1] `CreateReferenceDataRequest.cs` — `(Category, Key, NameAr, NameEn?, Metadata?, SortOrder?)`.
- [ ] **T219** [P] [US1] `UpdateReferenceDataRequest.cs` — `(NameAr?, NameEn?, Metadata?, SortOrder?, IsActive?)`. Category and Key are immutable after creation.
- [ ] **T220** [P] [US1] `ReferenceDataListFilters.cs` — `(Category?, IsActive?, IncludeArchived, Page, PageSize, SortBy?, SortDir?)`.

Use cases:

- [ ] **T221** [P] [US1] `Application/Admin/ReferenceData/CreateReferenceDataValidator.cs` — FluentValidation: category in 8 enum values, key alphanumeric `^[a-z0-9_-]+$`, NameAr required, max length 200.
- [ ] **T222** [P] [US1] `ListReferenceDataUseCase.cs` — paginated query against `db.ReferenceDataEntries`, mirrors the spec 003 list pattern.
- [ ] **T223** [P] [US1] `GetReferenceDataUseCase.cs` — single-row read.
- [ ] **T224** [P] [US1] `CreateReferenceDataUseCase.cs` — duplicate-key check via `(Category, Key)` index; throws `DomainConflictException("REFERENCE_KEY_TAKEN")` on conflict.
- [ ] **T225** [P] [US1] `UpdateReferenceDataUseCase.cs` — patches mutable fields; audit before/after JSON.
- [ ] **T226** [US1] `ArchiveReferenceDataUseCase.cs` — checks for FK references (applicants, admission rules, workflow stages); throws `DomainConflictException("REFERENCE_IN_USE")` on referenced rows. Sets `Archived=true, ArchivedAt={now}`.

API:

- [ ] **T227** [US1] `Api/Controllers/Admin/AdminReferenceDataController.cs` — 6 endpoints: GET (admin), GET (public, separate route), GET/{id}, POST, PATCH, POST archive. Headers per FR-X04. `[Authorize(Policy = "Role:super_admin")]` on admin routes; `[Authorize]` on the public read.

- [ ] **T228** [US1] `Api/Controllers/ReferenceDataController.cs` — public read endpoint `GET /reference-data?category=...` for any authenticated user; filters out archived rows.

- [ ] **T229** [US1] DI registration: 5 use cases + 1 validator in `DependencyInjection.cs`.

Frontend:

- [ ] **T230** [US1] `frontend/src/features/admin/api/referenceData.service.ts` — swap mock for apiClient. Keep query factories unchanged.
- [ ] **T231** [US1] `frontend/src/features/admin/pages/ReferenceDataPage.tsx` — wire to query hooks; add the 4 async states; remove MOCK fallback.
- [ ] **T232** [US1] Add `useReferenceData` query hook + types update in `referenceData.queries.ts`.

**Checkpoint**: US1 deployable. The 8 reference-data tabs render real backend data and persist edits.

---

## Phase 4: User Story 2 — Admission cycles CRUD (P1)

### Tests for US2 (write FIRST)

- [ ] **T233** [P] [US2] Backend integration — happy path: create cycle in Draft, transition to Active, verify single Active per `(year, cohort)`, transition to Closed, archive. In `Admin/Cycles/CrudTests.cs`.
- [ ] **T234** [P] [US2] Backend test — `INVALID_CYCLE_TRANSITION` (Draft→Closed skip), `OVERLAPPING_ACTIVE_CYCLE`, `CYCLE_HAS_APPLICANTS` on hard-delete. In `Admin/Cycles/TransitionTests.cs`.
- [ ] **T235** [P] [US2] Backend test — `openCategories` and `conditionOverrides` JSON round-trip; eligibility check honors override. In `Admin/Cycles/OverridesTests.cs`.
- [ ] **T236** [P] [US2] Frontend Vitest — `CyclesPage.test.tsx` + `CycleNewPage.test.tsx`: server-driven list, status chip filter, create form validation.
- [ ] **T237** [P] [US2] Playwright E2E — `us2-cycles.spec.ts`: super_admin creates draft → activates → public `/applicant/start` shows the cycle as selectable.

### Implementation for US2

- [ ] **T238** [P] [US2] DTOs in `Contracts/Admin/Cycles/`: `CycleListItemDto`, `CycleDetailDto`, `CreateCycleRequest`, `UpdateCycleRequest`, `CycleListFilters`, `TransitionCycleStatusRequest`.
- [ ] **T239** [P] [US2] `Application/Admin/Cycles/CreateCycleValidator.cs`: year ≥ 2024, openDate < closeDate, cohort in `{male, female}`, expectedCapacity > 0.
- [ ] **T240** [P] [US2] `Application/Admin/Cycles/{ List, Get, Create, Update, TransitionStatus, Delete }CycleUseCase.cs` (6 use cases). `TransitionStatus` is the only one that enforces FR-Y01 transition rules and FR-Y02 single-active invariant; it wraps in `IsolationLevel.Serializable` (same pattern as `LoginUseCase`).
- [ ] **T241** [US2] `Api/Controllers/Admin/AdminCyclesController.cs` — 6 endpoints + audit on every mutation.
- [ ] **T242** [US2] `Api/Controllers/CyclesController.cs` — public read `GET /cycles` returns Active + Closed only.
- [ ] **T243** [US2] DI registration: 6 use cases + 1 validator.
- [ ] **T244** [US2] Frontend swap: `cycles.service.ts`, `CyclesPage.tsx`, `CycleNewPage.tsx`, `CycleDetailPage.tsx` — wire to apiClient. Add the status-transition modal (Draft → Active → Closed → Archived) with the gold dashed FR-style notice for the irreversible Active → Closed step.

**Checkpoint**: US2 deployable. Cycles can be created, activated, closed, archived from the SPA.

---

## Phase 5: User Story 3 — Applicant categories CRUD (P1)

### Tests for US3 (write FIRST)

- [ ] **T245** [P] [US3] Backend integration — happy path: GET 7 categories with full conditions; PATCH `officers_general.conditions.minScorePercent` with the correct `confirmedAffectedCount`; verify audit records `{ confirmed: true, affectedApplicantCount: N, fieldsChanged: [...] }` plus the before/after JSON diff. In `Admin/Categories/CrudTests.cs`.
- [ ] **T246** [P] [US3] Backend test — `INVALID_CATEGORY_KEY` on POST (immutability); RequiredTestKind enum validation; **`STALE_AFFECTED_COUNT` 422** when PATCH carries a count that doesn't match the live in-flight applicant count for any active cycle (FR-K03 clarification). In `Admin/Categories/ValidationTests.cs`.
- [ ] **T247** [P] [US3] Backend test — eligibility check observes the new condition value for **all** applicants (in-flight + new) within one minute. In `Admin/Categories/EligibilityIntegrationTests.cs`.
- [ ] **T248** [P] [US3] Frontend Vitest — `CategoryEditPage.test.tsx`: condition fields render, validate, submit; **risk-confirmation modal** shows in-flight applicant count + changed fields + checkbox "أتعهد بمراجعة الأثر…"; submit blocked until checkbox ticked; stale-count 422 re-fetches and re-prompts. jest-axe assertion.
- [ ] **T249** [P] [US3] Playwright E2E — `us3-categories.spec.ts`: super_admin lowers `minScorePercent`, sees the modal with "X متقدماً سيتأثر" count, confirms, saves; then a synthetic applicant who was previously rejected passes eligibility AND an existing in-flight applicant who was passing is also re-evaluated (no snapshot lock).

### Implementation for US3

- [ ] **T250** [P] [US3] DTOs in `Contracts/Admin/Categories/`: `CategoryDetailDto`, `UpdateCategoryRequest`, `CategoryConditionDto` (mirror of frontend `CategoryCondition`), `RequiredTestDto`. **No `Create` DTO** — keys are immutable.
- [ ] **T251** [P] [US3] `Application/Admin/Categories/UpdateCategoryValidator.cs`: ageMin ≤ ageMax, minScorePercent ∈ [0, 100], requiredQualification in enum, gender in `{male, female, any}`.
- [ ] **T252** [P] [US3] `{ List, Get, Update }CategoryUseCase.cs`. Update use case writes the JSON columns and emits before/after audit diff.
- [ ] **T253** [US3] `Api/Controllers/Admin/AdminCategoriesController.cs` — 3 endpoints (no POST, no DELETE).
- [ ] **T254** [US3] `Api/Controllers/CategoriesController.cs` — public read.
- [ ] **T255** [US3] DI registration: 3 use cases + 1 validator.
- [ ] **T256** [US3] Frontend swap: `categories.service.ts`, `CategoriesListPage.tsx`, `CategoryEditPage.tsx` — wire to apiClient.

**Checkpoint**: US3 deployable. Super_admin can edit category conditions with full audit trail.

---

## Phase 6: User Story 4 — Admission rules (versioned, immutable) (P2)

### Tests for US4 (write FIRST)

- [ ] **T257** [P] [US4] Backend integration — happy path: POST v1 → POST v2 → list returns both ordered by `effectiveAt DESC`; v1 row unchanged. In `Admin/AdmissionRules/VersioningTests.cs`.
- [ ] **T258** [P] [US4] Backend test — `ADMISSION_RULES_IMMUTABLE` on PATCH and DELETE attempts (405). In `Admin/AdmissionRules/ImmutabilityTests.cs`.
- [ ] **T259** [P] [US4] Backend property test — 1000 randomized PATCH/DELETE attempts on existing versions all return 405; verifies SC-R01. Use `FsCheck.Xunit` with `seed=42`. Tagged `[Trait("Category","Heavy")]`. In `Admin/AdmissionRules/ImmutabilityPropertyTests.cs`.
- [ ] **T260** [P] [US4] Backend test — eligibility check uses the version locked at applicant creation; publishing v2 does not retroactively reject v1 applicants. In `Admin/AdmissionRules/EligibilityVersionLockTests.cs`.
- [ ] **T261** [P] [US4] Frontend Vitest — `AdmissionRulesPage.test.tsx`: version list ordered desc; new-version form blocks if any field invalid.
- [ ] **T262** [P] [US4] Playwright E2E — `us4-admission-rules.spec.ts`: super_admin publishes v2 with stricter age range; verify next applicant rejected at eligibility but in-flight applicant still passes.

### Implementation for US4

- [ ] **T263** [P] [US4] DTOs in `Contracts/Admin/AdmissionRules/`: `AdmissionRuleListItemDto`, `AdmissionRuleDetailDto`, `CreateAdmissionRuleRequest`. **No Update or Delete DTO.**
- [ ] **T264** [P] [US4] `Application/Admin/AdmissionRules/CreateAdmissionRuleValidator.cs`: age min ≤ max, BMI min ≤ max, height ranges per gender valid, application fees ≥ 0, max applications ≥ 1, accepted certificates non-empty.
- [ ] **T265** [P] [US4] `{ List, Get, Create }AdmissionRuleUseCase.cs`. Create computes `Version = (max version for cycle) + 1` inside `IsolationLevel.Serializable` to prevent concurrent v2 publishes. Sets `EffectiveAt = UtcNow, ChangedById = currentUser.Id`.
- [ ] **T266** [US4] `Api/Controllers/Admin/AdminAdmissionRulesController.cs` — 3 endpoints. PATCH and DELETE return `405 Method Not Allowed` with `{code: "ADMISSION_RULES_IMMUTABLE"}` body. (Document the deliberate 405 via XML comment — the global exception middleware passes it through.)
- [ ] **T267** [US4] DI registration: 3 use cases + 1 validator.
- [ ] **T268** [US4] Frontend swap: `admissionRules.service.ts`, `AdmissionRulesPage.tsx` — wire to apiClient. Add the version timeline UI (already partly in place from mock).

**Checkpoint**: US4 deployable. Admission rules can be versioned and queried; immutability is provably enforced.

---

## Phase 7: User Story 5 — Workflows CRUD (P2)

### Tests for US5 (write FIRST)

- [ ] **T269** [P] [US5] Backend integration — happy path: POST draft → publish → prior published auto-archived; archive returns 200; soft-deleted row remains queryable via `?includeArchived=true`. In `Admin/Workflows/CrudTests.cs`.
- [ ] **T270** [P] [US5] Backend test — `WORKFLOW_IN_USE` on stage reorder when applicants are mid-stage. In `Admin/Workflows/ReorderTests.cs`.
- [ ] **T271** [P] [US5] Backend concurrency test — 32 parallel publish requests for the same category; verify exactly 1 ends `Published` and the rest are `Archived`. Tagged `[Trait("Category","Heavy")]`. In `Admin/Workflows/PublishConcurrencyTests.cs`.
- [ ] **T272** [P] [US5] Frontend Vitest — `WorkflowEditorPage.test.tsx`: stage drag-reorder, kind-enum validation, publish action gates on draft state.
- [ ] **T273** [P] [US5] Playwright E2E — `us5-workflows.spec.ts`: super_admin inserts a "drug" stage between medical and physical, publishes; verify a new applicant in officers_general sees the new stage.

### Implementation for US5

- [ ] **T274** [P] [US5] DTOs in `Contracts/Admin/Workflows/`: `WorkflowListItemDto`, `WorkflowDetailDto` (with `WorkflowStageDto[]`), `CreateWorkflowRequest`, `UpdateWorkflowRequest`, `WorkflowListFilters`, `PublishWorkflowResponse`.
- [ ] **T275** [P] [US5] `Application/Admin/Workflows/CreateWorkflowValidator.cs`: stage `kind` in `RequiredTestKind` enum, contiguous 1-based ordering, name required, categoryKey in 7 valid keys.
- [ ] **T276** [P] [US5] `{ List, Get, Create, Update, Publish, Archive }WorkflowUseCase.cs` (6 use cases). Publish wraps in Serializable transaction: SELECT current Published for `categoryKey` → UPDATE to Archived → UPDATE target to Published → audit both.
- [ ] **T277** [US5] `Api/Controllers/Admin/AdminWorkflowsController.cs` — 6 endpoints.
- [ ] **T278** [US5] `Api/Controllers/WorkflowsController.cs` — public read returns Published only.
- [ ] **T279** [US5] DI registration: 6 use cases + 1 validator.
- [ ] **T280** [US5] Frontend swap: `workflows.service.ts`, `WorkflowsListPage.tsx`, `WorkflowEditorPage.tsx` — wire to apiClient. Add publish button + archived state badge.

**Checkpoint**: US5 deployable. Workflows can be drafted, published, archived; only one Published per category at a time.

---

## Phase 8: Polish

- [ ] **T281** [P] [Polish] OpenAPI snapshot — capture `/openapi/v1.json` after rebuild; split + commit as `specs/004-lookups-crud/contracts/{reference-data,cycles,categories,admission-rules,workflows}.openapi.yaml`. Add to the existing CI drift check from spec 003 T191.

- [ ] **T282** [P] [Polish] Coverage check — `dotnet test --collect:"XPlat Code Coverage"` and `vitest --coverage` after merge. Confirm 100% on the new `Application.Admin.{ReferenceData,Cycles,Categories,AdmissionRules,Workflows}.*` namespaces. Block PR if coverage drops below thresholds.

- [ ] **T283** [P] [Polish] Lighthouse CI — run against `/admin/reference-data/governorates`, `/admin/cycles`, `/admin/categories`, `/admin/admission-rules`, `/admin/workflows`. Verify perf ≥ existing baseline minus 5pt; a11y ≥ 100. Block PR on regression > 5pt.

- [ ] **T284** [P] [Polish] Update [`CLAUDE.md` §13](../../CLAUDE.md) quick-reference table — add the new endpoints (`/admin/reference-data`, `/admin/cycles`, etc.) and the swapped-from-mock status of each admin page.

- [ ] **T285** [Polish] Tick-back to spec 003 — verify spec 003 T196 (lint/format baseline) is complete so spec 004 can merge without `--no-verify`. If not, block on T196.

- [ ] **T286** [Polish] Frontend bundle audit — confirm admin chunk gzipped size unchanged or reduced. Mock data removal (~30KB) should offset any new TanStack Query plumbing. Capture before/after numbers in the PR description.

- [ ] **T287** [Polish] Constitution feedback — document spec 004 lessons learned in `docs/constitution-amendments-pending.md`: (a) JSON-column tradeoffs (spec 004 R0.3); (b) immutable versioned aggregates as a domain pattern (admission rules); (c) per-category single-published invariant as a domain pattern (workflows). Could become formal principles in a future v1.2.0 amendment.

---

## Phase 9: FR-K03 Risk-Confirmation Flow (US3 extension, added by 2026-05-09 clarify pass)

> Wires the impact-preview endpoint + `confirmedAffectedCount` validation + risk-confirmation modal that the original US3 tests (T246, T248, T249) reference but were not built by T250–T256. Numbered after Polish to preserve T200–T287 sequencing; logically blocks US3 final acceptance.

### Tests for Phase 9 (write FIRST)

- [ ] **T288** [P] [US3] Backend integration test — `Admin/Categories/ImpactPreviewTests.cs`: (a) `GET /admin/categories/{key}/impact?proposedConditions={json}` returns the correct in-flight applicant count, scoped to applicants whose cycle has `Status=Active` and whose `Stage` is not `Final`/`Rejected`/`Withdrawn`; (b) `FieldsChanging` lists property-level diffs only (no false positives on identical JSON); (c) returns 400 on malformed `proposedConditions` JSON. Plus PATCH-side test: `PATCH /admin/categories/{key}` with a stale `ConfirmedAffectedCount` returns 422 + `code: STALE_AFFECTED_COUNT` even when nobody else mutated, by simulating a parallel applicant insert inside the Serializable transaction.

### Implementation for Phase 9

- [ ] **T289** [P] [US3] Backend DTO + use case — add `backend/src/PACademy.Contracts/Admin/Categories/CategoryConditionImpactDto.cs` with shape `(int InFlightApplicantCount, string[] FieldsChanging)`. Add `Application/Admin/Categories/GetCategoryConditionImpactUseCase.cs` — counts in-flight applicants for any active cycle in this category (status filter as in T288), and computes `FieldsChanging` as a property-level diff between the stored `CategoryConditionDto` and the proposed one (use `JsonNode` walk so nested fields like `HeightCm.Min` are diffed individually).

- [ ] **T290** [US3] Backend wiring — add `GET /admin/categories/{key}/impact?proposedConditions={json}` to `Api/Controllers/Admin/AdminCategoriesController.cs` (URL-decode then `JsonSerializer.Deserialize<CategoryConditionDto>`; 400 on parse failure). Modify `UpdateCategoryUseCase.cs` to validate `ConfirmedAffectedCount` against the live in-flight count inside the existing `IsolationLevel.Serializable` transaction; throw `DomainConflictException("STALE_AFFECTED_COUNT")` on mismatch (the global exception middleware maps it to 422). Update `UpdateCategoryValidator.cs` to require `ConfirmedAffectedCount ≥ 0`. Register `GetCategoryConditionImpactUseCase` in `DependencyInjection.cs` (this brings the US3 use-case count to 4, replacing T255's "3").

- [ ] **T291** [US3] Frontend modal + page wiring — add `getCategoryImpact(key, proposedConditions)` to `frontend/src/features/admin/api/categories.service.ts` and a lazy/disabled-by-default `useCategoryImpactQuery` to `categories.queries.ts`. Add `frontend/src/features/admin/components/RiskConfirmationModal.tsx` (props: `{ inFlightCount, fieldsChanging[], onConfirm, onCancel }`) — renders the gold-dashed `border-gold-300 bg-gold-50 text-gold-700` notice per [CLAUDE.md §13](../../CLAUDE.md) §4 canon, the in-flight count, the changed-fields list, and the "أتعهد بمراجعة الأثر على المتقدمين الحاليين قبل الحفظ" checkbox; Confirm button disabled until ticked. Vitest in `RiskConfirmationModal.test.tsx`: render smoke + checkbox-gates-confirm + jest-axe. Wire into `CategoryEditPage.tsx`: save → fetch impact → open modal → confirm → mutate with `confirmedAffectedCount = inFlightCount`. On 422 `STALE_AFFECTED_COUNT`: re-fetch impact, re-open modal with fresh count, toast `"تم تحديث عدد المتقدمين المتأثرين، أعد التأكيد"`. This task closes the loops opened by T248 (stale-count re-prompt assertion) and T249 (E2E modal-then-save).

**Checkpoint**: US3 fully closed. The risk-confirmation modal is reachable from `/admin/categories/:key`, the stale-count race is provably defended, and audit entries carry the `confirmed: true` + `affectedApplicantCount` fields per FR-K03.

---

## Implementation Strategy

> Operator's guide for the per-story slice (backend DTOs → validator → use cases → controller → DI → frontend swap) lives in [quickstart.md](./quickstart.md). Per-entity DTO shapes and error codes are in [contracts/](./contracts/). Use this section for ordering and parallelization decisions only.

**MVP cut**: T200–T232 (Phase 1 + Phase 2 + Phase 3). Reference data CRUD shipped on its own. Deployable — closes the largest mock-data gap and unblocks every consuming app.

**Full Spec 004**: T200–T291. All five P1/P2 stories shipped + polish + the FR-K03 risk-confirmation extension (Phase 9, T288–T291).

**Parallelization map**: within each phase, every test file (T211–T215, T233–T237, T245–T249, T257–T262, T269–T273, T288) is `[P]`. Backend DTO files (T216–T220, T238, T250, T263, T274, T289) are `[P]`. Use case files within a story are mostly `[P]`; the serial spine per story is `Validator → Create → Update → Controller → DI → Frontend`. Phase 9 spine: T288 (test) → T289 (DTO + impact use case, parallel) → T290 (controller + serializable validation) → T291 (frontend modal + page wiring).

**Story independence**: US1 ships standalone. US2 depends on US1 only for the audit infrastructure (already there from spec 003). US3 depends on US2 for the cycle FK (categories' overrides reference cycles). US4 depends on US2 (rules attach to cycles). US5 depends on US3 (workflows reference categories). Skip a story → the others in the chain still ship cleanly except for the FK dependencies. Phase 9 (T288–T291) extends US3 and is required for US3 acceptance.

**Test pyramid**: ~29 backend integration tests (Testcontainers.MsSql; +1 from T288 impact-preview), ~9 frontend Vitest files (+1 from T291 risk modal), ~5 Playwright E2E specs. Heavy tests (T259 property, T271 publish concurrency) gated behind `[Trait("Category","Heavy")]` and run on a separate CI tier.

---

## Risks (carried from [plan.md §Risks](./plan.md#risks), monitored here)

- **JSON column drift** (plan.md Risk 1; rationale in [research.md R0.3](./research.md#r03--category-conditions-json-column-vs-normalized-child-tables)) — mitigation T281 OpenAPI snapshot generation. Track on every PR.
- **Stage reorder concurrency** (plan.md Risk 2; rationale in [research.md R0.2](./research.md#r02--workflow-stage-storage-child-entity-vs-json-column)) — mitigation: `RowVersion` column added in T203's `WorkflowStage` configuration, pushed back to `Workflow` aggregate.
- **Applicant rule-version snapshot** (plan.md Risk 3; rationale in [research.md R0.1](./research.md#r01--how-is-admission-rule-immutability-enforced)) — explicitly **deferred to spec 005**. Track in `docs/SCOPE_AUDIT.md`.

---

## Done definition

A PR titled `spec: 004 lookups CRUD (US1–US5)` passes when:
1. All 5 user stories' Acceptance Scenarios pass via the test files above.
2. All 8 Success Criteria from spec.md `#success-criteria` are objectively measurable in CI logs.
3. No `--no-verify` on the merge commit.
4. OpenAPI drift check passes; CLAUDE.md quick-reference is updated.
5. Coverage thresholds maintained per Constitution II.
6. Lighthouse CI delta ≤ 5pt per Constitution IV.
