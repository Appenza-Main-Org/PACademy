# Claude Code prompt — `/admin/applicant-grades` import wizard v2

## Begin prompt

You are working in `frontend/` of the Police Academy Admissions Platform. Read `CLAUDE.md` §2, §2.5, §3 before touching code. Strict TS, named exports only, no `useEffect` for fetching, no `any`, no third-party chart libs, logical CSS properties only, RTL-first Arabic UI, tokens + Radix primitives only.

Scope: rebuild the import wizard at `/admin/applicant-grades` from a 3-step flow (الإعدادات → مراجعة التكرار → النتيجة) into a 6-step flow that survives real `.mdb` / `.accdb` / `.xlsx` / `.xls` / `.csv` files, gives the admin full control over column mapping + value filtering, and ends with an actionable results report. Backend is mocked — wire everything through the existing service + queries layer in `frontend/src/features/applicant-grades/`.

### Step 0 — Inventory & gate

1. Read every file under `frontend/src/features/applicant-grades/` and note: current parser entry points, the wizard component tree, the service + queries shape, and the row/result types. Reply with a one-screen inventory and a list of files you intend to add or modify. **Stop and wait for confirmation before writing code.**

### Step 1 — Fix the parse error (Pilot 1)

The current screen on `.accdb` upload shows "تعذّر قراءة الملف". Reproduce against `docs/fixtures/applicant-grades/` (create the folder and a small `.accdb` + `.xlsx` + `.csv` fixture if missing). Root-cause and fix. Common causes to check in order:
- `mdb-reader` needs a `Buffer`, not an `ArrayBuffer` — the `buffer` polyfill is already a dep, import `Buffer` from `'buffer'` and wrap the `FileReader` result.
- Dynamic `import('mdb-reader')` default-vs-named export shape on prod build.
- `xlsx` reading `.xls` needs `type: 'array'`, `.xlsx` accepts both — normalise.
- File extension dispatch is case-sensitive; lowercase before switching.

Commit `fix(applicant-grades): repair .accdb/.xlsx parser dispatch and Buffer handoff` once green. **Stop and confirm before continuing.**

### Step 2 — Parser returns a typed `ParsedSheet`

Promote the parser to a pure function:

```ts
// frontend/src/features/applicant-grades/lib/parseGradesFile.ts
export type ParsedSheet = {
  sourceName: string;        // file name
  format: 'accdb' | 'mdb' | 'xlsx' | 'xls' | 'csv';
  tables: Array<{
    name: string;            // sheet name / table name (mdb may have several)
    columns: string[];       // header row as found in source
    rows: Array<Record<string, string | number | null>>;
    rowCount: number;
  }>;
};
export async function parseGradesFile(file: File): Promise<ParsedSheet> { … }
```

`.mdb`/`.accdb` returns every table; admin picks one in Step 3. `.xlsx`/`.xls` returns every sheet. `.csv` returns one synthetic table. No throwing on empty cells — coerce to `null`.

### Step 3 — Wizard restructure (6 steps)

Replace the existing 3-step stepper with this sequence. Each step is a separate component under `frontend/src/features/applicant-grades/components/importWizard/steps/`. The wizard shell stays the same; only the step list and state machine change.

State lives in a Zustand store `useImportWizardStore` (sessionStorage-backed so a refresh doesn't kill the session):

```ts
type ImportWizardState = {
  step: 1|2|3|4|5|6;
  secondaryType: 'general' | 'azhar';
  maxGrade: 410 | 510 | number; // pill picker, manual override allowed
  graduationYear: number;       // numeric, applies to every imported row
  file: File | null;
  parsed: ParsedSheet | null;
  selectedTableName: string | null;
  mapping: Record<TargetField, string | null>;     // target field → source column
  filters: Record<string, { mode: 'all' | 'include'; values: string[] }>; // source column → allow-list
  importResult: ImportReport | null;
};
```

`TargetField` enumerates the destination columns: `nameAr`, `nationalId`, `gender`, `track` (الشعبة — علمي علوم / علمي رياضة / أدبي / أزهري …), `totalGrade`, and any optional extras the existing domain row already supports. Source list lives in one place — `frontend/src/features/applicant-grades/lib/targetFields.ts`.

**Step 1 — الإعدادات.** Keep existing inputs (secondary type, max grade) and add the **graduation year picker** here (Combobox of `currentYear - 10 … currentYear`, default = active cycle's year). This value is applied to every row at import time; do **not** ask per row. File upload also stays here, but no parsing happens yet — only `accept` validation + size check.

**Step 2 — اختيار الجدول/الورقة.** Runs `parseGradesFile`. Shows a tiny summary card (file name, size, format) and a Radix RadioGroup of detected tables/sheets with row counts. For `.csv` the step auto-advances. Errors render in the existing `ErrorState` shell with a "إعادة المحاولة" button that re-runs the parser.

**Step 3 — ربط الأعمدة.** Two-column layout: left = list of `TargetField`s with their Arabic label and a required/optional pill; right = preview of the first 5 rows. Each target field has a Combobox of detected source columns. Pre-fill the mapping with a fuzzy match (normalise whitespace, strip diacritics, match against a per-field synonym list — e.g. `nationalId` matches `الرقم القومي`, `national_id`, `nid`, `RQM_QWMY`). Below the matcher show a "تعيين تلقائي" button that re-runs the fuzzy match. The "متابعة" button is disabled until every required field is mapped.

**Step 4 — تصفية القيم.** For every **mapped** source column, list the column name, the distinct value count, and a Radix Popover with a checkbox tree of distinct values (cap at 200 — show "+N قيمة أخرى" link to expand). Default mode is `all`. Switching to `include` shows the checkboxes. Live count at the top: "ستُستورد X من Y صفًا بعد التصفية". This is the step that lets the admin keep only ذكر rows, only specific tracks, etc.

**Step 5 — مراجعة التكرار.** Reuse the existing dedupe-by-national-id step but now drive it off the **filtered + mapped** rowset. Service signature stays the same. Add three counters at the top: مطابقات سابقة بالرقم القومي، أرقام قومية غير صالحة، صفوف بحقول مطلوبة فارغة.

**Step 6 — النتيجة.** Replace the current results screen with a grouped report:

```ts
type ImportReport = {
  totals: { received: number; imported: number; skipped: number; failed: number };
  groups: Array<{
    code:
      | 'DUPLICATE_NID'        // already exists in DB
      | 'INVALID_NID'          // checksum / length fail
      | 'MISSING_REQUIRED'     // mapping mapped but cell empty
      | 'NID_NOT_FOUND'        // applicant not registered in cycle
      | 'GRADE_OUT_OF_RANGE'   // > maxGrade or < 0
      | 'UNREADABLE_VALUE';    // parser couldn't coerce a number
    labelAr: string;
    rows: ImportFailureRow[];
    availableActions: Array<'skip' | 'override' | 'export' | 'create-applicant'>;
  }>;
};
```

Render as a stack of collapsible Radix Accordion cards, one per non-empty group. Card header shows the count + Arabic label + a colored Badge using the existing status tokens. Card body is a `DataTable` of the offending rows (national ID, name, total grade, source row index). Each card has a Bulk-Action toolbar wired to `availableActions`:
- `skip` — drop the group from this import.
- `override` — for `GRADE_OUT_OF_RANGE` and `DUPLICATE_NID`, replace existing values.
- `export` — download a CSV of just this group (use the existing CSV helper in `shared/lib/`, do not add papaparse).
- `create-applicant` — for `NID_NOT_FOUND`, queue these rows into the new-applicant flow (mock: emit an audit event, no real navigation yet).

Final "تأكيد الاستيراد" button at the bottom of Step 6 commits the surviving rows and routes back to the adjustments console with a toast.

### Step 4 — Service + queries

Extend `applicantGrades.service.ts`:

```ts
preflightImport(input: { rows: NormalisedRow[]; graduationYear: number }): Promise<ImportReport>;
commitImport(input: {
  rows: NormalisedRow[];
  graduationYear: number;
  perGroupActions: Record<ImportReport['groups'][number]['code'], 'skip'|'override'|'create-applicant'>;
}): Promise<{ insertedCount: number; failedCount: number }>;
```

Both are mock-backed via the seeded LCG (seed-42). Wrap them in `useApplicantGradesPreflight` and `useApplicantGradesCommit` mutations in `applicantGrades.queries.ts`. Invalidate the adjustments-console list query on success.

### Step 5 — Dev review + report

Add a dev-only entry under `/_dev/applicant-grades-import` that lets us drive each step in isolation with a hard-coded `ParsedSheet`. Use the same shell as `/_dev/primitives`.

Write `docs/migration/applicant-grades-import-v2/REPORT.md` with: file inventory, fix root cause, before/after screenshots of each step, the new wizard state shape, and the service signatures. Include a follow-ups list.

### Acceptance

- `npm --prefix frontend run typecheck` returns 0 errors.
- `npm --prefix frontend run lint` returns 0 warnings.
- `.accdb`, `.xlsx`, `.csv` fixtures all complete the full 6-step flow end-to-end without runtime errors.
- Every required `TargetField` resists advance unless mapped.
- Filter step's "X من Y" counter updates live as toggles change.
- Step 6 groups render only when non-empty; empty-state copy never leaks.
- No `any`, no `useEffect` for fetching, no default exports, no `pl-*`/`pr-*`/`ml-*`/`mr-*`, no hardcoded hex, no new component libraries.

One commit per step (1 → 5). Conventional commit messages. Stop after Step 1 (the fix) and after Step 3 (wizard restructure) for review before proceeding.

---

### Step 6 — List page rebuild (`/admin/applicant-grades`)

Same architectural rules. Each numbered point below is its own commit.

**6.1 — Promote the importer to a standalone page, not a modal.**
- Remove the in-page Dialog/Drawer that hosts the import wizard. The "استيراد درجات المتقدمين" toolbar button on `/admin/applicant-grades` now navigates to a new route `/admin/applicant-grades/import` registered in `routes.tsx` and added to `ROUTES.admin` as `applicantGradesImport`.
- The wizard renders inside `AdminLayout` chrome (not in a Modal). Use the existing `Wizard` shared component for the stepper shell; `PageHeader` carries title + breadcrumbs (`/admin/applicant-grades` → `استيراد درجات المتقدمين`) + an "إلغاء" action that routes back.
- After Step 6's "تأكيد الاستيراد" commits, navigate back to `/admin/applicant-grades` with a success toast (carry total counts in the toast message). On "إلغاء" mid-wizard, show an unsaved-changes confirm if `parsed` is non-null.
- Update every link/CTA that used to open the modal (Empty state's primary action on the list page, toolbar button, command palette entry if present).

**6.2 — Add `seatingNumber` to the row domain.**
- Extend the applicant-grades row type with `seatingNumber: string | null` (Eastern-Arabic-formatted on render via `shared/lib/arabic.ts`). Seed mock rows with deterministic seating numbers from the seed-42 LCG (use `mock-helpers`).
- The mapping step gains a new `TargetField` `seatingNumber` with synonyms: `رقم الجلوس`, `seating_number`, `seat_no`, `RQM_GLWS`. Mark it **optional** — older imports won't have it.
- Add the column to the list `DataTable` between `nationalId` and `nameAr`. Sortable. Searchable (see 6.4).
- Add the column to the drawer-based row details view.
- Add the column to every export (see 6.5) and to the template download (see 6.6).

**6.3 — Pagination with page-size selector.**
- The list page already uses the shared `DataTable`. Wire its pagination props if they aren't wired. Keep page + pageSize in **URL search params** (`?page=2&size=50`) — never in component state — so a refresh preserves position. Use `react-router-dom`'s `useSearchParams`.
- Page-size selector: a Radix Select rendered in the table footer toolbar, options `[20, 50, 100, 200]`, default `50`. Changing size resets `page` to 1.
- Footer copy in Arabic: `عرض {from}–{to} من {total}` with Eastern Arabic numerals.
- The service grows `listApplicantGrades({ page, pageSize, search, sort })` returning `{ rows, total }`. Existing mock backing fans out — slice the full dataset after filtering+sorting. Wrap in `useApplicantGradesList` keyed by the params.

**6.4 — Server-side search (national ID / seating number / name).**
- One search input in the toolbar (replace any client-side filter). Debounce 250ms (`useDebounce` from `shared/lib/`). Search term lives in `?q=...`.
- The service matches against `nationalId` (exact or prefix on the digit string), `seatingNumber` (exact or prefix, ignoring Eastern/Western digit form — normalise both sides via `shared/lib/arabic.ts`), and `nameAr` (substring, diacritic-insensitive, normalise via the same lib).
- Search resets `page` to 1. Show "لا توجد نتائج لـ \"{q}\"" in the table's empty state when results are zero but rows exist overall.

**6.5 — Export all data, not just the visible page.**
- Toolbar button "تصدير" opens a Radix DropdownMenu with two items: `تصدير الصفحة الحالية` and `تصدير كل البيانات (مع تطبيق البحث)`. Default item is the full export.
- "كل البيانات" hits a new service method `exportApplicantGrades({ search, sort })` that returns the **entire filtered dataset** (mock: just bypasses pagination). It streams to a CSV via the existing `shared/lib/csv.ts` helper (do NOT add papaparse). Filename: `applicant-grades-{cycle}-{YYYY-MM-DD}.csv`.
- Add a `xlsx` export option as well, using the already-installed `xlsx` package (lazy-loaded — reuse the existing dynamic import). Columns must match the template (see 6.6) so re-import is round-trip-safe.
- During export show a non-blocking toast `جارٍ تجهيز الملف…` and replace it on completion with `تم تنزيل {n} صفًا`. Disable both export buttons while a job is in flight.

**6.6 — Excel template download.**
- Add an "تنزيل نموذج Excel" action to the toolbar of **both** the list page and Step 1 of the import wizard (under the file-upload zone, with a brief help text: "نزّل النموذج لضمان تطابق الأعمدة").
- Wire it to a new helper `frontend/src/features/applicant-grades/lib/buildTemplateWorkbook.ts` that builds a single-sheet `.xlsx` via the lazy-loaded `xlsx` package:
  - Sheet name: `درجات المتقدمين`.
  - Row 1: Arabic headers in the order: `الرقم القومي`, `رقم الجلوس`, `الاسم باللغة العربية`, `النوع`, `الشعبة`, `سنة التخرج`, `المجموع الكلي`, `الدرجة العظمى`. Make the row bold + freeze it.
  - Row 2: one example row using realistic Arabic sample values (Eastern Arabic numerals where appropriate — the importer must accept both forms; document this in the comment cell).
  - A second hidden sheet `الإرشادات` with: file-format notes, accepted max-grade values (410, 510), accepted `الشعبة` values, and the duplicate-handling rule.
- Filename: `applicant-grades-template.xlsx`. Track template version in a constant `TEMPLATE_VERSION = '2026-05-A'` and stamp it into the first column header's cell comment so we can support older templates later.
- Template headers MUST match the auto-mapping synonym list so a user can download → fill → upload → and Step 3 maps every column without a single manual pick. Verify this with a fixture round-trip in `docs/migration/applicant-grades-import-v2/REPORT.md`.

**6.7 — Report append.**
- Extend `docs/migration/applicant-grades-import-v2/REPORT.md` with: new route, new domain field, URL-state pagination contract, search-matcher rules, export filenames + column ordering, template version + sheet structure, before/after screenshots.

### Acceptance additions

- `/admin/applicant-grades/import` is reachable directly and resists deep-link refresh (state persists or restarts cleanly).
- Refreshing `/admin/applicant-grades?page=3&size=100&q=300` preserves page, size, and search.
- Page-size selector is keyboard-operable; focus ring uses `var(--ring)`.
- Searching for a national ID in either Eastern or Western digits returns the same rows.
- `تصدير كل البيانات` produces a CSV/XLSX whose row count equals the post-search total (verified for at least 3 different queries).
- Downloading the Excel template, filling 2 rows, and uploading it walks every wizard step with **zero** manual column mapping required.
- Seating number renders in Eastern Arabic numerals everywhere it appears.

One commit per sub-step (6.1 → 6.7). Stop after 6.1 and after 6.6 for review.

## End prompt
