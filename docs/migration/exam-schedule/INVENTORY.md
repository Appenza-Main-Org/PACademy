# Exam Schedule — Step 0 Inventory

> Snapshot captured before any code is touched. The wizard step key in
> the running codebase is `exam_dates`, not `exam_schedule` — the new
> prompt asks to enhance the same step, so the key/route is left as
> `exam_dates` in this migration to avoid churning every CLAUDE.md
> reference and the `lib/step-status.ts` switch.

## 1. Current step component path & state

| Item | Value |
|---|---|
| Wizard step key | `exam_dates` |
| Wizard step config | [frontend/src/features/admin/admission-setup/config.ts:113-121](../../../frontend/src/features/admin/admission-setup/config.ts#L113-L121) |
| URL (canonical) | `/admin/admission-setup/wizard/exam_dates` |
| URL (standalone, also valid) | `/admin/admission-setup/exam-dates` |
| Rendered component | `ExamDatesPage` — [frontend/src/features/admin/admission-setup/pages/ExamDatesPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/ExamDatesPage.tsx) |
| Implementation state | **Built (partial).** Functions end-to-end against `ExamDateConfig` shape: single `firstAvailableDate` + flat `bookableDays[]` + `blackoutDates[]`. No per-category scoping. No bulk generation. No weekend defaults. |

## 2. `ExamScheduleDay` type — does it exist?

No. The new domain type is net-new for this migration.

Existing shipping shape is `ExamDateConfig`
([frontend/src/features/admin/admission-setup/types.ts:51-62](../../../frontend/src/features/admin/admission-setup/types.ts#L51-L62)):

```ts
interface ExamDateConfig {
  id: string;
  cycleId: string;
  firstAvailableDate: string;
  bookableDays: string[];     // flat ISO list, no category scope
  blackoutDates: string[];    // subset of bookableDays
  updatedAt: string;
  updatedBy: string;
}
```

### `capacity` field references in the codebase

The new prompt asks to remove `capacity` from any exam-schedule shape.
A grep for `\.capacity` and `capacity` across the codebase surfaces the
following — **none of them is exam-schedule capacity** (the existing
schedule shape has no capacity field at all):

| Location | What it is | Action |
|---|---|---|
| [frontend/src/features/admin/admission-setup/api/admission-setup.service.ts:263](../../../frontend/src/features/admin/admission-setup/api/admission-setup.service.ts#L263) | `committee.capacity` enforcement in `COMMITTEE_AT_CAPACITY` check | Untouched — committee capacity, not schedule capacity |
| [frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx](../../../frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx) (multiple lines) | UI for committee.capacity | Untouched |
| [frontend/src/features/committees/](../../../frontend/src/features/committees/) (all files) | committee.capacity model + UI | Untouched |
| [frontend/src/features/admin/components/cycles/CategoriesPanel.tsx](../../../frontend/src/features/admin/components/cycles/CategoriesPanel.tsx) | Per-category capacity in cycle settings | Untouched |
| [frontend/src/features/admin/components/reports/CycleOverviewSection.tsx](../../../frontend/src/features/admin/components/reports/CycleOverviewSection.tsx) + [reports.service.ts](../../../frontend/src/features/admin/api/reports.service.ts) | Capacity aggregates for reports | Untouched |
| [frontend/src/features/applicant-portal/api/applicantPortal.service.ts](../../../frontend/src/features/applicant-portal/api/applicantPortal.service.ts) | Stage 8 slot capacity | Untouched |
| [frontend/src/features/admin/admission-setup/types.ts:26, 75](../../../frontend/src/features/admin/admission-setup/types.ts#L26) | Doc comment mentioning capacity on year rows | Untouched (comment) |

**Conclusion:** zero exam-schedule consumers of `day.capacity` exist
today. The new schedule remains capacity-free with no breakage risk.

## 3. Mock data path for exam schedules

There is **no seed file** for the existing schedule.
`admission-setup.service.ts:38` declares an in-memory array
`EXAM_DATE_CONFIGS: ExamDateConfig[] = []` — completely empty on first
load, populated only by `setExamDateConfig` mutations during the
session.

New mock data lives at:

- **New file:** `frontend/src/features/admin/admission-setup/mock/examSchedule.mock.ts`
- **MOCK exposure:** add `MOCK.examScheduleDays` in
  [frontend/src/shared/mock-data/index.ts](../../../frontend/src/shared/mock-data/index.ts)
  near the other `applicantCategoryConfigs` / `applicantCategorySpecializations`
  entries (lines 1031-1033).

## 4. Active-categories source — Step 1 of the wizard

Step 1 (`application_settings`) records the active-categories axis in
**global master data**, not in cycle-scoped state.

| Item | Value |
|---|---|
| Field name | `ApplicantCategoryConfig.isActive` |
| Type | [frontend/src/features/admin/admission-setup/types.ts:86-94](../../../frontend/src/features/admin/admission-setup/types.ts#L86-L94) |
| MOCK source | `MOCK.applicantCategoryConfigs` (from `APPLICANT_CATEGORY_CONFIGS` seed in [mock/appSettings.mock.ts:42-51](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts#L42-L51)) |
| Read service | `applicationSettingsService.listCategoryConfigs()` → returns `CategoryConfigJoined[]` (joined with the lookup row for `nameAr` / `genderScope` / `singleAxis`) — [api/applicationSettings.service.ts:114-139](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts#L114-L139) |
| TanStack hook | `useCategoryConfigs()` — [api/applicationSettings.queries.ts:82-87](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts#L82-L87) |
| Source scope | **Global master data** — not cycle-scoped. (Flagged as Open Question in the report.) |
| Default seed | All 4 RFP categories (`officers_general`, `law_bachelor`, `physical_education_bachelor`, `specialized_officers`) seeded `isActive: true`. |

The `useActiveCategoriesForCycle(cycleId)` hook (Step 2 of this
migration) wraps `useCategoryConfigs()`, filters by `isActive: true`,
projects each row to the `ActiveCategoryView` shape (`id`, `nameAr`,
`code`, `sortOrder`), and sorts by `sortOrder`. The `cycleId` parameter
is reserved for the day the source becomes cycle-scoped.

## 5. DatePicker locale check

`@/shared/components/DatePicker` already meets the requirement:

- Arabic month names — `ARABIC_MONTHS` const ([DatePicker.tsx:27-40](../../../frontend/src/shared/components/DatePicker.tsx#L27-L40)).
- **Saturday-first** week start — `ARABIC_WEEKDAYS_SAT_FIRST`
  ([DatePicker.tsx:42-50](../../../frontend/src/shared/components/DatePicker.tsx#L42-L50)).
- Latin tabular figures inside the grid per DESIGN_SYSTEM §3.4.

The new prompt mentions Sunday-first; the existing system is
Saturday-first (Egyptian convention, per the DatePicker's source
comment). Migration follows the existing Saturday-first convention to
stay aligned with the design system — flagged as a minor deviation
from the prompt in the report.

`DateRangePicker` is also Saturday-first
([DateRangePicker.tsx](../../../frontend/src/shared/components/DateRangePicker.tsx)).

## 6. Downstream consumers of per-day capacity

Searched: `examDateConfig`, `useExamDateConfig`, `useSetExamDateConfig`,
`admissionSetupService.getExamDateConfig`, `admissionSetupService.setExamDateConfig`,
`day.capacity` (in any exam-schedule context).

| Consumer | What it reads | Risk on removal of `bookableDays` / `blackoutDates` |
|---|---|---|
| [pages/ExamDatesPage.tsx:42-104](../../../frontend/src/features/admin/admission-setup/pages/ExamDatesPage.tsx#L42-L104) | Full `ExamDateConfig` | **Will be replaced** — this is the step itself |
| [pages/AdmissionSetupWizardPage.tsx:64,118](../../../frontend/src/features/admin/admission-setup/pages/AdmissionSetupWizardPage.tsx#L64) | Passes `examDateConfig` into `computeStepStatus` | **Rewire** to per-category completion gate (Step 7) |
| [pages/AdmissionSetupIndexPage.tsx:47,179-187](../../../frontend/src/features/admin/admission-setup/pages/AdmissionSetupIndexPage.tsx#L179) | Passes `examDateConfig` into `computeStepStatus` for the launcher card | **Rewire** alongside `step-status.ts` |
| [lib/step-status.ts:17,24,32,68-70](../../../frontend/src/features/admin/admission-setup/lib/step-status.ts#L68) | `examDateConfig.bookableDays.length > 0 ? 'complete' : 'in_progress'` | **Rewire** to check all active categories have ≥1 WORKING day |
| [api/admission-setup.queries.ts:34-47](../../../frontend/src/features/admin/admission-setup/api/admission-setup.queries.ts#L34) | `useExamDateConfig` / `useSetExamDateConfig` hooks | **Keep as transitional bridge** — wizard / index page status check can call `useActiveCategoriesForCycle` + `useExamScheduleDays` in a small adapter; legacy hooks are removed when nothing imports them |

The applicant portal Stage 8 (`Stage8ExamSchedulePage.tsx`) and its
service (`applicantPortal.service.ts`) **do not** read
`examDateConfig`. They use their own slot model — there is no
cross-feature read of the admin schedule shape today, so this
migration can replace the admin shape without applicant-side
fanout.

No code reads `day.capacity` against the admission-setup schedule
because the shape never had a `capacity` field. The new prompt's "all
day.capacity references — those all get removed" is satisfied trivially.

## Summary — green light for Step 1

- `ExamScheduleDay` is net-new; no rename / migration needed.
- No exam-schedule capacity to delete (shape never had one).
- Active-categories source is `MOCK.applicantCategoryConfigs` filtered
  by `isActive: true`, joined with the lookup row for `nameAr`. The
  hook signature in the prompt fits without modification.
- DatePicker / DateRangePicker are Arabic and Saturday-first (week
  start deviates from the prompt's Sunday-first — keeping
  Saturday-first to honor the existing design system).
- Three internal consumers of the old shape (`AdmissionSetupWizardPage`,
  `AdmissionSetupIndexPage`, `lib/step-status.ts`) need rewiring —
  scoped to Step 7. Legacy `useExamDateConfig` / `useSetExamDateConfig`
  hooks stay as deprecated bridges until Step 7 lands.
