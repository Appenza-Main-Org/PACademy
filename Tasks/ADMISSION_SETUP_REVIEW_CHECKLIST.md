# التقديم Section — Review Checklist

> Manual review checklist for the التقديم sidebar section + 14-step admission setup feature.
> Use this when reviewing the implementation before sign-off — read each item, click through the app, mark ✅ / ❌ / ⚠️.
>
> **2026-05-10:** Cycle metadata (الخطوة 1 سابقاً) was removed from the wizard. Admins now enter the wizard by selecting an already-configured cycle from `/admin/admission-setup`; cycle creation / metadata editing lives in `/admin/cycles`. Old steps 2–15 are now steps 1–14.

---

## A · Sidebar Behavior

- [ ] **A1.** التقديم section is visible in the left sidebar.
- [ ] **A2.** Section label reads exactly **التقديم** in Arabic.
- [ ] **A3.** Section has an icon next to the label.
- [ ] **A4.** Clicking the section header expands it; clicking again collapses it.
- [ ] **A5.** Chevron/arrow indicator rotates or flips to reflect expand/collapse state.
- [ ] **A6.** Toggle state persists across page refresh (localStorage).
- [ ] **A7.** Section auto-expands when navigating to any `/admin/admission-setup/*` route.
- [ ] **A8.** Section is hidden entirely for users without `admission-setup:read` permission.
- [ ] **A9.** Active submenu item is visually highlighted (per-app accent color).
- [ ] **A10.** Sidebar respects RTL layout — submenu items indent on the correct side.
- [ ] **A11.** Reduced-motion users don't see jarring animations on expand/collapse.

---

## B · Submenu Items (order, labels, icons)

All 14 items must appear in this exact order with these exact Arabic labels:

- [ ] **B1.** `1. إعدادات التقديم`
- [ ] **B2.** `2. حالة التقديم`
- [ ] **B3.** `3. شروط السن`
- [ ] **B4.** `4. الحالة الاجتماعية`
- [ ] **B5.** `5. الرسوم المالية`
- [ ] **B6.** `6. إدارة الاختبارات`
- [ ] **B7.** `7. إدارة اللجان`
- [ ] **B8.** `8. دمج وفصل اللجان`
- [ ] **B9.** `9. درجات القبول`
- [ ] **B10.** `10. مواعيد الاختبارات`
- [ ] **B11.** `11. ربط المواعيد باللجان`
- [ ] **B12.** `12. المجموع الكلي`
- [ ] **B13.** `13. التنبيهات`
- [ ] **B14.** `14. الإقرار الإلكتروني`
- [ ] **B15.** Each item has its own icon (not all using the same generic icon).
- [ ] **B16.** Step numbers are displayed in Arabic numerals (١، ٢، ٣) or order is otherwise visually clear.

---

## C · Routing

- [ ] **C1.** Each submenu item navigates to a separate URL — no two items share a route.
- [ ] **C2.** All routes live under `/admin/admission-setup/*`.
- [ ] **C3.** URL changes when clicking a submenu item (no SPA-trap).
- [ ] **C4.** Browser back button returns to the previous step correctly.
- [ ] **C5.** Direct URL paste (e.g. `/admin/admission-setup/exam-dates`) lands on the correct step page.
- [ ] **C6.** Refreshing the page on any step keeps you on that step (not bounced to index).
- [ ] **C7.** Index route `/admin/admission-setup` shows an overview/landing page with all 15 steps.
- [ ] **C8.** All routes use route constants (`ROUTES.admin.admissionSetup.*`) — no hardcoded path strings in components.

---

## D · Step Pages — Shared Shell

Every one of the 15 step pages must have:

- [ ] **D1.** Breadcrumb at the top showing `التقديم → {step name}`.
- [ ] **D2.** Step indicator showing `الخطوة N من ١٤` (or equivalent).
- [ ] **D3.** Page title matches the submenu label exactly.
- [ ] **D4.** Active cycle context is visible (e.g. "دورة 2026" badge or selector).
- [ ] **D5.** Super-admin can swap to a different cycle from any step page.
- [ ] **D6.** Cycle selection persists across steps within the same session.
- [ ] **D7.** When no active cycle exists, launcher shows notice directing admin to `/admin/cycles` to activate one.
- [ ] **D8.** Loading skeleton appears during data fetch.
- [ ] **D9.** Error state appears on fetch/save failure with retry affordance.
- [ ] **D10.** All copy is in Arabic — no English UI strings.
- [ ] **D11.** RTL layout intact on every step page.

---

## E · Step Content (per-step acceptance)

> Cycle metadata (name / year / dates) is configured in `/admin/cycles` —
> not part of this wizard. Admins enter the wizard with an already-active
> cycle pinned as context.

### Step 1 — إعدادات التقديم
- [ ] **E1.1.** Application start date picker.
- [ ] **E1.2.** Application end date picker.
- [ ] **E1.3.** End date validates as ≥ start date.
- [ ] **E1.4.** Allowed applicant categories multi-select.
- [ ] **E1.5.** Applicant type field.
- [ ] **E1.6.** Gender field.
- [ ] **E1.7.** Graduation year field.

### Step 2 — حالة التقديم
- [ ] **E2.1.** Status selector with three options: Draft / Approved / Cancel Approval.
- [ ] **E2.2.** Toggle to control application visibility for applicants.
- [ ] **E2.3.** Status change emits audit entry.
- [ ] **E2.4.** Reflects existing cycle status workflow (Gap F).

### Step 3 — شروط السن
- [ ] **E3.1.** Minimum age input (numeric).
- [ ] **E3.2.** Maximum age input (numeric).
- [ ] **E3.3.** Min < max validation.
- [ ] **E3.4.** Per-category age rules editable.
- [ ] **E3.5.** Applicant type field.
- [ ] **E3.6.** Gender field.
- [ ] **E3.7.** Graduation year field.
- [ ] **E3.8.** Age calculation date picker.

### Step 4 — الحالة الاجتماعية
- [ ] **E4.1.** Required marital status configurable per category.
- [ ] **E4.2.** Options sourced from existing marital status lookup (Gap I).

### Step 5 — الرسوم المالية
- [ ] **E5.1.** Electronic application fees configurable per year.
- [ ] **E5.2.** Fee amount input with currency indicator (EGP / ج.م).
- [ ] **E5.3.** Reflects existing Fawry config (Gap K).

### Step 6 — إدارة الاختبارات
- [ ] **E6.1.** Configure approved tests (selectable list).
- [ ] **E6.2.** Define test order (drag-to-reorder or numeric input).
- [ ] **E6.3.** Reflects existing exam plan editor (Gap J).
- [ ] **E6.4.** "Copy from previous cycle" action available.

### Step 7 — إدارة اللجان
- [ ] **E7.1.** Configure committees (list + create).
- [ ] **E7.2.** Applicant type assignable per committee.
- [ ] **E7.3.** Gender assignable per committee.
- [ ] **E7.4.** Required specializations configurable.
- [ ] **E7.5.** Reflects existing CommitteeDetailPage (Gap H).

### Step 8 — دمج وفصل اللجان (NEW)
- [ ] **E8.1.** UI to select source committee(s).
- [ ] **E8.2.** UI to select target committee(s).
- [ ] **E8.3.** Choice between merge / split type.
- [ ] **E8.4.** Optional reason field.
- [ ] **E8.5.** Effective date picker.
- [ ] **E8.6.** Validation: merge requires ≥2 source / 1 target; split requires 1 source / ≥2 target.
- [ ] **E8.7.** List of existing merge/split rules visible.
- [ ] **E8.8.** Soft-delete supported with dependency check.

### Step 9 — درجات القبول
- [ ] **E9.1.** Min score input per committee.
- [ ] **E9.2.** Max score input per committee.
- [ ] **E9.3.** Min < max validation.
- [ ] **E9.4.** Auto-loads committees for the active cycle.

### Step 10 — مواعيد الاختبارات (NEW)
- [ ] **E10.1.** First available exam date picker.
- [ ] **E10.2.** Bookable days selector (multi-date or calendar).
- [ ] **E10.3.** Optional blackout dates.
- [ ] **E10.4.** First date validates as ≥ cycle start date.
- [ ] **E10.5.** All bookable days validate as ≥ first available date.

### Step 11 — ربط المواعيد باللجان
- [ ] **E11.1.** Assign schedules (dates) to committees.
- [ ] **E11.2.** Define capacity per slot per committee.
- [ ] **E11.3.** Capacity overflow blocked at the service level.
- [ ] **E11.4.** Reflects existing committee `availableDates` + `capacityPerDay` (Gap H).

### Step 12 — المجموع الكلي (NEW)
- [ ] **E12.1.** Per applicant-stream selector (general / special / law / sports_female).
- [ ] **E12.2.** Per-exam weight input (0..100).
- [ ] **E12.3.** Sum-to-100 validation per stream.
- [ ] **E12.4.** Optional minimum passing score per component.
- [ ] **E12.5.** Total score out-of input.

### Step 13 — التنبيهات
- [ ] **E13.1.** Composes existing notifications page (Gap L).
- [ ] **E13.2.** Audience targeting works (general / category / committee / department / specific applicant).
- [ ] **E13.3.** Publish/expire scheduling intact.

### Step 14 — الإقرار الإلكتروني (NEW)
- [ ] **E14.1.** Long-text editor for declaration body in Arabic.
- [ ] **E14.2.** Version number auto-increments on save.
- [ ] **E14.3.** Effective-from date picker.
- [ ] **E14.4.** Save and Publish are distinct actions.
- [ ] **E14.5.** Preview pane shows applicant view.
- [ ] **E14.6.** Publish action emits audit entry.

---

## F · Permissions / RBAC

- [ ] **F1.** New permission `admission-setup:read` exists.
- [ ] **F2.** New permission `admission-setup:write` exists.
- [ ] **F3.** `super_admin` role has both permissions.
- [ ] **F4.** Cycle-management roles (per Gap C matrix) have appropriate permissions.
- [ ] **F5.** Applicant role does NOT see التقديم section at all.
- [ ] **F6.** Users with read-only permission see forms in read-only mode (no edit affordances).
- [ ] **F7.** Users with read-only permission see a "ليس لديك صلاحية التعديل" footer note instead of error toasts on attempted writes.
- [ ] **F8.** No new role was added to satisfy permissions (verify against Gap C role matrix).

---

## G · Index / Landing Page (`/admin/admission-setup`)

- [ ] **G1.** Highlights the currently-active cycle with a primary "بدء التقديم" CTA; if no active cycle, shows a notice pointing to `/admin/cycles`.
- [ ] **G2.** Other (non-active) configured cycles render below for review/access.
- [ ] **G3.** Status pill values: `مكتمل` / `قيد التطوير` / `لم يبدأ`.
- [ ] **G4.** Status pill colors: green (مكتمل), gold (قيد التطوير), muted (لم يبدأ).
- [ ] **G5.** Clicking a card navigates to its step.
- [ ] **G6.** Status pills update reactively when underlying data changes.
- [ ] **G7.** Layout is responsive (3-col on desktop, stacks gracefully at narrower widths).

---

## H · Audit Trail

- [ ] **H1.** Every save action on every step emits an audit entry.
- [ ] **H2.** Audit entries appear in `/admin/audit` with correct module/entity tagging.
- [ ] **H3.** Before/after diff captured for every mutation.
- [ ] **H4.** Step 8 emits `committees_merged` / `committees_split` events.
- [ ] **H5.** Step 9 emits `committee_score_thresholds_changed`.
- [ ] **H6.** Step 10 emits exam-date config events.
- [ ] **H7.** Step 12 emits total-score config events.
- [ ] **H8.** Step 14 emits declaration save + publish events distinctly.

---

## I · Soft Delete & Data Protection

- [ ] **I1.** Net-new entities (merge/split rules, exam date config, total-score config, declarations) support soft delete.
- [ ] **I2.** List views hide soft-deleted by default.
- [ ] **I3.** Super-admin can toggle "إظهار المحذوف" to view soft-deleted.
- [ ] **I4.** Restore action available where applicable.
- [ ] **I5.** Dependency check blocks delete when child data exists.

---

## J · Scalability (the 15th step test)

- [ ] **J1.** Adding a 15th step requires only:
  - Append one entry to `ADMISSION_SETUP_STEPS` config.
  - Add one route segment to `ROUTES.admin.admissionSetup`.
  - Write one new page file.
- [ ] **J2.** No changes to `Sidebar.tsx`, `routes.tsx`, or shell components needed for a new step.
- [ ] **J3.** Sidebar automatically picks up the 15th step.
- [ ] **J4.** Breadcrumb automatically shows "الخطوة ١٥ من ١٥".
- [ ] **J5.** Wizard stepper automatically renders the 15th entry.

> **How to test:** add a fake 15th step config entry locally, verify it appears everywhere, then revert.

---

## K · Code Quality (spot-checks)

Run from `frontend/`:

```bash
npm run typecheck     # must be clean
npm run build         # must be clean
grep -rn ": any" src/features/admin/admission-setup/    # must return zero
grep -rn "export default" src/features/admin/admission-setup/    # must return zero
grep -rn "from '@/features/" src/shared/    # must return zero
grep -rn "navigate('/admin/admission\|to=\"/admin/admission" src/features/admin/admission-setup/    # must return zero
```

- [ ] **K1.** `npm run typecheck` clean.
- [ ] **K2.** `npm run build` clean.
- [ ] **K3.** Zero `any` in admission-setup code.
- [ ] **K4.** Zero default exports in admission-setup code.
- [ ] **K5.** Zero `shared → features` imports (Clean Arch).
- [ ] **K6.** Zero hardcoded admission-setup paths.
- [ ] **K7.** Composed steps reuse existing forms/services — no duplicated mutation logic.
- [ ] **K8.** Net-new services have `INTEGRATION CONTRACT` JSDoc on every method.

---

## L · Documentation

- [ ] **L1.** `docs/INTEGRATION_HANDOFF.md` §2 service inventory updated with `admissionSetupService` methods.
- [ ] **L2.** `Tasks/ADMIN_APP_SCOPE_ALIGNMENT.md` has a new section noting this enhancement.
- [ ] **L3.** Open question added to `docs/INTEGRATION_HANDOFF.md` §8 about cycle-as-aggregate-root vs separate tables.
- [ ] **L4.** Tag `admission-setup-shipped` exists in git.

---

## M · UX Smoke Test (click-through)

- [ ] **M1.** Log in as super_admin → التقديم section visible in sidebar.
- [ ] **M2.** Click التقديم → submenu expands smoothly.
- [ ] **M3.** Click each of the 15 items → each loads its own page.
- [ ] **M4.** Refresh browser on a step → still on that step, sidebar still expanded with that item highlighted.
- [ ] **M5.** Navigate to `/admin/audit` → entries from your test saves visible.
- [ ] **M6.** Switch cycle from a step page → all 15 step status pills update on next visit to index page.
- [ ] **M7.** Log out, log in as `applicant` → التقديم section NOT visible.
- [ ] **M8.** Log in as a non-admin staff role with no admission-setup permission → التقديم section NOT visible.

---

## Summary

- **Total items:** ~140
- **Pass threshold for sign-off:** all sections A, B, C, D, F, J, K must be 100%. Section E can have ⚠️ on items that depend on backend wiring (mark and document). Section H, I, L should be 100%. Section M is the live smoke test.

**Sign-off:**
- Reviewed by: __________________
- Date: __________________
- Result: ✅ Pass / ⚠️ Pass with notes / ❌ Fail
- Notes: __________________
