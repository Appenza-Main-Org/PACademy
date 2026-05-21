# Admin Finalization Phase 0 Audit

**Date:** 2026-05-21  
**Scope:** `/admin/*` pages only, RBAC surface, admin backend target `backend/admin` on `:5101`  
**Gate:** Phase 0 only. No backend/frontend implementation was performed.

## Executive Findings

- **Local backend reality:** this checkout has only `backend/.gitkeep`; `backend/admin/README.md`, `backend/applicant/README.md`, and `/Users/mac/.claude/plans/foamy-watching-map.md` are missing locally. The attached `Backend-STATUS` says Faculties exists on another backend `main`, but there is no local `backend/admin` code to build from yet.
- **Live demo reachable:** `https://admin.appenzademo.com/staff-login` loaded as `super_admin` and `/admin` + most routes render inside `AdminLayout`.
- **Backend state:** locally everything is 🟥 missing. If reconciling the external backend status, only Faculties is ✅ in the external handoff; all other modules remain target work.
- **Frontend admin services still contain mock fallback:** every admin service inspected still has `simulateLatency()` and/or `MOCK.*` fallback paths. Some methods already call `apiClient` behind `isBackendEnabled()`, but Phase 2 must remove admin mock reads entirely.
- **Route gaps:** `/admin/admission-rules` and `/admin/lookups/mappings/:kind` are listed in the requested scope but are not registered in `frontend/src/routes.tsx`; live hits fell through to the public landing page. `/admin/categories/new` intentionally redirects to `/admin/categories`.
- **RBAC gap:** `/admin` is guarded only by `<AuthGuard app="admin">` at `frontend/src/routes.tsx:207-208`; `/admin/users/roles`, `/admin/audit`, and `/admin/settings` are not route-level permission-gated. Some page-level checks exist, but the prompt asks for stricter route props.
- **Cloud matrix gap:** `cloudPermissions.ts` is correctly closed to `admin` + `applicant`, but it has no rows for audit, settings, workflows, reports export, admission rules, applicant grades, committees exam config, or lookups mapping actions.

## Docs Read / Missing

| Required item | Result |
|---|---|
| `Backend-STATUS.md` | Read from `/Users/mac/Downloads/Backend-STATUS (1).md`; local repo file not present. |
| `backend/admin/README.md` | Missing locally. |
| `backend/applicant/README.md` | Missing locally. |
| `/Users/mac/.claude/plans/foamy-watching-map.md` | Missing locally. |
| `AGENTS.md`, `CLAUDE.md` | Present; backend context was previously updated. |
| `docs/INTEGRATION_HANDOFF.md` | Present; service inventory and conflict envelope reviewed. |
| `docs/DB_CONSTRAINTS.md` | Present; typed conflict codes reviewed. |
| `rbac.ts`, `cloudPermissions.ts`, `routes.tsx`, `routes.ts` | Present; reviewed. |

## Live Route Audit

Live snapshots were taken from the deployed demo as `super_admin`. `headings` are the first visible DOM headings captured.

| Route | Frontend state | Live finding |
|---|---|---|
| `/admin` | complete | Renders reports command center; headings include `لوحة قيادة منظومة القبول`. |
| `/admin/reports` | complete | Same command center; 12-section report surface visible. |
| `/admin/applicants` | complete | Renders `إدارة المتقدمين`. |
| `/admin/applicants/new` | complete | Renders `إضافة متقدم جديد` with identity/address/contact/category sections. |
| `/admin/applicants/:id` | partial | Route exists; needs valid seeded id for live detail. |
| `/admin/applicants/:id/edit` | partial | Route exists; needs valid seeded id for live edit. |
| `/admin/applicant-grades` | partial | Renders `درجات الثانوية العامة والأزهرية`; live state showed empty imported grades. |
| `/admin/users` | complete | Renders `مستخدمو المنظومة`. |
| `/admin/users/new` | complete | Renders `إنشاء حساب مستخدم` + NID verification step. |
| `/admin/users/roles` | complete | Renders `إدارة الأدوار والصلاحيات`; lacks route-level stricter guard. |
| `/admin/users/:id` | partial | Route exists; needs valid seeded user id for live detail. |
| `/admin/users/:id/edit` | partial | Route exists; needs valid seeded user id for live edit. |
| `/admin/audit` | complete | Renders `سجل النشاط`; lacks route-level stricter guard. |
| `/admin/settings` | complete | Renders `الإعدادات العامة`, test settings, lock policy, locked users; lacks route-level stricter guard. |
| `/admin/notifications` | complete | Renders `إدارة الإشعارات`. |
| `/admin/payments` | broken in live batch | Browser snapshot returned no `main` and error marker. Static route exists at `routes.tsx:221`; inspect during Phase 2. |
| `/admin/lookups` | partial | Renders `الأكواد المرجعية`; live snapshot contained an error marker, likely from text/content matching or lookup row state. Needs deeper check. |
| `/admin/lookups/:typeCode` | partial | `/admin/lookups/faculties` renders `الكليات`; mock read still present in service. |
| `/admin/lookups/mappings/:kind` | broken/unregistered | Not in `routes.tsx`; live hit fell through to public landing. |
| `/admin/admission-rules` | broken/unregistered | `AdmissionRulesPage` exists, but route is not registered; live hit fell through to public landing. |
| `/admin/admission-setup` | redirect/partial | Legacy route redirects to `/admin/cycles/admission-setup`; live rendered setup empty state. |
| `/admin/cycles/admission-setup` | partial | Renders setup index; live showed no active cycle empty state. |
| `/admin/cycles/admission-setup/wizard/:stepKey` | complete | `application_settings` rendered category settings cards. |
| `/admin/cycles/admission-setup/application-settings` | complete | Renders application settings page. |
| `/admin/cycles/admission-setup/fees` | complete | Renders `الرسوم المالية`. |
| `/admin/cycles/admission-setup/exams` | partial | Renders `إدارة الاختبارات`; live showed a prerequisite empty state. |
| `/admin/cycles/admission-setup/committees` | redirect/complete | Redirects to `/admin/committees-exam-config`; target renders committee instance management. |
| `/admin/cycles/admission-setup/electronic-declaration` | complete | Renders `الإقرار الإلكتروني`. |
| `/admin/cycles` | complete | Renders `دورات القبول وإعداد التقديم`. |
| `/admin/cycles/new` | complete | Renders `دورة جديدة`. |
| `/admin/cycles/:id` | partial | Route exists; `/admin/cycles/2026` showed `الدورة غير موجودة`; use actual seeded ids. |
| `/admin/categories` | complete | Renders `إدارة فئات التقديم`. |
| `/admin/categories/new` | redirect | Intentionally redirects to locked 4-category list (`routes.tsx:247`). |
| `/admin/categories/:key` | complete | `/admin/categories/officers_general` renders `تعديل فئة`. |
| `/admin/workflows` | complete | Renders `إعدادات سير العمل`. |
| `/admin/workflows/new` | complete | Renders `سير عمل جديد` + stages editor. |
| `/admin/workflows/:id` | partial | Route exists; `/admin/workflows/wf-initial-review` showed `لم يتم تحميل سير العمل`, likely id mismatch with seed. |
| `/admin/committees-exam-config` | complete | Renders day-grouped committee instance management. |

## Backend Target Map

| Admin surface | Frontend service(s) | Target backend module | Backend state |
|---|---|---|---|
| Auth/RBAC, lock policy | `features/auth/api/auth.service.ts` | `backend/admin/Modules/Identity` | 🟥 missing locally |
| `/admin/users*`, `/roles` | `features/admin/api/users.service.ts`, `roles.service.ts` | `UsersAdmin` / `Identity` | 🟥 missing locally |
| `/admin/settings` | `settings.service.ts`, auth lock-policy methods | `SettingsAdmin` + `Identity` | 🟥 missing locally |
| `/admin/cycles*` | `cycles.service.ts` | `AdmissionsAdmin` | 🟥 missing locally |
| `/admin/categories*` | `categories.service.ts`, lookups category rows | `AdmissionsAdmin` / `LookupsAdmin` | 🟥 missing locally |
| `/admin/lookups*` | `lookups.service.ts` | `LookupsAdmin` | 🟥 local; external handoff says Faculties only ✅ |
| `/admin/admission-setup*` | `admission-setup.service.ts`, `applicationSettings.service.ts`, `examSchedule.service.ts`, `committeeBinding.service.ts`, `examPlans.service.ts` | `AdmissionsAdmin` | 🟥 missing locally |
| `/admin/admission-rules` | `admissionRules.service.ts` | `AdmissionsAdmin` | 🟥 missing locally; frontend route missing |
| `/admin/applicants*` | `features/applicants/api/applicant.service.ts` | `ApplicantsAdmin` | 🟥 missing locally |
| `/admin/applicant-grades*` | `features/applicant-grades/api/grades.service.ts` | `ApplicantGradesAdmin` | 🟥 missing locally |
| `/admin/committees-exam-config` | `features/committees/api/committeeInstance.service.ts` | `CommitteesExamConfigAdmin` | 🟥 missing locally |
| `/admin/workflows*` | `workflows.service.ts` | `WorkflowsAdmin` | 🟥 missing locally |
| `/admin/reports`, `/admin` | `reports.service.ts`, applicant/audit/committee data | `Reports` | 🟥 missing locally |
| `/admin/audit` | `features/audit/api/audit.service.ts` | `Audit` + shared audit wiring | 🟥 missing locally |
| `/admin/notifications` | `notifications.service.ts` | `NotificationsAdmin` | 🟥 missing locally |
| `/admin/payments` | `payments.service.ts` | `PaymentsAdmin` | 🟥 missing locally |

## Service Contracts And Mock Logic To Port

### Auth / RBAC

- Service: `frontend/src/features/auth/api/auth.service.ts`.
- Methods: `login:157`, `requestOtp:200`, `verifyOtp:273`, `logout:351`, `me:359`, `getLockPolicy:369`, `updateLockPolicy:377`, `getLockedUsers:400`, `lookupOfficer:418`, `unlockUser:434`.
- Mock logic to port: role-derived user construction from `MOCK.roleDefinitions` and `MOCK.users` (`auth.service.ts:105-122`), OTP pending/session flow, account inactive/locked audit emissions (`auth.service.ts:169-246`, `273-339`), lock policy update/unlock audit (`377-443`).
- Mock reads remaining: `MOCK.*` count 9; `simulateLatency()` count 10. Phase 2/Identity must remove these for staff/admin.
- Seed source: `frontend/src/shared/mock-data/index.ts` `MOCK.users` export around `1092+`, `frontend/src/shared/mock-data/roles.ts:39-94`, officer directory in `frontend/src/shared/mock-data/officers.ts:30+`.

### Users / Roles / Cloud Matrix

- Services: `users.service.ts`, `roles.service.ts`.
- User methods: `list:101`, `getById:109`, `create:124`, `update:176`, `setAccountStatus:260`, `deactivate:330`, `reset2fa:337`, `bulkAssign:346`, `getActivity:380`, `setStatus:393`, `bulkImport:432`, `createFromTemplate:485`.
- Role methods: `list:33`, `getById:41`, `create:49`, `update:78`, `getDependencies:115`, `softDelete:126`, `restore:150`.
- Mock logic to port: NID/officer-derived create, `withAudit`/`emitAudit` mutations, account status transitions, bulk import row validation, role dependency count from assigned users (`roles.service.ts:115-126`).
- Mock reads remaining: users `MOCK.*` count 2 and `simulateLatency()` count 11; roles `MOCK.*` count 2 and `simulateLatency()` count 7.
- RBAC: `rbac.ts` has 11 roles (`frontend/src/features/auth/rbac.ts:8-20`); permission union only types `admission-setup:read/write` plus `*` (`rbac.ts:28-31`) while pages use many string permissions. `cloudPermissions.ts` is closed to admin/applicant, but missing rows for some admin surfaces.
- Seed source: `MOCK.users`, `MOCK.userActivity`, `MOCK.roleDefinitions`.

### Lookups

- Service: `frontend/src/features/lookups/api/lookups.service.ts`.
- Contract: `GET/POST/PATCH/DELETE /api/lookups/:key` (`lookups.service.ts:4-8`).
- Methods: `listLookup:157`, `createLookupRow:165`, `updateLookupRow:184`, `deleteLookupRow:209`, sync `getRow:223`, `readLookup:232`.
- Mock logic to port: next code generation from `LOOKUP_META` (`55-68`), duplicate code conflict `DUPLICATE_CODE` (`70-74`), FK/delete guards for relationships, jobs, governorates, faculties, applicant-categories, submission-types, applicant-divisions (`84-151`).
- Mock reads remaining: `MOCK.lookups` state init at `37-42`; fallback `simulateLatency()` at `161`, `172`, `195`, `213`.
- Typed lookup count mismatch: `Backend-STATUS` says 24 lookups; current `LOOKUP_KEYS` has 25 keys (`frontend/src/features/lookups/types.ts:18-44`). Backend seed plan must reconcile by copying the current frontend list.
- Seed source: `frontend/src/features/lookups/mock/lookups.mock.ts:140-1028`; aggregate `LOOKUPS_SEED` at `1011+`; applicant categories at `395-530`; faculties at `169-188`.

### Cycles / Categories / Admission Rules

- Services: `cycles.service.ts`, `categories.service.ts`, `admissionRules.service.ts`.
- Cycle methods: `list:211`, `getById:220`, `getActive:228`, `create:251`, `updateStatus:324`, `update:389`, `clone:406`, `setActive:437`, `transition:478`, `activate:498`, `swapActive:559`, `close:620`, `extend:648`, `archive:682`, `remove:705`, `toggleCategory:718`, `updateCategoryOverride:759`, `getDependencies:797`, `softDelete:817`, `restore:844`.
- Category methods: `list:61`, `getByKey:69`, `update:77`, `getDependencies:107`, `softDelete:130`, `previewRuleChangeImpact:152`, `updateExpandedConditions:215`, `restore:254`.
- Admission rule methods: `listForCycle:21`, `getCurrent:30`, `save:41`.
- Mock logic to port: one-active-cycle checks `ACTIVE_CYCLE_EXISTS` (`cycles.service.ts:272`, `349`, `510`, `571`), activation prerequisite conflicts (`521`), dependency counts from applicants/committees (`797-826`), category derived dependency counts (`categories.service.ts:107-130`), category rule impact preview over applicants (`152-212`), audit emissions on all cycle/category mutations.
- Seed source: cycles/rules in `frontend/src/shared/mock-data/admissionCycles.ts:23-190`; categories derived from `LOOKUPS_SEED['applicant-categories']` in `frontend/src/shared/mock-data/index.ts:1128-1130`.

### Admission Setup / Exam Plans

- Services: `admission-setup.service.ts`, `applicationSettings.service.ts`, `examSchedule.service.ts`, `committeeBinding.service.ts`, `examPlans.service.ts`.
- Admission setup methods: exam date config `79/87`, declaration `142/152/226`, committee bindings `258/266/290`.
- Application settings methods: configs/specs/years/summary `289-443`, attach/detach/create/update/delete/toggle/bulk-save `458-677`.
- Exam schedule methods: `listDays:151`, `aggregateForCycle:178`, `generateBulk:195`, `addDay:259`, `updateDay:304`, `deleteDay:345`, `toggleOff:358`, `clearRange:382`, `copyFromCategory:420`.
- Committee binding methods: `list:297`, `create:331`, `update:360`, `delete:390`, `toggleActive:402`, `bulkSetEligibility:432`, `copyRow:528`, `copyColumn:599`.
- Exam plan methods: `listExams:53`, `listForCycle:61`, `getPlan:69`, `savePlan:84`, `copyConfig:138`, `canEnterResult:181`, `transitionResultStatus:205`, `manualEntry:240`, `bulkUpload:257`, `deviceIntegration:272`.
- Mock logic to port: grading-mode mismatch and year conflicts (`applicationSettings.service.ts:472-526`, `549-555`, `604`, `673-677`), exam date window/category active conflicts (`examSchedule.service.ts:83-119`, `281`, `327`), committee day binding invariants (`committeeBinding.service.ts:77-174`), exam order duplicate rule (`examPlans.service.ts:81-121`).
- Typed errors: `SPECIALIZATION_NOT_MAPPED`, `CATEGORY_HAS_ACTIVE_YEARS`, `DUPLICATE_DATE`, `DATE_OUT_OF_CYCLE_WINDOW`, `INVALID_DATE_RANGE`, `CATEGORY_NOT_ACTIVE`, `DUPLICATE_BINDING`, `CAPACITY_NOT_POSITIVE`, `GRADE_RANGE_INVERTED`, `PERCENTAGE_OUT_OF_RANGE`, `TAGDIR_GRADE_NOT_FOUND`, `MODE_MISMATCH`, `DAY_NOT_WORKING`, `COMMITTEE_WRONG_CATEGORY`, `EXAM_ORDER_DUPLICATE`.
- Seed sources: `frontend/src/shared/mock-data/academyExams.ts:10-38`, `committeeInstances.ts:44+`, `categoryCommittees.ts:15+`, `frontend/src/features/admin/admission-setup/mock/*`.

### Applicants

- Service: `frontend/src/features/applicants/api/applicant.service.ts`.
- Methods: list/detail/stats/timeline/distribution/collision/create/update/transition/progress/transitions/workflow/audit at `330-624`.
- Mock logic to port: list filters + pagination (`337-349`), NID collision (`427-435`), generated id/file number from active cycle year (`440-454`), workflow progress creation on create (`467-471`), diff/audit timeline emissions (`65-103`, `484-577`), status transition event writes.
- Typed errors: planned `NID_CYCLE_DUPLICATE` per `docs/INTEGRATION_HANDOFF.md:88` and `docs/DB_CONSTRAINTS.md:43`.
- Seed source: generated 240 applicants in `frontend/src/shared/mock-data/index.ts:141-238`, exported at `1092+`; workflow progress/transitions in `frontend/src/shared/mock-data/workflows.ts:246-297`.

### Applicant Grades

- Service: `frontend/src/features/applicant-grades/api/grades.service.ts`.
- Methods: `list:155`, `findByNationalId:178`, `clearAll:196`, `deleteRows:206`, adjustments `218/257/281/305`, import `337/424/538/658`, paginated/export `965/1005`.
- Mock logic to port: per-extension import preflight and commit validation, school category and exam round lookup resolution (`131-146`), duplicate/changed-row grouping, overrides/adjustments, paginated filters/sorts (`950-986`), export format (`1000-1021`).
- Seed source: grade rows are staged/imported; lookup deps from `LOOKUPS_SEED['school-categories']`, `LOOKUPS_SEED['exam-rounds']`; MOI demo grades in `moi-session.mock.ts:343+`.

### Committee Exam Config

- Service: `frontend/src/features/committees/api/committeeInstance.service.ts`.
- Methods: `list:192`, `addMany:207`, `update:266`, `refreshReservedCounts:340`, `remove:359`, `removeDay:393`, `transferDay:464`, `transferOne:660`.
- Mock logic to port: duplicate committee/date/category checks (`54-92`, `216-223`, `292-300`), reservation-over-capacity checks (`122`, `441-464`, `531-572`, `702-719`), day transfer atomicity and capacity override, audit emissions on add/update/remove/transfer.
- Typed errors: `COMMITTEE_INSTANCE_DUPLICATE`, `RESERVATIONS_OVER_DESTINATION_CAPACITY`.
- Seed source: `frontend/src/shared/mock-data/committeeInstances.ts:44+`.

### Workflows

- Service: `frontend/src/features/admin/api/workflows.service.ts`.
- Methods: `list:89`, `getById:97`, `getByDepartment:105`, `create:113`, `save:141`, `reorderStages:169`, `apply:194`, `remove:225`.
- Mock logic to port: live mutable `MOCK.workflows` (`29-34`), stage rekeying (`84`), audit rows (`54-66`), applicant progress/transitions writes (`212-254`).
- Seed source: `frontend/src/shared/mock-data/workflows.ts:246-297`.

### Reports

- Service: `frontend/src/features/admin/api/reports.service.ts`.
- Methods: `getCycleSnapshot:213`, `getStageFunnel:292`, `getDepartmentReport:336`, `getTestResultsReport:399`, `getOperationalStatus:462`, `getGovernanceReport:529`, `getIntegrationStatus:583`.
- Mock logic to port: aggregate active-cycle/applicant/category counts (`129-249`, `292-365`), test result pass rates and heatmap from applicants (`399-443`), committee/medical/board/exam operational cards (`462-510`), governance/anomaly report from audit (`529-556`), static integration status list (`583-588`).
- Seed source: derived from applicants, cycles, categories, committees, audit, medical stations, board sessions, live exams.

### Audit / Notifications / Payments / Settings

- Audit service methods: `list:43`, `getById:71`, `getDiff:84`, `getEntityTypes:99`, `getModules:108`, `getRoles:119`, `getUsers:129`, `exportCsv:143`. Mock logic filters by action/entity/entityType/user/role/module/since/until/limit (`audit.service.ts:43-71`), diff lookup (`84-96`), facets (`99-143`).
- Notifications methods: `list:104`, `getById:115`, `create:124`, `update:149`, `publish:172`, `unpublish:195`, `softDelete:217`, `restore:240`, `listForApplicant:269`. Mock logic includes recipient resolution from applicants (`69-77`, `269-274`) and audit emissions.
- Payments methods: `list:35`, `getByReference:56`, `syncFawryStatus:70`, `setStatus:92`, `listRefundEligible:133`. Mock logic filters by status/search/date (`35-56`), deterministic sync timestamp, status override audit, refund eligibility from archived/finalized cycles (`133-139`).
- Settings methods: `get:40`, `update:48`; mock logic persists patch into local state and emits audit (`48-68`).
- Seed sources: audit entries in `frontend/src/shared/mock-data/index.ts:329-705`, notifications in `frontend/src/shared/mock-data/adminNotifications.ts:13+`, payments built by `frontend/src/shared/mock-data/adminPayments.ts:14+`.

## RBAC Audit

| Area | Current state | Gap |
|---|---|---|
| Role tuple | 11 roles present in `rbac.ts:8-20`. | OK. |
| App access | `super_admin` has all apps; `committee_admin` has `admin`; most other staff roles do not. | Admin routes only reachable to `super_admin`/`committee_admin` by app membership; confirm whether finance/admin support roles are needed. |
| Permission typing | `Permission` union only includes `*`, `admission-setup:read`, `admission-setup:write` (`rbac.ts:28-31`). | Add typed permission keys for admin actions used in pages: applicants, users, roles, audit, settings, reports/export, cycles, categories, lookups, payments, notifications, workflows, applicant-grades, committees-exam-config. |
| Admin route guard | Parent `/admin` uses `<AuthGuard app="admin">` (`routes.tsx:207-208`). | Prompt requires stricter route-level guards for `/admin/users/roles`, `/admin/audit`, `/admin/settings`; currently absent. |
| Admission setup | `admission-setup:read` checked in layout/page; write checked in shell/review. | `committee_admin` has read only; super admin wildcard writes. OK conceptually. |
| Payments | `PaymentsPage` checks `payments:review` or super admin (`PaymentsPage.tsx:57`). | Permission missing from typed union and cloud matrix uses `applicant_payments:approve`, not `payments:review`. |
| Cloud matrix | Closed to `admin` + `applicant`. | Missing active rows/actions for audit, settings, reports export, admission rules, workflows, applicant grades, committees exam config, mapping screens. |

## Typed Error Map

| Page/service | Frontend conflict | DB constraints reference |
|---|---|---|
| Cycles | `ACTIVE_CYCLE_EXISTS` | `docs/DB_CONSTRAINTS.md:23`, `docs/INTEGRATION_HANDOFF.md:493` |
| Applicants | `NID_CYCLE_DUPLICATE` planned | `docs/DB_CONSTRAINTS.md:43`, `docs/INTEGRATION_HANDOFF.md:496` |
| Exam plans | `EXAM_ORDER_DUPLICATE` | `docs/DB_CONSTRAINTS.md:104`, `docs/INTEGRATION_HANDOFF.md:494` |
| Committee schedule | `COMMITTEE_AT_CAPACITY` | `docs/DB_CONSTRAINTS.md:125`, `docs/INTEGRATION_HANDOFF.md:495` |
| Lookups | `DUPLICATE_CODE`, delete blocked result | `docs/DB_CONSTRAINTS.md:251-312` |
| Admission application settings | `DUPLICATE_YEAR`, `OVERLAPPING_PERIOD`, `AGE_NOT_POSITIVE`, `INVALID_DATE_RANGE`, `PERCENTAGE_OUT_OF_RANGE`, `AGE_REFERENCE_AFTER_START`, `GRADE_MODE_MISMATCH`, `GENDER_REQUIRED`, `SPECIALIZATION_NOT_MAPPED`, `CATEGORY_HAS_ACTIVE_YEARS` | `docs/DB_CONSTRAINTS.md:383-581` |
| Exam schedule | `DUPLICATE_DATE`, `DATE_OUT_OF_CYCLE_WINDOW`, `INVALID_DATE_RANGE`, `CATEGORY_NOT_ACTIVE` | `docs/DB_CONSTRAINTS.md:592-666` |
| Committee binding | `DUPLICATE_BINDING`, `CAPACITY_NOT_POSITIVE`, `GRADE_RANGE_INVERTED`, `PERCENTAGE_OUT_OF_RANGE`, `TAGDIR_GRADE_NOT_FOUND`, `MODE_MISMATCH`, `DAY_NOT_WORKING`, `COMMITTEE_WRONG_CATEGORY` | `docs/DB_CONSTRAINTS.md:687-825` |
| Committee instances | `COMMITTEE_INSTANCE_DUPLICATE`, `RESERVATIONS_OVER_DESTINATION_CAPACITY` | Present in service contract, not clearly listed in current `DB_CONSTRAINTS.md`; add/confirm before backend implementation. |

## Mock Read / Forbidden Pattern Gaps

- Admin-surface mock reads are still widespread. Examples:
  - `auth.service.ts`: `MOCK.*` 9, `simulateLatency()` 10.
  - `cycles.service.ts`: `MOCK.*` 8, `simulateLatency()` 20.
  - `reports.service.ts`: `MOCK.*` 31, `simulateLatency()` 7.
  - `applicant.service.ts`: `MOCK.*` 27, `simulateLatency()` 13, `paginate()` still used.
  - `committeeInstance.service.ts`: `MOCK.*` 46, `simulateLatency()` 8.
  - `audit.service.ts`: `MOCK.*` 11, `simulateLatency()` 7.
- `useEffect` appears in admin pages/components where some are UI-state effects, but must be checked for fetching violations: `DashboardPage.tsx:72`, `FeesPage.tsx:42`, `ElectronicDeclarationPage.tsx:64`, `LookupsHubPage.tsx:30`, `ApplicantGradesImportPage.tsx:84`, several admission setup components.
- `any` appears in service code despite the rule: `lookups.service.ts:39/52`, `cycles.service.ts` multiple, `applicationSettings.service.ts` multiple, `grades.service.ts` multiple, `committeeInstance.service.ts` multiple, `reports.service.ts`.
- Hardcoded color utilities remain in admin UI: examples `DashboardPage.tsx:225/444/448`, `ApplicationStatusPage.tsx:168/264`, `VerticalStepper.tsx:82/123/149/168`, many admission setup components with `bg-teal-*` / `text-gold-*`.
- Query key factories exist for all inspected admin query files; no missing factory found in the first static pass.

## Phase 1 Blockers / Immediate TODOs

1. Add missing route registrations or explicit redirects for `/admin/admission-rules` and `/admin/lookups/mappings/:kind`.
2. Add stricter route-level guards for `/admin/users/roles`, `/admin/audit`, `/admin/settings`; decide exact permission keys.
3. Expand `Permission` typing and `ROLE_DEFINITIONS` to cover actual admin action permissions, preserving wildcard behavior.
4. Expand `cloudPermissions.ts` only within admin/applicant sections to cover every admin UI action exposed.
5. Resolve `payments:review` vs `applicant_payments:approve` permission mismatch.
6. Confirm whether `committee_admin` should retain `/admin` app access under the re-scoped sprint or be limited to specific admin setup pages.

## Phase 2 Backend Start Conditions

Before implementation can proceed cleanly in this checkout:

1. Reconcile or import the existing backend code described by `Backend-STATUS` into local `backend/`, or scaffold the two-service structure here.
2. Restore/add `backend/admin/README.md` and `backend/applicant/README.md` with the Faculties recipe.
3. Add the missing architecture plan or keep `docs/BACKEND_IMPLEMENTATION_CONTEXT.md` as the local substitute.
4. Start with `LookupsAdmin`: backend status says Faculties is the canonical slice, but local code has no Faculties implementation. Current frontend has 25 lookup keys, so seed counts must be generated from current `LOOKUPS_SEED`, not the older “24 lookups” wording.

## Stop Gate

Phase 0 audit is complete. Per instruction, stop here and wait for explicit go-ahead before Phase 1.
