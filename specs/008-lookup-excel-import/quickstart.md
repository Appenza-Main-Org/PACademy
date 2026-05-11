# Quickstart: Lookup Excel + CSV Import

A 5-minute operator's guide for the admin landing on a lookup page for
the first time after this feature ships.

---

## What it does

Every one of the 21 lookup pages
(`/admin/reference-data/governorates`, `/admin/universities`,
`/admin/faculties`, …) gains a new **استيراد من ملف** action in the
page header next to *إضافة جديد*. Click it and you can bulk-load the
page from an Excel (`.xlsx`) or CSV (`.csv`) file instead of typing
each row.

## Day-1 walkthrough

### 1. Open the import modal

On any lookup tab, click **استيراد من ملف**. A modal opens with a
drop-zone and two buttons: **تنزيل القالب** (download the per-lookup
template) and **رفع ملف** (upload).

### 2. Get the right shape

Click **تنزيل القالب**. You get a `.xlsx` file whose first row contains
Arabic column headers tailored to this lookup type:

- **Governorates** → `المفتاح | الاسم بالعربية | الاسم بالإنجليزية | الإقليم | الترتيب`
- **Faculties** → `المفتاح | الاسم بالعربية | الاسم بالإنجليزية | الجامعة | الترتيب`
- **Specialties** → `المفتاح | الاسم بالعربية | الاسم بالإنجليزية | نوع التخصص | النوع | الترتيب`
- …and 18 others, each derived from its dedicated REST resource.

Row 2 is a sample entry to copy.

If you'd rather work in CSV, save-as `.csv (UTF-8)` from Excel —
the importer accepts both. **Don't** save as the default `.csv`
(non-UTF-8) — the importer will reject it with an Arabic-language
error telling you why.

### 3. Upload

Drop the file on the modal or click *رفع ملف*. Limits:

- ≤ **5 MB** file size
- ≤ **1000 data rows** (header excluded)
- `.xlsx` or `.csv` extension; CSV must be UTF-8

Files that fail any of these checks are rejected within ~2 s with a
clear message.

### 4. Preview

The parser produces a table of every row, classified into one of:

- **valid** (green) — will be inserted as-is.
- **active_collision** (amber) — key matches an existing active row.
  Pick **Skip** (drop the new row), **Update** (overwrite the existing
  row's mutable fields), or **Abort** (cancel the whole import).
- **archived_collision** (blue) — key matches a soft-deleted row.
  Pick **Skip** (default — leave the archive alone), **Restore +
  Update** (un-archive and apply the new values), or **New Key
  Required** (edit the key cell in-place to a free key).
- **errored** (red) — shape problem (missing required column,
  invalid key pattern, unknown enum value, FK not found, duplicate
  within file, etc.). These can't be imported until fixed in the source
  file.

The header shows live counts:
*"47 صالحة · 3 تعارض نشط · 1 تعارض مؤرشف · 2 خطأ"*.

### 5. Commit

The **استيراد** button enables when every conflict row has a
resolution chosen (or has been re-classified back to *valid* via the
*New Key Required* path). It stays disabled while *errored* rows
exist — fix the source file and re-upload.

Commit walks the accepted rows with up to 4 parallel HTTP calls,
shows a progress bar, and records each row's outcome
(`created` / `updated` / `restored` / `skipped` / `errored`).

### 6. Summary

When the runner finishes you see a panel:

```
تم الاستيراد · governorates.xlsx
  ✓ 47 سجلاً جديداً
  ✓ 3 سجلات محدثة
  ↻ 1 سجل أُعيد تفعيله
  – 2 سجل تم تخطيه
  ✗ 1 سجل فشل  (انقر للتفاصيل)
```

The audit log (`/admin/audit`) gains:

1. **One summary entry** — `import_completed · لجنة استيراد البيانات
   المرجعية · governorates.xlsx · 47 + 3 + 1 = 51 written, 3 skipped`.
2. **One per-row entry** for each `created` / `updated` / `restored`
   row, indistinguishable in shape from a hand-edit audit entry. Skipped
   and errored rows do **not** appear here — they're captured only in
   the summary's counts.

This satisfies FR-012 / FR-012a (hybrid audit).

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Preview says "encoding unsupported" on a `.csv` | File is Windows-1256 / cp1256 (Excel's default for Arabic) | In Excel: Save As → CSV UTF-8 (Comma delimited) |
| All rows show as "duplicate in file" | The `المفتاح` column has trailing whitespace differences | Use Excel's TRIM() over the key column before saving |
| Faculty rows error with "parent not found" | `الجامعة` cells contain free-text names instead of the parent's `المفتاح` | Use the university `المفتاح` (lowercase, ASCII; e.g., `cairo`, not `جامعة القاهرة`). The template's example row shows the correct shape. |
| Modal never opens | The current user lacks the lookup's edit permission | Log in as `super_admin` (or whichever role owns the lookup's write permission per FR-016) |
| `.xls` file rejected | Binary Excel 97 is out of scope per spec Assumption | Save-as `.xlsx` in Excel first |

---

## For developers

- Schema lives at `frontend/src/features/admin/api/lookup-import/arabic-schema.ts`.
  Adding a new lookup type? Edit one entry there and the template,
  parser, and validator all pick it up.
- The `xlsx` library is **dynamically imported** inside the import
  modal. Don't import it eagerly elsewhere or the lookup pages bloat by
  ~190 KB.
- Tests:
  - `arabic-schema.test.ts` — 21 fixtures per lookup
  - `csv-parser.test.ts` — UTF-8, BOM, mixed line endings, quoted fields
  - `conflict-detector.test.ts` — all 4 row classifications
  - `import-runner.test.ts` — runner outcomes with MSW
  - `ImportLookupModal.test.tsx` — smoke + interaction + jest-axe
  - `lookup-import.e2e.ts` (Playwright) — Governorates happy path
- Performance budget: 1000-row `.xlsx` parsed + classified in ≤ 3 s;
  1000-row commit in ≤ 30 s with 4-way concurrency.
