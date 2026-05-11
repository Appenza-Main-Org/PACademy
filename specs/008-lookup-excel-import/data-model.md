# Phase 1 — Data Model: Lookup Excel + CSV Import

All entities below are **frontend-only**, in-memory for the duration of
a single import session. No database schema changes; no new backend
entities; no persisted client-side state beyond the one currently-open
import modal.

---

## ImportSession (root)

The state machine for one upload-preview-commit cycle.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (uuid v4) | Generated on dropzone-accept; used as the correlation id for the summary audit entry. |
| `lookupKey` | `LookupKey` | Which of the 21 lookups this session targets. Drives the schema lookup and the destination REST resource. |
| `fileName` | `string` | As provided by the OS. Echoed in the summary audit's `entityLabel`. |
| `fileFormat` | `'xlsx' \| 'csv'` | Detected from extension + MIME. |
| `fileSizeBytes` | `number` | For FR-004 enforcement (≤ 5 MB). |
| `phase` | `'idle' \| 'parsing' \| 'preview' \| 'committing' \| 'done' \| 'cancelled'` | Drives the modal UI. |
| `rows` | `ParsedRow[]` | Populated after parse; cleared on cancel. |
| `summary` | `ImportSummary \| null` | Populated after `phase === 'done'`. |
| `startedAt` | `string (ISO)` | First time `phase` left `idle`. |
| `completedAt` | `string (ISO) \| null` | First time `phase` hit `done` or `cancelled`. |

**Invariants**:
- Transitions are one-way through the phases listed above; cancellation
  from any phase returns to `'cancelled'` (terminal).
- `rows` is read-only after `phase === 'preview'` except for the
  `resolution` field, which the admin sets per-row.

---

## ParsedRow

One row from the uploaded file, after both validation passes.

| Field | Type | Notes |
|---|---|---|
| `index` | `number` (0-based) | Position in the source file (header excluded). Used as the React key and the per-row error label. |
| `arabicValues` | `Record<string, string>` | Raw column → cell value, keyed by the Arabic header. Preserved verbatim for display. |
| `payload` | `BackendPayload \| null` | The shape-passed payload ready to send to the backend (`null` when the row failed shape validation). Built by the schema's `mapRow`. |
| `classification` | `RowClassification` | Where the conflict-detector landed this row. |
| `conflict` | `ConflictDescriptor \| null` | Present iff `classification` is `'active_collision'` or `'archived_collision'`. |
| `resolution` | `ConflictResolution \| null` | Present iff `conflict` is non-null. Set by the admin in the preview UI. |
| `outcome` | `RowOutcome \| null` | Populated by the runner after commit. |
| `error` | `RowError \| null` | Present iff `classification === 'errored'` or the runner fails this row. |

### RowClassification (enum)

| Value | Meaning |
|---|---|
| `'valid'` | Shape OK, no collision, FK references resolved. Will be `created` on commit. |
| `'active_collision'` | Shape OK; key matches an existing *active* row. Awaits `ConflictResolution`. |
| `'archived_collision'` | Shape OK; key matches an existing *archived* row. Awaits `ConflictResolution`. |
| `'errored'` | Failed shape validation, FK lookup, intra-file uniqueness, or runner submission. |

### ConflictDescriptor

| Field | Type | Notes |
|---|---|---|
| `type` | `'active_collision' \| 'archived_collision'` | Mirrors the row's classification. |
| `existingId` | `Guid` | The clashing row's backend id (used to build the `PATCH` / `restore` URL on commit). |
| `existingValues` | `Record<string, unknown>` | Snapshot of the existing row's mutable fields for diff display. |

### ConflictResolution (enum)

For `active_collision`:

| Value | Behaviour on commit |
|---|---|
| `'skip'` | The incoming row is dropped; existing row untouched. Outcome `'skipped'`. |
| `'update'` | `PATCH /admin/<lookup>/{id}` with the mutable fields from `payload`. Outcome `'updated'`. |
| `'abort'` | **Global** — cancels the whole session before any writes. |

For `archived_collision` (per FR-008a):

| Value | Behaviour on commit |
|---|---|
| `'skip'` | Drop incoming row. Archived row remains archived. Outcome `'skipped'`. (Default.) |
| `'restore_update'` | `POST /admin/<lookup>/{id}/restore` then `PATCH /admin/<lookup>/{id}`. Outcome `'restored'`. |
| `'rename_required'` | UI gates commit until the admin edits the `المفتاح` cell to a free key — at which point the row reclassifies (back to `'valid'` if the new key has no collision). |

### RowOutcome (enum)

| Value | Meaning |
|---|---|
| `'created'` | New row inserted. |
| `'updated'` | Existing active row patched. |
| `'restored'` | Archived row un-archived and patched. |
| `'skipped'` | Admin chose skip, or `errored` row was excluded. |
| `'errored'` | Shape / FK / uniqueness validation failed, or the per-row HTTP call returned non-2xx. |

### RowError

| Field | Type | Notes |
|---|---|---|
| `code` | `'missing_required' \| 'invalid_key' \| 'unknown_enum' \| 'fk_not_found' \| 'fk_archived' \| 'duplicate_in_file' \| 'http_failure'` | Discriminator for UI rendering. |
| `column` | `string \| null` | Arabic header of the offending column (when applicable). |
| `messageAr` | `string` | Single Arabic sentence rendered in the preview row. |
| `httpStatus` | `number \| null` | Populated for `'http_failure'` rows. |

---

## ImportSummary

The result of one commit run; powers the post-commit panel and the
summary audit entry.

| Field | Type | Notes |
|---|---|---|
| `total` | `number` | Total parsed rows (excluding header). |
| `created` | `number` | Count where `outcome === 'created'`. |
| `updated` | `number` | Count where `outcome === 'updated'`. |
| `restored` | `number` | Count where `outcome === 'restored'`. |
| `skipped` | `number` | Count where `outcome === 'skipped'`. |
| `errored` | `number` | Count where `outcome === 'errored'`. |
| `errors` | `ParsedRow[]` | Subset for the "show errored rows" expandable section. |
| `durationMs` | `number` | Wall-clock from first commit POST to last. |

---

## LookupSchema (static, per-lookup)

The Arabic-header → backend-field contract. Exported from
`arabic-schema.ts` as a `Record<LookupKey, LookupSchema>`. Used by:

- Template generator (`xlsx-writer.ts`)
- File parser (validates `requiredHeaders` are present in row 1)
- Shape validator (validates each cell against `enums` / `key` regex)
- Row mapper (`mapRow`) — produces a `BackendPayload`

| Field | Type | Notes |
|---|---|---|
| `lookupKey` | `LookupKey` | Discriminator. |
| `requiredHeaders` | `readonly string[]` | Arabic strings. Missing any of these rejects the file at parse time. |
| `optionalHeaders` | `readonly string[]` | Arabic strings. Allowed but not required. |
| `parentLookup` | `LookupKey \| null` | Non-null for `faculties` (→ `universities`) and `specialties` (→ `specialtyTypes`). Drives FK resolution. |
| `enums` | `Record<string, EnumMap>` | Maps a header (Arabic) to its Arabic ↔ backend-enum bidirectional table. |
| `mapRow` | `(arabic: Record<string, string>, parents: ParentLookup) => BackendPayload` | Pure function. Throws if shape is bad; caller catches and converts to `RowError`. |

### EnumMap

| Field | Type | Notes |
|---|---|---|
| `forwardAr → backend` | `Record<string, string>` | Used at parse time. |
| `reverseBackend → ar` | `Record<string, string>` | Used by the template generator's example-row. |

### ParentLookup (resolution context)

For hierarchical lookups, the conflict-detector pre-loads the parent
rows into:

```ts
type ParentLookup = {
  active: Map<string /* parent.key */, Guid>;
  archived: Map<string, Guid>;
};
```

`mapRow` consults this to resolve `الجامعة: "جامعة القاهرة"` to the
right `universityId`. If the parent is archived, `mapRow` flags the
row as `fk_archived` (preview shows: "Referenced parent is archived").

---

## Relationship sketch

```text
ImportSession (1)
  ├─ rows: ParsedRow[] (0..1000)
  │    ├─ payload: BackendPayload | null
  │    ├─ conflict: ConflictDescriptor | null
  │    ├─ resolution: ConflictResolution | null  (admin-set)
  │    ├─ outcome:    RowOutcome | null          (runner-set)
  │    └─ error:      RowError | null
  └─ summary: ImportSummary | null

LookupSchema  (1..21, static)
  └─ EnumMap (0..N)
```

No persistence anywhere — the entire object graph lives on the React
component tree for the lifetime of the modal and is garbage-collected
when the modal unmounts.
