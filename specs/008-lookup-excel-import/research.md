# Phase 0 — Research: Lookup Excel + CSV Import

Decisions taken before design (Phase 1). Each entry follows the
*Decision / Rationale / Alternatives* shape required by the speckit
plan workflow.

---

## 1. `.xlsx` parsing library

**Decision**: SheetJS (`xlsx`) community edition, loaded via dynamic
`import('xlsx')` from inside the import modal.

**Rationale**:
- SheetJS is the de-facto browser-side `.xlsx` reader. Battle-tested
  across thousands of production deployments; correct handling of
  workbook quirks (date serial numbers, locale-sensitive number
  formats, formula cells, merged cells, multiple sheets).
- Parses `.xlsx` (the only Excel variant in scope) plus `.xlsm`,
  `.xls`, `.ods`, and CSV — we only use the `.xlsx` branch, so the
  others stay dormant but are free if scope grows.
- Tree-shakeable in modern bundlers; the lazy chunk lands at
  ~190 KB gzipped of the ~430 KB full bundle.
- MIT-equivalent permissive licence on the community edition.

**Alternatives considered**:
- **ExcelJS** — Smaller for write paths but heavier (~300 KB) for
  read paths and weaker on edge-case workbook handling.
- **read-excel-file** (~60 KB gzipped) — Tempting on bundle size,
  but the maintainer's date and locale handling is known-buggy for
  Arabic locales and the project is single-author; high risk for
  production data.
- **Server-side parsing** with a new `POST /admin/<lookup>/import` —
  Rejected because (a) spec Assumption pins parsing client-side,
  (b) adding multipart upload + a transient parser endpoint is a
  bigger surface than the importer itself, and (c) the project's
  bundle-budget CI gate (Principle IV) is not yet wired, so the
  lazy-chunk cost is not load-bearing today.

---

## 2. `.csv` parsing library

**Decision**: PapaParse (`papaparse`) loaded eagerly (it sits under
the 30 KB Principle-I dependency threshold).

**Rationale**:
- ~7 KB gzipped; one of the most-used CSV libraries in the JS
  ecosystem. Handles the RFC 4180 edge cases the spec calls out:
  quoted fields with embedded commas, doubled-quote escape, CRLF
  and LF line endings.
- Supports a `header: true` mode that returns row objects keyed by
  the first-line headers — fits the Arabic-header schema we adopted.
- Encoding handling is delegated to the browser's `FileReader`
  with the `UTF-8` charset; combined with a BOM-stripping preprocess,
  this covers FR-003a (UTF-8 required, BOM tolerated).
- No runtime dependencies; works in a Web Worker if we ever want to
  move parsing off the main thread.

**Alternatives considered**:
- **Custom parser** (~50 lines) — Tempting, but production CSVs
  routinely surprise hand-rolled parsers (BOM, mid-field newlines,
  doubled quotes around quotes). Cost is low; risk is high.
- **csv-parse / csv-parser** — Node-only or heavier than PapaParse.

---

## 3. Encoding handling for CSV

**Decision**: Read the file as a `Blob`, detect a UTF-8 BOM
(`0xEF 0xBB 0xBF`), strip it, then decode the remaining bytes with
`new TextDecoder('utf-8', { fatal: true })`. A `fatal: true` decode
throws on invalid byte sequences, which we catch and surface as the
FR-003a rejection message.

**Rationale**:
- `TextDecoder` is universally available in target browsers and the
  `fatal: true` flag turns silent mojibake into a clear failure path.
- Spec rejects non-UTF-8 CSV (Windows-1256 etc.) per FR-003a — this
  approach surfaces the rejection deterministically rather than
  producing garbage Arabic strings downstream.

**Alternatives considered**:
- Auto-detect encoding via `jschardet` or similar (~120 KB) —
  rejected: adds budget cost for behaviour the spec explicitly says
  is out of scope.
- Permissive decode (`fatal: false`) — rejected: leads to mojibake
  reaching the preview and the database.

---

## 4. Parsing concurrency / UI responsiveness

**Decision**: Single-threaded parsing on the main thread, with an
asynchronous yield (`setTimeout(0)` micro-pause) every 100 rows during
post-parse validation. Web Workers deferred to a follow-up.

**Rationale**:
- 1000 rows × 5 columns = 5k cells. SheetJS parses this in well under
  the 3 s budget on a mid-tier laptop in benchmarks (~150 ms typical).
- The performance bottleneck is the *commit* loop (per-row HTTP, see
  decision 6), not the parse — parallelising parsing buys nothing
  user-visible.
- Web Workers add complexity (postMessage marshalling, transferable
  buffers for the file, separate bundle for the worker entry point);
  not worth it at 1000-row scale.

**Alternatives considered**:
- Web Worker for parsing — viable, deferred until measurement shows
  parse-time matters.
- Streaming parse via `papaparse.parse(file, { worker: true })` —
  built-in for CSV but not for SheetJS; mixed code paths would be
  costlier than the gain.

---

## 5. Conflict detection strategy

**Decision**: Two-pass, pure-frontend:

1. **Shape pass** — validate each parsed row against the destination
   lookup's Arabic-header schema (required columns present, key
   pattern matches `^[a-z0-9_-]+$`, enums recognised). Failures are
   partitioned into `errored`.
2. **Collision pass** — fetch the destination lookup's current rows
   once via the existing `useLookupList(key, { includeDeleted: true })`
   (TanStack-Query-cached; uses `staleTime` of 0 here to force a
   fresh read at preview time). Partition the rows that passed pass 1
   into `valid` / `active_collision` / `archived_collision` by
   comparing on `key`. FK columns (`الجامعة`, `نوع التخصص`,
   `المحافظة`) are resolved against the *active* parent rows; mismatches
   become `errored`.

**Rationale**:
- Two passes are clearer than interleaving shape + collision in one
  loop, and they let us short-circuit: if shape-pass fails on a row,
  we don't waste a collision lookup on it.
- Re-using the existing TanStack Query cache avoids a duplicate
  fetch when the user opened the import modal seconds after looking
  at the table.
- Pure-frontend detection (no `POST .../preview` endpoint) keeps the
  spec's no-backend-changes promise intact.

**Alternatives considered**:
- One-pass merged loop — slightly faster but tangled; rejected for
  readability and testability.
- Server-side preview endpoint — would require a new backend route
  per lookup; rejected per the no-backend-changes goal.

---

## 6. Commit orchestration & concurrency

**Decision**: Sequenced runner with a small parallelism cap (default
**4 concurrent requests**, configurable via a constant). Each accepted
row gets routed to one of:

- `POST /admin/<lookup>` for fresh creates
- `PATCH /admin/<lookup>/{id}` for `update` resolutions on
  `active_collision`
- `POST /admin/<lookup>/{id}/restore` then `PATCH .../{id}` for
  `restore_update` resolutions on `archived_collision`

The runner records each row's outcome (`created` / `updated` /
`restored` / `skipped` / `errored`) and surfaces progress to the UI
via a TanStack Query mutation hook.

**Rationale**:
- Sequential-with-cap matches the existing pattern used by the
  current mock `bulkImport` and keeps the dev API's session
  middleware happy (no thundering herd).
- 4 concurrent is a sweet spot from network testing — measurably
  faster than `1`, no measurable gain past `4` on the dev DB
  connection.
- Per-row outcomes feed the post-commit summary panel without
  needing a separate "what just happened" endpoint.

**Alternatives considered**:
- Fully sequential — too slow for 1000 rows (would exceed SC-001).
- Unbounded `Promise.all` — risks 429 / session-lock contention on
  the backend; rejected.
- New backend `POST /admin/<lookup>/bulk` endpoint accepting an
  array — biggest behavioural change, would also need
  bulk-conflict-resolution semantics on the backend. Out of scope.

---

## 7. Audit emission strategy

**Decision**: Hybrid per FR-012 / FR-012a:

- **Summary audit** — one `import_completed` action emitted from
  the frontend via the existing `emitAudit` helper *after* the runner
  finishes. Carries `entityType = "lookup-import"`, `entityId =
  <lookup-key>`, `entityLabel = <file-name>`, `details = "47 created,
  3 updated, 5 skipped"`.
- **Per-row audit** — comes "for free": the per-row REST calls
  (`POST` / `PATCH` / `POST .../restore`) already trigger the
  backend's normal audit middleware (spec 005 audit pipeline). No
  extra frontend code needed.

**Rationale**:
- Spec 005's audit module records every mutation through the
  dedicated endpoints; reusing that means a row created via import
  is indistinguishable in the audit log from a row created via the
  form drawer, which is exactly what spec FR-012a asked for.
- Summary audit lives only on the frontend because the backend
  doesn't know an import happened — it sees N independent writes.

**Alternatives considered**:
- Backend-side summary audit (require a new endpoint just to record
  the summary) — rejected: adds an endpoint for one purpose.
- Per-row audit emitted by the frontend in addition to the backend's
  — rejected: double-audit pollutes the log.

---

## 8. Arabic-header schema location

**Decision**: A single file —
`frontend/src/features/admin/api/lookup-import/arabic-schema.ts` —
exports a typed `LookupSchema` per lookup key, each with:

- `requiredHeaders: string[]` (Arabic strings)
- `optionalHeaders: string[]`
- `parentLookup?: LookupKey` (for hierarchical: faculties, specialties)
- `enums: Record<string, Record<arabic_label, backend_enum_value>>`
  (e.g., region → `{ "القاهرة الكبرى": "Cairo", "الدلتا": "Delta",
  … }`)
- `mapRow(row: Record<arabic_header, string>): BackendPayload`

**Rationale**:
- Single source of truth: the template generator, the parser, and
  the validator all import from this file. Adding a column means
  one edit, not three.
- Per-lookup typing keeps the mapper exhaustive — adding a new
  lookup forces the developer to fill in the schema or fail the
  build.
- Enum value mapping (Arabic ↔ backend enum) lives here too, so the
  Arabic-language commitment from Q1 doesn't bleed into the
  importer body.

**Alternatives considered**:
- Inline the schema in each per-lookup importer component — rejected:
  21× duplication.
- Generate the schema from a YAML / JSON config — rejected: adds a
  build-time generator step for marginal benefit.
