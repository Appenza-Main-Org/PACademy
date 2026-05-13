# Committee × Day Binding — Step 0 Inventory

> Source-of-truth read of the existing committees wizard step and the
> hooks the new bindings sub-tab will depend on. Written **before** any
> code is touched, per Gate 1.

URL under audit: `/admin/admission-setup/wizard/committees`
(wizard step key `committees`, route segment `committees` — see
[frontend/src/features/admin/admission-setup/config.ts:111-121](frontend/src/features/admin/admission-setup/config.ts#L111-L121)).

---

## 1 · Committees step component path

The step is composed by exactly one page file:

- [frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx](frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx)
  - Exports the named `CommitteesManagementPage()` JSX element (no
    default export — Clean Arch / §2.5 rule observed).
  - Wraps body in `<AdmissionSetupShell>` and renders a `Card` containing a
    Radix-backed `Tabs` strip — one tab per **active** applicant category
    (driven by `useActiveCategoriesForCycle(cycle.id)`).
  - The body component is `Body({ cycle })`; per active-tab content is
    `CategoryBindings({ cycle, categoryKey, categoryLabel })`. That
    sub-component is where the existing **roster** UI lives — a
    `SelectionPanel` (MultiSelect + save) over the eligible-committee
    pool, plus a `CommitteeCard` grid bound to `selectedIds`.
  - Persistence flows through
    `useSetCommitteeBindings({ cycleId, academicYearId, categoryId, committeeIds, actorUserId? })`
    from
    [frontend/src/features/admin/admission-setup/api/admission-setup.queries.ts:93-107](frontend/src/features/admin/admission-setup/api/admission-setup.queries.ts#L93-L107).

This page is what Step 3 will refactor — the entire body of `CategoryBindings`
becomes the `roster` sub-tab; a new `bindings` sub-tab sits beside it.

The wizard hosts this page via the dynamic stepKey route
`/admin/admission-setup/wizard/:stepKey`
([frontend/src/config/routes.ts:59-61](frontend/src/config/routes.ts#L59-L61)).

---

## 2 · Does `Committee` carry `applicantCategoryId` and a cycle-level seat cap?

**No singular `applicantCategoryId`. Yes a cycle-level seat cap.**

Reading [frontend/src/shared/types/domain.ts:419-464](frontend/src/shared/types/domain.ts#L419-L464):

| Field on `Committee` | Present? | Notes |
|---|---|---|
| `applicantCategoryId` | ❌ not defined | The shipped shape exposes **`linkedCategoryIds?: ApplicantCategoryKey[]`** — a **multi**-category set, not a singular FK. The single-category contract the prompt assumes does not exist on `Committee` today. |
| `linkedCategoryIds` | ✅ optional `ApplicantCategoryKey[]` | Multi-select binding hint stored on the committee itself. |
| `capacity` | ✅ optional `number` | **This is the cycle-level seat cap** — seed values are 700 / 650 / 700 / 650 / 600 ([frontend/src/shared/mock-data/index.ts:778-812](frontend/src/shared/mock-data/index.ts#L778-L812)). The prompt's "700-cap" screenshot reference matches `C-01`/`C-03`. |
| `capacityPerDay` | ✅ optional `number` | A **separate** daily ceiling (Gap H). Mentioned for completeness — not what the prompt is asking about. |
| `academicYearId` | ✅ optional `string` | "2026-2027" etc. — already used to filter the eligibility list. |
| `availableDates?: string[]` | ✅ optional `string[]` | A weak hint; the matrix's authoritative day source is `examScheduleService`. |

**Authoritative committee↔category relationship for this wizard**: lives in
the separate `CategoryCommittees` entity
([frontend/src/shared/types/domain.ts:466-489](frontend/src/shared/types/domain.ts#L466-L489)),
which is the per-(cycle, category, committee, year) binding row that
the existing roster sub-tab persists. So `COMMITTEE_WRONG_CATEGORY` in
Step 1 is checked **against `CategoryCommittees` for the active (cycleId,
applicantCategoryId)**, not against a singular field on `Committee`.

**Implication for Step 1 type:** keep
`CommitteeDayBinding.applicantCategoryId` as designed (string FK to
`ApplicantCategory.code`). The invariant text against
`Committee.applicantCategoryId` rewrites to "the committee must appear
in the cycle's `CategoryCommittees` rows for `applicantCategoryId`."

---

## 3 · Confirm the four hooks/helpers exist

| Identifier from prompt | Exists? | Where | Notes |
|---|---|---|---|
| `useActiveCategoriesForCycle` | ✅ | [lib/activeCategories.ts:34](frontend/src/features/admin/admission-setup/lib/activeCategories.ts#L34) | Returns `{ data: ActiveCategoryView[] \| undefined, isLoading, isError }`. Each view has `{ id, nameAr, code, sortOrder }` where `id === code` (ApplicantCategory code, e.g. `officers_general`). |
| `useExamScheduleDays` | ✅ | [api/examSchedule.queries.ts:64](frontend/src/features/admin/admission-setup/api/examSchedule.queries.ts#L64) | Signature: `(cycleId: string \| null, applicantCategoryId: string \| null) → UseQueryResult<ExamScheduleDay[]>`. Returns **both** WORKING and OFF days; matrix columns must filter `kind === 'WORKING'`. |
| `resolveCategorySubmissionType` | ❌ **not present** | — | No function by that name exists. The closest concept is `resolveGradingModeForSpec(categorySpecializationId, deps)` in [lib/resolveGradingMode.ts:36](frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts#L36) — but that resolves by **spec** id, not by **category** code. The path the new binding needs is direct: `applicant-categories[code].metadata.submissionTypeCode → submission-types[code].metadata.gradingMode`. The seed mock already implements this exact walk inline in [mock/appSettings.mock.ts:107-119](frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts#L107-L119) (`GRADING_MODE_BY_CATEGORY`). **Decision proposal:** add a small `resolveCategoryGradingMode(categoryCode, deps): GradingMode \| null` helper next to `resolveGradingModeForSpec` rather than reusing it — its existing spec-walk doesn't fit the matrix's per-category use, and a 10-line dedicated helper is clearer than overloading the spec one. Confirm at Gate 1. |
| `readGradingMode` | ✅ | [features/lookups/lib/submissionType.ts:14](frontend/src/features/lookups/lib/submissionType.ts#L14) | Single sanctioned read of `submission-types[code].metadata.gradingMode`. Re-exported from [features/lookups/index.ts:72](frontend/src/features/lookups/index.ts#L72). Use this — do not re-walk `metadata` from feature code. |

`GradingMode` type itself: `'GRADES' \| 'TAGDIR'`
([features/lookups/lib/gradingModes.ts](frontend/src/features/lookups/lib/gradingModes.ts)).

---

## 4 · ACADEMIC_GRADES lookup — items + percentage-range metadata

Lookup key: `academic-grades` (catalogue `LOOKUPS_SEED['academic-grades']`).
Row shape: `AcademicGradeRow extends LookupRowBase`
([features/lookups/types.ts:322-326](frontend/src/features/lookups/types.ts#L322-L326)).
Percentage-range accessor:
[features/lookups/lib/academicGrade.ts](frontend/src/features/lookups/lib/academicGrade.ts) —
`readPercentageRange(row): { min: number; max: number } | null` (inclusive,
both ends). **This is the single sanctioned read; the matrix form's
TAGDIR-mode hints under each تقدير combobox option must call it — do
not re-walk `metadata` from feature code.**

Seeded rows ([features/lookups/mock/lookups.mock.ts:891-920](frontend/src/features/lookups/mock/lookups.mock.ts#L891-L920)):

| code | `name` (ar) | `nameEn` | `minPercentage` | `maxPercentage` | active |
|---|---|---|---:|---:|---|
| `AGR-01` | امتياز | Excellent | 85 | 100 | ✅ |
| `AGR-02` | جيد جداً | Very Good | 75 | 84 | ✅ |
| `AGR-03` | جيد | Good | 65 | 74 | ✅ |
| `AGR-04` | مقبول | Pass | 50 | 64 | ✅ |

Two consequences for Step 4 form validation:

1. **TAGDIR sortOrder** is **not** a column on `AcademicGradeRow` —
   ordering is implicit (the seed array is descending: امتياز → مقبول).
   The "min ≤ max" rule the prompt asks for must therefore key off
   either an explicit row index (descending in the seed → ascending
   percentage band, so `minPercentage` is the right comparator) or
   directly off `readPercentageRange(row).min`. The cleanest read is
   "`min.minPercentage ≤ max.minPercentage`" — i.e. compare on the
   floor of each picked band. Confirm at Gate 1.
2. **The percentage-band hint** beneath each combobox option is just
   `${range.min}–${range.max}%`. Existing precedent: the same hint
   already appears in `LookupTabPanel`/application-settings — replicate
   the visual shape.

---

## 5 · Other moving parts the new step depends on (decided in-flight)

- **`ConflictError` machinery** — [shared/lib/errors.ts:44](frontend/src/shared/lib/errors.ts#L44). New conflict codes are added to the `ConflictCode` union and surfaced via the queries layer's `surfaceError(err)` pattern already in use by exam-schedule (see [api/examSchedule.queries.ts:45-60](frontend/src/features/admin/admission-setup/api/examSchedule.queries.ts#L45-L60)). Eight new codes from the prompt (`DUPLICATE_BINDING`, `CAPACITY_NOT_POSITIVE`, `GRADE_RANGE_INVERTED`, `PERCENTAGE_OUT_OF_RANGE` *(already present — share)*, `TAGDIR_GRADE_NOT_FOUND`, `MODE_MISMATCH`, `DAY_NOT_WORKING`, `COMMITTEE_WRONG_CATEGORY`) — note `PERCENTAGE_OUT_OF_RANGE` is already on the union from Application Settings (line 31); we reuse the same code with the new copy in the Arabic toast map. Confirm at Gate 1 whether to reuse or rename.

- **`DB_CONSTRAINTS.md`** — sections `§11` (Application Settings) and `§12` (Exam Schedule) already follow the canonical "code → invariant → SQL Server expression" shape. New section **`§13 · Committee Bindings`** appended in Step 1, matching that shape.

- **Tabs primitive** — `Tabs` / `Tabs.List` / `Tabs.Tab` / `Tabs.Panel` exists in `@/shared/components` ([shared/components/Tabs.tsx](frontend/src/shared/components/Tabs.tsx)) and is already used in the same step body. Sub-tab strip in Step 3 will use that same wrapper, **not** import `@radix-ui/react-tabs` directly (per §2.5 layer-3 rule). URL persistence via `?subtab=roster|bindings` will use `useSearchParams` from `react-router-dom` (same pattern as `?categoryId=...` in `LookupTabPanel`).

- **Combobox / MultiSelect** — already token-styled in `@/shared/components`; portal-popover scroll guard documented in CLAUDE.md §13 already handles the in-popover scroll case, so day/committee comboboxes won't need a re-fix.

- **No new third-party deps.** No `framer-motion`, no shadcn, no styled lib. Radix Tabs is already in the dep graph via `Tabs.tsx`.

---

## 6 · Open questions to settle at Gate 1

1. **`resolveCategorySubmissionType` doesn't exist.** Two options:
   - (a) Add `resolveCategoryGradingMode(categoryCode, deps): GradingMode | null` next to `resolveGradingModeForSpec` and consume it from the binding service + the form.
   - (b) Inline the 4-step walk inside the binding service (it's already inlined inside the appSettings mock seed at line 107-119).
   **Recommendation: option (a)** — single sanctioned read path, mirrors the spec-side helper, keeps feature code clean of metadata reaches.

2. **`PERCENTAGE_OUT_OF_RANGE` already in `ConflictCode` union.** The prompt lists 8 codes for the new feature including this one. Reuse the existing code (different Arabic copy is fine; the code is the same invariant) — versus a new prefixed code like `BINDING_PERCENTAGE_OUT_OF_RANGE`.
   **Recommendation: reuse.** The invariant is identical; the copy in the binding-queries toast map makes the user-facing message context-appropriate.

3. **`COMMITTEE_WRONG_CATEGORY` semantics.** Two enforceable readings:
   - (a) Strict — the committee must be in the cycle's `CategoryCommittees` rows for the binding's `applicantCategoryId` (i.e. the roster sub-tab has already added it).
   - (b) Loose — `Committee.linkedCategoryIds?.includes(applicantCategoryId)` (the committee declares it serves that category).
   **Recommendation: (a)**, because the roster step is the wizard's authoritative cycle-level binding and the matrix should not let admins bind to a committee not in the roster. This also gives the matrix a natural empty state when the roster sub-tab is incomplete.

4. **TAGDIR ordering.** Use `readPercentageRange(row).min` as the comparator (rather than seed array order). Stable across mock-data tweaks. Confirm.

5. **Mock seed strategy.** Prompt: "one binding per (committee, WORKING day) in each active category." Two corners:
   - Use the cycle's `CategoryCommittees` rows as the source-of-truth committee set per category (matching `COMMITTEE_WRONG_CATEGORY` recommendation).
   - For categories with `gradingMode = 'GRADES'`, seed `{ min: 60, max: 100 }`. For `TAGDIR`, seed `{ min: 'AGR-03' (جيد), max: 'AGR-01' (امتياز) }`.
   - `capacity` per-cell = `committee.capacity ÷ workingDayCount`, floored, min 1.
   **Confirm both shape and defaults.**

6. **`AdmissionSetupShell` write-mode.** `useAdmissionSetupCanWrite()` is already in scope from the existing page — the new sub-tab honors it for all mutation surfaces (form disabled, bulk dialogs blocked, dashed "+" cells become inert). Same precedent as the roster sub-tab.

---

## 7 · Surface area Step 1 onwards will touch

| Path | Edit kind |
|---|---|
| `frontend/src/features/admin/admission-setup/types.ts` | extend — append `BindingEligibility`, `CommitteeDayBinding`, `BindingConflict` |
| `frontend/src/shared/lib/errors.ts` | extend — append 7 net-new codes to `ConflictCode` (reusing `PERCENTAGE_OUT_OF_RANGE`) |
| `frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts` | extend — add `resolveCategoryGradingMode` helper |
| `frontend/src/features/admin/admission-setup/api/committeeBinding.service.ts` | **new** — service + validators |
| `frontend/src/features/admin/admission-setup/api/committeeBinding.queries.ts` | **new** — TanStack hooks + Arabic toast map |
| `frontend/src/features/admin/admission-setup/mock/committeeBindings.mock.ts` | **new** — seed |
| `frontend/src/features/admin/admission-setup/pages/CommitteesManagementPage.tsx` | refactor — wrap body in `roster`/`bindings` sub-tabs |
| `frontend/src/features/admin/admission-setup/components/committeeBinding/CommitteeBindingMatrix.tsx` | **new** |
| `…/committeeBinding/BindingFormDialog.tsx` | **new** |
| `…/committeeBinding/BulkEligibilityDialog.tsx` | **new** |
| `…/committeeBinding/CopyRowDialog.tsx` | **new** |
| `…/committeeBinding/CopyColumnDialog.tsx` | **new** |
| `…/committeeBinding/CompletionBanner.tsx` | **new** |
| `frontend/src/features/admin/admission-setup/lib/step-status.ts` | extend `committees` branch — gate completion on `(roster.complete && bindings.complete)` |
| `docs/DB_CONSTRAINTS.md` | extend — append §13 "Committee Bindings — invariants" |

No `shared/components/` additions (single-feature per gate spec).
No new third-party deps.

---

**Gate 1 — awaiting go.**
