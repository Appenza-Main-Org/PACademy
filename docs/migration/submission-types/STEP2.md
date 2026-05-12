# SUBMISSION_TYPES migration — Step 1.4 (revised) + Step 2.3 report

Patch instruction:
> If any category code listed above is NOT present in the existing seed, surface it in the report rather than silently dropping it.

This is that report. Also captures the four open-question deviations from `INVENTORY.md §6` that auto-resolved when "go" was issued without answers.

---

## 1. Seed-row count (Step 1.4 revised)

Replaced the 2-row seed from Step 1 with the patched 4-row seed:

| Code    | nameAr             | nameEn                          | gradingMode | sortOrder | metadata.createdBy / createdAt |
|---------|--------------------|---------------------------------|-------------|-----------|---------------------------------|
| SUB-001 | تقديم عام          | General Submission              | GRADES      | 10        | `system` / `2026-05-12T00:00:00.000Z` |
| SUB-002 | تقديم المتخصصين    | Specialists Submission          | TAGDIR      | 20        | same                            |
| SUB-003 | تقديم الحقوقيين    | Law Graduates Submission        | TAGDIR      | 30        | same                            |
| SUB-004 | تربية رياضية إناث  | Physical Education — Females    | GRADES      | 40        | same                            |

**Deviations from the patch's column list:**

- **No top-level `createdBy` / `createdAt` columns** — every other row in `frontend/src/features/lookups/types.ts` extends `LookupRowBase` (code, name, isActive), no audit fields. Adding two columns just for `submission-types` is inconsistent. Stashed inside `metadata` instead, alongside `gradingMode`. If audit fields land system-wide later, lift them to `LookupRowBase` and out of metadata in the same commit.
- **No `id` column** — the codebase uses `code` as durable identity. The prompt's `submissionTypeId` becomes `submissionTypeCode` in §2.
- **`nameEn`, `sortOrder` added as typed columns** on `SubmissionTypeRow` — these are useful enough to be top-level (other rows like `ApplicantCategoryRow` already have `nameEn`).

---

## 2. Step 2.3 — applicant-categories ↔ submission-types mapping

### 2.1 Patch table → actual seed

The patch's category table assumes codes `CAT-01 … CAT-08`. The actual seed uses snake_case codes (the lookup-absorption work renamed `.key` → `.code`). Matched the patch table against the actual seed by Arabic name:

| Patch row | Patch category | Patch → SUB | Actual seed row | Outcome |
|---|---|---|---|---|
| CAT-01 | ثانوية عامة — ذكور | SUB-001 | **absent** | dropped (see §2.3) |
| CAT-02 | ثانوية عامة — إناث | SUB-001 | **absent** | dropped |
| CAT-03 | الأزهر الشريف | SUB-001 | **absent** | dropped |
| CAT-04 | الضباط المتخصصون | SUB-002 | `officers_specialized` (قسم الضباط المتخصصين) | **applied** |
| CAT-05 | تربية رياضية | SUB-004 | **absent** | dropped |
| CAT-06 | حقوق | SUB-003 | **absent** | dropped |
| CAT-07 | حاملو شهادات أجنبية | SUB-001 | **absent** | dropped |
| CAT-08 | الدراسات العليا | SUB-002 | `postgraduate` (الدراسات العليا) | **applied** |

**2 of 8 patch entries matched; 6 dropped.**

### 2.2 Actual seed rows + final assignment

Five seed rows aren't named in the patch table. For these, fell back to the row's existing `applicationMode` (the typed column already on `ApplicantCategoryRow`): `general → SUB-001`, `nomination → SUB-002`. This respects the row's own data rather than blindly defaulting to general.

| Actual code | Actual nameAr | applicationMode | Final submissionTypeCode | Basis |
|---|---|---|---|---|
| `officers_general` | قسم الضباط (القسم العام) | general | SUB-001 | applicationMode fallback |
| `officers_specialized` | قسم الضباط المتخصصين | general | SUB-002 | explicit name-match with CAT-04 (overrides applicationMode) |
| `postgraduate` | الدراسات العليا | nomination | SUB-002 | explicit name-match with CAT-08 |
| `institute_officers_training` | معهد تدريب الضباط | nomination | SUB-002 | applicationMode fallback |
| `institute_traffic` | معهد المرور | nomination | SUB-002 | applicationMode fallback |
| `institute_guarding` | معهد الحراسات والتأمين | nomination | SUB-002 | applicationMode fallback |
| `special_units` | الوحدات الخاصة | nomination | SUB-002 | applicationMode fallback |

**Resulting distribution:** SUB-001 ×1, SUB-002 ×6, SUB-003 ×0, SUB-004 ×0.

### 2.3 Patch categories with NO match in seed — surfaced

These 6 patch-listed categories do not exist in `MOCK.lookups['applicant-categories']` today. The patch should either:
- have a follow-up step that adds them, or
- accept that the verifications in Step 10 that depend on their presence will not pass.

| Patch code | Patch nameAr | Patch nameEn equivalent (inferred) |
|---|---|---|
| CAT-01 | ثانوية عامة — ذكور | Thanaweya Amma — Male |
| CAT-02 | ثانوية عامة — إناث | Thanaweya Amma — Female |
| CAT-03 | الأزهر الشريف | Al-Azhar |
| CAT-05 | تربية رياضية | Physical Education |
| CAT-06 | حقوق | Law |
| CAT-07 | حاملو شهادات أجنبية | Foreign Certificate Holders |

The existing `officers_specialized` row's `description` field already says "حقوق / طب / هندسة / إعلام" — i.e. the "law graduates" applicants are bundled into the specialists category. The fine-grained CAT-06 (حقوق) split doesn't exist as a separate row yet.

---

## 3. Step 10 verification — pre-flight against the current seed

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | `APPLICANT_CATEGORIES` grid shows **4 distinct** submission-type badges across the 8 rows: عام (×4), متخصصين (×2), حقوقيين (×1), تربية رياضية إناث (×1). | **FAIL** | The seed has 7 rows, not 8, and currently shows **2 distinct** badges: تقديم عام (×1), تقديم المتخصصين (×6). To pass: add CAT-01..03, CAT-05..07 as actual seed rows in a follow-up. |
| 2 | `SUBMISSION_TYPES` grid shows 4 rows with the gradingMode badge color split: 2 × درجات (info), 2 × تقدير (gold). | **PASS** | Rendered by [`LookupTabPanel.tsx`](frontend/src/features/lookups/components/LookupTabPanel.tsx) `case 'submission-types'`. SUB-001 + SUB-004 → درجات (info); SUB-002 + SUB-003 → تقدير (accent). |
| 3 | Soft-deleting any of SUB-001 / SUB-002 / SUB-003 / SUB-004 throws `IN_USE`. | **PARTIAL** | Reference check added to [`lookups.service.ts`](frontend/src/features/lookups/api/lookups.service.ts) (`if (key === 'submission-types') …`). SUB-001 (1 ref) and SUB-002 (6 refs) **will** block delete. SUB-003 and SUB-004 have **zero references** and will allow delete — same root cause as #1. |
| 4 | Applicant data entry for an applicant under CAT-04 renders `TagdirSelect`; under CAT-01 renders `GradesInput`. | **PENDING** | (a) CAT-01 doesn't exist in the seed (see #1); (b) `TagdirSelect` and `GradesInput` components don't exist yet. Branch must be wired in a downstream step against `officers_specialized` (TAGDIR via SUB-002) vs `officers_general` (GRADES via SUB-001). Today, [`Stage4EducationPage.tsx:151-165`](frontend/src/features/applicant-portal/pages/Stage4EducationPage.tsx#L151-L165) renders numeric inputs unconditionally — the branching seam is still in place from Step 1's plan. |

---

## 4. Files touched this step

- `frontend/src/features/lookups/types.ts` — added `nameEn`, `sortOrder` to `SubmissionTypeRow`.
- `frontend/src/features/lookups/mock/lookups.mock.ts` — replaced 2-row seed with 4-row seed; added `CATEGORY_SUBMISSION_MAP` + `submissionTypeCodeFor()` helper; added `metadata.submissionTypeCode` to all 7 applicant-category rows.
- `frontend/src/features/lookups/api/lookups.service.ts` — added `'submission-types'` branch to `countReferences()`, reading the FK off `applicant-categories[*].metadata.submissionTypeCode`.
- `frontend/src/features/lookups/components/LookupTabPanel.tsx` — swapped the `applicant-categories` "نوع التقديم" column from the legacy `applicationMode` binary badge to the new FK-resolved badge.

Typecheck passes (`npm --prefix frontend run typecheck`).

---

## 5. To unblock Step 10 fully, decisions needed

1. **Add the 6 missing applicant-category rows?** (CAT-01..03, CAT-05..07) — required for verification #1 + #3 to pass. Affects scope by ~6 fully-shaped applicant-category rows (each has description, conditions, requiredTests, procedures — ~30 lines per row).
2. **Decide the `TagdirSelect` / `GradesInput` component shape** (Step 10 verification #4). `TagdirSelect` needs a vocabulary — fixed enum (`ممتاز / جيد جدًا / جيد / مقبول`) or free-text Input? Today's admin form's `education.grade` is free-text; portal has no field at all.
3. **Drop or keep `ApplicantCategoryRow.applicationMode`?** The new FK + metadata.gradingMode supersedes it. Today both are on the row, with `applicationMode` no longer rendered in the lookups grid. Removing it is a typecheck-impact change across `LookupRowDrawer.tsx` (form switch + `blankRow`) and any external readers (grep shows zero external readers).
