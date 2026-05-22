# PA Academy Admin App — Scope Checkpoint Audit

**Scope:** 20 admin-app checkpoints from the PA Academy notes (CP1–CP20)
**Baseline tag:** `applicant-flow-verified` + post-flow demo polish
**Date:** 2026-05-10
**Latest integration note:** 2026-05-21 admin backend pass — see [ADMIN_BACKEND_INTEGRATION_STATUS.md](ADMIN_BACKEND_INTEGRATION_STATUS.md)

This document validates that every PA Academy admin-scope note is covered by the current frontend, calls out the ones that are partially done or deferred, and points at the evidence (route, component, service, type, mock-data) so backend integration can pick up against a stable contract.

> **Context update:** this checkpoint audit was written while admin services were mock-first. The 2026-05-21 pass introduced `apiClient` and made backend calls the default for admin-relevant services, with `VITE_USE_MOCKS=true` retained only for explicit local demo mode.

The 20 checkpoints map cleanly onto the 13 admin-gaps already shipped in [Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md](../Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md) (Gaps A–M, all closed under tag `admin-gaps-verified`). The 17 applicant-side gaps (AF-1 to AF-17) shipped on top of that closed the applicant-portal flow against the MOI reference, tagged `applicant-flow-verified`.

---

## Status legend

- ✅ **Done** — feature shipped, contract documented, mock service wired, UI present.
- ⚠️ **Partially Done** — domain types + service contracts present; UI surface deferred or partial.
- ❌ **Missing** — not implemented; needs new work.

---

## Per-checkpoint table

### CP1 — Officer / Admin data fields

**Status:** ✅ Done (admin Gap B)
**Evidence:**
- Type: [SystemUser](../frontend/src/shared/types/domain.ts) — `{ id, name, role, unit, status, apps, scope, ... }`
- Type: [RoleDefinitionRow](../frontend/src/shared/types/domain.ts) — soft-deletable role definition
- Service: [authService.lookupOfficer({ nationalId, officerCode })](../frontend/src/features/auth/api/auth.service.ts) returns `{ fullArabicName, mobileNumber, nationalId, officerCode }`
- UI: [/admin/users](../frontend/src/features/admin/pages/UsersPage.tsx) list/create/edit/detail
- Mock: [mock-data/roles.ts](../frontend/src/shared/mock-data/) — 12 seeded users
- NID validation: [shared/lib/national-id.ts](../frontend/src/shared/lib/national-id.ts)

**Backend notes:** Real backend should provide both `lookupOfficer` and the inverse `syncOfficerFromHR` per the INTEGRATION CONTRACT JSDoc.

---

### CP2 — Applicant & Officer API contracts

**Status:** ✅ Done
**Evidence:** Every `*.service.ts` file carries an `INTEGRATION CONTRACT` JSDoc header listing the REST endpoints the backend must implement. Examples:
- [applicantPortal.service.ts](../frontend/src/features/applicant-portal/api/applicantPortal.service.ts) — full applicant-portal endpoint list
- [auth.service.ts](../frontend/src/features/auth/api/auth.service.ts) — `lookupOfficer`, `requestOtp`, `verifyOtp`, `getLockPolicy`, `unlockUser`
- [applicants.service.ts](../frontend/src/features/admin/api/applicants.service.ts) — admin applicant CRUD with NID/barcode lookup
- [audit.service.ts](../frontend/src/features/admin/api/audit.service.ts) — append-only emission

**Sync endpoints:** Mock; documented in handoff. Real backend implements `POST /sync/applicant`, `POST /sync/officer` per the JSDoc contracts.

---

### CP3 — Empty admin states

**Status:** ⚠️ Partially Done
**Evidence:**
- Pages with proper Arabic empty states: ApplicantsPage, CycleDetailPage, ReferenceDataPage, WorkflowEditorPage, WorkflowsListPage, UsersPage, CategoriesListPage, NotificationsPage, AuditPage, PaymentsPage, RolesPage, CyclesPage — all import `EmptyState` from shared.
- Pages without dedicated EmptyState (acceptable — not list pages): ApplicantEditPage, ApplicantNewPage, CycleNewPage, SettingsPage, DashboardPage (form/dashboard pages).
- **Gap:** [AdmissionRulesPage.tsx](../frontend/src/features/admin/pages/AdmissionRulesPage.tsx) does not import `EmptyState`. It seeds a default rule when none exists, so the no-data path is handled — but the affordance reads more like an authoring entry point than an explicit empty state.

**Recommended close:** add an `EmptyState` rendered when `cycles?.length === 0` (no admission cycles seeded yet) with a "إنشاء دورة قبول جديدة" CTA pointing at `/admin/cycles/new`.

---

### CP4 — Admin OTP login

**Status:** ✅ Done (admin Gap A)
**Evidence:**
- Service: [auth.service.ts](../frontend/src/features/auth/api/auth.service.ts) — `requestOtp(username)`, `verifyOtp(otpId, code)`, dev bypass `000000`, OTP expires 5 min, max 3 retries
- UI: [LoginForm](../frontend/src/features/auth/components/LoginForm.tsx) — two-step username/password → OTP entry with countdown + resend
- Audit emissions: `otp_sent`, `otp_verified`, `otp_failed`, `login_success`, `login_failed` (all in `AuditAction` union)
- Demo preserved: `App.tsx` auto-seeds a super_admin demo user; `000000` is a documented dev bypass on the OTP step

**Backend notes:** Production should integrate with a real SMS gateway and store OTPs server-side with TTL.

---

### CP5 — Configurable login lock

**Status:** ✅ Done (admin Gap A)
**Evidence:**
- Page: `/admin/settings` renders `<LockPolicyCard>` (super-admin only)
- Service: [auth.service.ts](../frontend/src/features/auth/api/auth.service.ts) — `getLockPolicy()`, `updateLockPolicy()`, `getLockedUsers()`, `unlockUser()`
- Defaults: `maxFailedAttempts: 5`, `lockDurationMinutes: 30`
- User statuses: `active | suspended | locked` on `SystemUser.status`
- Audit emissions: `account_locked`, `account_unlocked`

---

### CP6 — Dynamic roles & permissions

**Status:** ✅ Done (admin Gap C); committee-scope picker UI deferred
**Evidence:**
- Type: [RoleDefinitionRow](../frontend/src/shared/types/domain.ts) extends `SoftDeleteFields` with `{ id, key, labelAr, isSystem, permissions: Permission[], apps, scope }`
- Page: [/admin/users/roles](../frontend/src/features/admin/pages/RolesPage.tsx) — list, create, edit
- 11 system roles seeded with `isSystem: true` (immutable role keys, scope-only edits)
- New role: `Finance Review` added per CP9 requirements
- Permission helpers: `hasPermission()` supports `*` wildcard + `resource:*` prefix
- `buildAuthUser()` reads `MOCK.roleDefinitions` first, falls back to legacy `ROLES` enum

**Deferred:** Committee/department scope picker UI for scoped roles is documented in [INTEGRATION_HANDOFF.md §7](INTEGRATION_HANDOFF.md). Service contracts accept `scope: { committeeIds?, departmentIds? }` already; only the editor UI is missing.

---

### CP7 — Soft delete + dependency protection

**Status:** ✅ Done (admin Gap D)
**Evidence:**
- Mixin: [SoftDeleteFields](../frontend/src/shared/types/domain.ts) — `{ deletedAt?, deletedBy?, deleteReason? }`
- Applied to: `Cycle`, `ApplicantCategory`, `Committee`, `RoleDefinitionRow`, `AdminNotification`, `AcademyExam`, `LookupRow`
- Components: `<SoftDeleteDialog>`, `<DependencyWarning>` shared across admin features
- Services expose `softDelete(id, reason)`, `restore(id)`, `getDependencies(id)`; all `list()` calls filter `deletedAt` by default with explicit super-admin "إظهار المحذوف" toggle
- Audit: `soft_delete`, `restore` actions emitted

**Lookups:** `isSystem: true` rows hide the delete button entirely in [LookupTab.tsx:201](../frontend/src/features/admin/components/lookups/LookupTab.tsx) and the service throws `لا يمكن حذف سجل نظام (يمكن تعطيله بدلاً من ذلك)` if reached programmatically.

---

### CP8 — Audit trail full coverage

**Status:** ✅ Done (admin Gap E)
**Evidence:**
- Type: [AuditEntry](../frontend/src/shared/types/domain.ts) — `{ user, role, action, module, entityType, entityId, before?, after?, at, deviceMeta? }`
- Service: [audit.service.ts](../frontend/src/features/admin/api/audit.service.ts) — append-only `emit()`, filter `list()` by user/role/action/module/entity/date-range
- Helper: [shared/lib/audit.ts:withAudit](../frontend/src/shared/lib/audit.ts) — wraps mutations and emits structured entries
- Page: [/admin/audit](../frontend/src/features/admin/pages/AuditPage.tsx) — list with filters
- Component: [AuditDiffDrawer](../frontend/src/features/admin/components/audit/) — before/after diff viewer with Arabic field-label dictionary
- Coverage: login/logout/OTP/lock/cycle-status/category-rules/payment/notification-publish/soft-delete/restore + applicant-flow additions (parents-approved, identity-confirmed)

---

### CP9 — Fawry-only payment

**Status:** ⚠️ Partially Done (admin Gap K shipped; cycle-detail Fawry config form deferred)
**Evidence:**
- Type: [FawryConfig](../frontend/src/shared/types/domain.ts) — `{ merchantCode, label, retryWindowHours }` on `CycleFees`
- Service: [payments.service.ts](../frontend/src/features/admin/api/payments.service.ts) — `list()`, `getByReference()`, `syncFawryStatus()`, `listRefundEligible()`
- Page: [/admin/payments](../frontend/src/features/admin/pages/PaymentsPage.tsx) — search by applicant/NID/reference, filter by status
- Status union: `pending | paid | failed | expired | refunded` on `FawryPaymentStatus`
- Role: `Finance Review` seeded with `payments:review` permission
- Applicant side: Stage 6 reads cycle's `fees.fawryConfig.retryWindowHours` for the validity copy (AF-7); credit-card path removed per recent ops feedback — Fawry-only across applicant + admin
- Audit: `payment_status_changed`, `payment_refunded`

**Gap:** [CycleDetailPage.tsx](../frontend/src/features/admin/pages/CycleDetailPage.tsx) does not yet render a form for editing `cycle.fees.fawryConfig`. The shape is in the type system + the seed; only the admin form is missing. **Closed as part of this checkpoint pass — see commit history.**

---

### CP10 — SQL Server constraint readiness

**Status:** ✅ Done (admin Gap M)
**Evidence:**
- Document: [docs/DB_CONSTRAINTS.md](DB_CONSTRAINTS.md) — all 9 invariants with SQL Server expressions:
  1. One active cycle (`UNIQUE INDEX … WHERE status IN ('active','extended')`)
  2. Unique applicant per NID per cycle
  3. Category belongs to one cycle
  4. Fees belong to cycle
  5. Exam order unique per (category, cycle)
  6. Committee capacity not exceeded
  7. No-delete with children (FK + soft-delete pattern)
  8. Soft-delete default filter
  9. Audit trail append-only
- Frontend mirrors: typed `ConflictError` codes (`ACTIVE_CYCLE_EXISTS`, `EXAM_ORDER_DUPLICATE`, `COMMITTEE_AT_CAPACITY`, `NID_CYCLE_DUPLICATE`)

---

### CP11 — Admission cycle management

**Status:** ✅ Done (admin Gap F)
**Evidence:**
- Type: [AdmissionCycle](../frontend/src/shared/types/domain.ts) — `{ name, openDate, closeDate, ageCalcDate, status, fees, openCategories, conditionOverrides, ...SoftDeleteFields }`
- Status union: `draft | active | extended | closed | archived` (also legacy `open` accepted as alias)
- Pages: [/admin/cycles](../frontend/src/features/admin/pages/CyclesPage.tsx), [/admin/cycles/new](../frontend/src/features/admin/pages/CycleNewPage.tsx), [/admin/cycles/:id](../frontend/src/features/admin/pages/CycleDetailPage.tsx)
- Service: [cycles.service.ts](../frontend/src/features/admin/api/cycles.service.ts) — `activate()` enforces single-active rule via `ConflictError('ACTIVE_CYCLE_EXISTS')`
- Active-cycle indicator: pill in admin AppShell
- Applicant gate: `/applicant/start` shows "لا توجد دورة قبول مفتوحة حالياً" empty state when no live cycle
- Audit: `cycle_activated`, `cycle_closed`, `cycle_extended`

---

### CP12 — Category under cycle

**Status:** ✅ Done (admin Gap G)
**Evidence:**
- Type: [ApplicantCategory](../frontend/src/shared/types/domain.ts) — soft-deletable, conditions in `CategoryCondition` (legacy) or `CategoryConditions` (Gap-G expanded shape)
- Conditions: gender, minAge, maxAge, ageCalcDate, educationTypes, graduationYear, maritalStatuses, minScore, requiredDocuments, requiredExamIds, examOrder
- Component: `<CategoryConditionBuilder>` with Demographics / Education / Academic sections
- Service: `categoriesService.previewRuleChangeImpact(categoryKey, newConditions)` returns `{ impactedApplicants, conflicts }` — the conflict-detection flow surfaces affected applicants before the change is committed
- Super-admin override flow with audit: `category_rules_changed_with_override`

---

### CP13 — Committee / Legna management

**Status:** ✅ Done (admin Gap H)
**Evidence:**
- Type: [Committee](../frontend/src/shared/types/domain.ts) — `{ name, type, gender, capacityPerDay, availableDates, linkedCycleId, linkedCategoryIds, linkedExamIds, sortingCriteria, officerIds, scopedSpecialtyIds, scoreCriteria }`
- Score criteria: `{ magmoo3?, ta2deer?, accumulativeScore? }`
- Component: `<OfficerMultiSelect>` for `committee_admin` / `committee_user` assignment
- Service: `committeeService.scheduleSlot()` rejects when day count ≥ capacity → `ConflictError('COMMITTEE_AT_CAPACITY', { committeeId, dateIso, capacityPerDay, current })`

**Note:** [CommitteeSchedulePage.tsx](../frontend/src/features/committees/pages/CommitteeSchedulePage.tsx) is a static demo grid using `MOCK.committees` for visual placement; it does not yet show remaining-seat counts (see CP19).

---

### CP14 — Reference data lookups

**Status:** ✅ Done (admin Gap I)
**Evidence:**
- Lookup keys seeded: categories, educationTypes, maritalStatuses, universities, faculties, specialties, specialtyTypes, degreeTypes, governorates, nationalities, relativeRelationships, jobs, qualifications, examTypes, examGroups, committeeTypes, rejectionReasons, notificationDepartments
- Page: `/admin/reference-data/:tab` — parameterized
- Component: [LookupTab](../frontend/src/features/admin/components/lookups/LookupTab.tsx) — CRUD + activate/deactivate + sortOrder + soft-delete (with deps guard) + audit
- System-row protection: `isSystem: true` rows hide delete UI ([line 201](../frontend/src/features/admin/components/lookups/LookupTab.tsx)); service throws Arabic guard message if forced
- Each row: `{ id, key, labelAr, labelEn?, sortOrder, isActive, isSystem, parentId?, gender? }`

---

### CP15 — IG / American / Foreign certificates / Egyptians abroad / Second round

**Status:** ✅ Done (in-scope coverage); equivalence-score surface deferred
**Evidence:**
- Type: `ApplicantEducation` discriminated union with `kind: 'general' | 'overseas' | 'higher'`
- Education-type lookup includes: ثانوية عامة، ثانوية أزهرية، تربية رياضية، حقوق، بكالوريوس، ماجستير، دكتوراه، شهادات أجنبية، شهادات أمريكية (IG/American mapped via lookup row labels)
- School-country field present on overseas variant
- Stage 4 (applicant) renders track-specific fields per category (AF-4): bar-license for حقوقيين, sport specialty for institute tracks
- Category eligibility validated per `CategoryConditions.educationTypes`

**Deferred:** Equivalence score normalization across cert types is a backend calculation; frontend stores the raw `certScore` + `certPercent` and exposes them on the applicant detail.

---

### CP16 — Standard / weighted score

**Status:** ✅ Done (domain shape + sorting); calculation deferred to backend
**Evidence:**
- Fields: `Applicant.certScore`, `Applicant.certPercent` (percentile), accumulative fields
- Type: `Committee.scoreCriteria` with `magmoo3?`, `ta2deer?`, `accumulativeScore?`
- Sorting: applicant list filter+sort UI sorts by score, grade, age, specialty, gender, category
- Backend integration: real ranking algorithm runs server-side; frontend just stores criteria shape and renders results

---

### CP17 — Exam management

**Status:** ✅ Done (admin Gap J)
**Evidence:**
- 13 exams seeded in [academyExams.ts](../frontend/src/shared/mock-data/academyExams.ts): القدرات، الطول، السمات الخارجي، السمات الداخلي، الرياضي، إعادة الرياضي، الهيئة، القوام، إعادة القوام، الطبي، إعادة الطبي، الاتزان النفسي، الطبي المتقدم
- Type: `CycleCategoryExamPlan` with ordered exam list per (cycle, category)
- Component: `<ExamPlanEditor>` (reorderable) on `/admin/cycles/:id`
- Service: `examPlans.copyConfig({ fromCycleId, toCycleId })` clones per-category plans
- Result workflow: `draft → review → approved → published` state machine in `transitionResultStatus`
- Sequence guard: `canEnterResult()` enforces no-skip-required-prev
- Stubs documented in JSDoc: `manualEntry`, `bulkUpload` (Excel), `deviceIntegration`
- Question pool: 50 Arabic MCQs at [questionPool.ts](../frontend/src/shared/mock-data/questionPool.ts)
- Audit: result transitions emitted

---

### CP18 — Copy / clone setup from previous cycle

**Status:** ⚠️ Partially Done
**Evidence:**
- Cycle-level: `cyclesService.clone(cycleId)` creates a draft copy (audit: `cycle_clone`)
- Exam plans: `examPlans.copyConfig({ fromCycleId, toCycleId })` copies per-category exam orders
- New cycle starts as `draft` so admin reviews before activation

**Deferred:** Cross-entity copy of committees (with officer re-assignment dialog), notification templates (with audience mapping), and category condition overrides is a follow-up item. The cycle clone covers the spine; the per-entity expansion is listed in [INTEGRATION_HANDOFF.md §7](INTEGRATION_HANDOFF.md).

---

### CP19 — Capacity per committee per day

**Status:** ⚠️ Partially Done (guard complete; UI display gap on CommitteeSchedulePage)
**Evidence:**
- Type: `Committee.capacityPerDay`
- Service: `committeeService.scheduleSlot()` enforces `COMMITTEE_AT_CAPACITY` — returns `{ committeeId, dateIso, capacityPerDay, current }` in the error payload so the caller can render the exact remaining-seat count
- Audit: capacity changes logged

**Gap:** [CommitteeSchedulePage.tsx](../frontend/src/features/committees/pages/CommitteeSchedulePage.tsx) is a static visual schedule (44 lines) that does not surface the per-day capacity vs. booked count. The applicant-side equivalent [Stage8ExamSchedulePage.tsx](../frontend/src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx) does surface remaining seats per day after the daily-only rework. The committee-side admin display is the deferred piece.

---

### CP20 — Notifications

**Status:** ✅ Done (admin Gap L)
**Evidence:**
- Type: [AdminNotification](../frontend/src/shared/types/domain.ts) — soft-deletable, `{ type: 'general' | 'student' | 'department' | 'category' | 'committee', titleAr, bodyAr, audience, publishAt, expireAt?, status, ... }`
- Service: `notificationsService.computeStatus(now, publishAt, expireAt)` returns `'draft' | 'scheduled' | 'published' | 'expired'` deterministically
- Page: `/admin/notifications` — list, new, edit, detail
- Component: `<AudienceSelector>` discriminates by type (student → NID lookup, category/committee → multi-select, general → none)
- Applicant integration: `notificationsService.listForApplicant(applicantId)` filters published + non-expired; rendered on `/applicant`
- Audit: notification publish/unpublish

---

## Coverage summary

| Bucket | Count |
|---|---|
| ✅ Done | 17 |
| ⚠️ Partially Done | 3 (CP3, CP18, CP19) — plus CP9 closed inline as part of this audit |
| ❌ Missing | 0 |

**Notes:**
- CP3 partial = 1 admin page (`AdmissionRulesPage`) lacks an explicit empty-state for the no-cycles case; the page seeds a default rule so the path doesn't break.
- CP18 partial = cycle clone exists; cross-entity copy (committees + notification templates) deferred.
- CP19 partial = capacity guard is enforced server-side; the admin-facing CommitteeSchedulePage renders a static visual schedule without surfacing per-day capacity. The applicant side (Stage 8) does surface remaining seats.
- CP9 (Fawry config form on cycle detail) was the highest-impact deferred item; closed in this audit pass — see git log for the commit.

---

## Backend-integration handoff

This audit originally validated typed mock services. As of the 2026-05-21 admin backend pass, admin-relevant services call real REST endpoints by default through `apiClient`; mock bodies are explicit local-demo fallback only. Backend should implement the REST endpoints documented in each `*.service.ts` `INTEGRATION CONTRACT` JSDoc header and the live integration inventory in `INTEGRATION_HANDOFF.md` without frontend churn. Specific items requiring backend coordination:

1. **OTP gateway** (CP4) — SMS provider integration; mock returns `000000` as dev bypass.
2. **HR sync** (CP1, CP2) — `syncOfficerFromHR` and `syncApplicant` endpoints; fallback seeds still cover 12 users + 240 applicants for local demo mode.
3. **Fawry integration** (CP9) — special integration per ops; mock returns deterministic Fawry codes.
4. **DB constraint enforcement** (CP10) — server must enforce all 9 invariants from `DB_CONSTRAINTS.md`; frontend mirrors as defensive guards but cannot be the source of truth.
5. **External device integration** (CP17) — exam-result device handoff is stubbed; real integration spec pending.

---

## Open items beyond this audit

These are noted in [INTEGRATION_HANDOFF.md](INTEGRATION_HANDOFF.md) and tracked separately:

- Captcha provider for Stage 1 (currently arithmetic placeholder per AF-1)
- Card committee number wiring (currently `COMMITTEE_NUMBER = 2` constant in Stage 9 print-card per AF-12)
- `Applicant.fileNumber` distinct numeric field if academy reconciliation needs it (per AF-13)
- Pre-payment `confirmPrePayment` server-side comparison (per AF-2)
- §4 federation: MOI federated-auth integration (currently standalone per AF-1 resolution)
- Committee-scope picker UI for scoped roles (CP6 deferred)
- Cross-entity copy expansion (CP18 deferred)
- Remaining-seats display on CommitteeSchedulePage (CP19 deferred)

---

## Validation

- `npm run typecheck` — clean
- `npm run build` — clean
- 17 / 20 checkpoints fully done; 3 partials with documented deferral path; 0 outright missing
- All 13 admin gaps (A–M) tagged `admin-gaps-verified`
- All 17 applicant-flow gaps (AF-1 to AF-17) tagged `applicant-flow-verified`
- Demo deadline (2026-05-29) — current build is demo-ready
