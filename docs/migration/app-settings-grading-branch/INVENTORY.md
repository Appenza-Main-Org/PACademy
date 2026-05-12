# Inventory — Application Settings × gradingMode branching

Date: 2026-05-12
Scope: Step 0 of the gradingMode-branch patch prompt.

> **TL;DR for the reviewer:** the prompt assumes a shape the codebase does not yet have. Five concrete mismatches are listed in §6 ("Stop-and-ask blockers"). Need direction on each before Step 1 can start.

---

## 1. `ApplicantSpecializationYear` — definition + every consumer

**Definition:** [frontend/src/features/admin/admission-setup/types.ts:160-181](frontend/src/features/admin/admission-setup/types.ts#L160-L181)

Current shape (verbatim):

```ts
export interface ApplicantSpecializationYear {
  id: string;
  categorySpecializationId: string;
  graduationYear: number;
  genderTypes: GenderType[];            // MULTI-select
  maritalStatusCodes: string[];         // MULTI-select; '' = any
  maxAge: number | null;                // nullable
  minGrade: number | null;              // nullable band, low end
  maxGrade: number | null;              // nullable band, high end
  applicationStartDate: string;         // ISO
  applicationEndDate: string;           // ISO
  ageCalcDate: string;                  // ISO  ← NOT "ageReferenceDate"
  isActive: boolean;
}
```

**Consumers** (`grep -rn "ApplicantSpecializationYear" frontend/src/`):

| # | File | Role |
|---|---|---|
| 1 | [frontend/src/features/admin/admission-setup/types.ts](frontend/src/features/admin/admission-setup/types.ts) | Definition |
| 2 | [frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx](frontend/src/features/admin/admission-setup/pages/ApplicationSettingsPage.tsx) | Page composer (doc-string only) |
| 3 | [frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx:43,181](frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx#L43) | UI table + row patch handler |
| 4 | [frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts:26,128-146](frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts#L128-L146) | Seed rows (`APPLICANT_SPECIALIZATION_YEARS`) |
| 5 | [frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts:54,61,130,179,228-251,266-270,343,378](frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts) | Service CRUD + bulkSave |
| 6 | [frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts:26,110,161,179,210](frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts) | Query hooks |
| 7 | [frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts:23,31,33,47,53,56,77-78,122,142](frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts) | Draft store |
| 8 | [frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts:23,79,99,117-118](frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts) | Validation suite |

8 files total. No cross-feature consumers — module is self-contained as intended.

---

## 2. `YearTable` current columns (visual order, RTL)

11 columns, from [components/applicationSettings/YearTable.tsx:137-148](frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx#L137-L148):

| # | Header | Field | Component |
|---|---|---|---|
| 1 | سنة التخرج (الأقصى) | `graduationYear` | Select (last 5 yrs + current) |
| 2 | النوع | `genderTypes` (MULTI) | `GenderToggle` (multi-pill ذكور/إناث) |
| 3 | الحالة الاجتماعية | `maritalStatusCodes` (MULTI) | `MultiSelect` from local `MARITAL_STATUSES` |
| 4 | السن الأقصى | `maxAge \| null` | numeric Input |
| 5 | أدنى درجة | `minGrade \| null` | numeric Input (0–100) |
| 6 | أقصى درجة | `maxGrade \| null` | numeric Input (0–100) |
| 7 | بداية التقديم | `applicationStartDate` | DatePicker |
| 8 | نهاية التقديم | `applicationEndDate` | DatePicker (min = start) |
| 9 | تاريخ احتساب السن | `ageCalcDate` | DatePicker |
| 10 | الحالة | `isActive` | StatusPill |
| 11 | إجراءات | — | حذف/استرجاع |

No `capacity` column, no `academicYearStartDate` column. (See §6 blocker B.)

---

## 3. `appSettingsValidation.ts` — current signatures

[frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts](frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts)

```ts
validateGender(genders): AppSettingsConflict | null
validateAge(maxAge: number | null): AppSettingsConflict | null
validateGradeRange(minGrade: number | null, maxGrade: number | null): AppSettingsConflict | null
validateDateRange(start: string, end: string, ageCalc: string): AppSettingsConflict | null
validateNoDuplicateYear(year, genders, existingYears, excludeId?): AppSettingsConflict | null
validateNoOverlap(candidate: DateWindow, existingYears, excludeId?): AppSettingsConflict | null
validateYearRow(row, siblingYears, excludeId?): AppSettingsConflict | null    // orchestrator
```

**Existing `AppSettingsConflict` codes** ([types.ts:188-196](frontend/src/features/admin/admission-setup/types.ts#L188-L196)):
- `DUPLICATE_YEAR`
- `INVALID_DATE_RANGE`
- `OVERLAPPING_PERIOD`
- `AGE_NOT_POSITIVE`   ← **already present** (prompt wants to "append" it; would be a no-op)
- `GRADE_RANGE_INVALID`
- `GENDER_REQUIRED`
- `SPECIALIZATION_NOT_MAPPED`
- `CATEGORY_HAS_ACTIVE_YEARS`

`PERCENTAGE_OUT_OF_RANGE`, `AGE_REFERENCE_AFTER_START`, `GRADE_MODE_MISMATCH` do **not** exist yet.

---

## 4. `useApplicantGradingMode` — **does not exist**

What the submission-types prompt actually shipped:

- [frontend/src/features/lookups/lib/gradingModes.ts](frontend/src/features/lookups/lib/gradingModes.ts) — `GradingMode` union (`'GRADES' | 'TAGDIR'`), `GRADING_MODE_LABELS_AR`, `assertGradingMode`.
- [frontend/src/features/lookups/lib/submissionType.ts](frontend/src/features/lookups/lib/submissionType.ts) — `readGradingMode(row: SubmissionTypeRow): GradingMode` (a pure accessor over `metadata.gradingMode`).
- `metadata.submissionTypeCode` FK on `ApplicantCategoryRow` rows (added 2026-05-12, per the seed comment at [lookups.mock.ts:276-291](frontend/src/features/lookups/mock/lookups.mock.ts#L276)).
- A grid column for طريقة الاحتساب in [LookupTabPanel.tsx:465](frontend/src/features/lookups/components/LookupTabPanel.tsx#L465).

There is **no** typed resolver hook that walks `categorySpecializationId → configId → categoryId → submissionTypeCode → gradingMode`. The patch's `useResolvedGradingModeForSpec` and `useApplicantGradingMode` are both names of work the patch must itself land. → see blocker D.

---

## 5. `MARITAL_STATUS` and `STUDY_TRACK` lookup state

### MARITAL_STATUS
- **Not** in the lookup catalogue. `LOOKUP_KEYS` ([types.ts:18-38](frontend/src/features/lookups/types.ts#L18-L38)) does not list any marital-status key.
- An in-feature module exists: [frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts](frontend/src/features/admin/admission-setup/lib/maritalStatuses.ts) — 4 hardcoded rows (`single`, `married`, `divorced`, `widowed`) with Arabic labels (أعزب / متزوج / مطلق / أرمل). The file header documents this as a placeholder for when the lookup catalogue grows the row back.
- The current `YearTable` consumes this local module, not a lookup.

### STUDY_TRACK
- **Partially exists under a different name.** The lookup catalogue has `applicant-divisions` (شعبة المتقدمين, code prefix `DIV`) at [lookups.mock.ts:772-780](frontend/src/features/lookups/mock/lookups.mock.ts#L772-L780):
  - `DIV-01` علمي علوم
  - `DIV-02` علمي رياضة
  - `DIV-03` أدبي
  - `DIV-04` أزهري علمي
  - `DIV-05` أزهري أدبي
- This is conceptually the same as "الشعبة" the prompt wants — same five tracks, near-identical Arabic. The prompt's labels for the azhari rows are slightly different (`علمي (أزهري)` vs `أزهري علمي`); merely cosmetic.

### ACADEMIC_GRADES (التقدير)
- **Not in the lookup catalogue.** No `academic-grades` key, no قِيم like `جيد`/`جيد جداً`/`ممتاز`/`مقبول`/`جيد مرتفع` anywhere in [lookups.mock.ts](frontend/src/features/lookups/mock/lookups.mock.ts).
- The string "التقدير" only appears in admin applicant form copy ([ApplicantForm.tsx:581](frontend/src/features/admin/components/applicants/ApplicantForm.tsx#L581)) and the applicant detail view — both as a free-text field on the applicant education record, not as a normalised lookup.
- The patch's `useLookupList({ typeCode: 'ACADEMIC_GRADES' })` would resolve to nothing today.

### `LOOKUP_TYPE_CODES`
- **Does not exist.** The catalogue uses `LOOKUP_KEYS` ([types.ts:18](frontend/src/features/lookups/types.ts#L18)) — slug-style keys like `'applicant-divisions'`, `'submission-types'`. The patch's screaming-snake `LOOKUP_TYPE_CODES = ['MARITAL_STATUS', 'STUDY_TRACK', ...]` is a parallel naming scheme that does not match any existing API.

---

## 6. Stop-and-ask blockers (need direction before Step 1)

### A. Multi-select vs singular fields — **breaking schema mismatch**

The patch's Step 2 specifies:
- `genderType: GenderType` (singular)
- `maritalStatusId: string` (singular FK)
- `maxAge: number` (non-nullable)
- `minPercentage: number` (non-nullable on the GRADES branch)

The current type has:
- `genderTypes: GenderType[]` (multi)
- `maritalStatusCodes: string[]` (multi, `[]` = "any")
- `maxAge: number | null` (nullable)
- `minGrade: number | null` **and** `maxGrade: number | null` (a band, not a floor)

These are not additive. Three options for resolving:

1. **Adopt the patch verbatim** — collapse multi→singular for gender + marital, drop `maxGrade`, make `maxAge` non-null. Need to backfill seeded rows (split rows that had `['male','female']` into two, pick one marital code per row, etc.). Validation rules `DUPLICATE_YEAR` and `OVERLAPPING_PERIOD` simplify (no more gender intersection).
2. **Keep multi, branch only the grade column** — keep `genderTypes`/`maritalStatusCodes` as-is, replace `{minGrade,maxGrade}` with the discriminated `{gradeKind, minPercentage}` ∪ `{gradeKind, academicGradeId}`. Smallest blast radius; preserves the existing validation contracts.
3. **Patch the patch** — singular gender + maritalStatusId is what the data model actually wants (each year row is unambiguously one gender × one marital tier), and the current multi shape was over-permissive. Treat this prompt as fixing both at once.

I cannot pick this without your call. Recommended path: **option 2** (the smaller change) for V1, and re-open the multi→singular collapse as its own follow-up patch — it's a real data-model question and deserves its own report, not a side-effect of the grading-branch work.

### B. Missing prior-prompt fields — `capacity`, `academicYearStartDate`

The patch's Step 5 reads "Capacity and academicYearStartDate columns from the previous prompt remain. Recheck total column count…" but neither field exists on `ApplicantSpecializationYear` and neither column exists in `YearTable`. The submission-types prompt did **not** add them.

Two reads:

1. They were dropped from the submission-types prompt's actual scope (`docs/migration/submission-types/STEP2.md` documents the actual additions). The grading-branch patch's mention is stale.
2. They were always meant to land here but the surrounding language treats them as already-shipped.

Need a yes/no on whether this patch should also add `capacity: number` + `academicYearStartDate: string`. If yes, that's two more fields, two more columns, two more pieces of validation, and the seed has to populate them. If no, the patch's wording at Step 5 ("if column count exceeds reasonable horizontal space, fold capacity + academicYearStartDate into an expandable secondary row") is moot.

### C. `LOOKUP_TYPE_CODES` taxonomy mismatch

The lookup module uses slug-style `LookupKey` (`'applicant-divisions'`). The patch wants screaming-snake `LOOKUP_TYPE_CODES.MARITAL_STATUS`. Two paths:

1. **Map the patch's vocabulary onto the existing taxonomy:**
   - Patch's `MARITAL_STATUS` → new lookup `'marital-statuses'` (key prefix `MAR`).
   - Patch's `STUDY_TRACK` → reuse the existing `'applicant-divisions'` lookup as-is (it already has the five tracks, including the two azhari).
   - Patch's `ACADEMIC_GRADES` → new lookup `'academic-grades'` (key prefix `AGR`); seed rows: `جيد / جيد جداً / امتياز / مقبول / ضعيف` or the official Egyptian Ministry of Education ladder (need user's call on the exact set).
2. **Add `LOOKUP_TYPE_CODES` as a parallel registry alongside `LOOKUP_KEYS`** — adds a second source of truth, would have to be kept in sync forever. Not recommended.

Recommended: option 1, using the existing slug taxonomy. But this means three real questions:

- (C1) Should `STUDY_TRACK` reuse `applicant-divisions` outright, or do we introduce a separate `STUDY_TRACK` lookup with the prompt's exact labels? The patch's labels (`علمي (أزهري)`) drift slightly from the existing seed (`أزهري علمي`); I lean toward reuse since the meanings are identical.
- (C2) `MARITAL_STATUS` will be a brand-new lookup (the in-feature placeholder `lib/maritalStatuses.ts` must migrate to it). What's the code prefix and what's the cleanup story for the placeholder?
- (C3) `ACADEMIC_GRADES` is brand new. What's the canonical Arabic set? The patch hints at `جيد جداً / جيد` with `metadata.minPercentage`/`metadata.maxPercentage`; need the full ladder + ranges.

### D. `useApplicantGradingMode` doesn't exist

The patch's Step 5 says it "exists from the submission-types prompt; if not, flag — this prompt assumes it." Flagging. The submission-types prompt only added the pure accessor `readGradingMode(row: SubmissionTypeRow)`. A resolver that walks `categorySpecializationId → configId → categoryId → submissionTypeCode → gradingMode` needs to be authored as part of this patch.

Proposed signature (need your sign-off before I commit to it):

```ts
// frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts
export function useResolvedGradingModeForSpec(
  categorySpecializationId: string,
): GradingMode | null;
// null while loading or if the chain breaks.
```

Implementation: read `APPLICANT_CATEGORY_SPECIALIZATIONS[id]` → `APPLICANT_CATEGORY_CONFIGS[configId]` → look up `MOCK.lookups['applicant-categories']` by `categoryId` → read `metadata.submissionTypeCode` → look up `MOCK.lookups['submission-types']` by that code → `readGradingMode(...)`. The hook subscribes to the same react-query keys that drive `useYears`/`useConfigs` so it reactively flips when an admin re-points a category at a different submission-type.

### E. `gradeKind` derivation timing

The patch says `gradeKind` is "derived from the parent category's submission type's gradingMode at row creation time" and is "immutable after creation". Two scenarios the patch doesn't disambiguate:

- **Scenario 1**: admin changes a category's `submissionTypeCode` from `SUB-001` (GRADES) to `SUB-002` (TAGDIR) after the category already has 30 year rows. The patch says: surface conflict banner, disable bulk save. ✅ understood.
- **Scenario 2**: same admin then *changes their mind* and flips it back. The original year rows are now valid again. Does the banner auto-dismiss? The patch's "immutability guard" wording suggests yes (the rows never changed; only the parent flipped twice). I'll implement it that way unless told otherwise.

---

## 7. Files that would change if all gates pass

Conservative count assuming option 2 in §6A + reusing `applicant-divisions` for STUDY_TRACK + new `marital-statuses` + new `academic-grades` lookups:

| Area | Files |
|---|---|
| Lookup module | `frontend/src/features/lookups/types.ts` (`LOOKUP_KEYS` + 2 row interfaces + 2 union entries + `LOOKUP_META`), `frontend/src/features/lookups/mock/lookups.mock.ts` (2 seed arrays + 2 LOOKUPS_SEED entries) |
| Admission-setup types | `frontend/src/features/admin/admission-setup/types.ts` (discriminated union, new conflict codes) |
| Admission-setup validation | `frontend/src/features/admin/admission-setup/lib/appSettingsValidation.ts` (3 new validators + new orchestrator branches) |
| Admission-setup resolver | new file `frontend/src/features/admin/admission-setup/lib/resolveGradingMode.ts` |
| Admission-setup service | `frontend/src/features/admin/admission-setup/api/applicationSettings.service.ts` (gradingMode resolution + GRADE_MODE_MISMATCH enforcement in create/update/bulkSave) |
| Admission-setup queries | `frontend/src/features/admin/admission-setup/api/applicationSettings.queries.ts` (new conflict messages) |
| Admission-setup draft store | `frontend/src/features/admin/admission-setup/store/appSettingsDraft.ts` (branched default seed for `addRow`) |
| Admission-setup mock seed | `frontend/src/features/admin/admission-setup/mock/appSettings.mock.ts` (regenerate rows with branched `gradeKind` + new shared fields) |
| Admission-setup UI | `frontend/src/features/admin/admission-setup/components/applicationSettings/YearTable.tsx` (column rebuild + branched col 5), new `ConflictBanner` inside the same component file |
| DB constraints doc | `docs/DB_CONSTRAINTS.md` (4 new invariants under "Application Settings") |
| Migration docs | `docs/migration/app-settings-grading-branch/{INVENTORY.md, REPORT.md, *.png}` |

Approx. 11 files modified, 1 file added, 1 doc file appended. Per-commit cadence in Step 8 is achievable.

---

## Gate 1 — waiting for "go"

Specifically, I need direction on:

- **A.** Multi-select vs singular gender/marital (recommend option 2 — keep multi for V1).
- **B.** Whether `capacity` + `academicYearStartDate` are in scope here (recommend: **no**, they're a separate patch).
- **C1.** Reuse `applicant-divisions` as STUDY_TRACK? (recommend: yes.)
- **C2.** Code prefix for the new `marital-statuses` lookup, and how to retire `lib/maritalStatuses.ts`.
- **C3.** Canonical `ACADEMIC_GRADES` ladder + percentage ranges.
- **D.** Sign-off on the proposed `useResolvedGradingModeForSpec` signature.
- **E.** Conflict banner auto-dismiss on flip-back: assume yes unless told otherwise.

I will not start Step 1 until I have a "go" with answers (or "use defaults, go") on these.
