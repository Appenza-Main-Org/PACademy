# Admission-setup fixes — change report

Date: 2026-05-13
Scope: five small frontend changes to the admission-setup wizard and the
roles admin screen. Each change shipped as a separate commit with
`npm run typecheck` and `npm run build` green at the commit boundary.

## Commits

| # | SHA | Title |
|---|-----|-------|
| 1 | `7d319fc` | `fix(admission-setup): place exam_dates immediately after exams in wizard order` |
| 2 | `5e1a68e` | `feat(admission-setup): constrain exams order field to single digit (1-9)` |
| 3 | `e9e7dfa` | `feat(admission-setup): scope exams by active category via tabs` |
| 4 | `f97fdb7` | `feat(admission-setup): scope committees by active category via tabs` |
| 5 | `c35d819` | `feat(users): pre-enable all permissions when creating super_admin role` |

> An additional commit `e4c8d93 feat(exam-schedule): per-category exam
> schedule wizard step` landed between tasks 3 and 4 from a separate
> workstream and is not part of this change set.

## Task 1 — reorder wizard: exam_dates after exams

**Files touched**
- [frontend/src/features/admin/admission-setup/config.ts](../../../frontend/src/features/admin/admission-setup/config.ts) — swapped the `order` field on `committees` (5↔6) and `exam_dates` (5↔6).

The wizard's vertical stepper and Next/Previous buttons read from
`ADMISSION_SETUP_STEPS` sorted by `order`, so no other code paths
required changes. Verified at runtime that the wizard now reads
`exams → exam_dates → committees`, and that pressing "التالي" from
`/wizard/exams` advances to `/wizard/exam_dates`.

**Screenshots**
- Before: [screenshots/task-1-and-3-exams-before.png](screenshots/task-1-and-3-exams-before.png) — stepper shows exams (4) → committees (5) → exam_dates (6)
- After: [screenshots/task-1-and-3-exams-after.png](screenshots/task-1-and-3-exams-after.png) — stepper shows exams (4) → exam_dates (5) → committees (6)

## Task 2 — single-digit order field on the exams step

**Files touched**
- [frontend/src/features/admin/components/exams/ExamPlanEditor.tsx](../../../frontend/src/features/admin/components/exams/ExamPlanEditor.tsx)

The previously read-only order cell is now an `Input` with
`type="text"`, `inputMode="numeric"`, `pattern="[1-9]"`,
`maxLength={1}`, and a fixed `inline-size: 3rem` width. The change
handler strips non-`[1-9]` characters before committing the keystroke,
and a memoised per-row `orderErrors` map flags empty, out-of-range,
and duplicate orders. Each invalid row surfaces the inline error
`الترتيب يجب أن يكون رقمًا من 1 إلى 9 وغير مكرر`. Save is disabled
while any row is invalid and shows the same message as a toast if
clicked anyway.

Drag/up-down reorder controls still re-number positionally, so the
typical workflow stays one-click. Manual override via the input is
the new affordance.

**Screenshots**
- Before: [screenshots/task-2-order-input-error-before.png](screenshots/task-2-order-input-error-before.png) — orders rendered as static text `10`, `20`, …
- After: [screenshots/task-2-order-input-error-after.png](screenshots/task-2-order-input-error-after.png) — single-digit input cells + per-row inline error for any row whose order is outside 1–9 or duplicated

## Task 3 — exams step: tabs per active category

**Files touched**
- [frontend/src/features/admin/admission-setup/pages/ExamsManagementPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/ExamsManagementPage.tsx) — replaced the bespoke pill-strip with the shared `Tabs` primitive (`@radix-ui/react-tabs` under `shared/components/Tabs.tsx`).
- [frontend/src/features/admin/components/exams/ExamPlanEditor.tsx](../../../frontend/src/features/admin/components/exams/ExamPlanEditor.tsx) — empty-row copy now reads `لا توجد امتحانات لهذه الفئة بعد` with a primary `إضافة امتحان` CTA that picks the first unselected exam from the pool.

Active categories are sourced from `useCategoryConfigs()` (the
application_settings step's master data) filtered by
`isActive === true`. When zero categories are active, the page falls
back to an `EmptyState`:
`يرجى تفعيل فئة واحدة على الأقل من إعدادات التقديم`, linking back to
`/admin/admission-setup/application-settings`. Persistence is
unchanged — each tab still renders an `ExamPlanEditor` scoped to
`(cycleId, categoryId)` and saves via the existing
`useSaveExamPlan` mutation.

**Screenshots**
- Before: [screenshots/task-1-and-3-exams-before.png](screenshots/task-1-and-3-exams-before.png) — bespoke category-pill grid sourced from `cycle.openCategories`
- After: [screenshots/task-1-and-3-exams-after.png](screenshots/task-1-and-3-exams-after.png) — Radix Tabs sourced from active category configs

## Task 4 — committees step: tabs per active category

**Files touched**
- [frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx) — full rewrite around a Radix `Tabs` strip. Each tab owns its own `SelectionPanel` + card grid scoped to that category's bindings.

Reuses the existing `useActiveCategoriesForCycle` helper from
[frontend/src/features/admin/admission-setup/lib/activeCategories.ts](../../../frontend/src/features/admin/admission-setup/lib/activeCategories.ts)
(authored by the parallel exam-schedule workstream). With this commit
the helper now has 2 in-tree consumers (committees here +
exam-schedule's `ExamScheduleStep`); Task 3's exams page inlines the
same filter — `useCategoryConfigs().filter(c => c.isActive)` — and
should consolidate onto the shared helper if a third consumer
appears (CLAUDE.md §2.5 promotion guardrail, "only if used 3+ times").

Per-tab persistence flows through `useSetCommitteeBindings({cycleId,
academicYearId, categoryId, committeeIds})`. The "all categories"
combobox filter from the previous page is removed entirely — there's
no longer a route to accidentally overwrite a category's selection
with a different one's pool. Empty state per tab reads
`لا توجد لجان لهذه الفئة بعد` with a primary `إضافة لجنة` CTA linking
to the canonical committee-create page (`ROUTES.committee.create`).
Zero-active-categories falls back to the same hint used on the exams
step.

**Screenshots**
- Before: [screenshots/task-4-committees-before.png](screenshots/task-4-committees-before.png) — single pool + "تصفية حسب الفئة" combobox
- After: [screenshots/task-4-committees-after.png](screenshots/task-4-committees-after.png) — Radix Tabs strip, per-category panels

## Task 5 — super_admin role pre-checks all permissions

**Files touched**
- [frontend/src/features/admin/pages/RolesPage.tsx](../../../frontend/src/features/admin/pages/RolesPage.tsx)

Added a "نوع الدور" `Select` to the create-flow drawer with two
options:

1. `'custom'` — labelled "دور مخصص"; permission matrix starts empty
   (unchanged from prior behaviour).
2. `'super_admin'` — labelled "مدير النظام — جميع الصلاحيات"; a
   module-level `ALL_INTERACTIVE_PERMISSIONS` constant (computed once
   from `CLOUD_MODULES × CLOUD_ACTIONS` filtered through
   `isCellInteractive`) seeds `draft.permissions` so every interactive
   checkbox starts checked. A `useMemo` keyed on `roleTemplate` drives
   this so the canonical permission taxonomy is never mutated.

When the super_admin template is selected on create — or when the
seeded super_admin row is being edited — a teal hint banner surfaces
under the picker:
`مدير النظام يملك جميع الصلاحيات افتراضيًا`. The admin can uncheck
any cell before saving — pre-checking is the initial state, not a
lock. Other roles keep their existing default behaviour.

**Screenshots**
- Before (drawer): [screenshots/task-5-roles-drawer-before.png](screenshots/task-5-roles-drawer-before.png) — no role-type picker, no hint, empty matrix
- After (custom): [screenshots/task-5-roles-drawer-custom-after.png](screenshots/task-5-roles-drawer-custom-after.png) — picker visible at "دور مخصص", empty matrix
- After (super_admin): [screenshots/task-5-roles-drawer-super-admin-after.png](screenshots/task-5-roles-drawer-super-admin-after.png) — hint banner visible, every interactive cell pre-checked

## Verification

- `npm run typecheck` (zero project-source errors) was the gate at
  every commit boundary.
- `npm run build` was clean (only the pre-existing
  "chunks larger than 500 kB" warning, untouched by this changeset).
- Live browser walkthroughs of `/admin/admission-setup/wizard/exams`,
  `/wizard/exam_dates`, `/wizard/committees`, and `/admin/users/roles`
  exercised the Next/Previous flow, tab switching, per-row validation,
  and the role-template picker.

## Deviations from the prompt

1. **Pre-existing parallel workstream.** A separate, partially-merged
   exam-schedule workstream (`activeCategories.ts`, `examSchedule.*`,
   `step-status.ts` restructuring, mock-data wiring) was in flight in
   the working tree while these tasks ran. The
   `AdmissionSetupIndexPage` and `AdmissionSetupWizardPage` had been
   left in a half-migrated state by that workstream (referenced
   `examDateConfig` against a `StepStatusInputs` type that no longer
   declares it). I made the minimal two-line bridge fix in each page
   to swap `examDateConfig` → `examSchedule` so the typecheck gate
   could go green at commit boundaries; I did not author or modify
   the exam-schedule files themselves. Once that workstream lands,
   no further coordination is required.
2. **`useActiveCategoriesForCycle` not back-applied to Task 3.** The
   helper hook already exists (authored by the exam-schedule
   workstream) and Task 4 uses it. Task 3's exams page inlines the
   equivalent `useCategoryConfigs().filter(...)` filter because Task
   3 shipped before I'd looked at the helper, and re-touching a
   shipped commit purely for hook unification would have added churn
   without behaviour change. Recommend a follow-up consolidation
   once a third consumer of the helper appears (CLAUDE.md §2.5
   3+-usage threshold).
3. **Existing data orders are now invalid.** The mock exam plans seed
   orders at `10, 20, 30, …` — under the new 1–9 constraint, every
   seeded row reports an inline error until the admin re-numbers it.
   This is expected per the prompt and matches the user-facing
   policy; no migration was in scope.
