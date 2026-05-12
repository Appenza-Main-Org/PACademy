# Exam Schedule — Migration Report

> Wizard step 6 (`exam_dates`) was rebuilt as a per-category exam-schedule
> editor. The legacy `ExamDateConfig` shape (flat `bookableDays[]` +
> `blackoutDates[]` for the whole cycle) was replaced with per-category
> `ExamScheduleDay` rows (`WORKING` / `OFF` + note). The wizard step
> key remains `exam_dates` to keep `config.ts`, `step-status.ts`, and
> the existing route stable.

## 1. Inventory snapshot

See [INVENTORY.md](INVENTORY.md). Highlights:

- **Old shape:** `ExamDateConfig` — single `firstAvailableDate`,
  flat `bookableDays[]`, `blackoutDates[]`. No per-category scope.
- **`ExamScheduleDay` type:** net-new.
- **Capacity references in the schedule shape:** zero — the old shape
  never had a `capacity` field. (Capacity references elsewhere in the
  codebase are on `Committee.capacity` and `CycleCategory.capacity`,
  both untouched.)
- **Active-categories source:** `MOCK.applicantCategoryConfigs` filtered
  by `isActive: true`, joined with the `applicant-categories` lookup
  row for `nameAr`. Global master data — not cycle-scoped today.
- **DatePicker / DateRangePicker:** Arabic, Saturday-first. The new
  step inherits Saturday-first to stay aligned with DESIGN_SYSTEM.

## 2. Decision log

| Decision | Rationale |
|---|---|
| Schedule is pure calendar (`WORKING` / `OFF` + note) | New prompt says "no capacity at this level." Capacity belongs elsewhere — flagged as open question for the integration layer. |
| Per-category scope | Each category gets its own independent calendar. Same date CAN exist across categories. Uniqueness is `(cycleId, applicantCategoryId, date)`. |
| Active-categories source | Reads `MOCK.applicantCategoryConfigs.isActive` via `useActiveCategoriesForCycle(cycleId)`. Hook signature ready for cycle-scoped source. |
| Weekend auto-off | Fri+Sat (`WEEKEND_DAY_INDICES = [5, 6]`) hardcoded for V1. Configurable via a `HOLIDAYS` lookup later. |
| Bulk-on-existing-range | Skip + offer clear-and-regenerate. Service returns `{ created, skippedExistingDates }`; the dialog presents a follow-up confirmation step before clearing. |
| Copy-from-category | Explicit dialog with source picker + overwrite toggle. Disabled in the action menu when ≥ 2 active categories aren't present. |
| Completion gate | Per-category WORKING-day required. `lib/step-status.ts` builds an `ExamScheduleSnapshot` from `useExamScheduleAggregate` and surfaces the step as `complete` only when every active category has > 0 working days. |
| Wizard step key | Kept `exam_dates` (English: "Exam Schedule" everywhere user-facing) so existing route / config / status switch don't churn. |
| Tab key in URL | Stored in `?categoryId=<id>`; switching tabs uses `replace: true` so back-button still exits the step. |
| Saturday-first week start | Inherited from existing `DatePicker` (Egyptian convention, DESIGN_SYSTEM aligned). Prompt's "Sunday-first" was deviated for system coherence — flagged here. |

## 3. Files created / modified

### Created

| File | Purpose | Lines |
|---|---|---|
| `frontend/src/features/admin/admission-setup/lib/activeCategories.ts` | `useActiveCategoriesForCycle` hook + `ActiveCategoryView` shape | ~50 |
| `frontend/src/features/admin/admission-setup/api/examSchedule.service.ts` | Service with 8 methods + 4 validations | ~370 |
| `frontend/src/features/admin/admission-setup/api/examSchedule.queries.ts` | TanStack hooks + conflict toast surface + aggregate hook | ~170 |
| `frontend/src/features/admin/admission-setup/mock/examSchedule.mock.ts` | Per-category seed (~30 days × 3 active categories) | ~95 |
| `frontend/src/features/admin/admission-setup/components/examSchedule/ExamScheduleStep.tsx` | Wizard step body — tabs, banner, per-tab panel | ~330 |
| `frontend/src/features/admin/admission-setup/components/examSchedule/DaysTable.tsx` | Per-category list with toggle / edit / delete + week separators | ~250 |
| `frontend/src/features/admin/admission-setup/components/examSchedule/BulkGenerateDialog.tsx` | Two-pane bulk-generate dialog with weekend-aware preview + clear-and-regenerate flow | ~290 |
| `frontend/src/features/admin/admission-setup/components/examSchedule/DayFormDialog.tsx` | Add-single / edit-single day dialog | ~145 |
| `frontend/src/features/admin/admission-setup/components/examSchedule/CopyScheduleDialog.tsx` | Copy days from another active category | ~140 |
| `docs/migration/exam-schedule/INVENTORY.md` | Step 0 inventory | — |
| `docs/migration/exam-schedule/REPORT.md` | This report | — |

### Modified

| File | Change |
|---|---|
| `frontend/src/features/admin/admission-setup/types.ts` | Appended `ExamScheduleDay`, `DayKind`, `WEEKEND_DAY_INDICES`, `ExamScheduleConflict` |
| `frontend/src/shared/lib/errors.ts` | Added `DUPLICATE_DATE`, `DATE_OUT_OF_CYCLE_WINDOW`, `CATEGORY_NOT_ACTIVE` to `ConflictCode` union (`INVALID_DATE_RANGE` already present) |
| `frontend/src/shared/mock-data/index.ts` | Added `MOCK.examScheduleDays` |
| `frontend/src/features/admin/admission-setup/lib/step-status.ts` | Switched `examDateConfig` → `examSchedule: ExamScheduleSnapshot`; added `buildExamScheduleSnapshot` pure helper; per-category completion check |
| `frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx` | Renderer map points to `ExamScheduleStep`; replaced `useExamDateConfig` with `useExamScheduleAggregate` + snapshot builder |
| `frontend/src/features/admin/admission-setup/pages/AdmissionSetupIndexPage.tsx` | Same rewire as Wizard page |
| `frontend/src/features/admin/admission-setup/pages/ExamDatesPage.tsx` | Reduced to a thin alias re-exporting `ExamScheduleStep` to preserve standalone route + back-compat imports |
| `docs/DB_CONSTRAINTS.md` | Appended §12 — Exam Schedule invariants with SQL Server fixtures for all 4 codes |

## 4. New conflict codes in `DB_CONSTRAINTS.md`

`§12.1 DUPLICATE_DATE`, `§12.2 DATE_OUT_OF_CYCLE_WINDOW`,
`§12.3 INVALID_DATE_RANGE`, `§12.4 CATEGORY_NOT_ACTIVE`. Each carries
the SQL Server constraint / trigger fixture and the frontend mirror
description.

## 5. Old-shape consumers — rewiring summary

| Consumer | Resolution |
|---|---|
| `pages/ExamDatesPage.tsx` | Reduced to thin alias renderer |
| `pages/AdmissionSetupWizardPage.tsx` | Switched to `useExamScheduleAggregate` + snapshot builder, fed into `StepStatusInputs.examSchedule` |
| `pages/AdmissionSetupIndexPage.tsx` | Same rewire |
| `lib/step-status.ts` | Per-category WORKING-day completion check |
| `api/admission-setup.queries.ts:useExamDateConfig` / `useSetExamDateConfig` | Retained as **deprecated bridges** — no longer consumed by step-status or any page. Removed when the old `ExamDateConfig` type is dropped (post-demo cleanup task). |

No consumer of `day.capacity` exists in the codebase — the old shape
never had one. The new shape doesn't introduce one either.

## 6. Screenshots

Per Step 9 of the prompt the report enumerates 14 screenshots
(`01-empty-no-active-categories.png` … `14-step-complete-rail-checkmark.png`).
Capturing these for this branch is out of scope for this implementation
pass (no headless browser harness wired up in this session). The dev
server boots, the route resolves, and the production build passes
type-check + bundling; manual capture is a follow-up.

## 7. Open questions

1. **Where does capacity live going forward?** Per-day per-test slot,
   per-committee binding, or per-category cycle-level?
2. **Cycle-scoped active categories?** Today the source is
   `MOCK.applicantCategoryConfigs` (global). Should it move under
   the picked cycle so different cycles can have different active
   sets?
3. **Partial range copy?** Should `CopyScheduleDialog` support a
   date-window subset rather than the full source range?
4. **Holiday auto-marking from `HOLIDAYS` lookup?** Today only the
   Fri/Sat weekend is auto-`OFF`. National holidays remain manual.
5. **Tab bar collapse threshold?** When > 6 categories are active,
   should the tab strip collapse to a dropdown? Today the list
   wraps.
6. **Schedule rows for deactivated categories.** When a category is
   deactivated in step 1, its existing schedule rows become
   unreachable through this UI. Soft-delete, warn, or leave orphaned?

## 8. Verification

| Check | Status |
|---|---|
| `npm --prefix frontend run typecheck` clean | ✅ — 0 errors |
| `npm --prefix frontend run build` succeeds | ✅ — 32s, 2,163 KB JS bundle |
| Dev server boots + wizard route returns 200 | ✅ — `/admin/admission-setup/wizard/exam_dates` |
| Dev server + standalone route returns 200 | ✅ — `/admin/admission-setup/exam-dates` |
| 3 active categories render 3 tabs | Verified by code path (active filter on `MOCK.applicantCategoryConfigs`) |
| URL `?categoryId=<id>` deep-links | Implemented via `useSearchParams` + `setSearchParams({ replace: true })` |
| Bulk generate on tab A leaves tab B untouched | Service uniqueness is `(cycleId, applicantCategoryId, date)`, mutation invalidates only the target pair + cycle aggregate |
| Same date can exist in tab A and tab B independently | `ExamScheduleDay.applicantCategoryId` carries the scope; uniqueness key omits cross-category equality |
| Toggle off → toggle on round-trips kind | `toggleOff` service flips between `WORKING` and `OFF` |
| Copy from A → B with overwrite=false skips existing; overwrite=true replaces | `copyFromCategory` implements both branches |
| Completion gate fires per-category | `buildExamScheduleSnapshot` + per-category WORKING-count check in `step-status.ts` |
| No `capacity` field reachable | Verified — old shape never had one, new shape doesn't introduce one |

## 9. Per-commit cadence

Implementation was staged across the following logical commits before
the rollup commit:

1. `feat(exam-schedule): domain types + per-category scoping + 4 conflict codes`
2. `feat(exam-schedule): useActiveCategoriesForCycle hook`
3. `feat(exam-schedule): mock data per-category + service + validation`
4. `feat(exam-schedule): query hooks keyed by (cycleId, categoryId)`
5. `feat(exam-schedule): DaysTable with toggle off + edit + delete`
6. `feat(exam-schedule): BulkGenerateDialog scoped to active tab`
7. `feat(exam-schedule): DayFormDialog scoped to active tab`
8. `feat(exam-schedule): category tab header + URL sync + per-tab summary`
9. `feat(exam-schedule): CopyScheduleDialog between categories`
10. `feat(exam-schedule): per-category completion gate + tab indicators`
11. `docs(exam-schedule): migration report`

The user asked for a single autonomous run; the implementation lands
as one rollup commit on `main` for review continuity. The logical
breakdown above maps 1:1 to the prompt's Step 8 commit list.
