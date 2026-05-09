# Frontend Flow Closure — PA Academy Admin & Applicant

**Scope:** end-to-end user-flow closure for the admin app and applicant portal, frontend-only. Backend-dependent items intentionally mocked.
**Date:** 2026-05-10
**Tags pointed at this work:** `applicant-flow-verified`, plus follow-ups in this session.

This doc closes the loop on three prior audits — the 13 admin gaps, the 17 applicant-flow gaps, and the 20-checkpoint scope audit — by walking the actual user journeys (admin and applicant) and confirming every step renders, navigates, and validates inside mock data.

For per-checkpoint coverage of the underlying contracts/types/services see [PA_ADMIN_SCOPE_CHECKPOINTS.md](PA_ADMIN_SCOPE_CHECKPOINTS.md).

---

## Status legend

- ✅ **Done** — flow renders end-to-end with mock data; user can complete the journey.
- ⚠️ **Partially Done** — main path works; secondary affordance deferred (documented).
- 🔧 **Mocked / Demo Only** — intentionally simulates a backend-dependent action.

---

# Part 1 — Admin Flow Checklist

## §1.1 — Admin entry flow ✅ Done
- `/staff-login` (also `/login` redirect) renders `LoginForm`. Demo super_admin auto-seeds via `App.tsx:ensureDemoUser()`.
- Two-step login: username/password → OTP. OTP `000000` is a documented dev bypass.
- Super admin lands on `/admin` which routes via `AdminIndexRoute` → `ReportsPage`.
- Sidebar entries (verified in `AdminLayout.tsx:24-58`): Hub · Dashboard · Applicants · Users · Roles · Audit · Reference Data · Admission Rules · Categories · Cycles · Workflows · Notifications · Payments · Settings · Reports.
- Active page state highlights via `NavLink isActive` (start-edge accent border).
- Committees + Exams are **separate apps** with their own sidebars (per `CLAUDE.md §8`); reachable via `/hub` link in admin sidebar.

## §1.2 — Admin dashboard / Reports ✅ Done
- `DashboardPage` renders: cycle picker · 4 StatCards · LineChart (registrations) · DonutChart (status) · Heatmap (activity) · 8 recent applicants.
- **NEW** Quick-actions card with 6 CTAs (this session): Create cycle · Manage categories · Manage committees · Configure exam workflow · Review payments · Send notification.
- "Actions required" panel surfaces: pending payments, flagged investigations, on-hold applicants.
- Activity ticker reads `useAuditLog()`.

## §1.3 — Cycle flow ✅ Done
- `/admin/cycles` — list with status badges and clone action.
- `/admin/cycles/new` — create form.
- `/admin/cycles/:id` — full configuration: status workflow (draft → active → extended → closed → archived), category-toggle panel, exam-plan editor, lifecycle actions, **Fawry config card** (added in CP9 closure), copy-from-previous-cycle action.
- **NEW** Activation pre-flight validation (this session): when admin tries to activate, `cyclesService.activate()` collects missing prerequisites and throws `ConflictError('CYCLE_ACTIVATION_INCOMPLETE')` with a friendly Arabic message listing all gaps:
  - تواريخ الفتح والإغلاق غير مضبوطة
  - رسوم التقديم غير مضبوطة
  - إعدادات بوابة فوري غير مكتملة
  - لا توجد فئة قبول مفتوحة
  - لا توجد لجان مُعدّة
  - لا توجد خطة اختبارات لأي فئة مفتوحة
- Single-active invariant enforced via `ConflictError('ACTIVE_CYCLE_EXISTS')`.

## §1.4 — Category under cycle ✅ Done
- `/admin/categories` list and `/admin/categories/:key` detail.
- `<CategoryConditionBuilder>` configures gender / age / age-calc-date / education types / graduation year / marital / score / required exams / exam order.
- `categoriesService.previewRuleChangeImpact()` returns impacted-applicant list before commit.
- Super-admin override flow with audit emission `category_rules_changed_with_override`.

## §1.5 — Committee / Legna ✅ Done (admin pages); ⚠️ schedule UI partial
- `/committee/list` lists committees; create/edit/detail in committee app.
- `<OfficerMultiSelect>` for officer assignment.
- Committee shape carries: gender scope, score criteria, capacityPerDay, availableDates, linkedCategoryIds, linkedExamIds, sortingCriteria.
- `committeeService.scheduleSlot()` enforces `COMMITTEE_AT_CAPACITY` with daily counter.
- ⚠️ `/committee/schedule` is a **44-line static visual grid** that doesn't surface remaining seats per day. Listed in deferred items. Applicant Stage 8 displays per-day capacity correctly.

## §1.6 — Exams ✅ Done
- 13 exams seeded in `academyExams.ts` with exact RFP names.
- `ExamPlanEditor` on `/admin/cycles/:id` reorders exams per (cycle, category).
- `examPlans.copyConfig()` clones across cycles.
- Result-state machine: `draft → review → approved → published`, sequence guard `canEnterResult()`.
- 50-MCQ Arabic question pool seeded.
- Manual entry / bulk Excel upload / device integration are stubbed with JSDoc placeholders.

## §1.7 — Payments / Finance Review ✅ Done
- `/admin/payments` — Fawry-only ledger gated by `payments:review` permission.
- Search by NID + reference; filter by status (pending/paid/failed/expired/refunded).
- Two tabs: active ledger + refund-eligible.
- **NEW** Inline row actions (this session): مزامنة (Fawry resync), مراجعة (mark-as-reviewed toggle with toast), استرداد (refund request — only on `paid` rows, opens confirm dialog, files mock refund request with badge).
- 🔧 Refund and review states are demo-only client state; production wires to `markReviewed` / `requestRefund` service methods (audit-emitting).

## §1.8 — Notifications ✅ Done
- `/admin/notifications` — list, new, edit, detail.
- `<AudienceSelector>` discriminated by type: general · student (NID lookup) · category · committee · department.
- `computeStatus()` derives `draft | scheduled | published | expired` deterministically from publishAt/expireAt.
- Applicant home (`/applicant`) reads `notificationsService.listForApplicant()` — published + non-expired only.
- Soft-delete supported with audit.

## §1.9 — Reference data ✅ Done
- `/admin/reference-data/:tab` parameterized for 18 lookup keys (categories, education types, marital, universities, faculties, specialties, specialty types, degree types, governorates, nationalities, relationships, jobs, qualifications, exam types, exam groups, committee types, rejection reasons, notification departments).
- `<LookupTab>` provides CRUD + sortOrder + activate/deactivate + soft-delete (with deps guard) + audit.
- System rows (`isSystem: true`) hide delete affordance.

## §1.10 — Audit trail ✅ Done
- `/admin/audit` page with filters: user · role · action · module · entity · date-range.
- `<AuditDiffDrawer>` shared component renders before/after diff with Arabic field-label dictionary.
- 80 mock entries seeded covering create/update/soft-delete/restore/login/OTP/lock/payment/cycle-status/category-rules/notification publish.
- `withAudit` helper wraps mutations across the codebase.

## §1.11 — Soft delete ✅ Done
- Mixin: `SoftDeleteFields { deletedAt?, deletedBy?, deleteReason? }` on Cycle, ApplicantCategory, Committee, RoleDefinitionRow, AdminNotification, AcademyExam, LookupRow.
- `<SoftDeleteDialog>` + `<DependencyWarning>` shared components.
- Each entity service: `softDelete()`, `restore()`, `getDependencies()`. List filters hide deleted by default.
- Audit emissions `soft_delete` and `restore` on every action.
- ⚠️ Some list pages (CyclesPage, UsersPage) use inline delete via row action without wrapping in `SoftDeleteDialog` — defaulting to the dependency-blocked service-side guard. Detail-page workflow uses the dialog. Listed in deferred items.

## §1.12 — **NEW: AdmissionRulesPage empty state** ✅ Done
- When `cycles?.length === 0`, page renders an `EmptyState` with title `لا توجد دورات قبول بعد` and a CTA linking to `/admin/cycles/new`. Closes the prior CP3 partial.

---

# Part 2 — Applicant Flow Checklist

## §2.1 — Applicant entry ✅ Done
- `/` → `PublicLandingPage`. `/apply` → `ApplyEntryPage` (returning applicants auto-resume at furthest stage).
- `/applicant/start` → `CategorySelectionPage`. Auto-selects single live cycle; prompts pick when ≥2.
- 11-stage Wizard sidebar always visible; current stage highlighted; previous stages clickable; future blocked.
- Top nav has: applicant ID badge + تعديل الطلب (AF-3) + نتائج الإختبارات (AF-10) + خروج.

## §2.2 — Applicant eligibility ✅ Done
- `/applicant/eligibility` — NID + category + recap of conditions/required-tests/procedures.
- `useEligibilityMutation()` returns pass/fail with specific rejection reasons (age, qualification, score, gender, marital, NID-already-used, application closed).
- Empty/closed states: `لا توجد دورة قبول مفتوحة حالياً` when no live cycle.

## §2.3 — Applicant profile ✅ Done
- Stage 3 personal: 4-part Arabic name + DOB/gender derived from NID + governorate (SearchSelect) + religion + addresses + photo upload.
- Stage 4 education: certificate verification with override flow + AF-4 track-specific fields (bar license for حقوقيين, sport specialty for institute tracks).
- Stage 5 marital: conditional spouse fields.
- Stage 7 family: father/mother/grandparents (6 fixed) + AF-5 stepfather (optional) + siblings + relatives. NID uniqueness across all members. AF-6 explicit اعتماد gate before continuing.
- Stage 11 acquaintance: travel history + social accounts + printable declaration.
- All forms react-hook-form + zod with Arabic validation messages.
- Draft auto-saves via `submitStage()` after each step; `furthestStage` tracked.

## §2.4 — Applicant payment ✅ Done (Fawry-only)
- Stage 6 — single-method (Fawry) after recent removal of credit-card path.
- AF-2 IdentityConfirmGate blocks payment until applicant re-enters NID + mobile.
- AF-7 retry-window read from `cycle.fees.fawryConfig.retryWindowHours` (48 hours).
- 🔧 `إصدار رمز السداد` issues a mock 10-digit Fawry code via `initiatePayment()`. `التحقق من السداد` auto-succeeds in demo. Receipt opens in modal with print button.
- Payment record persists `fawryCode` on draft for AF-14 (printed-card line).

## §2.5 — Applicant exam schedule ✅ Done
- Stage 8 — daily-only picker (recent rework). Shows next 3 available days.
- Each DayCard: day-of-week + Gregorian date + location (Main HQ / اللجنة الأولى / اللجنة الثانية, deterministic per index) + capacity bar + remaining seats.
- Reservation through `useReserveSlot()`; service rejects if capacity reached.
- After confirm, navigates to Stage 9.

## §2.6 — Applicant print card ✅ Done
- Stage 9 — close to printed reference per AF-11 through AF-17:
  - Title بطاقة التردد
  - Identity block: اسم الطالب · اللجنة (Arabic ordinal) · رقم الملف · الرقم القومى
  - Fawry payment-ref line: `تم الدفع بواسطة فورى بالمدفوعة رقم: …`
  - Exam-date prose sentence: `تاريخ إختبار قدرات يوم {day} {date} الساعة {hour} {period}`
  - Code 128 barcode + اللجنة [ordinal] label below
  - كشف ومواعيد الإختبارات table (5 columns RTL)
  - Required-documents checklist + signature block + Khayameya stripe footer
- Print/skip buttons in `no-print` chrome; `tنزيل إقرار التعارف` shortcut to Stage 11 (AF-9).

## §2.7 — Applicant follow-up ✅ Done
- Stage 10 — 6 pipeline status cards (capacities/traits/sports/medical/investigation/finalResult).
- Conditional banner if investigation `awaiting-approval` → CTA into Stage 11.
- Bottom CTAs: مواعيد الاختبارات + المتابعة إلى وثيقة التعارف.
- Top-nav AF-10 results-tracker reachable from any stage.

## §2.8 — Applicant notifications ✅ Done
- Applicant home (`/applicant`) renders the published-notifications feed via `notificationsService.listForApplicant(applicantId)`.
- Audience filter: general + student-specific (NID match) + category.
- Expired notifications filtered out by `computeStatus()`.

## §2.9 — Applicant edit-application surface ✅ Done
- `/applicant/application/summary` (AF-3) — read-only snapshot with per-section "تعديل" buttons routing back into wizard stages.
- Locks: payment after `paidAt`, exam-slot after reservation.
- Suspended-state banner blocks edit affordances entirely.

---

# Part 3 — Demo Quality & UX Polish

## §3.1 — Navigation / Flow QA ✅ Done
- Admin paths verified end-to-end in this session: Login → Dashboard → Create cycle → Add category → Add committee (via Hub → Committees) → Configure exams → Activate (with new pre-flight validation) → Payments → Review → Notifications → Publish → Audit → Detail.
- Applicant paths verified: Apply → Select category → Eligibility → Auth (123456 OTP) → Profile (Stages 3-5) → Payment (Fawry only) → Family (with اعتماد gate) → Exam schedule (3 days) → Print card → Follow-up.
- No broken routes; no dead links; admin sidebar Hub link routes back to `/hub` for cross-app navigation.

## §3.2 — Empty / loading / error / success states ✅ Done
- Loading: `<LoadingState>` variants (page, card-grid, table) used across feature pages.
- Empty: `<EmptyState>` used on every list page where applicable. AdmissionRulesPage closed in this session.
- Error: `<ErrorState>` with retry shown on query errors.
- Success/danger: `toast()` from shared/components after every mutation.
- Confirmation: `<Modal>` and `window.confirm()` for risky actions (refund, soft-delete).

## §3.3 — Arabic RTL ✅ Done
- `<html lang="ar" dir="rtl">` in index.html; logical properties (`ms-`, `me-`, `ps-`, `pe-`) used throughout.
- IBM Plex Sans Arabic / Tajawal display fonts; tnum tabular numerals for stat cards.
- Direction-aware icons (back arrow uses `rtl:rotate-180`).
- Tables RTL-ordered; forms align right-to-left.

## §3.4 — Mock data consistency ✅ Done
- Active cycle CYC-2026-M used consistently across admin (`/admin/cycles`, `/admin/admission-rules`, `/admin/payments`) and applicant (`/applicant/start`).
- Categories belong to cycles via `openCategories` map.
- Stage 8 reservation writes to `draft.examSlot`; Stage 9 print card reads it back.
- Stage 6 payment writes `draft.payment` with `fawryCode`; Stage 9 prints it via AF-14.
- Notifications appear on applicant home for matching applicants/categories.
- Audit entries reflect mutations: cycle activation/closure, category rule change, payment status change, notification publish, soft-delete/restore.

---

## What was newly implemented in this session

| Fix | Headline | Files |
|---|---|---|
| **F1** | Cycle activation pre-flight validation | [cycles.service.ts](../frontend/src/features/admin/api/cycles.service.ts) (+`collectActivationIssues`) · [errors.ts](../frontend/src/shared/lib/errors.ts) (+`CYCLE_ACTIVATION_INCOMPLETE`) |
| **F2** | Dashboard quick-actions card (6 CTAs) | [DashboardPage.tsx](../frontend/src/features/admin/pages/DashboardPage.tsx) (+`QuickAction` helper) |
| **F3** | AdmissionRulesPage empty state for no-cycles case | [AdmissionRulesPage.tsx](../frontend/src/features/admin/pages/AdmissionRulesPage.tsx) |
| **F5** | Payment list mock actions (mark reviewed, refund placeholder) | [PaymentsPage.tsx](../frontend/src/features/admin/pages/PaymentsPage.tsx) |

(F4 — committee schedule seat-count display — not shipped this session; see deferred list.)

---

## What is intentionally mocked / skipped (backend-dependent)

These are demo-only behaviors flagged with comments pointing at the production contract:

1. **OTP** — Stage 2 accepts `123456` only; admin OTP accepts `000000`. Production wires SMS gateway.
2. **Fawry** — `initiatePayment` returns mock 10-digit code; `verifyPayment` auto-succeeds. Production wires Fawry merchant API per the cycle's `fawryConfig.merchantCode`.
3. **Captcha** — Stage 1 arithmetic placeholder. Production wires server-issued challenge.
4. **Pre-payment identity check** — `confirmPrePayment` accepts any well-formed NID+phone. Production compares against Stage 1 stored values.
5. **Excel upload / device integration** — JSDoc-stubbed in exam result service.
6. **Real audit IP/device meta** — frontend cannot capture; mocked as `null`.
7. **Soft delete** — runs in in-memory state; persists across navigation but not across page reload.
8. **MOI federated auth (§4)** — applicant standalone auth; production option to redirect via MOI portal.

---

## What is partially done (deferred)

| Item | What's there | What's deferred |
|---|---|---|
| **CommitteeSchedulePage seat count** | 44-line static visual grid | Per-day capacity widget reading `Committee.capacityPerDay`; needs cross-feature service call |
| **Inline soft-delete coverage** | CategoriesListPage, NotificationsPage use `<SoftDeleteDialog>` | CyclesPage, UsersPage, etc. still use inline confirm without dialog wrap |
| **Cross-entity cycle clone** | `cyclesService.clone()` + `examPlans.copyConfig()` | Committee duplication + notification template copy |
| **Manual exam result entry UI** | Service contract present; result-state machine complete | Dedicated single-applicant result entry page |
| **Notification preview tab** | Renders correctly on applicant home in real time | "Preview as applicant" affordance in the editor drawer |
| **Applicant simulate-paid/failed buttons** | Production `verifyPayment` auto-succeeds | Mock-mark-failed / regenerate-reference shortcuts |
| **More applicant back buttons** | Wizard sidebar handles cross-stage navigation | Some pages (TestScheduleAndResults, etc.) lack a top-nav back button |

None of these block the demo path.

---

## Routes verified

- `/staff-login` → `/admin` → `ReportsPage`
- `/admin/dashboard` (alias)
- `/admin/applicants` → `applicants/new` → `applicants/:id` → `applicants/:id/edit`
- `/admin/users` → `/admin/users/roles`
- `/admin/audit`
- `/admin/settings`
- `/admin/reports`
- `/admin/reference-data` → `/admin/reference-data/:tab`
- `/admin/admission-rules`
- `/admin/cycles` → `/admin/cycles/new` → `/admin/cycles/:id`
- `/admin/categories` → `/admin/categories/:key`
- `/admin/workflows` → `/admin/workflows/new` → `/admin/workflows/:id`
- `/admin/notifications`
- `/admin/payments`
- `/applicant` → `/applicant/start` → `/applicant/eligibility` → `/applicant/auth/step-1` → `step-2` → `/applicant/profile/personal` → `education` → `marital` → `/applicant/payment` → `/applicant/profile/family` → `/applicant/exam-schedule` → `/applicant/print-card` → `/applicant/follow-up` → `/applicant/acquaintance-doc`
- `/applicant/application/summary` (AF-3 edit surface)
- `/applicant/tests` (results tracker)
- `/hub` (cross-app launcher)

---

## Validation

- `npm run typecheck` — **clean**
- `npm run build` — **clean** (~1.9 MB / ~564 kB gzipped)
- All four new fixes (F1–F3, F5) commit-clean and integrated into mock services without backend coupling.

---

## Closeout

The admin app and applicant portal are **demo-ready**. Every required user journey from the prompt walks end-to-end on mock data with friendly Arabic messaging at decision points. Deferred items are non-blocking and listed above with explicit "what's there / what's deferred" so future agents can pick up cleanly.

Backend integration sits behind every `*.service.ts` `INTEGRATION CONTRACT` JSDoc header — no frontend rewriting required when the real APIs land.
