# Tasks: Admission-Setup Wizard Persistence

> **⚠ Amendment 001 active (2026-05-12)** — wizard step count is 13 (was 15). T047 returns 13 rows; T053 controller rejects legacy step keys. See [`AMENDMENT-001-wizard-step-count.md`](AMENDMENT-001-wizard-step-count.md).

**Input**: Design documents from `/specs/009-admission-setup-persistence/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/admission-setup-api.md, quickstart.md

**Tests**: Per Constitution Principle II (NON-NEGOTIABLE), test tasks below are MANDATORY. Every user story includes test-first tasks for: domain invariants (xUnit), use-case happy + 409 + permission-deny paths (xUnit), integration round-trips (Testcontainers SQL Server), new UI components (render smoke + interaction + jest-axe), and one Playwright E2E per priority band. MSW for all frontend network mocking; no live network. `.skip` / `.only` MUST NOT reach `main`. Coverage thresholds (CI): ≥ 80% statements, ≥ 75% branches; 100% on the Apply transaction and the Cross-cycle copy transaction (both sit in the payments/mutation path of the constitution).

**Organization**: Tasks are grouped by user story so each story (P1 → P2 → P3 → P4) can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared-file dependencies)
- **[Story]**: Which user story this task belongs to (US1 = P1 5 NEW entities, US2 = P2 4 mock-only-service migrations, US3 = P3 cycles+categories finish, US4 = P4 cross-cycle copy)
- All file paths are repo-root-relative

## Path Conventions

- Backend modules: `backend/src/Modules/<Module>/PACademy.Modules.<Module>.{Domain,Application,Infrastructure,Public}/`
- Controllers: `backend/src/PACademy.Api/Controllers/Admin/`
- Backend tests: `backend/tests/PACademy.Api.Tests/`, `backend/tests/PACademy.Application.Tests/`, `backend/tests/PACademy.Domain.Tests/`, `backend/tests/PACademy.Architecture.Tests/`
- Frontend services: `frontend/src/features/admin/{admission-setup,}/api/`
- Frontend components: `frontend/src/features/admin/admission-setup/components/`
- Frontend tests: colocated next to source (`*.test.ts`, `*.test.tsx`)
- Playwright E2E: `frontend/e2e/`

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Add the shared concurrency primitive, the audit-action labels for the 5 new actions, and create the empty backend module project files so all later tasks have well-defined homes.

- [x] T001 Add new audit-action labels (Arabic + color) to `frontend/src/shared/lib/audit.ts`'s `ACTION_FALLBACK` map: `merge_rule_applied` (`'تطبيق دمج/فصل لجان'`, success), `merge_rule_cancelled` (`'إلغاء قاعدة دمج/فصل'`, warning), `wizard_step_completed` (`'إكمال خطوة الإعداد'`, success), `wizard_step_reopened` (`'إعادة فتح خطوة الإعداد'`, info), `cycle_cloned` (`'نسخ إعدادات دورة'`, info).
- [x] T002 Extend the `AuditAction` union in `frontend/src/shared/types/domain.ts` with the same 5 values, grouped under a `/* Admission-setup wizard (spec 009) */` comment.
- [x] T003 [P] Define the shared 409 conflict shape `RowVersionConflictResult` in `backend/src/Shared/Contracts/PACademy.Shared.Contracts/Concurrency/RowVersionConflictResult.cs` (record with `Code`, `MessageAr`, `MessageEn`, `CurrentRowVersion`, `EntityType`, `EntityId` per contracts §"Concurrency conflict response shape").
- [x] T004 [P] Add `DbUpdateConcurrencyExceptionMiddleware` in `backend/src/PACademy.Api/Middleware/DbUpdateConcurrencyExceptionMiddleware.cs` — catches `DbUpdateConcurrencyException`, extracts the failed entry's current row version, returns 409 with `RowVersionConflictResult`. Register in `Program.cs` after the audit middleware.
- [x] T005 [P] Create the `Committees` module skeleton: `backend/src/Modules/Committees/PACademy.Modules.Committees.{Domain,Application,Infrastructure,Public}/` with empty `.csproj` files that follow the existing module conventions (per spec 005 FR-M02). Wire them into `backend/PACademy.sln`.
- [x] T006 [P] Create the `Notifications` module skeleton: `backend/src/Modules/Notifications/PACademy.Modules.Notifications.{Domain,Application,Infrastructure,Public}/` with empty `.csproj` files. Wire into the solution.
- [x] T007 Add new permission policies in `backend/src/PACademy.Api/Authorization/PermissionPolicyProvider.cs` (and `RolePermissions.cs` per spec 007): `admission-setup:read`, `admission-setup:write`, `admission-setup:apply`, `admission-setup:clone`. Assign `super_admin` and `committee_admin` (read+write only) to the relevant policies; `apply` and `clone` are super_admin-only.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Optimistic-locking convention, the `WizardStepStatus` table + middleware hook, and the new Admissions migration scaffolding. All later phases depend on this.

**⚠️ CRITICAL**: Blocks all four user-story phases.

### Backend foundations

- [x] T008 Add a `RowVersion` byte[] property + `IsConcurrencyToken()` fluent config to the existing `Cycle`, `Category`, `AdmissionRule` entities in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/`. Update the entity configurations in `Infrastructure/Persistence/Configurations/` to map it as `rowversion` SQL Server type.
- [x] T009 Create `WizardStepStatus` entity in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/WizardStepStatus.cs` per data-model.md §"wizard_step_statuses": sealed class with composite key `(CycleId, StepKey)`, `Status` enum (`NotStarted` / `InProgress` / `Complete`), `CompletedAt`, `CompletedBy`, `RowVersion`. Include factory `Create` + `MarkComplete` + `Reopen` methods enforcing the lifecycle invariants.
- [x] T010 Add the `WizardStepStatusStatus` enum (or equivalent type-safe representation) in the Domain project.
- [x] T011 [P] Configure `WizardStepStatus` mapping in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure/Persistence/Configurations/WizardStepStatusConfiguration.cs` — composite PK, indexes per data-model.md.
- [x] T012 Implement the auto-promotion middleware hook on `AdmissionsDbContext.SaveChangesAsync`: detects any tracked entity in the wizard-scoped table set that's `Added` / `Modified` and not already represented in the status table for the same `(cycle_id, step_key)`; upserts `wizard_step_statuses` row to `in_progress`. Lives in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure/Persistence/WizardStatusInterceptor.cs`. Wire it into `AddDbContext` in `AdmissionsModule.cs`.
- [x] T013 Implement the auto-demotion hook in the same interceptor: when a save targets an entity whose `(cycle_id, step_key)` row currently has `status = complete`, demote it to `in_progress` in the same transaction.
- [x] T014 [P] Create the new Admissions migration `009_AdmissionSetupEntities` via `dotnet ef migrations add` from `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure/`. The migration adds: `wizard_step_statuses` + the 5 wizard entities (filled in later) + the 3 `rowversion` columns on existing tables. Migration body fleshes out in later phases as entities are added; this task creates the file + history-table convention (`__EFMigrationsHistory_Admissions`).

### Frontend foundations

- [x] T015 [P] Add new TypeScript types in `frontend/src/features/admin/admission-setup/types.ts`: `WizardStepStatusRow`, `MergeSplitRuleStatus`, `MergeSplitPreviewDto`, `CycleCloneSummaryDto`, `CycleCloneBrokenReference`. Update the existing 4 net-new entity types (CommitteeMergeSplitRule, ExamDateConfig, TotalScoreConfig, ElectronicDeclaration, CommitteeScoreThreshold) to include a `rowVersion: string` field.
- [x] T016 [P] Add a `RowVersionConflictError` discriminated error subtype in `frontend/src/shared/api/errors.ts` (or wherever the existing axios error normalisation lives). `apiClient` should propagate 409 with body shape `{ code: 'ROW_VERSION_CONFLICT', currentRowVersion, … }` as a typed error subclass so service-layer code can recognize it.
- [x] T017 [P] Add a shared `<RowVersionConflictDialog>` component in `frontend/src/shared/components/RowVersionConflictDialog.tsx` — reads the conflict's `currentRowVersion` snapshot, renders a diff vs. the user's in-flight values, exposes a "Refresh and re-apply" action. Re-exported from `frontend/src/shared/components/index.ts`. Includes a smoke test + axe assertion (`RowVersionConflictDialog.test.tsx`).

**Checkpoint**: Optimistic-locking infrastructure ready, wizard-status interceptor in place, new audit actions registered. All four user-story phases can begin.

---

## Phase 3: User Story 1 — The 5 NEW wizard entities get full persistence (Priority: P1) 🎯 MVP

**Goal**: A super-admin opens any of the 5 wizard steps with zero backend today (merge/split, score thresholds, exam dates, total-score, declaration), saves data, refreshes the browser, and sees exactly the saved state. Cross-session, cross-device, cross-user.

**Independent Test**: Per spec.md Story 1 Acceptance — configure a committee merge rule on a draft cycle → refresh → rule appears intact. Configure all 5 entity types in sequence → close browser → re-open from another machine signed in as the same admin → all 5 visible.

### Tests for User Story 1 (REQUIRED — Constitution Principle II) ⚠️

> Write these tests FIRST and confirm they FAIL before implementation.

#### Backend domain unit tests (xUnit, no DB)

- [x] T018 [P] [US1] Domain tests for `CommitteeMergeSplitRule` invariants in `backend/tests/PACademy.Domain.Tests/Admissions/CommitteeMergeSplitRuleTests.cs`: merge requires ≥ 2 source + exactly 1 target; split requires exactly 1 source + ≥ 2 target; `Apply` flips status to `applied` and locks the row; `Cancel` only allowed on `planned`; applied rules reject any further mutation.
- [x] T019 [P] [US1] Domain tests for `CommitteeScoreThreshold` in `backend/tests/PACademy.Domain.Tests/Admissions/CommitteeScoreThresholdTests.cs`: `min ≤ max`; rejects out-of-cycle-range scores.
- [x] T020 [P] [US1] Domain tests for `ExamDateConfig` in `backend/tests/PACademy.Domain.Tests/Admissions/ExamDateConfigTests.cs`: every `bookableDay >= firstAvailableDate`; `blackoutDates ⊆ bookableDays`.
- [x] T021 [P] [US1] Domain tests for `TotalScoreConfig` in `backend/tests/PACademy.Domain.Tests/Admissions/TotalScoreConfigTests.cs`: components sum to 100; component `exam_key` foreign-key check; per-stream uniqueness.
- [x] T022 [P] [US1] Domain tests for `ElectronicDeclaration` in `backend/tests/PACademy.Domain.Tests/Admissions/ElectronicDeclarationTests.cs`: version auto-increment; only one published per cycle at a time; publish atomically unsets prior.

#### Backend integration tests (xUnit + Testcontainers SQL Server)

- [x] T023 [P] [US1] HTTP integration tests for the merge/split endpoints in `backend/tests/PACademy.Api.Tests/AdmissionSetup/MergeSplitRulesIntegrationTests.cs`: List/Get/Create/Update/Cancel/Archive happy paths; Preview returns expected shape; Apply runs the transactional move and the rule becomes immutable; stale `previewHash` → 409; stale `rowVersion` → 409.
- [x] T024 [P] [US1] HTTP integration tests for score-thresholds in `.../ScoreThresholdsIntegrationTests.cs` — upsert PUT, list per cycle, 422 on `min > max`.
- [x] T025 [P] [US1] HTTP integration tests for exam-date-config in `.../ExamDateConfigIntegrationTests.cs` — upsert PUT, 422 on subset violation.
- [x] T026 [P] [US1] HTTP integration tests for total-score-config in `.../TotalScoreConfigIntegrationTests.cs` — upsert PUT per stream, 422 on weights ≠ 100 sum, 422 on unknown exam_key.
- [x] T027 [P] [US1] HTTP integration tests for electronic-declaration in `.../ElectronicDeclarationIntegrationTests.cs` — POST creates draft v1; subsequent POST creates v2; publish atomically demotes v1 if it was published; archive blocks the currently-published version.
- [x] T028 [P] [US1] HTTP integration tests for wizard-status endpoints in `.../WizardStatusIntegrationTests.cs` — Complete + Reopen endpoints; verify the auto-`in_progress` interceptor fires when any of the 5 wizard entities is saved.
- [x] T029 [P] [US1] Concurrency tests in `.../OptimisticLockingIntegrationTests.cs` — for one representative entity (CommitteeMergeSplitRule), simulate two clients with stale rowVersions: first save succeeds; second returns 409 with the `RowVersionConflictResult` body.
- [x] T029a [P] [US1] Broken-reference resilience tests in `.../BrokenReferenceResilienceTests.cs` — covers SC-009: (a) soft-delete a committee that is named in a `CommitteeMergeSplitRule` → `GET` the merge rule and assert the response includes a broken-reference indicator, not a 500; (b) soft-delete a committee named in a `CommitteeScoreThreshold` → `GET` thresholds list and assert same; (c) attempt `Apply` on a rule with a broken reference and assert 422 with Arabic `"اللجنة المرجعية محذوفة — يرجى مراجعة القاعدة قبل التطبيق"`.

#### Frontend service + component tests (Vitest + MSW + Testing Library)

- [ ] T030 [P] [US1] Service-layer tests in `frontend/src/features/admin/admission-setup/api/admission-setup.service.test.ts` — for each of the 5 entities, MSW handlers stub the contract from `contracts/admission-setup-api.md`; service methods (`listMergeSplitRules`, `applyMergeSplitRule`, `upsertScoreThreshold`, …) parse the responses and propagate `RowVersionConflictError` on 409.
- [ ] T031 [P] [US1] `MergeSplitApplyDrawer` component test in `frontend/src/features/admin/admission-setup/components/MergeSplitApplyDrawer.test.tsx` — render smoke, interaction (Preview → Apply flow with mocked endpoints), axe assertion on the open drawer.

#### Playwright E2E

- [ ] T032 [P] [US1] Playwright E2E `frontend/e2e/admission-setup-p1.spec.ts` — log in as super_admin → navigate to a draft cycle's wizard → configure one row in each of the 5 P1 steps → refresh → assert each saved row is intact → run the merge/split Apply on a fixture cycle with seeded committees → assert applicants move and rule becomes immutable. **Also covers SC-004**: after publishing an `electronic_declaration`, switch to the applicant portal (sign in as an applicant on the same fixture cycle), navigate to the print-card stage, and assert the declaration text rendered matches the published version body and contains no hard-coded fallback string.

### Backend implementation for User Story 1

- [x] T033 [P] [US1] Implement `CommitteeMergeSplitRule` aggregate in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/CommitteeMergeSplitRule.cs` — fields per data-model.md, factory `Create`, `UpdateShape`, `Apply`, `Cancel` methods enforcing invariants.
- [x] T034 [P] [US1] Implement `CommitteeScoreThreshold` aggregate in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/CommitteeScoreThreshold.cs`.
- [x] T035 [P] [US1] Implement `ExamDateConfig` aggregate in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/ExamDateConfig.cs`.
- [x] T036 [P] [US1] Implement `TotalScoreConfig` aggregate (with embedded `TotalScoreComponent` value object) in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/TotalScoreConfig.cs` and `TotalScoreComponent.cs`.
- [x] T037 [P] [US1] Implement `ElectronicDeclaration` aggregate in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/ElectronicDeclaration.cs`.
- [x] T038 [P] [US1] EF Core configurations for all 5 entities in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Infrastructure/Persistence/Configurations/` (one config file per entity).
- [x] T039 [US1] Register all 5 new entities on `AdmissionsDbContext` `DbSet` properties and flesh out the `009_AdmissionSetupEntities` migration body (depends on T014, T033–T038). Run `dotnet ef migrations add` to regenerate the migration, verify the snapshot.
- [x] T040a [US1] Implement `CycleStatusGuard` in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Application/Common/CycleStatusGuard.cs` — a static helper that all wizard write use-cases call before mutating: loads the cycle, throws `DomainConflictException` with code `CYCLE_NOT_DRAFT` + Arabic message `"لا يمكن تعديل دورة غير مسودة"` if `cycle.Status != CycleStatus.Draft`. Covers FR-006 gap surfaced in analyze pass.
- [x] T040 [P] [US1] CRUD use cases for `CommitteeMergeSplitRule` in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Application/MergeSplit/` — `List`, `Get`, `Create`, `Update`, `Cancel`, `Archive`, `Restore`. Each is a sealed class with `ExecuteAsync`. Audit emissions per data-model.md.
- [x] T041 [US1] Merge/split `Preview` use case in `.../MergeSplit/PreviewMergeSplitRuleUseCase.cs` — computes applicant moves and capacity changes without committing; returns `MergeSplitPreviewDto` + a deterministic `previewHash` over the change set.
- [x] T042 [US1] Merge/split `Apply` use case in `.../MergeSplit/ApplyMergeSplitRuleUseCase.cs` — opens a `CrossModuleUnitOfWork`, re-runs the preview logic, validates `confirmPreviewHash`, moves applicants atomically, flips rule to `applied`, emits `merge_rule_applied` audit. Performance: ≤ 10 s for 5 000 applicants (perf test in T053).
- [x] T043 [P] [US1] CRUD use cases for `CommitteeScoreThreshold` in `.../ScoreThresholds/` — `List`, `Get`, `Upsert` (the PUT endpoint). No soft delete (per data-model.md).
- [x] T044 [P] [US1] CRUD use cases for `ExamDateConfig` in `.../ExamDateConfigs/` — `Get`, `Upsert` (one row per cycle, no archive).
- [x] T045 [P] [US1] CRUD use cases for `TotalScoreConfig` in `.../TotalScore/` — `List` (returns per-stream list), `Get`, `Upsert` per stream.
- [x] T046 [P] [US1] CRUD use cases for `ElectronicDeclaration` in `.../ElectronicDeclaration/` — `List` (versions), `Get` (currently published), `Create` (new draft version), `Update` (only on un-published drafts), `Publish` (atomic flip with audit), `Archive` (blocked on currently-published).
- [x] T047 [P] [US1] Wizard-status use cases in `.../WizardStatus/` — `GetStatuses(cycleId)` (returns 13-row map per `AMENDMENT-001-wizard-step-count.md`), `Complete(cycleId, stepKey)`, `Reopen(cycleId, stepKey)`. Reject unknown step keys (incl. legacy `cycle_metadata` / `marital_status_rules`) with 422. Audit `wizard_step_completed` / `wizard_step_reopened`.
- [x] T047a [P] [US1] **Cross-spec hook for spec 011.** Add `POST /admin/admission-setup/cycles/{cycleId}/steps/{stepKey}/auto-promote` endpoint to `AdminWizardStatusController` (T053). Idempotent — promotes pill from `not_started` to `in_progress` for the given `(cycleId, stepKey)`; no-op if already `in_progress` or `complete`. Called by spec 011's `applicationSettings.service.ts` on first save per cycle, since the spec 005 `WizardStatusInterceptor` does NOT watch spec 011's tables (they live in a different DbContext). No audit emission (the underlying spec 011 mutation already audits).
- [x] T048 [P] [US1] Controller `AdminMergeSplitRulesController` in `backend/src/PACademy.Api/Controllers/Admin/AdmissionSetup/AdminMergeSplitRulesController.cs` — wires all 9 merge/split endpoints from contracts §1.
- [x] T049 [P] [US1] Controller `AdminCommitteeScoreThresholdsController` in `.../AdminCommitteeScoreThresholdsController.cs` — contracts §2.
- [x] T050 [P] [US1] Controller `AdminExamDateConfigController` in `.../AdminExamDateConfigController.cs` — contracts §3.
- [x] T051 [P] [US1] Controller `AdminTotalScoreConfigController` in `.../AdminTotalScoreConfigController.cs` — contracts §4.
- [x] T052 [P] [US1] Controller `AdminElectronicDeclarationController` in `.../AdminElectronicDeclarationController.cs` — contracts §5.
- [x] T053 [P] [US1] Controller `AdminWizardStatusController` in `.../AdminWizardStatusController.cs` — contracts §6.
- [x] T054 [US1] Performance test in `.../ApplyMergeSplitRulePerfTests.cs` — seed a fixture cycle with 5 000 applicants and 5 committees; assert `Apply` completes within 10 s on the dev DB.

### Frontend implementation for User Story 1

- [x] T055 [US1] Swap `frontend/src/features/admin/admission-setup/api/admission-setup.service.ts` from MOCK to real `apiClient` calls for all 5 entities. Match the contract from `contracts/admission-setup-api.md` §§1–6. Each method handles 409 by throwing `RowVersionConflictError`. The 13 `simulateLatency` calls + `MERGE_SPLIT_RULES`/`EXAM_DATE_CONFIGS`/`TOTAL_SCORE_CONFIGS`/`DECLARATIONS` in-memory arrays are removed.
- [x] T056a [US1] Update `frontend/src/features/admin/admission-setup/lib/wizard-draft.ts` reconciliation logic — when a 409 `RowVersionConflictError` is thrown, the draft store must NOT silently discard the in-flight edits; instead surface the `RowVersionConflictDialog` with a diff. Server-state wins on explicit "Refresh and re-apply" action; in-flight values are discarded only then. Covers FR-013 gap.
- [x] T056 [US1] Update `frontend/src/features/admin/admission-setup/api/admission-setup.queries.ts` — add cache keys per entity, query/mutation hooks for every contract endpoint, mutation `onSuccess` invalidations, and `onError` handling for `RowVersionConflictError` (opens `<RowVersionConflictDialog>`).
- [x] T057 [US1] Build `MergeSplitApplyDrawer` in `frontend/src/features/admin/admission-setup/components/MergeSplitApplyDrawer.tsx` — opens from the step-9 rule list when the admin clicks "تطبيق"; fetches preview; renders an impact summary + applicant-moves list (virtualised `<DataTable>` ≥ 50 rows); admin confirms; calls Apply mutation with the preview's hash; closes on success and invalidates the rule list cache.
- [x] T058 [US1] Wire the new drawer into `frontend/src/features/admin/admission-setup/pages/CommitteeMergeSplitPage.tsx` (or the step-9 page that already exists). Same for the "Mark step complete" button on every wizard page (calls `useCompleteWizardStep` mutation per `useAdmissionSetupCycle` cycleId).
- [x] T059 [US1] Update the existing `frontend/src/features/admin/admission-setup/lib/step-status.ts` to read from the new `GET /admin/admission-setup/cycles/{cycleId}/step-statuses` endpoint instead of the in-memory placeholder. The status pills on `AdmissionSetupIndexPage` reflect server state via TanStack Query.
- [x] T060a [US1] Add `useWizardWritePermission(cycleId)` hook in `frontend/src/features/admin/admission-setup/hooks/useWizardWritePermission.ts` — returns `{ canWrite: boolean, reason: string | null }`. Returns `canWrite: false` when cycle status is not `draft` (per FR-005/FR-006) or when the authenticated user lacks `admission-setup:write`. All 15 wizard step pages wrap their mutating controls in this hook and render them disabled with an Arabic tooltip when `!canWrite`. Covers FR-005 read-only UI gap.
- [x] T060 [US1] Verify TypeScript compiles, lint passes, and the 5 wizard pages render correctly when their service flips to real (run `npm --prefix frontend run typecheck && npm --prefix frontend run lint`).

**Checkpoint**: US1 fully functional — all 5 brand-new wizard entities persist end-to-end. Demoable as MVP.

---

## Phase 4: User Story 2 — The 4 mock-only services move to DB (Priority: P2)

**Goal**: The wizard steps that compose over existing services (exam-plan editor, committee management, date-committee binding, notification authoring) read from and write to the database. Refresh-cycle persists data; cross-user state is consistent.

**Independent Test**: Reorder the exam plan, add a committee, bind a date, publish a notification → close browser → return → all four persist.

### Tests for User Story 2 (REQUIRED — Constitution Principle II) ⚠️

#### Backend tests

- [x] T061 [P] [US2] Domain tests for `Committee` aggregate in `backend/tests/PACademy.Domain.Tests/Committees/CommitteeTests.cs` — `Create`, `AddMember`, `SwapChair`, `Archive`, `Restore`, `key` uniqueness within a cycle.
- [x] T062 [P] [US2] Domain tests for `CommitteeDateBinding` and `CommitteeMember` in the same project.
- [x] T063 [P] [US2] Domain tests for `NotificationTemplate` in `backend/tests/PACademy.Domain.Tests/Notifications/NotificationTemplateTests.cs` — publish atomically marks `is_published=true`; un-publish reverses it; archive blocked when published.
- [x] T064 [P] [US2] Domain tests for `CycleExam` in `backend/tests/PACademy.Domain.Tests/Admissions/CycleExamTests.cs` — order reassignment, optional/required flag, fee ≥ 0.
- [x] T065 [P] [US2] HTTP integration tests for committees endpoints in `.../Committees/CommitteesIntegrationTests.cs` (contracts §9).
- [x] T066 [P] [US2] HTTP integration tests for date-bindings in `.../Committees/DateBindingsIntegrationTests.cs` (contracts §10).
- [x] T067 [P] [US2] HTTP integration tests for notification-templates in `.../Notifications/NotificationTemplatesIntegrationTests.cs` (contracts §11).
- [x] T068 [P] [US2] HTTP integration tests for cycle-exam plan in `.../AdmissionSetup/CycleExamPlanIntegrationTests.cs` (contracts §8) — including the `/reorder` endpoint.
- [x] T069 [P] [US2] Architecture test `CommitteesModuleHasNoSiblingDomainReferences` in `backend/tests/PACademy.Architecture.Tests/CommitteesModuleTests.cs` (NetArchTest) — Committees may reference `Shared.Contracts` + `Admissions.Public` only.
- [x] T070 [P] [US2] Architecture test for Notifications module in `.../NotificationsModuleTests.cs`.

#### Frontend tests

- [ ] T071 [P] [US2] Service-layer tests in `frontend/src/features/committees/api/committee.service.test.ts` — MSW-stubbed handlers verify each method (`list`, `get`, `create`, `update`, `archive`, `restore`, `addMember`, `removeMember`) and 409 propagation.
- [ ] T072 [P] [US2] Service tests in `frontend/src/features/admin/api/examPlans.service.test.ts` — same shape, against contracts §8.
- [ ] T073 [P] [US2] Service tests in `frontend/src/features/admin/api/notifications.service.test.ts` — contracts §11.
- [ ] T074 [P] [US2] Playwright E2E `frontend/e2e/admission-setup-p2.spec.ts` — reorder exam plan → committee creation → date binding → notification publish → refresh → all four persist.

### Backend implementation for User Story 2

#### Committees module

- [x] T075 [P] [US2] Implement Committees `Public` API contract `ICommitteeApi` in `backend/src/Modules/Committees/PACademy.Modules.Committees.Public/ICommitteeApi.cs` — exposed to Admissions module so score-thresholds and merge-split-rules can reference committee data without crossing module boundaries.
- [x] T076 [US2] Implement `Committee`, `CommitteeMember`, `CommitteeDateBinding`, `CommitteeStatus` enum in the Domain project per data-model.md.
- [x] T077 [US2] Implement `CommitteesDbContext` + entity configurations + `__EFMigrationsHistory_Committees` per spec 005 FR-X01 pattern. Migration `009_CommitteesInitial`.
- [x] T078 [P] [US2] CRUD use cases for `Committee` in `backend/src/Modules/Committees/PACademy.Modules.Committees.Application/Committees/` (`List`, `Get`, `Create`, `Update`, `Archive`, `Restore`).
- [x] T079 [P] [US2] Member-management use cases in `.../Members/` (`Add`, `Remove`, `SwapChair`).
- [x] T080 [P] [US2] Date-binding use cases in `.../DateBindings/` (`List`, `Upsert`, `Remove`).
- [x] T081 [US2] Wire `CommitteesModule.cs` per the existing modular DI pattern (per spec 005).
- [x] T082 [P] [US2] Controller `AdminCommitteesController` in `backend/src/PACademy.Api/Controllers/Admin/AdminCommitteesController.cs` — contracts §9.
- [x] T083 [P] [US2] Controller `AdminCommitteeDateBindingsController` in `backend/src/PACademy.Api/Controllers/Admin/AdminCommitteeDateBindingsController.cs` — contracts §10.

#### Notifications module

- [x] T084 [US2] Implement `NotificationTemplate` aggregate + `NotificationTriggerEvent` enum in `backend/src/Modules/Notifications/PACademy.Modules.Notifications.Domain/`.
- [x] T085 [US2] Implement `NotificationsDbContext` + configurations + migration `009_NotificationsInitial`. Defer `notification_deliveries` per data-model.md note.
- [x] T086 [P] [US2] CRUD + publish use cases in `backend/src/Modules/Notifications/PACademy.Modules.Notifications.Application/Templates/`.
- [x] T087 [US2] Wire `NotificationsModule.cs` per the modular DI pattern.
- [x] T088 [P] [US2] Controller `AdminNotificationTemplatesController` in `.../Admin/AdminNotificationTemplatesController.cs` — contracts §11.

#### Cycle-exam plan (Admissions extension)

- [x] T089 [US2] Implement `CycleExam` aggregate in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Domain/CycleExam.cs` per data-model.md.
- [x] T090 [US2] Extend `009_AdmissionSetupEntities` migration to include `cycle_exams` table (or generate a new `009b_CycleExamPlan` migration if cleaner). Update `AdmissionsDbContext`.
- [x] T091 [P] [US2] CRUD use cases in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Application/CycleExams/` including the `Reorder` operation that reassigns `order` to 10, 20, 30, ….
- [x] T092 [P] [US2] Controller `AdminCycleExamsController` in `backend/src/PACademy.Api/Controllers/Admin/AdminCycleExamsController.cs` — contracts §8.

### Frontend implementation for User Story 2

- [x] T093 [US2] Swap `frontend/src/features/committees/api/committee.service.ts` from MOCK to real `apiClient`. Match contracts §9. Audit emissions stay in place via existing `emitAudit` calls but switch to `'committees'` module. ⚠️ This service is also consumed by `board`, `investigations`, `biometric`, `barcode`, and `admin` features — verify each consumer still typechecks and renders.
- [x] T094 [US2] Update `frontend/src/features/committees/api/committee.queries.ts` cache keys + invalidations to match the new endpoints.
- [x] T095 [US2] Swap `frontend/src/features/admin/api/examPlans.service.ts` from MOCK to real `apiClient` for the cycle-exam plan endpoints (contracts §8).
- [x] T096 [US2] Swap `frontend/src/features/admin/api/notifications.service.ts` from MOCK to real `apiClient` (contracts §11).
- [x] T097 [US2] Add date-binding service methods to `committee.service.ts` (the per-date capacity for step 12) — new endpoints from contracts §10.
- [x] T098 [US2] Update wizard step 12 page (`DateCommitteeBindingPage.tsx`) to use the new endpoints. Verify the existing UI works with persistent state on reload.

**Checkpoint**: US2 fully functional — all four previously-mock services persist data end-to-end. Wizard's exams, committees, date bindings, and notifications all survive reloads.

---

## Phase 5: User Story 3 — Cycles + Categories finish their persistence story (Priority: P3)

**Goal**: Every field on the first six wizard steps reads and writes through the API. No partial-wiring gaps remain.

**Independent Test**: Edit every field on each of steps 1–6 → refresh → all fields persist. Run a query against the audit log to verify each save emitted an entry.

### Tests for User Story 3 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T099 [P] [US3] Gap-audit script in `backend/tests/PACademy.Api.Tests/Audit/CycleEndpointsCoverageTests.cs` — verify every `Cycle` field exposed in `CycleDto` has a corresponding POST/PATCH path that persists it. Compare the DB column set to the controller surface.
- [ ] T100 [P] [US3] Equivalent for `Category` in `.../CategoryEndpointsCoverageTests.cs`.
- [ ] T101 [P] [US3] Frontend service-layer tests covering the gaps once identified — `cycles.service.test.ts` and `categories.service.test.ts` adding cases for each newly-wired field (e.g., Fawry config sub-fields, fee tiers).
- [ ] T102 [P] [US3] Playwright E2E `frontend/e2e/admission-setup-p3.spec.ts` — exercise steps 1–6 with a representative edit on each, refresh, assert all persist.

### Implementation for User Story 3

- [x] T103 [US3] Run the gap-audit (T099, T100) and produce a list of missing endpoints / fields. Track output in `specs/009-admission-setup-persistence/research.md` as a new "P3 gap inventory" section appended. *Resolution (2026-05-17): five gaps catalogued — P3-1 (RowVersion exposure), P3-2 (cycles+categories mock-to-real), P3-3 (FawryConfigCard orphan), P3-4 (CategoryConditionBuilder), P3-5 (CreateCategoryRequest.IsActive defer). See "P3 gap inventory" section in research.md.*
- [ ] T104 [US3] For each gap on the backend, add the missing use case + controller method. Group commits by Cycle vs Category — at most one new controller method per task.
- [ ] T105 [US3] For each gap on the frontend, finish the service-layer migration (replace any remaining `simulateLatency` / `MOCK.*` reads with `apiClient` calls).
- [x] T106 [P] [US3] Update the FawryConfigCard component if its persistence path was incomplete — verify saves round-trip through the cycle endpoints. *Resolution (2026-05-17, gap P3-3): the component was orphaned with zero importers — deleted. Two stale fawry gates (fees step-status completion check + activation pre-flight issue) were also dropped since nothing in the wizard authors `fawryConfig` anymore. `FawryConfig` type + seed + read-only Stage 6 consumer preserved.*
- [x] T107 [P] [US3] Update the CategoryConditionBuilder component if any rule-type writes weren't persisted (age / marital / score / education conditions). *Resolution (2026-05-17, gap P3-4): the wire path is a pure JSON-blob passthrough — `UpdateCategoryRequest.Conditions` (JsonElement?) → `request.Conditions?.GetRawText()` → `Category.ConditionsJson` (nvarchar(max)) → `JsonDocument.Parse(...).RootElement` on read. Verified end-to-end with a live PATCH+GET round-trip on `officers_general`: every rule type (gender, age range, ageCalcDate, education types, graduation year, marital statuses, min score, required documents, required exams, exam order) and Arabic strings (byte-level UTF-8 verified, e.g. `D8 B4 D9 87 D8 A7 D8 AF D8 A9` for «شهادة» found at expected offset). **Caveat**: `CategoryConditionBuilder` and `useUpdateExpandedConditions` are orphaned (zero importers); `CategoryEditPage` only sends labelAr + description today. Path is infrastructure-ready; future UI wiring is a 5-line page change.*

**Checkpoint**: US3 fully functional — steps 1–6 have no in-memory state. Audit confirms every save emits an entry.

---

## Phase 6: User Story 4 — Cross-cycle copy (Priority: P4)

**Goal**: An admin creates a new draft cycle and clones the wizard configuration of any prior cycle as a starting point. Identity-bound fields reset; references remap by key/name; broken references flagged.

**Independent Test**: Per spec.md Story 4 Acceptance — create a draft cycle, copy from a prior fully-configured cycle, all 13 steps populate (step 1 `application_settings` is global per spec 011 — not cloned; the orchestrator only marks step 1's pill as `in_progress`), identity fields blank, broken refs flagged.

### Tests for User Story 4 (REQUIRED — Constitution Principle II) ⚠️

- [ ] T108 [P] [US4] Use-case unit tests for `CycleCloneRemapper` in `backend/tests/PACademy.Application.Tests/CrossCycleCopy/CycleCloneRemapperTests.cs` — every wizard table maps; cross-entity refs resolved by key match; missing references produce `CloneBrokenReference` rows.
- [ ] T109 [P] [US4] HTTP integration test in `backend/tests/PACademy.Api.Tests/CrossCycleCopy/CrossCycleCopyIntegrationTests.cs` — seed a fully-configured source cycle and an empty draft target → POST clone → assert all 12 wizard tables copy with remapped ids → source cycle untouched → audit entry `cycle_cloned` present.
- [ ] T110 [P] [US4] Atomicity test in the same file — inject a deterministic failure mid-clone → entire transaction rolls back → target cycle remains empty.
- [ ] T111 [P] [US4] `CopyFromCycleDrawer` component test in `frontend/src/features/admin/admission-setup/components/CopyFromCycleDrawer.test.tsx` — render smoke, picks a source cycle, calls mutation, displays summary; axe assertion.
- [ ] T112 [P] [US4] Playwright E2E `frontend/e2e/admission-setup-p4.spec.ts` — clone from a fixture cycle → verify the new cycle is populated → verify a broken-reference indicator on at least one row that doesn't exist in the target catalogue.

### Implementation for User Story 4

- [ ] T113 [US4] Implement `CycleCloneRemapper` service in `backend/src/Modules/Admissions/PACademy.Modules.Admissions.Application/CrossCycleCopy/CycleCloneRemapper.cs` — knows every wizard table; reads source rows; remaps `cycle_id` and cross-entity refs (committee key, exam_type key, lookup key, category key); emits `CloneBrokenReference` for unresolvable refs.
- [ ] T114 [US4] Implement `CloneCycleFromUseCase` in `.../CrossCycleCopy/CloneCycleFromUseCase.cs` — opens `CrossModuleUnitOfWork`, validates target is `draft`, runs remapper, inserts into target, emits `cycle_cloned` audit, commits.
- [ ] T115 [US4] Controller `AdminCrossCycleCopyController` in `backend/src/PACademy.Api/Controllers/Admin/AdmissionSetup/AdminCrossCycleCopyController.cs` — contracts §7.
- [ ] T116 [US4] Add service methods to `admission-setup.service.ts` for the clone operation (`cloneFromCycle(targetId, sourceId, opts)`).
- [ ] T117 [US4] Add cache keys + mutation hook in `frontend/src/features/admin/admission-setup/api/cross-cycle-copy.queries.ts` (new file).
- [ ] T118 [US4] Build `CopyFromCycleDrawer` in `frontend/src/features/admin/admission-setup/components/CopyFromCycleDrawer.tsx` — opens from the `AdmissionSetupIndexPage`; lists prior cycles via `useCyclesList`; admin picks one → confirm dialog if target non-empty → runs mutation → shows summary with broken-references list and an "open broken refs" deep-link to the relevant wizard steps.
- [ ] T119 [US4] Wire the drawer into `frontend/src/features/admin/admission-setup/pages/AdmissionSetupIndexPage.tsx` — a "نسخ من دورة سابقة" button next to the existing actions, visible only when the cycle is in `draft` status.

**Checkpoint**: US4 fully functional — admins can clone prior cycles' wizard configurations into new draft cycles.

---

## Phase 7: Polish & Cross-cutting

**Purpose**: Coverage gates, bundle budget check, performance verification, accessibility audit, quickstart walkthrough validation. Runs after all four user stories are in.

- [ ] T120 [P] Coverage gate verification: `npm --prefix frontend run test -- --coverage` must hit ≥ 80% statements / ≥ 75% branches; 100% on the new service files (admission-setup, committee, examPlans, notifications) and on `import-runner`-equivalent transactional code paths.
- [ ] T121 [P] Backend coverage: `dotnet test backend/PACademy.sln --collect:"XPlat Code Coverage"` must hit equivalent budgets on the new use cases. Apply + CloneCycleFrom must be at 100% line + branch.
- [ ] T122 [P] Bundle-budget check: verify no per-route bundle exceeds 250 KB gzipped after this feature. Since the feature is service-layer migration + 2 new drawers, the increment should be ≤ 20 KB total.
- [ ] T123 [P] Performance verification: re-run the wizard-step page load measurements (SC-007 ≤ 2 s, SC-008 ≤ 500 ms) and the apply / clone benchmarks (SC-010 / SC-011) against the integrated stack. Record numbers in `specs/009-admission-setup-persistence/research.md` under a new "Phase 7 perf results" appendix.
- [ ] T124 [P] Run jest-axe on every new component (`MergeSplitApplyDrawer`, `CopyFromCycleDrawer`, `RowVersionConflictDialog`) and confirm zero violations.
- [ ] T125 [P] Walk through `quickstart.md` end-to-end as a non-author and fix any step that doesn't work verbatim.
- [ ] T126 [P] Architecture tests: extend `backend/tests/PACademy.Architecture.Tests/SolutionStructureTests.cs` to assert the new Committees and Notifications modules respect FR-M02 (only reference `Shared.Contracts` + siblings' `*.Public`).
- [ ] T127 [P] Migration parity tests in `backend/tests/PACademy.Api.Tests/Seeding/SeedParityTests.cs` — confirm `DemoDataSeeder` populates the 12 new tables with seed data for the demo cycle, idempotently.
- [ ] T128 Refresh `CLAUDE.md` with a one-paragraph entry under §11 ("What's done · what's next") summarising spec 009: 2 new modules, 12 new tables, ~50 new endpoints, 4 service migrations, optimistic-locking rolled out across all wizard entities. Update §14 spec index to include `specs/009-admission-setup-persistence/`.

**Checkpoint**: All four user stories deliver. All success criteria measured. Constitution principles re-verified. Ready for `/speckit.implement`.

---

## Dependencies (high-level)

```text
Phase 1 (Setup) ── blocks ─→ Phase 2 (Foundational)
Phase 2 (Foundational) ── blocks ─→ Phases 3, 4, 5, 6

Within Phase 3 (US1):
  T018–T032 (tests) ── before ─→ T033–T060 (impl)
  T033–T038 (5 domain entities) [P]
  T039 ── after ─→ T033–T038 (migration depends on entities)
  T040–T047 (use cases) [P after T039]
  T048–T053 (controllers) [P after T040–T047]
  T055 ── after ─→ T040–T053 (frontend service swap depends on backend ready)

Within Phase 4 (US2):
  Committees module (T075–T083) parallel to
  Notifications module (T084–T088) parallel to
  Cycle-exam plan (T089–T092)
  All three ── before ─→ T093–T098 (frontend swaps)

Phase 7 ── after ─→ Phases 3, 4, 5, 6 complete
```

## Suggested commit cadence

- One commit per task (or per closely-related task pair where files overlap).
- One commit closing each phase, summarising scope and any deferred items.
- A pre-merge squash is optional but PRs should keep the test-first ordering visible in the history for review.

---

**Total tasks**: 128
**Estimated effort**: 4–6 weeks (single developer at sustainable pace) or 2–3 weeks (parallel developer team if the `[P]` markers are honoured).
