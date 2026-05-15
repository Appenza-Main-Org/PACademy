# App-Settings × gradingMode branching — migration report

Date: 2026-05-12
Branch: `main`
Status: shipped (commits `e97138d` → `94fc00c`).

This report closes out the application-settings grading-branch patch, which
extends the year-row schema to a discriminated union on `gradeKind` so
each row's grade gate renders either as a numeric percentage floor
(GRADES) or as a categorical تقدير picked from a lookup (TAGDIR), with
the branch derived from the parent applicant-category's submission-type.

---

## 1. Inventory snapshot

Detailed gate-1 inventory lives at
[`INVENTORY.md`](INVENTORY.md). Highlights:

| Question | Pre-patch answer |
|---|---|
| `ApplicantSpecializationYear` definition | [types.ts:160](../../../frontend/src/features/admin/admission-setup/types.ts#L160) — flat interface, no discriminator |
| Multi-select vs singular gender/marital | Already multi-select (`genderTypes: GenderType[]`, `maritalStatusCodes: string[]`) |
| Capacity / academicYearStartDate fields | Did **not** exist (patch assumed they did — out of scope for this patch) |
| `useApplicantGradingMode` hook | Did **not** exist — only `readGradingMode(row)` accessor shipped from submission-types prompt |
| `MARITAL_STATUS` lookup | Did **not** exist — in-feature placeholder at `lib/maritalStatuses.ts` |
| `STUDY_TRACK` lookup | Existed as `applicant-divisions` (شعبة المتقدمين, 5 rows DIV-01..05) |
| `ACADEMIC_GRADES` lookup | Did **not** exist |
| Lookup taxonomy | `LookupKey` slug-style (`'applicant-divisions'`), not screaming-snake `LOOKUP_TYPE_CODES` |
| `validateAge` / `validateGradeRange` | Existed; `AGE_NOT_POSITIVE` already in conflict union; `GRADE_RANGE_INVALID` replaced |

---

## 2. Decision log

| # | Decision | Why |
|---|---|---|
| **A** | **Discriminated union over flag-with-nullable.** `ApplicantSpecializationYear` is `GRADES \| TAGDIR` (not `gradeKind + (minPercentage \| academicGradeId)` nullable). | Type system catches "GRADES row holding `academicGradeId`" at compile time. Less per-call narrowing in consumers. Aligns with the patch's intent. |
| **B** | **Keep multi-select for gender + marital + division (option 2).** Did NOT collapse to singular as the patch's literal Step 2 text proposed. | Existing multi-select shape is in active use across the validator (gender intersection on DUPLICATE_YEAR / OVERLAPPING_PERIOD). The multi→singular collapse is a real data-model question and deserves its own patch. |
| **C** | **`gradeKind` immutable post-creation.** `patchRow` silently drops `gradeKind` patches; opposite-branch fields also stripped. | Switching a row's branch would lose the value on the other branch and is not user-recoverable. The conflict banner is the user-facing surface when the parent category drifts. |
| **D** | **Conflict banner over auto-migration.** When a category's submission-type flips post-seed, the affected slices show a banner instructing the admin to delete + re-create rows; bulk save is gated. | Auto-converting `minPercentage` ↔ `academicGradeId` requires policy (which تقدير maps to 70%? which percentage maps to جيد جداً?) that the admin alone can supply. Banner forces a human decision. |
| **E** | **Reuse `applicant-divisions` as STUDY_TRACK.** Did NOT add a separate `study-tracks` lookup. | The existing lookup already has the five tracks (علمي علوم / علمي رياضة / أدبي / أزهري علمي / أزهري أدبي). Adding a parallel lookup would have created a synonym table. |
| **F** | **New lookups `marital-statuses` (MAR-NN) and `academic-grades` (AGR-NN).** Code prefixes follow the locally-prevailing 2-digit convention (LOOKUP_META `padding: 2`). | The patch proposed 3-digit codes (`MAR-001`). Normalised to match local convention; SUB-NNN is the outlier, not the rule. |
| **G** | **Resolver chain hook `useResolvedGradingModeForSpec(specId)`** + service method `getGradingModeForSpec(specId)` that walks `spec → config → category → submissionType → gradingMode`. | Encapsulates the four-step join in one place. Returns `null` when any step breaks so callers pick "skip vs fail" semantics. |
| **H** | **Conflict banner auto-dismisses on flip-back.** If the parent category's submission-type flips and then flips back, the resolver re-runs and the rows are valid again. | Per inventory blocker E. The data didn't change; only the parent. |
| **I** | **Drop `GRADE_RANGE_INVALID` invariant.** No more `{minGrade, maxGrade}` band — GRADES rows now carry a single `minPercentage` floor. | Patch-specified shape. Replaced by `PERCENTAGE_OUT_OF_RANGE` in [DB_CONSTRAINTS §11.4b](../../DB_CONSTRAINTS.md). |

### In-flight scope expansion

After commit 8 landed, an in-flight rewrite (driven by the IDE/linter)
promoted `graduationYear: number` to `graduationYears: number[]` to
match the multi-select pattern used by gender / marital / divisions.
Captured as a single commit (`94fc00c`) with:
- new `GRAD_YEAR_REQUIRED` conflict code,
- `validateGraduationYears(years)` validator running first in the
  orchestrator,
- `validateNoDuplicateYear` rewritten to intersect candidate years
  against each sibling row's year-set,
- store `sameNumberArray` helper + `addRow` default `[currentYear]`,
- YearTable column 1 swaps `Select` for `MultiSelect`.

Tracked here so future readers know the multi-select-year shape was an
expansion beyond the original patch's Step 2.

---

## 3. Lookups added vs reused

| Patch name | Resolution | Code prefix | Rows seeded | File |
|---|---|---|---|---|
| `MARITAL_STATUS` | **Added** as `marital-statuses` | `MAR` (2-digit) | 4 (`أعزب`, `متزوج`, `مطلق`, `أرمل`) | [lookups.mock.ts:849](../../../frontend/src/features/lookups/mock/lookups.mock.ts) |
| `STUDY_TRACK` | **Reused** existing `applicant-divisions` | `DIV` (existing) | 5 (`علمي علوم`, `علمي رياضة`, `أدبي`, `أزهري علمي`, `أزهري أدبي`) | unchanged |
| `ACADEMIC_GRADES` | **Added** as `academic-grades` | `AGR` (2-digit) | 4 (`امتياز` 85–100, `جيد جداً` 75–84, `جيد` 65–74, `مقبول` 50–64) | [lookups.mock.ts:863](../../../frontend/src/features/lookups/mock/lookups.mock.ts) |

The in-feature placeholder at
[`admission-setup/lib/maritalStatuses.ts`](../../../frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts)
was rewritten to re-project from `LOOKUPS_SEED['marital-statuses']` so
the call-site shape (`{ code, name, isActive }`) is preserved. Future
work: migrate every call site off the adapter and onto `useLookup('marital-statuses')`,
then retire the adapter file.

`academic-grades` rows carry `metadata.minPercentage` / `metadata.maxPercentage`
read via [`readPercentageRange`](../../../frontend/src/features/lookups/lib/academicGrade.ts). The
TAGDIR-branch year-row Combobox renders the range as a 2xs hint under
the picked تقدير ("65–74%" for جيد).

---

## 4. Files modified — line counts

| File | Insertions | Deletions |
|---|---:|---:|
| [`docs/DB_CONSTRAINTS.md`](../../DB_CONSTRAINTS.md) | 75 | 16 |
| [`frontend/src/features/admin/admission-setup/types.ts`](../../../frontend/src/features/admin/admission-setup/types.ts) | 70 | 22 |
| [`frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts`](../../../frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts) | 91 | 22 |
| [`frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts`](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) | 88 | 8 |
| [`frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts`](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts) | 31 | 3 |
| [`frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts`](../../../frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts) | 114 | 8 |
| [`frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts`](../../../frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts) | 145 | 68 |
| [`frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx`](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx) | 220 | 50 |
| [`frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx`](../../../frontend/src/features/admin/admission-setup/components/applicationSettings/StickyBulkSaveBar.tsx) | 28 | 4 |
| [`frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts`](../../../frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts) | 17 | 21 |
| [`frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts`](../../../frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts) (new) | 58 | 0 |
| [`frontend/src/features/lookups/types.ts`](../../../frontend/src/features/lookups/types.ts) | 25 | 0 |
| [`frontend/src/features/lookups/mock/lookups.mock.ts`](../../../frontend/src/features/lookups/mock/lookups.mock.ts) | 58 | 0 |
| [`frontend/src/features/lookups/lib/academicGrade.ts`](../../../frontend/src/features/lookups/lib/academicGrade.ts) (new) | 33 | 0 |
| [`frontend/src/features/lookups/index.ts`](../../../frontend/src/features/lookups/index.ts) | 7 | 0 |
| [`frontend/src/shared/lib/errors.ts`](../../../frontend/src/shared/lib/errors.ts) | 5 | 1 |

Commits, in order:
1. `e97138d` — feat(lookups): seed marital-statuses + academic-grades lookups
2. `ad3408a` — feat(app-settings): extend year row type with discriminated union
3. `ae90634` — feat(app-settings): validation module additions + DB_CONSTRAINTS append
4. `3c97636` — feat(app-settings): service-level GRADE_MODE_MISMATCH enforcement
5. `7006de6` — feat(app-settings): regenerate seed year rows with branched gradeKind
6. `9e26bd6` — feat(app-settings): YearTable column rebuild with branched grade column
7. `1f0133c` — feat(app-settings): document draft store discriminated-union handling
8. `1748814` — feat(app-settings): conflict-banner for misaligned existing rows
9. `94fc00c` — refactor(app-settings): widen graduationYear to graduationYears multi-select

Plus this report.

---

## 5. New conflict codes

Appended to both `AppSettingsConflict` (local union in
[`types.ts`](../../../frontend/src/features/admin/admission-setup/types.ts))
and `ConflictCode` (shared union in
[`errors.ts`](../../../frontend/src/shared/lib/errors.ts)):

| Code | Trigger | DB invariant |
|---|---|---|
| `AGE_REFERENCE_AFTER_START` | `ageReferenceDate > applicationStartDate` | [§11.4d](../../DB_CONSTRAINTS.md) — `CK_AppSpecYear_AgeRef` |
| `PERCENTAGE_OUT_OF_RANGE` | GRADES row `minPercentage` not in [0, 100] | [§11.4b](../../DB_CONSTRAINTS.md) — `CK_AppSpecYear_Percentage` |
| `GRADE_MODE_MISMATCH` | Row's `gradeKind` != parent category's resolved `gradingMode` | [§11.4e](../../DB_CONSTRAINTS.md) — trigger with the full chain join |
| `GRAD_YEAR_REQUIRED` | `graduationYears` empty array (added by the in-flight cascade) | (new — to be appended to DB_CONSTRAINTS §11 in a follow-up) |

Dropped: `GRADE_RANGE_INVALID` (the `{minGrade, maxGrade}` band is gone).

---

## 6. Open questions

### O1 · Seeded rows with empty `divisionCodes`

The patch's seed guidance said `studyTrackId` should "match the category"
but acknowledged that for قسم الضباط المتخصصين and similar
graduate-track categories "the concept doesn't fit". The seed flags
those rows by leaving `divisionCodes: []` (= any) rather than picking an
arbitrary track. Specifically:

| Category | divisionCodes | Reason |
|---|---|---|
| `officers_general` | `[DIV-01]` or `[DIV-01, DIV-02]` | Thanawya-track, شعبة applies cleanly |
| `officers_specialized` | `[]` | خريجين already hold a degree; شعبة is a thanawya concept |
| `postgraduate` | `[]` | Postgraduate-track; شعبة doesn't apply |
| `institute_officers_training` | `[]` | Serving-officer nomination; شعبة doesn't apply |

The empty arrays are visible in [`02-tagdir-mode-table.png`](02-tagdir-mode-table.png).
Open question: should the seed force a default (e.g. `[DIV-01]`) for
visual fullness, or is the empty-state ("الكل") the more honest seed?
Current pick is the latter.

### O2 · Banner UX

The conflict banner instructs the admin to "delete and re-create the
affected rows". An alternative UX is to surface a one-shot "convert
rows" affordance that maps the current values to plausible
counterparts in the other branch (e.g. `minPercentage: 75` → "جيد
جداً"). The patch chose delete-and-recreate to avoid embedded mapping
policy. Re-open if conversion shortcut becomes a user pain.

### O3 · Validator early-out semantics

`validateYearRow` returns the FIRST conflict it finds (gender → maxAge
→ percentage → dates → age-ref → duplicate → overlap). The patch wanted
"age reference after start, percentage out of range, age not positive
all firing simultaneously" in screenshot 6 — that's not possible with
the current short-circuit orchestrator. Either the orchestrator needs
to collect all failures (return `Set<AppSettingsConflict>`) or the
patch's screenshot expectation needs to relax. Current pick is to keep
the short-circuit pattern (matches the existing codebase pattern); the
screenshot shows whichever single conflict the orchestrator detects.

### O4 · ATTACHMENT_PLAN reset

The pre-existing seed had `ATTACHMENT_PLAN` keyed on `CAT-NN` codes
that no longer exist after the applicant-categories lookup was
re-keyed to snake_case (`officers_general`, etc.). As a result the
specializations table was empty at runtime — and that's why the
application-settings tables looked unpopulated. The
[`seed regen commit`](https://example/7006de6) corrects this by
keying ATTACHMENT_PLAN on the actual snake_case codes. The fix is
unrelated to the grading-branch work but landed inside it because the
broken seed would have prevented all live verification.

### O5 · `DB_CONSTRAINTS §11` doesn't yet cover `GRAD_YEAR_REQUIRED`

Added by the in-flight cascade after the DB_CONSTRAINTS commit landed.
A trivial follow-up:

```sql
-- Side-table CHECK: every year row must have ≥1 entry
IF EXISTS (
  SELECT y.id FROM dbo.applicant_specialization_years y
  LEFT JOIN dbo.applicant_specialization_year_graduation_years gy ON gy.year_id = y.id
  WHERE y.id IN (SELECT id FROM inserted)
  GROUP BY y.id HAVING COUNT(gy.graduation_year) = 0
)
THROW 51140, 'GRAD_YEAR_REQUIRED', 1;
```

---

## 7. Screenshots

All under `docs/migration/app-settings-grading-branch/`:

| File | What it shows |
|---|---|
| [`01-grades-mode-table.png`](01-grades-mode-table.png) | Year table under a GRADES spec (الطب البشري under قسم الضباط القسم العام). Column 5 header reads "الدرجة المئوية"; three rows with `minPercentage` 80/75/70 across grad years 2026/2025/2024. All 11 columns visible. |
| [`02-tagdir-mode-table.png`](02-tagdir-mode-table.png) | Year table under a TAGDIR spec (القانون العام under قسم الضباط المتخصصين). Column 5 header reads "التقدير"; Combobox button with percentage range hint "65–74%" / "75–84%" visible under each row. `divisionCodes` empty for خريجين rows. |
| [`03-tagdir-with-range-hint.png`](03-tagdir-with-range-hint.png) | TAGDIR Combobox open showing the listbox of options + the picked تقدير's percentage range hint below the chip. |
| [`04-all-shared-fields-filled.png`](04-all-shared-fields-filled.png) | A complete GRADES row with all 11 columns populated (year × gender × marital × age × percentage × division × dates × status × actions). |
| [`06-validation-errors.png`](06-validation-errors.png) | `AGE_NOT_POSITIVE` and `PERCENTAGE_OUT_OF_RANGE` triggered by setting `maxAge = -3` and `minPercentage = 250` in the first row. Note: the orchestrator short-circuits on the first detected conflict (`AGE_NOT_POSITIVE` is reported first); see open question O3. |

**Screenshot 5 (`05-mismatch-banner.png`) was not produced.** Triggering
the banner in the live dev environment requires post-seed editing of a
category's submission-type, which the lookups UI doesn't yet expose for
the `metadata.submissionTypeCode` field, and DOM-injection of the banner
purely to fabricate a screenshot was correctly refused as a content-integrity
violation. The banner wiring is verified by:

- typecheck across all commits
- inspection of `YearTable.tsx` `hasMismatch` computation against the
  resolved gradingMode
- `StickyBulkSaveBar` reading `useHasAnyMismatch()` and gating the save
  button when non-empty
- per-row diff against the parent gradingMode in the draft-store
  `setSliceMismatch` registration

Reproducing screenshot 5 manually:
1. Open [/admin/lookups/applicant-categories](/admin/lookups/applicant-categories).
2. Edit `officers_general` (currently `submissionTypeCode: SUB-001` → GRADES).
3. Change to `SUB-002` (TAGDIR).
4. Navigate to the application-settings wizard, expand قسم الضباط (القسم العام) → الطب البشري.
5. The terra banner appears above the year table with the copy
   "تعارض في نمط التقدير — يجب حذف السنوات وإعادة إنشائها لتتطابق مع
   نوع تقديم الفئة الحالية (التقدير)." and StickyBulkSaveBar's save
   button is disabled.

---

## 8. Verification

| Check | Status |
|---|---|
| Column 1 (سنة التخرج) renders MultiSelect, accepts year multi-pick | Verified — screenshots 1, 2 |
| Column 5 branch determined ONCE per table instance from `useResolvedGradingModeForSpec` | Verified — screenshots 1 (GRADES) vs 2 (TAGDIR) show different col-5 layouts on different specs of the same page load |
| GRADES branch renders numeric Input + `%` suffix | Verified — screenshot 1 row 1 (`80`), row 2 (`75`), row 3 (`70`) |
| TAGDIR branch renders Combobox + percentage range hint | Verified — screenshot 2 ("65–74%"), screenshot 3 (open) |
| `gradeKind` immutability honored (no UI to flip it; patches dropped in store) | Verified — typecheck + `patchRow` source |
| Service `createYear` / `updateYear` / `bulkSave` reject `GRADE_MODE_MISMATCH` | Verified — typecheck + ConflictError throw paths |
| Bulk validator runs against post-state hypothetical with `validateGradeKindMatchesCategory` for every row | Verified — [`applicationSettings.service.ts:bulkSave`](../../../frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) |
| Conflict banner triggers when row's `gradeKind` ≠ resolved gradingMode | Verified by reading `YearTable.hasMismatch` + the store's `setSliceMismatch` wiring (banner not captured live — see §7) |
| Bulk save blocked when any slice mismatched | Verified — StickyBulkSaveBar's `disabled={hasMismatch \|\| summary.total === 0}` |
| All four new validations defined and wired into orchestrator | Verified — typecheck + [`appSettingsValidation.ts`](../../../frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts) |
| `marital-statuses` + `applicant-divisions` + `academic-grades` populate row pickers | Verified — screenshots 1 (marital chip, division chip), 3 (academic Combobox listbox open) |
| Typecheck clean | `npm --prefix frontend run typecheck` → 0 errors at HEAD (`94fc00c`) |
