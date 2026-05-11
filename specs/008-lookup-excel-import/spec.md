# Feature Specification: Lookup Excel Import

**Feature Branch**: `008-lookup-excel-import`
**Created**: 2026-05-11
**Status**: Draft
**Input**: User description: "import from excel in lookup pages"

## Clarifications

### Session 2026-05-11

- Q: Excel column header language for the per-lookup template — English keys, Arabic labels, or bilingual? → A: Arabic labels only (e.g., `المفتاح`, `الاسم بالعربية`, `الإقليم`). The importer maps Arabic headers back to the backend's English field names internally so the contract stays clean. Templates are admin-facing artifacts; admin-first language wins.
- Q: Archived-row collision behaviour — same as active-row conflict, or its own thing? → A: A distinct conflict subtype with three resolutions — **Restore + Update** (un-archive and apply the incoming values), **Skip** (leave the archived row untouched), **New Key Required** (the import row must rename its `المفتاح` before commit). Default resolution is **Skip** so bulk imports never silently resurrect dropped data.
- Q: Audit granularity for imports — single summary, per-row, or hybrid? → A: Hybrid. One **summary audit entry** per import (file name, lookup type, total + count-by-outcome, acting user) **plus** one **per-row audit entry only for mutating outcomes** (`created`, `updated`, `restored`). Skipped and errored rows appear in the summary count only — they don't generate per-row audit entries. Compliance reviewers can trace "who restored row X?" by querying audit on the dedicated lookup table exactly as they do for hand-edits.
- Q: Accepted file formats — `.xlsx` only, or also `.csv`? → A: **Both `.xlsx` and `.csv`**. Admins frequently work with CSV (lighter-weight, broader tool compatibility for the data-entry team). CSV files MUST be UTF-8 encoded (BOM optional but tolerated) so Arabic headers and values parse correctly. Templates remain `.xlsx` only — admins who want CSV save-as from the downloaded template. `.xls` (binary Excel 97) and Google-Sheets-direct uploads stay out of scope.

## User Scenarios & Testing *(mandatory)*

The admin manages 21 reference-data / lookup tables (governorates, specializations,
ranks, colleges, qualifications, nationalities, relationships, case types,
education types, marital statuses, universities, faculties, specialties,
specialty types, degree types, jobs, exam types, exam groups, committee types,
rejection reasons, notification departments). Today each row is created one at a
time via a form drawer; for catalogues that ship with dozens to hundreds of rows
this is unworkable. The new flow lets the admin paste/upload an Excel sheet,
preview what was parsed, resolve any issues, and confirm the bulk insert.

### User Story 1 — Bulk-load a lookup from a clean Excel sheet (Priority: P1)

The super-admin opens any lookup tab (e.g., the *جنسيات / Nationalities* tab),
clicks **استيراد من ملف** in the page header, picks a `.xlsx` or `.csv` file
that matches the expected Arabic-labelled column layout, sees a preview of the
rows the system parsed with a count of valid rows, and clicks **استيراد** to
commit. The page then refreshes with the new rows appended in their seeded
sort order. The admin sees a success toast: *"تم استيراد 47 سجلاً بنجاح"*.

**Why this priority**: This is the entire reason for the feature. Without it,
filling each of the 21 lookup tables one row at a time wastes hours during
initial setup of a new cycle. P1 because it must work end-to-end for at least
the "happy path" (well-formed file, no conflicts) before anything else is worth
shipping.

**Independent Test**: Pick one simple lookup (e.g., *Job titles*), prepare an
Excel file with 10 valid rows that don't collide with existing keys, run the
import, verify all 10 rows appear in the table and the row count in the page
header updates accordingly.

**Acceptance Scenarios**:

1. **Given** an admin is on the Nationalities lookup tab with 14 existing
   active rows, **When** they import a 10-row Excel file with valid, unique
   keys, **Then** the import preview shows "10 rows valid · 0 conflicts" and
   confirming commits all 10 rows; the table refreshes to show 24 active rows.
2. **Given** an admin has just created a new draft cycle and no governorates
   exist, **When** they import the 27-row Egyptian governorates template,
   **Then** all 27 rows are inserted and the *المحافظات* tab now shows the
   full set with `region` populated for each.
3. **Given** an admin is on the Faculties tab, **When** they import an Excel
   file whose `universityKey` column references universities that already
   exist in the *الجامعات* tab, **Then** the foreign-key relationship is
   resolved by key on the way in and the faculties land linked to the right
   universities.

---

### User Story 2 — Download a per-lookup template (Priority: P2)

Before preparing the file, the admin needs to know which columns the system
expects. From the same import dialog, they can click **تنزيل القالب** to get
an `.xlsx` template tailored to the current lookup type, with the column
headers already laid out and a single example row to copy. Per-type templates
differ — Governorates wants `key, nameAr, nameEn, region, sortOrder`;
Faculties wants `key, labelAr, labelEn, universityKey, sortOrder`; Specialties
adds a `gender` column on top of that.

**Why this priority**: Reduces "wrong-shape file" errors to near zero. Without
the template, admins are guessing which fields are required and what
casing/values are valid (e.g., is the region "Cairo" or "cairo"?). P2 because
P1 still works if the admin already knows the schema — but field support
calls will spike without this.

**Independent Test**: On each of the 21 lookup tabs, click *تنزيل القالب*
and verify the file is a valid Excel workbook whose first sheet has exactly
the headers expected by the importer, with one example row beneath.

**Acceptance Scenarios**:

1. **Given** an admin is on the Specialties tab, **When** they click
   *تنزيل القالب*, **Then** the downloaded file contains Arabic headers —
   `المفتاح | الاسم بالعربية | الاسم بالإنجليزية | نوع التخصص | النوع | الترتيب` —
   and a sample row with valid values (e.g., النوع = "ذكور").
2. **Given** an admin fills the downloaded template and uploads it without
   changing any headers, **When** the importer parses it, **Then** every
   column maps to its target field without manual remapping and the preview
   shows "N rows valid · 0 conflicts".

---

### User Story 3 — Preview, resolve conflicts, and partial-import (Priority: P3)

Real-world files often have duplicate keys, missing required cells, or
hierarchy FKs that don't exist yet. The preview step lists every problem row
with the reason ("Key 'cairo' already exists — choose Skip or Update", "Row
12 missing required column 'labelAr'", "Row 17 references unknown
universityKey 'unknown_uni'") and lets the admin pick a per-conflict
resolution or import only the valid rows. The admin can also abort the
preview entirely without writing anything to the database.

**Why this priority**: Conflict handling is what separates a toy importer
from one that survives messy production input. P3 because the basic happy
path covers ~80% of expected usage; conflict handling is a UX polish that
saves time but is not load-bearing if the template is clean.

**Independent Test**: Prepare a 20-row file where 3 keys collide with
existing rows, 2 rows have missing required cells, and 1 row references a
non-existent parent key. Verify the preview reports `14 valid · 5 errors ·
1 unresolved conflict`, that selecting *Skip* for each conflict and
clicking import inserts exactly the 14 valid rows, and that the table
reflects the result.

**Acceptance Scenarios**:

1. **Given** an import file with 5 rows where 2 keys are identical to each
   other, **When** the system parses the file, **Then** the preview flags
   one of the two as a duplicate-within-file error so only one row from the
   pair is offered for import.
2. **Given** an import file for Faculties referencing an archived university
   key, **When** the preview runs, **Then** that row is flagged as
   "referenced parent is archived" and excluded from the valid count.
3. **Given** a preview shows 10 valid rows and 3 conflicts, **When** the
   admin clicks *إلغاء*, **Then** nothing is written; reopening the import
   later starts from scratch.

---

### Edge Cases

- File extension is `.xlsx` or `.csv` but contents don't match (e.g., a
  CSV renamed to `.xlsx`, a binary blob renamed to `.csv`, a password-
  protected workbook, or a corrupted file) — the importer must reject
  with a clear Arabic-language message before any preview is shown.
- CSV file is not UTF-8 (e.g., Windows-1256 / cp1256, which Excel for
  Arabic often picks by default) — rejected per FR-003a; the error
  message tells the admin to re-save with UTF-8 encoding.
- CSV file has a UTF-8 BOM (Excel's "Save As → CSV UTF-8 (Comma
  delimited)" produces this) — the importer strips the BOM silently and
  parses the file normally.
- CSV file has mixed line endings (CRLF + LF in the same file) or a
  trailing blank line — handled gracefully; no rows produced from blank
  lines.
- CSV value contains an embedded comma or newline inside a properly
  quoted field — parsed as a single field per FR-003b.
- File is empty or its first sheet contains only the header row — preview
  shows "0 rows valid · 0 conflicts" and the *استيراد* button stays
  disabled.
- File exceeds the size or row-count limit (see Assumptions) — rejected
  upfront with the limit named in the message.
- File contains rows past the row-count limit — only the first N rows are
  parsed; the user is told the remainder were ignored.
- A `key` cell contains characters the backend's key validator rejects
  (currently `^[a-z0-9_-]+$`) — the row is flagged with the exact reason.
- All rows in the preview are conflicts that the admin chooses to skip — the
  importer treats the import as a no-op and emits no audit entry.
- The browser tab is closed mid-import — partial rows already committed
  remain; no rollback. (See assumption on transactionality.)
- Two admins import into the same lookup concurrently — last-write-wins per
  row; key-uniqueness errors surface naturally to whichever request lands
  second.
- Soft-deleted (archived) rows whose `المفتاح` matches an incoming file
  row — handled per FR-008a as a distinct conflict subtype: the admin
  picks **Restore + Update**, **Skip** (default), or **New Key Required**.
  The committed outcome is recorded per-row in the post-import summary so
  any restores are traceable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST surface an **استيراد من ملف** action on every
  one of the 21 lookup pages, available only to roles with the lookup's
  edit permission. The button label MUST NOT imply a specific file format
  (since both `.xlsx` and `.csv` are accepted — see FR-003).
- **FR-002**: The system MUST provide a per-lookup **تنزيل القالب** action
  that produces an `.xlsx` file whose first-sheet header row contains the
  **Arabic labels** the importer expects for that lookup type
  (e.g., `المفتاح`, `الاسم بالعربية`, `الإقليم`, `الجامعة`, `الترتيب`).
  Each Arabic header maps deterministically to a backend field. The mapping
  is owned by the importer; admin-facing artifacts never expose the
  English keys. Admins who prefer CSV save-as from the downloaded template
  (UTF-8, comma-delimited) — a separate CSV template is NOT shipped.
- **FR-003**: The system MUST accept uploads in **`.xlsx`** and **`.csv`**
  formats. Format is detected by file extension (and validated against
  MIME-type when the browser supplies one). `.xls` (binary Excel 97) and
  Google-Sheets-direct uploads are out of scope.
- **FR-003a**: CSV uploads MUST be parsed as **UTF-8** (with optional BOM)
  to preserve Arabic headers and values. Files in other encodings (e.g.,
  Windows-1256, ISO-8859-6) MUST be rejected upfront with a clear
  Arabic-language error message asking the admin to re-save as UTF-8.
- **FR-003b**: CSV parsing MUST handle: comma-as-delimiter, double-quote
  field enclosure for values containing commas or line breaks, doubled
  double-quotes (`""`) as the escape for a literal quote inside a quoted
  value, and both CRLF and LF line endings. Tab- or semicolon-delimited
  files are out of scope.
- **FR-004**: The system MUST reject any upload that exceeds the file-size
  limit (assumption: **5 MB**) or row-count limit (assumption: **1000
  data rows**, excluding header) with a clear, named error before parsing
  any rows.
- **FR-005**: For `.xlsx` uploads the system MUST parse the first sheet,
  treat the first row as the header, and ignore any sheets beyond the
  first. For `.csv` uploads the system MUST treat the first record line
  as the header. In both cases the parsed header set MUST match the
  Arabic-labelled columns expected for the destination lookup (FR-002).
- **FR-006**: The system MUST validate, per row: (a) all required columns
  (resolved by Arabic header) present and non-empty, (b) `المفتاح` matches
  the backend's key-validator pattern (`^[a-z0-9_-]+$`), (c) enum-valued
  columns (e.g., `الإقليم`, `النوع`, `الفئة`) contain a recognised Arabic
  value that maps to a known backend enum member, (d) FK-valued columns
  (`الجامعة`, `نوع التخصص`, `المحافظة`) resolve by the parent's `المفتاح`
  to an active row in the referenced lookup.
- **FR-007**: The system MUST detect duplicate keys *within the uploaded
  file* and flag every duplicate after the first occurrence.
- **FR-008**: The system MUST detect collisions with *existing active rows*
  in the destination table and offer the admin a per-row resolution: skip
  the new row, update the existing row's mutable fields, or abort the
  whole import.
- **FR-008a**: The system MUST detect collisions with *existing archived
  (soft-deleted) rows* as a **distinct conflict subtype** — visually
  distinguishable from active-row conflicts in the preview — and offer
  the admin a per-row resolution from: **Restore + Update**
  (un-archive the row and apply the incoming values), **Skip** (leave
  the archived row archived; the incoming row is dropped), or **New Key
  Required** (the import row must rename its `المفتاح` before commit can
  proceed). The default pre-selection is **Skip**.
- **FR-009**: The system MUST display a preview before any database writes,
  listing: total parsed, valid, in-conflict, errored — plus a row-level
  breakdown of every problem.
- **FR-010**: The system MUST let the admin commit the import only after
  every conflict has a resolution chosen (or has been excluded). Errored
  rows are always excluded from commit and are listed in the post-import
  summary.
- **FR-011**: On commit, the system MUST insert/update each row independently
  (per-row best-effort) so a single row-level backend failure does not
  abort the rest. Each row's outcome (created, updated, skipped, failed)
  MUST appear in the post-import summary.
- **FR-012**: The system MUST emit a **summary audit entry** per import
  operation containing: lookup type, file name, total rows attempted,
  count by outcome (created / updated / restored / skipped / errored),
  and the acting user.
- **FR-012a**: The system MUST additionally emit a **per-row audit entry**
  for every row whose outcome is `created`, `updated`, or `restored`.
  Skipped and errored rows are NOT individually audited — they are only
  reflected in the FR-012 summary count. Per-row entries carry the same
  shape as a hand-edit audit entry (so compliance queries against the
  lookup don't need to special-case import-origin), and they reference
  the summary audit entry's id for traceability.
- **FR-013**: Imported rows that omit `sortOrder` MUST be assigned a
  sortOrder equal to `max(existing.sortOrder) + N` where N is the row's
  position in the file (so the file's row order is preserved).
- **FR-014**: Imported rows that omit `isActive` / `active` MUST default to
  active.
- **FR-015**: For hierarchical lookups (faculties, specialties), the FK
  column MUST accept the parent's `key` (not its Guid), and the importer
  MUST resolve the Guid server-side.
- **FR-016**: The system MUST refuse to import into a lookup the current
  user lacks the write permission for, even if they navigated to the page
  (the page-level guard should prevent the button from rendering, but a
  defence-in-depth check at submit time is required).

### Key Entities

- **Import Session** (transient, lives for the duration of one upload):
  Identifies one preview-then-commit cycle. Attributes: lookup type, file
  name, total parsed rows, valid count, conflict count, error count,
  per-row results.
- **Row Outcome**: For each row in the file, after commit, one of:
  `created`, `updated`, `restored` (archived row brought back), `skipped`
  (admin chose skip), `errored` (validation or backend failure with
  reason).
- **Conflict Type**: Either `active_collision` (incoming `المفتاح` matches
  an active row) or `archived_collision` (matches a soft-deleted row).
  Different resolution menus apply to each — see FR-008 and FR-008a.
- **Conflict Resolution**: Per-row choice attached to a key collision.
  For `active_collision`: `skip` / `update` / `abort` (global).
  For `archived_collision`: `restore_update` / `skip` (default) /
  `rename_required`.
- **Per-Lookup Template**: For each of the 21 lookups, the column layout
  the importer expects. Includes required columns, optional columns, and
  enum/FK constraints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A super-admin can import the full Egyptian governorates list
  (27 rows) from a clean template file in under **45 seconds** end-to-end
  (open dialog → upload → preview → confirm → table refreshed).
- **SC-002**: Time spent populating a fresh lookup catalogue drops by at
  least **90%** versus the row-at-a-time form drawer (measured for a
  representative 50-row table such as Specialties).
- **SC-003**: At least **95%** of import attempts using the provided
  per-lookup template succeed with zero unresolved conflicts on the first
  preview.
- **SC-004**: For every import operation the audit log contains a summary
  entry (file name, lookup type, outcome counts) plus one per-row entry
  for every `created` / `updated` / `restored` row — both visible from the
  `/admin/audit` page within **5 seconds** of the import completing.
- **SC-005**: When a file fails the size or row-count limit, the user sees
  the rejection message within **2 seconds** of selecting the file (i.e.,
  no parsing latency surprise).
- **SC-006**: An admin can resolve every conflict surfaced by the preview
  without leaving the import dialog — no second upload required.

## Assumptions

- The 21 lookup tables share the same per-row validation rules already
  enforced by their dedicated REST endpoints (`/admin/governorates`,
  `/admin/faculties`, …). The importer reuses those rules; it does not
  duplicate validation logic.
- Excel (`.xlsx`) and CSV (`.csv`) parsing both happen client-side. Files
  never leave the browser unparsed; the importer makes one HTTP call per
  row using the existing dedicated `POST` / `PATCH` endpoints.
- File-size cap: **5 MB**. Row-count cap: **1000 data rows** per import.
  These are upper bounds that protect the browser, not product
  requirements — they can be revisited if a real catalogue exceeds them.
- Conflict-resolution scope is per-row: there is no bulk "skip all" or
  "update all" affordance in this iteration. (If admins reach for one
  regularly, follow-up scope.)
- `.xls` (binary Excel 97) and Google-Sheets-direct uploads are explicitly
  out of scope. Admins who use Google Sheets export to `.xlsx` or `.csv`
  before uploading. Tab-separated and semicolon-separated CSV variants are
  also out of scope; only comma-delimited UTF-8 CSV is accepted.
- Imports are not transactional across rows. A row-N failure does not
  unwind rows 1…N-1. Audit captures the per-row outcomes.
- Templates are generated client-side from a static schema definition;
  the backend does not need to host the template files.
- Only `super_admin` (or any role with the lookup's write permission)
  triggers imports; other roles never see the button.
