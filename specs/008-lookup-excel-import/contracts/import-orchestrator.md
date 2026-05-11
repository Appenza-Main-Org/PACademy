# Contract: Lookup Import Orchestrator (internal frontend API)

This feature does **not** expose any new HTTP endpoints. Its contracts
are internal TypeScript module boundaries that downstream feature work
and tests will rely on.

The 21 backend REST resources used by the runner (see *Backend
endpoints actually called*, below) are already specified in spec 007's
21-table split — they are not re-specified here.

---

## Module: `frontend/src/features/admin/api/lookup-import/`

```text
lookup-import/
├── arabic-schema.ts        # static 21-entry map; single source of truth
├── xlsx-parser.ts          # SheetJS wrapper, dynamic-imported
├── csv-parser.ts           # papaparse wrapper, eager-imported, UTF-8 enforced
├── conflict-detector.ts    # two-pass classifier
├── import-runner.ts        # commit orchestrator with parallelism cap
├── template-writer.ts      # generates the per-lookup .xlsx template
├── types.ts                # ImportSession, ParsedRow, LookupSchema, etc.
└── index.ts                # barrel
```

The public surface (re-exported from `index.ts`) is:

```ts
export type {
  LookupKey,
  LookupSchema,
  ImportSession,
  ParsedRow,
  RowOutcome,
  RowClassification,
  ConflictDescriptor,
  ConflictResolution,
  ImportSummary,
} from './types';

export { ARABIC_SCHEMAS } from './arabic-schema';

export async function parseImportFile(
  file: File,
  lookupKey: LookupKey,
): Promise<{ rows: ParsedRow[]; rejection: ImportRejection | null }>;

export async function classifyImportRows(
  rows: ParsedRow[],
  lookupKey: LookupKey,
): Promise<ParsedRow[]>;     // mutates classification + conflict in place

export function createImportRunner(
  session: ImportSession,
  onProgress: (rowIndex: number, outcome: RowOutcome) => void,
): {
  run(): Promise<ImportSummary>;
  abort(): void;
};

export function buildTemplate(lookupKey: LookupKey): Blob;     // .xlsx
```

---

## `parseImportFile(file, lookupKey)`

**Inputs**:
- `file: File` — from the `<input type="file">` change event.
- `lookupKey: LookupKey` — which schema to validate against.

**Output**:
- On success: `{ rows: ParsedRow[], rejection: null }`. Each `row.classification`
  is initialised to `'valid'` or `'errored'` based on **shape only** —
  `active_collision` / `archived_collision` come later from
  `classifyImportRows`.
- On rejection: `{ rows: [], rejection: ImportRejection }` where
  `ImportRejection` discriminates:
  - `'too_large'` (file > 5 MB)
  - `'too_many_rows'` (> 1000 data rows)
  - `'unsupported_format'` (extension/MIME mismatch, or `.csv` not UTF-8)
  - `'corrupted'` (parser threw)
  - `'empty'` (zero data rows)
  - `'schema_mismatch'` (missing required Arabic headers)

**Throws**: never. All failure cases land in `rejection`.

**Side effects**: none. Pure with respect to global state.

**Performance**: parse + shape-validate a 1000-row `.xlsx` in
≤ 3 s on a mid-tier laptop (per the Phase 1 perf budget). CSV is
single-threaded papaparse — faster (< 1 s for 1000 rows).

---

## `classifyImportRows(rows, lookupKey)`

**Inputs**:
- `rows: ParsedRow[]` — output of `parseImportFile`, with only
  shape-pass classification.
- `lookupKey: LookupKey`.

**Behaviour**:
1. Fetches the destination lookup's full row list (active + archived)
   via TanStack Query (`useLookupList(key, { includeDeleted: true })`),
   forcing `staleTime: 0` to get a fresh read.
2. For hierarchical lookups, also fetches the parent lookup's rows.
3. For each `'valid'` row:
   - Build a `Map<key, { id, archived }>` from the destination rows.
   - Look up the row's `key`. If found and `!archived`,
     reclassify to `'active_collision'` and attach `ConflictDescriptor`.
     If found and `archived`, reclassify to `'archived_collision'`.
4. Detects intra-file duplicate keys (within `rows`) and reclassifies
   the second + occurrences as `'errored'` with `code:
   'duplicate_in_file'`.

**Output**: the same `ParsedRow[]` array with classification and conflict
fields updated in place. (Idempotent: re-running on the same input
yields the same output unless the backing data changed.)

**Performance**: dominated by the network fetches (typically < 200 ms
on a warm TanStack cache).

---

## `createImportRunner(session, onProgress)`

**Inputs**:
- `session: ImportSession` — full state with all `resolution` values set.
- `onProgress(rowIndex, outcome)` — called after each row completes;
  drives the progress bar in the UI.

**Output**: a runner with `run()` and `abort()` methods.

**Behaviour of `run()`**:
1. Computes the **commit plan**: rows with `outcome === null` are
   eligible. `'valid'` rows go to `POST /admin/<lookup>`. Rows with
   `resolution: 'update'` go to `PATCH /admin/<lookup>/{id}`. Rows
   with `resolution: 'restore_update'` chain `POST .../{id}/restore`
   then `PATCH .../{id}`. Rows with `resolution: 'skip'` or
   `'errored'` rows are accepted with `outcome: 'skipped'` immediately.
2. Drives a parallelism-capped worker pool (default `concurrency = 4`)
   over the eligible rows. Each row's outcome is written back to the
   row, then `onProgress(rowIndex, outcome)` is invoked.
3. After every row completes, returns the resolved `ImportSummary`.
4. Emits one summary audit entry via `emitAudit({ action:
   'import_completed', module: 'lookups', entityType: lookupKey,
   entityLabel: fileName, details: '47 created, 3 updated, 5 skipped'
   })` only if at least one mutating outcome occurred (per FR-012's
   intent — empty/all-skipped imports don't pollute the audit log).

**Behaviour of `abort()`**:
- Stops the worker pool from picking up new rows. Rows already
  in-flight complete naturally and are recorded as written.
- Marks `session.phase = 'cancelled'`.
- Does NOT emit an audit entry.

**Errors**:
- Per-row HTTP failures become `outcome: 'errored'` with
  `error.code: 'http_failure'`. They do not throw out of `run()`.
- A global failure (e.g., network offline) throws — the UI catches and
  displays an error state with a retry option.

---

## `buildTemplate(lookupKey)`

Synchronous (SheetJS write is fast). Returns a `Blob` with MIME
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

The blob's first sheet has:
- Row 1: the schema's `requiredHeaders` concatenated with
  `optionalHeaders` in canonical order, all in Arabic.
- Row 2: a single example row drawn from a per-schema sample
  defined inline (e.g., for Governorates: `01 | القاهرة | Cairo |
  cairo | 1`).
- Column widths set to fit Arabic text (no narrow truncation).

---

## Backend endpoints actually called

For reference — these are existing endpoints from spec 007's 21-table
split. The importer doesn't introduce new ones.

| Resolution | Calls |
|---|---|
| `'valid'` (new row) | `POST /admin/<lookup>` |
| `'update'` (active collision) | `PATCH /admin/<lookup>/{id}` |
| `'restore_update'` (archived collision) | `POST /admin/<lookup>/{id}/restore` → `PATCH /admin/<lookup>/{id}` |
| `'skip'` | none |
| `'errored'` | none |

For hierarchical lookups (faculties, specialties), the FK columns —
`الجامعة`, `نوع التخصص` — are resolved by `arabic-schema.mapRow` against
the parent lookup's rows that `classifyImportRows` pre-fetched, so the
body sent to `POST /admin/faculties` includes a resolved
`universityId: Guid`, not a key.
