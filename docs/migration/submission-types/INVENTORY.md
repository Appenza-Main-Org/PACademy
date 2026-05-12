# SUBMISSION_TYPES migration — Step 0 Inventory

> **Stop-and-ask gate.** This is what exists in the codebase today, plus a flag list of places the upcoming prompt's API assumptions diverge from the current shape. Do not start Step 1 until the divergences below are reconciled — they change the diff list.

---

## 0. Critical mismatch between the prompt and the codebase (read first)

The prompt assumes a generic-lookup data model (`LOOKUP_TYPE_CODES`, `HIERARCHICAL_TYPES`, `LookupItem` with a `metadata` JSON field, a `LookupType` row to insert). **None of those identifiers exist** in `frontend/src/features/lookups/`. The actual shape is a discriminated union of typed per-key row interfaces (`ApplicantCategoryRow`, `FacultyRow`, …) keyed by hyphenated `LookupKey` literals.

| Prompt identifier | Actual identifier(s) | Notes |
|---|---|---|
| `LOOKUP_TYPE_CODES: 'SUBMISSION_TYPES' \| 'APPLICANT_CATEGORIES' \| …` | `LOOKUP_KEYS: 'applicant-categories' \| 'faculties' \| …` ([types.ts:18-36](frontend/src/features/lookups/types.ts#L18-L36)) | Hyphenated, lowercase. No SCREAMING_SNAKE. Position in this array drives sidebar order ([LOOKUP_SECTIONS](frontend/src/features/lookups/types.ts#L45-L86) controls section grouping). |
| `HIERARCHICAL_TYPES` | No such array. Hierarchy is per-row via `parentCode: string \| null` on `RelationshipRow` / `JobRow`, **not** a global flag list. | Adding `SUBMISSION_TYPES` does not need to opt out of anything — it's flat by default. |
| `LookupItem` with `metadata: { gradingMode?: …}` JSON field | `interface LookupRowBase { code; name; isActive }` + per-key row shape ([types.ts:112-117](frontend/src/features/lookups/types.ts#L112-L117) and [types.ts:119-240](frontend/src/features/lookups/types.ts#L119-L240)). **No `metadata` field exists on any row, anywhere.** | Storing `gradingMode` requires either (a) adding a typed `gradingMode` column directly on a new `SubmissionTypeRow`, or (b) introducing a generic `metadata` slot — choose deliberately; the rest of the module assumes typed columns. Recommendation: typed column. |
| `LookupType` row in mocks (separate "lookup of lookups") | `LOOKUP_META` static `Record<LookupKey, {label, codePrefix, padding}>` ([types.ts:90-108](frontend/src/features/lookups/types.ts#L90-L108)). There is no runtime LookupType collection to insert into. | Adding a new key means: add to `LOOKUP_KEYS`, add to a `LOOKUP_SECTIONS` group, add to `LOOKUP_META`, add to `LookupRowMap`, add a typed row interface, seed in `lookups.mock.ts`, plumb a tab-panel column array, plumb a form case in `LookupRowDrawer`, plumb a default-value case in `LookupRowDrawer`. |

**Recommendation for Step 1**: drop the `metadata` indirection. Add a typed `SubmissionTypeRow extends LookupRowBase { gradingMode: GradingMode }` and an `applicant-categories`-side FK `submissionTypeCode: string`. The accessor in `submissionType.ts` then becomes a simple field read, not a metadata-assertion gauntlet. `assertGradingMode` still has value at the seed-parsing boundary, but is not load-bearing for runtime FK resolution.

---

## 1. Every consumer of "نوع التقديم" / `applicationMode` today

The dimension already exists in the schema as `ApplicantCategoryApplicationMode = 'general' | 'nomination'` ([types.ts:173](frontend/src/features/lookups/types.ts#L173)), carried directly on `ApplicantCategoryRow.applicationMode` ([types.ts:175-178](frontend/src/features/lookups/types.ts#L175-L178)). The migration is a **swap from inline enum → FK to a new SUBMISSION_TYPES lookup**, plus the addition of `gradingMode`.

### 1.1 Direct consumers of `applicationMode` (the field that becomes a FK)

| Where | Use |
|---|---|
| [`features/lookups/types.ts:173-178`](frontend/src/features/lookups/types.ts#L173-L178) | Type definition: `ApplicantCategoryApplicationMode` union + `ApplicantCategoryRow.applicationMode` field. |
| [`features/lookups/mock/lookups.mock.ts:219-227`](frontend/src/features/lookups/mock/lookups.mock.ts#L219-L227) | 8 seed rows. CAT-04 and CAT-08 are `'nomination'`; the rest are `'general'`. |
| [`features/lookups/components/LookupTabPanel.tsx:463`](frontend/src/features/lookups/components/LookupTabPanel.tsx#L463) | Grid column **labeled `'نوع التقديم'`** rendering `Badge` "عام" / "بالترشيح". This is the exact column the new SUBMISSION_TYPES FK display will replace (or label-by-code through). |
| [`features/lookups/components/LookupRowDrawer.tsx:307-314`](frontend/src/features/lookups/components/LookupRowDrawer.tsx#L307-L314) | `<Select label="نوع التقديم">` editor with `'general' / 'nomination'` options. Becomes a `ForeignKeySelect lookupKey="submission-types"` after migration. |
| [`features/lookups/components/LookupRowDrawer.tsx:556-558`](frontend/src/features/lookups/components/LookupRowDrawer.tsx#L556-L558) | Default-values factory: `{ ...base, genderScope: 'any', applicationMode: 'general' }` when creating an applicant-category row. Becomes `submissionTypeCode: <first active SUBMISSION_TYPES code or required-empty>`. |
| [`features/lookups/index.ts:31-33`](frontend/src/features/lookups/index.ts#L31-L33) | Re-export `ApplicantCategoryApplicationMode`. Either keep as deprecated alias of the new `GradingMode`+SUBMISSION_TYPES split, or remove if no external imports. (`grep` shows zero external importers.) |

### 1.2 Indirect consumers (string copy / unrelated `'general'` enums that look similar)

These are **not** the lookup's `applicationMode` — they're separate concepts that happen to share Arabic vocabulary. Do not migrate them.

| Where | What it is | Action |
|---|---|---|
| [`features/admin/admission-setup/pages/TotalScorePage.tsx:32-37`](frontend/src/features/admin/admission-setup/pages/TotalScorePage.tsx#L32-L37) | A different enum: `ApplicantStream = 'general' \| 'special' \| 'law' \| 'sports_female'` (defined at [`admission-setup/types.ts:97`](frontend/src/features/admin/admission-setup/types.ts#L97)) used for per-stream score weighting. The label `'تقديم عام'` is coincidental. | Leave alone. Flag in the planning thread so reviewers don't confuse them. |
| [`features/admin/api/reports.service.ts:70`](frontend/src/features/admin/api/reports.service.ts#L70) | Rejection-reason label `nomination_required: 'بالترشيح فقط'`. This is a derived label on a *result* type, not the input. | Leave alone (label still correct after migration). |
| [`features/applicant-portal/pages/EligibilityCheckPage.tsx:43`](frontend/src/features/applicant-portal/pages/EligibilityCheckPage.tsx#L43) | Same rejection-reason label as above, surfaced in the applicant-side eligibility check. | Leave alone. |
| [`shared/mock-data/admissionCycles.ts:76-79, 121-124`](frontend/src/shared/mock-data/admissionCycles.ts#L76-L79) | Free-form `notes: 'بالترشيح فقط'` strings on `MOCK.cycles[*].categories[<key>]` entries (the **legacy** category model in `shared/mock-data/categories.ts`, not the lookup module). | Leave alone in this migration. The two category models will reconcile in a separate workstream. |
| [`shared/mock-data/categories.ts:119, 133, 147, 164`](frontend/src/shared/mock-data/categories.ts#L119) | Same legacy mock-categories `description` field with the Arabic phrase. Not structured. | Leave alone. |
| [`features/admin/admission-setup/components/applicationSettings/*`](frontend/src/features/admin/admission-setup/components/applicationSettings/) | The Application Settings rebuild (`ScopeBanner`, `AttachSpecializationDialog`, `CategoryAccordion`, `YearTable`, `SpecializationList`, `SpecializationRow`) reads `applicant-categories` rows by `code` only — it never reads `applicationMode`. | No change required *unless* the wizard surfaces `gradingMode` (see §3 below). |

---

## 2. Current shape of `LookupItem` for `APPLICANT_CATEGORIES`

There is no generic `LookupItem`. The concrete row is:

```ts
// frontend/src/features/lookups/types.ts:175-178
export interface ApplicantCategoryRow extends LookupRowBase {
  genderScope: ApplicantCategoryGenderScope;        // 'male' | 'female' | 'any'
  applicationMode: ApplicantCategoryApplicationMode; // 'general' | 'nomination'  ← becomes FK
}
```

with `LookupRowBase = { code: string; name: string; isActive: boolean }`.

**No `metadata` field. No JSON column. No untyped extension point.** Seed at [mock/lookups.mock.ts:218-227](frontend/src/features/lookups/mock/lookups.mock.ts#L218-L227):

| code | name | genderScope | applicationMode → mapped SUBMISSION_TYPES seed |
|---|---|---|---|
| CAT-01 | ثانوية عامة — ذكور | male | `SUB-01` (تقديم عام · GRADES) |
| CAT-02 | ثانوية عامة — إناث | female | `SUB-01` |
| CAT-03 | الأزهر الشريف | any | `SUB-01` |
| CAT-04 | الضباط المتخصصون | any | `SUB-02` (بالترشيح · TAGDIR) |
| CAT-05 | تربية رياضية | any | `SUB-01` |
| CAT-06 | حقوق | any | `SUB-01` |
| CAT-07 | حاملو شهادات أجنبية | any | `SUB-01` |
| CAT-08 | الدراسات العليا | any | `SUB-02` |

> **Open question (block before Step 1):** the mapping `nomination → TAGDIR` is the obvious assumption (officer/post-grad streams use qualitative grades), but it's *my* guess. The prompt only tells me to seed **one** `LookupItem` for SUBMISSION_TYPES, and to make every category point at it via a required FK. With one item in the lookup, all 8 categories collapse to the same FK and `gradingMode` becomes a one-value column — which defeats the whole point of branching downstream behavior on it. Confirm intended seed count (likely 2: GRADES + TAGDIR) and the per-category mapping before I touch the seed.

---

## 3. Grade / percentage capture in applicant data entry today

Two surfaces collect academic results; only the admin form has a qualitative-grade input at all.

### 3.1 Applicant portal — Stage 4 (Education)

[`features/applicant-portal/pages/Stage4EducationPage.tsx:151-165`](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L151-L165) — the actual applicant-facing form. Schema at [`features/applicant-portal/schemas/index.ts:52-53`](frontend/src/features/applicant-portal/schemas/index.ts#L52-L53):

```ts
totalScore: z.coerce.number().min(0),
percentage: z.coerce.number().min(0).max(100),
```

Numeric only. **No qualitative `grade` / `تقدير` field on the portal.** Renders the same fields for *every* applicant category today — there is no per-category branching here yet, which is exactly the seam the new `gradingMode` will create.

### 3.2 Admin applicant form

[`features/admin/components/applicants/ApplicantForm.tsx:549-602`](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L549-L602) — admin-side data-entry form, has three `educationKind` branches:

| `educationKind` | Numeric `totalScore` | `percentage` | Qualitative `grade` (تقدير) |
|---|---|---|---|
| `'general'` (Thanaweya / general secondary) | ✓ required | ✓ optional | ✗ not collected |
| `'overseas'` (وافد / foreign certificate) | ✓ required | ✗ (verified by منصة التحقق) | ✗ not collected |
| `'higher'` (بكالوريوس / ماجستير / دكتوراه) | ✓ required | ✗ | ✓ free-text `education.grade` Input ([line 581](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L581)) |
| `'higher' → secondary` (high-school history block under "higher") | ✓ required | ✓ optional | ✗ |

The qualitative `grade` field is **already present** in the admin form for `'higher'` but it's a free-text `<Input>` — not bound to a fixed vocabulary, and not driven by category. After this migration, the field's *visibility* should be driven by `category.submissionType.gradingMode === 'TAGDIR'` rather than by `educationKind === 'higher'`. That changes who sees which fields and where the validation lives — confirm before writing.

### 3.3 Admin detail render

[`features/admin/pages/ApplicantDetailPage.tsx:471`](frontend/src/features/admin/pages/ApplicantDetailPage.tsx#L471) — `<DefRow label="التقدير" value={education.grade ?? '—'} />`. Read-only mirror of 3.2; falls through to the em-dash when `grade` is absent (i.e., on every non-higher applicant). After migration, render conditionally on `gradingMode === 'TAGDIR'` instead.

---

## 4. "تقدير" vs "درجات" in the codebase today

### تقدير (qualitative)
- [`features/admin/components/applicants/ApplicantForm.tsx:581`](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L581) — input label "التقدير" for higher-ed.
- [`features/admin/pages/ApplicantDetailPage.tsx:471`](frontend/src/features/admin/pages/ApplicantDetailPage.tsx#L471) — detail-row label "التقدير".
- [`shared/mock-data/categories.ts:83, 109`](frontend/src/shared/mock-data/categories.ts#L83) — descriptive eligibility strings (`'تقدير مناسب (جيد على الأقل)'`), not structured.
- `features/exams/pages/Sprint7Pages.tsx` — three hits using `تقديرية` ("estimated"), an unrelated word (estimated duration). Ignore.

**There is no `grade` enum / no `Tagdir` type / no fixed vocabulary** ("ممتاز / جيد جدًا / جيد / مقبول"). If the prompt expects a fixed grade vocabulary, it must be introduced in this migration — flag.

### درجات (numeric)
- Stage 4 portal label "إجمالي الدرجات" + admin form "المجموع" (same concept, different label).
- [`features/admin/admission-setup/pages/ScoreThresholdsPage.tsx:46`](frontend/src/features/admin/admission-setup/pages/ScoreThresholdsPage.tsx#L46) — `PageHeader title="درجات القبول"` (admission cutoff thresholds — a different concept; do not touch).
- `features/admin/admission-setup/api/admission-setup.service.ts` + several other admission-setup files mention `grade` in identifier names — these are about admission **cutoff** grades (`ScoreThresholdGrade`?), not applicant-entered grades. Confirm by grep before writing if ambiguity persists.

---

## 5. Proposed file diff list (subject to the §0 clarification)

Assuming we go with the **typed-column variant** (recommended in §0) and that the prompt corrects to seed **2** rows (GRADES + TAGDIR) rather than 1.

### Add (4 files)

- `frontend/src/features/lookups/lib/gradingModes.ts` — `GRADING_MODES` const + `GradingMode` type + `GRADING_MODE_LABELS_AR` + `assertGradingMode` guard.
- `frontend/src/features/lookups/lib/submissionType.ts` — typed accessor (becomes one-liner if §0 typed-column recommendation is accepted; richer if `metadata` JSON path is taken).
- `docs/migration/submission-types/INVENTORY.md` — this file. **Already done.**
- (Optional) `docs/migration/submission-types/DECISIONS.md` — capture the 4 open questions in §6 once answered.

### Modify (lookup module, 4 files)

- `frontend/src/features/lookups/types.ts` —
  - Prepend `'submission-types'` to `LOOKUP_KEYS` *immediately before* `'applicant-categories'` (line 26). **Note hyphenated form** — see §0.
  - Add `'submission-types'` into the `LOOKUP_SECTIONS.process` group's `keys` tuple, immediately before `'applicant-categories'`.
  - Add `'submission-types': { label: 'نوع التقديم', codePrefix: 'SUB', padding: 2 }` to `LOOKUP_META`.
  - Add `export interface SubmissionTypeRow extends LookupRowBase { gradingMode: GradingMode }`.
  - Add `'submission-types': SubmissionTypeRow` to `LookupRowMap`.
  - Replace `ApplicantCategoryRow.applicationMode` with `submissionTypeCode: string` (FK). Delete the `ApplicantCategoryApplicationMode` union. **This is the breaking change** — `LookupRowDrawer`, `LookupTabPanel`, the mock, and the index re-export must all update in the same commit.
- `frontend/src/features/lookups/mock/lookups.mock.ts` —
  - Add a `submissionTypes: SubmissionTypeRow[]` seed (2 rows: `SUB-01 / تقديم عام / GRADES`, `SUB-02 / بالترشيح / TAGDIR`).
  - Wire it into the final `Record<LookupKey, LookupRow>` literal (line ~563).
  - Rewrite the 8 `applicantCategories` seed entries to replace `applicationMode: 'general' | 'nomination'` with `submissionTypeCode: 'SUB-01' | 'SUB-02'` (mapping per §2 table).
- `frontend/src/features/lookups/components/LookupRowDrawer.tsx` —
  - Add a `case 'submission-types':` form fragment with a Select bound to `gradingMode` (options from `GRADING_MODE_LABELS_AR`). Set default in `defaultValuesFor`.
  - Replace the `case 'applicant-categories':` `<Select>` for `applicationMode` with a `<ForeignKeySelect lookupKey="submission-types" />` bound to `submissionTypeCode`.
  - Update the default-values factory at line 557.
- `frontend/src/features/lookups/components/LookupTabPanel.tsx` —
  - Add a `case 'submission-types':` column array (code / name / gradingMode badge / isActive).
  - In `case 'applicant-categories':`, replace the `applicationMode` column with `submissionTypeCode` rendered via `labelByCode('submission-types', r.submissionTypeCode)` (or equivalent — the file already has `labelByCode` for the announcements row).
- `frontend/src/features/lookups/index.ts` — re-export `SubmissionTypeRow`, `GradingMode`, `GRADING_MODES`, `GRADING_MODE_LABELS_AR`, `readGradingMode`. Drop `ApplicantCategoryApplicationMode` (zero external importers confirmed via grep).
- `frontend/src/features/lookups/api/lookups.service.ts` —
  - Add `submission-types`-side FK-reference check inside `referenceCount` for blocking deletion (the 8 applicant-category rows that point at the type). Mirrors lines 118-124 for `applicant-categories`.

### Modify (admission-setup, 1 file likely)

- `frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts` — already reads `LOOKUPS_SEED['applicant-categories']` ([line 63](frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts#L63)); type-only impact from removing `applicationMode`. If the file references it (it shouldn't — grep confirmed only `code`/`name` are read), update.

### Modify (applicant-portal, 1 file)

- `frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx` — once the category's `gradingMode` is reachable (via the lookup query already used elsewhere in the portal), branch the rendered fields:
  - `gradingMode === 'GRADES'` → keep `totalScore` + `percentage` (current behavior).
  - `gradingMode === 'TAGDIR'` → render a `grade` Select instead of `totalScore`/`percentage`. **Requires a `Tagdir` vocabulary** that doesn't exist yet — see §6.
- `frontend/src/features/applicant-portal/schemas/index.ts:52-53` — make `totalScore` / `percentage` optional + add optional `grade`, then constrain at the form-submit boundary based on category's `gradingMode`. Zod discriminated union by `gradingMode` is the clean shape.

### Modify (admin, 2 files possible)

- `frontend/src/features/admin/components/applicants/ApplicantForm.tsx:545-602` — the `educationKind === 'higher'` branch (the only place `education.grade` is rendered) becomes driven by `gradingMode === 'TAGDIR'` instead. Touches the `branch === 'higher'` vs the general/overseas branches — careful, the four branches in the file are not 1:1 with `gradingMode`.
- `frontend/src/features/admin/pages/ApplicantDetailPage.tsx:471` — conditional render on `gradingMode === 'TAGDIR'`, otherwise hide the row instead of showing the em-dash.

### Leave alone

- `frontend/src/features/admin/admission-setup/pages/TotalScorePage.tsx` — different enum.
- `frontend/src/features/admin/api/reports.service.ts` + `EligibilityCheckPage.tsx` — rejection-label strings remain correct.
- `frontend/src/shared/mock-data/admissionCycles.ts`, `categories.ts` — legacy mock-categories model; not the lookup module.

---

## 6. Open questions (block Step 1 until answered)

1. **How many SUBMISSION_TYPES seed rows?** Step 1.4 says "seed one", but a single row + a required FK + branching downstream on `gradingMode` is internally inconsistent. **Best guess:** 2 rows — `SUB-01 / تقديم عام / GRADES` and `SUB-02 / بالترشيح / TAGDIR`. Confirm.
2. **Carrier: typed column vs. metadata JSON?** Codebase precedent is overwhelmingly typed columns (no row anywhere has a `metadata` field). The prompt's `metadata.gradingMode` reads like a generic-lookup pattern from a different project. **Recommendation:** typed column on `SubmissionTypeRow`, drop the metadata layer.
3. **Tagdir vocabulary?** Does `gradingMode === 'TAGDIR'` mean "free-text grade" (preserving the current `Input` in `ApplicantForm`) or "Select from a fixed vocab" (`ممتاز / جيد جدًا / جيد / مقبول`)? If the latter, we need either a new lookup (`GRADE_TIERS`?) or a const enum — out of scope here, but blocks Stage 4 portal work.
4. **Per-category mapping table (CAT-NN → SUB-NN)?** §2 has my best guess (`nomination → SUB-02 / TAGDIR`, `general → SUB-01 / GRADES`). The prompt does not state this. Confirm — particularly for CAT-03 (الأزهر) and CAT-07 (حاملو شهادات أجنبية), which are *general* applicants but might use a different grading mode.

---

**Standing by for "go" — plus answers to the 4 questions above.**
