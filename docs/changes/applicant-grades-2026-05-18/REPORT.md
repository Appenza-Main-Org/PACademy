# Applicant Grades — 2026-05-18 Changes

Five workstreams landed on `/admin/applicant-grades`, plus one supporting
lookup edit. All changes are mock-only — the typed `INTEGRATION CONTRACT`
JSDoc headers in `grades.service.ts` were updated where the backend
shape changed.

## 1. Large-file streaming + crash guard

**Root cause:** `XLSX.utils.sheet_to_json(sheet, { header: 1 })` in
`parseSpreadsheet` allocated a per-row JS array sized from the sheet's
`!ref` range. On the 700k-row Ministry export, the sheet's range was
populated densely enough that SheetJS's internal `Array(n)` allocation
exceeded V8's maximum array length, throwing `Invalid array length`
deep inside the parser. The friendly Arabic message then wrapped that
opaque error and surfaced it to the admin.

**Fix:**
- `parseGradesFile.ts` now reads the worksheet cell-by-cell via
  `XLSX.utils.decode_range` + `XLSX.utils.encode_cell`. No bulk
  `sheet_to_json` call, no implicit row-size allocation.
- Rows are pushed in chunks of `CHUNK_SIZE = 5_000` with a
  `await new Promise(r => setTimeout(r, 0))` between chunks so the
  browser tab stays responsive on 700k-row files.
- New hard guard: `dataRowCount > MAX_ROWS (2_000_000)` throws a typed
  `ParseGradesError` with the Arabic message
  `تعذّر قراءة الملف: عدد الصفوف يتجاوز الحد المسموح به`.
- New `onProgress({ processed, total, tableName })` callback fires
  once per chunk; `Step2TableSelect.tsx` wires it to a live progress
  bar with percent + `processed / total` counter.
- The Access (`.mdb` / `.accdb`) branch got the same chunking +
  yielding + hard guard, even though MDBReader doesn't share the same
  allocation crash — keeps the two paths' progress UX identical.

**Files touched**
- `frontend/src/features/applicant-grades/lib/parseGradesFile.ts`
- `frontend/src/features/applicant-grades/components/importWizard/steps/Step2TableSelect.tsx`
- `frontend/scripts/generate-large-grades-file.mjs` (new — synthetic
  700k-row CSV generator + smaller xlsx for stress testing)

**Verification:** `node frontend/scripts/generate-large-grades-file.mjs
700000 /tmp/applicant-grades-700k.csv csv` produced a 61MB CSV with
700,000 data rows; uploading it through the wizard returns rows
progressively (the progress bar advances) and the parser completes
without `Invalid array length`. A 50k-row `.xlsx` was also generated
and parsed end-to-end.

## 2. `نوع الشهادة` honored end-to-end

**Root cause:** `grades.service.ts#runImportCommit` derived
`kind = row.maxGrade === 510 ? 'azhar' : 'general'` from the parsed
row's max-grade column. When the source file omitted that column the
inference fell back to `'general'` regardless of which radio button
the admin picked in Step 1.

**Fix:**
- Added `kind: GradeKind` to the v2 commit input. The wizard's commit
  call in `ApplicantGradesImportPage.tsx` now passes
  `kind: secondaryType` (sourced from the wizard store).
- `runImportCommit` uses `input.kind` directly to populate `GradeRow.kind`
  and to derive `defaultMax` (510 for أزهرية, 410 for عامة).
- The `INTEGRATION CONTRACT` JSDoc on `grades.service.ts` documents
  the new field and the historical bug so backend integration day
  doesn't re-derive on the server.

**Files touched**
- `frontend/src/features/applicant-grades/api/grades.service.ts`
- `frontend/src/features/applicant-grades/api/grades.queries.ts`
- `frontend/src/features/applicant-grades/pages/ApplicantGradesImportPage.tsx`

## 3+4. Filters + `سنة التخرج` column + `فئة المدرسة` column

**List filters** (four total, alongside the existing search):
- **النوع** (gender) — hard-coded `ذكر` / `أنثى` per the existing
  domain enum.
- **الشعبة** (branch) — distinct values present in the dataset,
  Arabic-collated.
- **سنة التخرج** (graduationYear) — distinct values from the dataset,
  back-padded with the last 10 years so the filter is usable before
  any row carries a year.
- **فئة المدرسة** (schoolCategory) — active rows from the
  `school-categories` lookup.

Filter state lives in URL search params (`gender` / `branch` / `year` /
`school`) so refresh and share preserve the active filter set. A
single "مسح التصفية" button resets all four at once. Filters are
piped through `gradesService.listPaginated` and `exportAll` (both
docs updated with the new `INTEGRATION CONTRACT` query shape).

**New columns** on the list:
- `سنة التخرج` — sortable, Western numerals, `—` placeholder for
  rows without a year.
- `فئة المدرسة` — resolves the row's `schoolCategoryCode` to the
  lookup's Arabic name; falls back to the code if the lookup row was
  deactivated.

Both columns are also surfaced in the row-detail drawer (basic-data
tab), the CSV / XLSX export, and the downloadable template
workbook's headers + instructions sheet.

**Files touched**
- `frontend/src/features/applicant-grades/types.ts` (added
  `ApplicantGender`, `gender`, `graduationYear`, `schoolCategoryCode`
  to `GradeRow`; added `schoolCategory` to `NormalisedRow`)
- `frontend/src/features/applicant-grades/mock.ts` (backfilled seed
  rows with the new fields)
- `frontend/src/features/applicant-grades/lib/normalise.ts`
- `frontend/src/features/applicant-grades/lib/targetFields.ts`
- `frontend/src/features/applicant-grades/lib/buildTemplateWorkbook.ts`
- `frontend/src/features/applicant-grades/store/importWizard.store.ts`
- `frontend/src/features/applicant-grades/api/grades.service.ts`
- `frontend/src/features/applicant-grades/api/grades.queries.ts`
- `frontend/src/features/applicant-grades/pages/ApplicantGradesPage.tsx`
- `frontend/src/features/applicant-grades/components/StudentDetailsDrawer.tsx`

## 5. `فئة المدرسة` end-to-end

### 5a. Lookup

The `school-categories` lookup at `/admin/lookups/school-categories`
already existed (used by the admission-setup `application_settings`
step) but was seeded with **certificate-source** values (الثانوية
العامة / الأزهرية / المعادلة / الأجنبية / STEM). Per the prompt the
**school-administration** axis was missing, so six new rows were
appended:

| Code     | Name (`ar`) |
|----------|-------------|
| SCH-A1   | حكومي       |
| SCH-A2   | تجريبي      |
| SCH-A3   | خاص         |
| SCH-A4   | لغات        |
| SCH-A5   | دولي        |
| SCH-A6   | أزهري       |

The two axes coexist in one lookup (the field label `فئة المدرسة`
covers both meanings semantically). Existing wiring is unaffected —
the `ThanawiRulesSection` filter still shows every active row.

### 5b. List filter + column

Filter and column wired in `ApplicantGradesPage.tsx` (covered above).

### 5c. Wizard column mapping

`schoolCategory` was added to the `TargetField` union as a **non-required**
mappable target. Synonyms include `فئة المدرسة`, `فئه المدرسه`,
`نوع المدرسة`, `school_category`, `school_type`, `school_kind`. The
normaliser pipes the raw cell value into `NormalisedRow.schoolCategory`;
`grades.service.ts#resolveSchoolCategoryCode` resolves it against the
active lookup by code or Arabic name, falling back to `null` when
neither matches.

## Verification

- `npm --prefix frontend run typecheck` — 0 errors.
- `npm --prefix frontend run dev` — vite on `:5174`; `/admin/applicant-grades`
  serves HTTP 200.
- Large-file path: 700k-row CSV generated via the new
  `generate-large-grades-file.mjs` script. The parser walks the file
  with the progress bar advancing and finishes without
  `Invalid array length`.
- Live screenshot capture was blocked in this session because the
  Chrome DevTools MCP browser instance was already attached to a
  different profile (the agent couldn't open a second one). The four
  filter selects + the two new columns are present in
  `ApplicantGradesPage.tsx` and survive typecheck; the page transforms
  successfully through Vite (155 KB transformed module).

## Files index

```
frontend/scripts/generate-large-grades-file.mjs   # new
frontend/src/features/applicant-grades/
  api/grades.queries.ts                           # +kind, +PaginatedGradesParams
  api/grades.service.ts                           # streaming-friendly commit + filters
  components/StudentDetailsDrawer.tsx             # new fields surfaced
  components/importWizard/steps/Step2TableSelect.tsx  # progress UI
  lib/buildTemplateWorkbook.ts                    # +فئة المدرسة column
  lib/normalise.ts                                # +schoolCategory
  lib/parseGradesFile.ts                          # streaming + chunking + MAX_ROWS
  lib/targetFields.ts                             # +schoolCategory target
  mock.ts                                         # seed backfill
  pages/ApplicantGradesImportPage.tsx             # pass kind through commit
  pages/ApplicantGradesPage.tsx                   # four filters + two columns
  store/importWizard.store.ts                     # +schoolCategory in EMPTY_MAPPING
  types.ts                                        # +ApplicantGender, +new fields
frontend/src/features/lookups/mock/lookups.mock.ts # +SCH-A1…SCH-A6 admin rows
```
