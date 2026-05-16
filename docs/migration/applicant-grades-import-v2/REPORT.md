# `/admin/applicant-grades` Import Wizard v2 — Migration Report

This report covers the full v2 rebuild of the applicant-grades surface:
the parser, the 6-step wizard, the new standalone route, and the list
page changes (pagination, search, export, template). Captures both the
root cause of the original parse failure and the architectural shape
the wizard now sits on.

---

## 1. File inventory

### Added

| File | Purpose |
|---|---|
| `frontend/src/features/applicant-grades/lib/parseGradesFile.ts` | Pure parser returning a typed `ParsedSheet` — every table/sheet from `.mdb`/`.accdb`/`.xlsx`/`.xls`/`.csv`. |
| `frontend/src/features/applicant-grades/lib/targetFields.ts` | Destination-column registry (`TargetField` union) + fuzzy `autoMapColumns()`. |
| `frontend/src/features/applicant-grades/lib/normalise.ts` | Maps a `ParsedTable` row dict → `NormalisedRow` using the wizard's mapping + filters. Surfaces `countFiltered` and `distinctValues` for Step 4. |
| `frontend/src/features/applicant-grades/lib/buildTemplateWorkbook.ts` | Lazy-loaded Excel template builder. Stamps `TEMPLATE_VERSION = '2026-05-A'` into the first header cell's comment. |
| `frontend/src/features/applicant-grades/store/importWizard.store.ts` | Zustand store with sessionStorage persistence. Partializes out the `File` + `ParsedSheet` (non-serialisable). |
| `frontend/src/features/applicant-grades/components/importWizard/steps/Step{1..6}*.tsx` | Six step components — Settings · TableSelect · ColumnMapping · Filters · DuplicateReview · Result. |
| `frontend/src/features/applicant-grades/pages/ApplicantGradesImportPage.tsx` | Standalone wizard page at `/admin/applicant-grades/import` inside `AdminLayout`. |
| `frontend/src/features/dev/ApplicantGradesImportReviewPage.tsx` | Dev-only `/_dev/applicant-grades-import` drive-each-step-in-isolation surface. |
| `docs/fixtures/applicant-grades/sample-{general,azhar}.csv` | CSV fixtures for end-to-end testing. |
| `docs/fixtures/applicant-grades/README.md` | Fixture-folder index + drop-in instructions for binary `.xlsx` / `.accdb` files. |

### Modified

| File | Change |
|---|---|
| `frontend/src/features/applicant-grades/lib/parseAccessFile.ts` | Plant `Buffer` polyfill on `globalThis` **before** `mdb-reader` evaluates. Guard the default-export shape against Vite CJS↔ESM interop. |
| `frontend/src/features/applicant-grades/types.ts` | Add `seatingNumber: string \| null` to `GradeRow`. Add v2 types — `NormalisedRow`, `ImportReport`, `ImportReportGroup`, `ImportFailureRow`, `ImportGroupCode`, `ImportGroupAction`, `ImportCommitResult`. |
| `frontend/src/features/applicant-grades/mock.ts` | Seed `seatingNumber` for every mock row. |
| `frontend/src/features/applicant-grades/api/grades.service.ts` | Add `runImportPreflight`, `runImportCommit`, `listPaginated`, `exportAll`. The v1 `commitImport` survives unchanged (renaming v2 keeps the legacy wizard's hook compatible during the transition). |
| `frontend/src/features/applicant-grades/api/grades.queries.ts` | Add `useApplicantGradesPreflight`, `useApplicantGradesCommit`, `useApplicantGradesList`. |
| `frontend/src/features/applicant-grades/pages/ApplicantGradesPage.tsx` | URL-state pagination + debounced search, new `seatingNumber` column (Eastern numerals), export dropdown, template download button. |
| `frontend/src/features/applicant-grades/index.ts` | Export `ApplicantGradesImportPage`. |
| `frontend/src/config/routes.ts` | Add `ROUTES.admin.applicantGradesImport = '/admin/applicant-grades/import'`. |
| `frontend/src/routes.tsx` | Register `applicant-grades/import` and `/_dev/applicant-grades-import`. |

---

## 2. Step 1 — Parse error root cause

**Symptom.** Uploading `.accdb` (and frequently `.xlsx`) produced the
single fallback error `تعذّر قراءة الملف`. There was no real error
message bubbling out of the parser; the UI assumed every non-typed
exception was a generic file-read failure.

**Root cause.** `mdb-reader@3.2` is published as an ESM module that
exposes the browser entry point through `lib/browser/index.js`. The
internal helpers (`util.ts`, `usage-map.ts`) call `Buffer.allocUnsafe()`
and `Buffer.from()` via the *global* `Buffer` symbol — which the
browser doesn't define. Wrapping the input bytes through the `buffer`
npm polyfill (`new MDBReader(Buffer.from(arrayBuffer))`) was already in
place, but it didn't help: the library's internal calls resolved
`Buffer` against `globalThis` and got `undefined`. Every page read then
threw `Buffer is not defined`, which the catch block surfaced as the
opaque Arabic fallback.

**Fix** (`lib/parseAccessFile.ts`):

1. Sequentially `await import('buffer')` and install the polyfill on
   `globalThis.Buffer` once, **before** dynamically importing
   `mdb-reader`. The sequential ordering matters — `Promise.all`
   wouldn't guarantee the polyfill is planted before `mdb-reader`'s
   top-level code runs.
2. Defensively resolve the default export against the `mod` itself in
   case Vite's CJS↔ESM interop nests `default.default` in prod builds.
3. Lowercase file-extension dispatch is already in place; no change
   needed but verified.

Step 2's new `parseGradesFile.ts` carries the same polyfill setup so
both code paths converge on the fixed approach.

---

## 3. Wizard state shape

```ts
type PersistedImportWizardState = {
  step: 1|2|3|4|5|6;
  secondaryType: 'general' | 'azhar';
  maxGrade: number;             // 410 | 510 by default, manual override allowed
  graduationYear: number;       // default = currentYear
  fileMeta: { name: string; size: number } | null;
  selectedTableName: string | null;
  mapping: Record<TargetField, string | null>;
  filters: Record<string, { mode: 'all' | 'include'; values: string[] }>;
  importResult: ImportReport | null;
  perGroupActions: Record<string, 'skip' | 'override' | 'create-applicant'>;
};

// Non-persisted siblings — recreated when the admin re-picks a file.
file: File | null;
parsed: ParsedSheet | null;
```

The `File` + `ParsedSheet` slices live in the store but are **not**
persisted (Zustand's `partialize`). On refresh the wizard restores the
admin's settings + mapping + filter decisions but lands them on Step 1
because the source file is gone — exactly the behaviour we want.

---

## 4. Service signatures

```ts
// frontend/src/features/applicant-grades/api/grades.service.ts
gradesService.runImportPreflight(input: {
  rows: NormalisedRow[];
  graduationYear: number;
}): Promise<ImportReport>;

gradesService.runImportCommit(input: {
  rows: NormalisedRow[];
  graduationYear: number;
  perGroupActions: Record<ImportGroupCode, 'skip' | 'override' | 'create-applicant' | undefined>;
}): Promise<{ insertedCount: number; failedCount: number }>;

gradesService.listPaginated(input: {
  page: number;
  pageSize: number;
  search: string;
  sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
}): Promise<{ rows: GradeRow[]; total: number }>;

gradesService.exportAll(input: {
  search: string;
  sort?: { key: keyof GradeRow; direction: 'asc' | 'desc' } | null;
}): Promise<GradeRow[]>;
```

Service methods are renamed `runImportPreflight` / `runImportCommit`
(rather than the spec's `preflightImport` / `commitImport`) to avoid
colliding with the v1 `commitImport` that the legacy modal wizard still
uses. The query hooks the prompt names — `useApplicantGradesPreflight` /
`useApplicantGradesCommit` — wrap the new methods.

The preflight bucketer is exclusive — every row lands in **one** group,
checked in the declared order: `MISSING_REQUIRED` → `INVALID_NID` →
`UNREADABLE_VALUE` → `GRADE_OUT_OF_RANGE` → `DUPLICATE_NID`. Rows that
clear every check count as `imported`.

---

## 5. List-page contracts

### URL state

| Param | Meaning | Default |
|---|---|---|
| `page` | 1-indexed page number | `1` |
| `size` | Page size | `50` (one of `20 / 50 / 100 / 200`) |
| `q` | Search term | `''` |

`useSearchParams` is the source of truth. A refresh of
`/admin/applicant-grades?page=3&size=100&q=300` restores all three.
The input value is mirrored locally and debounced 250ms before being
written to `q`.

### Search matcher

- `nationalId` — exact / prefix on the digit string. Eastern Arabic
  digits get normalised to ASCII before comparison via
  `easternToAscii`.
- `seatingNumber` — exact / prefix, digit-form-insensitive.
- `nameAr` — substring, diacritic-insensitive (`normalizeArabic`).

Empty-state copy reads `لا توجد نتائج لـ "<q>"` when a search is
active and the result set is empty.

### Export

| Action | Output |
|---|---|
| تصدير الصفحة الحالية (CSV) | The page currently rendered, in `applicant-grades-2026-YYYY-MM-DD.csv`. |
| تصدير كل البيانات (CSV) | Full filtered dataset via `gradesService.exportAll` — `applicant-grades-2026-YYYY-MM-DD.csv`. |
| تصدير كل البيانات (XLSX) | Same dataset, written via lazy-loaded `xlsx` package — `applicant-grades-2026-YYYY-MM-DD.xlsx`. |

The column order matches the template, so re-import is round-trip safe.

### Template workbook

| Sheet | Hidden? | Contents |
|---|---|---|
| `درجات المتقدمين` | No | Frozen header row + one realistic example row. |
| `الإرشادات` | Yes | File-format notes, accepted max-grade values, accepted `الشعبة` values, duplicate-handling rule. |

**Round-trip verified:**

1. Download `applicant-grades-template.xlsx` from the list page or
   Step 1 of the wizard.
2. Fill 2 rows in `درجات المتقدمين`.
3. Re-upload the file in Step 1.
4. In Step 2, the single sheet `درجات المتقدمين` is auto-picked.
5. In Step 3, **every** target field is auto-mapped — the synonym list
   in `targetFields.ts` is a superset of the template headers.
6. Step 4 reports `2 من 2 صفًا بعد التصفية`.
7. Step 5 + 6 walk through to a successful commit.

### Template version

`TEMPLATE_VERSION = '2026-05-A'` is stamped into the first header cell's
comment (`A1.c`). Future template revisions bump this string; older
templates can be detected by reading that comment on upload.

---

## 6. Follow-ups

- **Binary fixtures.** The repo currently ships only `.csv` fixtures
  because committing a Ministry `.accdb` export carries data-sensitivity
  questions. The Docs README ([docs/fixtures/applicant-grades/README.md](../../fixtures/applicant-grades/README.md))
  documents how to drop a real `.accdb` in for local reproduction.
- **NID-not-found grouping.** The mock preflight intentionally never
  emits `NID_NOT_FOUND` because there's no cycle-applicant registry to
  cross-check against. Real-backend integration day will fill this in.
- **`create-applicant` action plumbing.** Step 6's `create-applicant`
  bulk action currently stops at the per-group state — it doesn't yet
  navigate the admin to the new-applicant flow. The hook is in place
  for when applicant intake gets a programmatic API.
- **Filter UI density.** Step 4's filter cards render flat. Columns
  with >200 distinct values expand on click via "+N قيمة أخرى". A
  search-within-popover affordance is a follow-up if practical
  Ministry exports start carrying very-high-cardinality columns we
  haven't seen yet.
- **Sort propagation to export.** The list page's active sort is
  passed to `exportAll`, so the exported CSV/XLSX matches the on-screen
  order. Verify against >1k-row datasets when the real backend lands.
- **List page legacy modal removal.** The legacy `ImportWizard.tsx`
  component is still present in the codebase but no longer mounted —
  it was the source of the old in-page modal. Cleanup is intentionally
  deferred to keep this PR small; it should be removed alongside the
  `MissingColumnError` + `ImportedGradeRow` types in a follow-up sweep.

---

## 7. Screenshots

> Screenshots are produced from the running dev server at
> `/_dev/applicant-grades-import` for each step in isolation, plus
> `/admin/applicant-grades/import` for the integrated wizard, and
> `/admin/applicant-grades?page=1&size=50` for the list page. Save them
> under `docs/migration/applicant-grades-import-v2/screenshots/`.
>
> The `before/` set is captured from the `polish-complete` tag
> (the last commit on the legacy modal). The `after/` set is captured
> from the tip of this branch. The captures are intentionally not
> committed here — drop them into the folder once the deploy lands so
> reviewers can compare side-by-side.

| Slot | Before (v1 modal) | After (v2 page) |
|---|---|---|
| Step 1 — Settings | `before/step-1.png` | `after/step-1.png` |
| Step 2 — Table select | n/a (auto-parse) | `after/step-2.png` |
| Step 3 — Column mapping | n/a (fixed columns) | `after/step-3.png` |
| Step 4 — Filters | n/a | `after/step-4.png` |
| Step 5 — Duplicate review | `before/step-2-review.png` | `after/step-5.png` |
| Step 6 — Result report | `before/step-3-result.png` | `after/step-6.png` |
| List page (with `seatingNumber`) | `before/list.png` | `after/list.png` |
