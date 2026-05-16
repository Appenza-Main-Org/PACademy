/**
 * Parse a Ministry-issued grades file — Access database (`.mdb` /
 * `.accdb`) OR spreadsheet (`.xlsx` / `.xls` / `.csv`) — into the
 * `ImportedGradeRow` shape the wizard's staging step expects.
 *
 * The file picker accepts five formats; this module dispatches to
 * the right parser based on the file's extension:
 *
 *   .mdb / .accdb         → `mdb-reader` (pure-JS Access reader)
 *   .xlsx / .xls / .csv   → SheetJS (`xlsx` package)
 *
 * Both branches share the same column contract per `kind`:
 *
 *   general  → seating_no · national_no · arabic_name · school_name ·
 *              moderia_name · branch_desc_new · total_degree ·
 *              student_case_desc
 *   azhar    → StSeatNo · StudenName · DevisionName · National_Code ·
 *              ZonName · InstituteName · Total2
 *
 * For spreadsheets, the first row is treated as the header; columns
 * are case-sensitive and must match the names above.
 *
 * Errors surface as typed exceptions so the wizard can route to the
 * right step:
 *   - `MissingColumnError`  → MISSING_REQUIRED_COLUMN (error step)
 *   - `ParseError`          → generic parse failure (error tile)
 */

import type MDBReaderType from 'mdb-reader';
import type { Value } from 'mdb-reader';
import type * as XLSXType from 'xlsx';
import type { GradeKind } from '../types';

/* `mdb-reader` (with its `buffer` polyfill family) and `xlsx` are
 * heavy and reach for Node globals at module-evaluation time. Loading
 * them eagerly broke the main bundle in production with
 *   Uncaught ReferenceError: process is not defined
 *   Uncaught TypeError: Cannot read properties of undefined (reading 'slice')
 * because top-level code in `mdb-reader` → `readable-stream` touches
 * Node-only APIs. They're only needed once an admin actually uploads
 * a file, so the value imports are deferred to runtime via dynamic
 * `import()` inside the per-format branches. The type-only imports
 * above are erased at compile time and don't pull anything into the
 * main chunk. */

/**
 * Row shape the parser emits — identical to `GradeRow` minus the
 * fields the application owns (overrideMax / lastEditedAt /
 * lastEditedBy / log). The wizard's staging step fills those in.
 */
export interface ImportedGradeRow {
  seat: number;
  nid: string;
  name: string;
  kind: GradeKind;
  branch: string;
  school: string;
  region: string;
  total: number;
  status: string;
}

export class MissingColumnError extends Error {
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`Missing required column(s): ${missing.join(', ')}`);
    this.name = 'MissingColumnError';
    this.missing = missing;
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/* ── Column contracts ─────────────────────────────────────────────── */

type RawCell = Value | string | number | null | undefined;

interface ColumnMap {
  /** Per-row table column names the parser will read. */
  required: readonly string[];
  /** Maps a raw row (keyed by source-column name) to the canonical
   *  `ImportedGradeRow` shape. */
  toRow: (raw: Record<string, RawCell>) => ImportedGradeRow;
}

const GENERAL_MAP: ColumnMap = {
  required: [
    'seating_no',
    'national_no',
    'arabic_name',
    'school_name',
    'moderia_name',
    'total_degree',
    'student_case_desc',
  ],
  toRow: (raw) => ({
    seat: numericish(raw['seating_no']),
    nid: stringish(raw['national_no']),
    name: stringish(raw['arabic_name']),
    kind: 'general',
    branch: stringish(raw['branch_desc_new']),
    school: stringish(raw['school_name']),
    region: stringish(raw['moderia_name']),
    total: numericish(raw['total_degree']),
    status: stringish(raw['student_case_desc']) || '—',
  }),
};

const AZHAR_MAP: ColumnMap = {
  required: [
    'StSeatNo',
    'StudenName',
    'National_Code',
    'ZonName',
    'InstituteName',
    'Total2',
  ],
  toRow: (raw) => ({
    seat: numericish(raw['StSeatNo']),
    nid: stringish(raw['National_Code']),
    name: stringish(raw['StudenName']),
    kind: 'azhar',
    branch: stringish(raw['DevisionName']),
    school: stringish(raw['InstituteName']),
    region: stringish(raw['ZonName']),
    total: numericish(raw['Total2']),
    /* Azhar exports don't carry a student-case dimension; default to
     * the dash placeholder so the UI's status column reads as N/A. */
    status: '—',
  }),
};

const MAPS: Record<GradeKind, ColumnMap> = { general: GENERAL_MAP, azhar: AZHAR_MAP };

/* ── Helpers ──────────────────────────────────────────────────────── */

function stringish(v: RawCell): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v).trim();
  }
  if (v instanceof Date) return v.toISOString();
  return '';
}

function numericish(v: RawCell): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* ── Access (.mdb / .accdb) branch ────────────────────────────────── */

/** Pick the first table whose column set is a superset of `required`.
 *  Ministry exports usually carry a single data table plus internal
 *  index tables; this scan tolerates either ordering. */
function findDataTable(
  reader: MDBReaderType,
  required: readonly string[],
): { table: ReturnType<MDBReaderType['getTable']>; missing: string[] } {
  const names = reader.getTableNames();
  let bestMissing: string[] = [...required];
  let bestTable: ReturnType<MDBReaderType['getTable']> | null = null;
  for (const tableName of names) {
    const table = reader.getTable(tableName);
    const cols = new Set(table.getColumnNames());
    const missing = required.filter((c) => !cols.has(c));
    if (missing.length === 0) return { table, missing: [] };
    if (missing.length < bestMissing.length) {
      bestMissing = missing;
      bestTable = table;
    }
  }
  if (bestTable == null) throw new ParseError('لا يوجد جدول قابل للقراءة في الملف.');
  return { table: bestTable, missing: bestMissing };
}

async function parseAccess(buffer: ArrayBuffer, map: ColumnMap): Promise<ImportedGradeRow[]> {
  /* `mdb-reader` internally calls `Buffer.allocUnsafe()` / `Buffer.from()`
   * via the *global* `Buffer` symbol. The browser has no such global, so
   * the polyfill from the `buffer` package must be installed onto
   * `globalThis.Buffer` BEFORE `mdb-reader` is evaluated — wrapping the
   * input bytes alone isn't enough because every page read inside the
   * library reaches for that same global.
   *
   * The import order here is sequential rather than parallel for that
   * reason: resolve `buffer`, plant the global, then resolve
   * `mdb-reader`. Both modules are lazy-loaded so the heavy chunks only
   * ship when an admin actually uploads an Access file. */
  const bufferMod = await import('buffer');
  const BufferCtor = bufferMod.Buffer;
  if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
    (globalThis as unknown as { Buffer: typeof BufferCtor }).Buffer = BufferCtor;
  }
  const mdbMod = await import('mdb-reader');
  /* Vite's CJS↔ESM interop occasionally surfaces the default export
   * under `.default.default` in prod builds; guard with a runtime
   * fallback so the destructure can't end up with `undefined`. */
  const MDBReader =
    (mdbMod as { default?: typeof MDBReaderType }).default ?? (mdbMod as unknown as typeof MDBReaderType);
  let reader: MDBReaderType;
  try {
    /* `mdb-reader` constructor signature requires a Node `Buffer`; in
     * the browser we polyfill via the `buffer` package so the same
     * call works in both environments. `Buffer.from(arrayBuffer)`
     * wraps the bytes without copying. */
    reader = new MDBReader(BufferCtor.from(buffer));
  } catch (err) {
    throw new ParseError(
      err instanceof Error ? `تعذّر قراءة الملف: ${err.message}` : 'تعذّر قراءة الملف.',
    );
  }

  const { table, missing } = findDataTable(reader, map.required);
  if (missing.length > 0) throw new MissingColumnError(missing);

  let raws: Array<Record<string, Value>>;
  try {
    raws = table.getData<Record<string, Value>>();
  } catch (err) {
    throw new ParseError(
      err instanceof Error ? `تعذّر استخراج البيانات: ${err.message}` : 'تعذّر استخراج البيانات.',
    );
  }
  return raws.map(map.toRow);
}

/* ── Spreadsheet (.xlsx / .xls / .csv) branch ─────────────────────── */

async function parseSpreadsheet(
  buffer: ArrayBuffer,
  map: ColumnMap,
): Promise<ImportedGradeRow[]> {
  /* SheetJS is large; defer the import so the main bundle stays
   * lean and the heavy chunk only loads when the admin uploads a
   * spreadsheet. */
  const XLSX = (await import('xlsx')) as typeof XLSXType;
  let workbook: XLSXType.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch (err) {
    throw new ParseError(
      err instanceof Error ? `تعذّر قراءة الملف: ${err.message}` : 'تعذّر قراءة الملف.',
    );
  }

  /* Walk the sheets to find one whose header row carries every
   * required column. Same tolerance as the Access branch — Ministry
   * exports occasionally tuck the data sheet behind a cover/index
   * sheet. */
  let bestMissing: string[] = [...map.required];
  let bestRaws: Array<Record<string, RawCell>> | null = null;

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    let raws: Array<Record<string, RawCell>>;
    try {
      raws = XLSX.utils.sheet_to_json<Record<string, RawCell>>(sheet, {
        defval: null,
        raw: true,
      });
    } catch {
      continue;
    }
    if (raws.length === 0) continue;
    const cols = new Set(Object.keys(raws[0]!));
    const missing = map.required.filter((c) => !cols.has(c));
    if (missing.length === 0) return raws.map(map.toRow);
    if (missing.length < bestMissing.length) {
      bestMissing = missing;
      bestRaws = raws;
    }
  }

  if (bestRaws == null) {
    throw new ParseError('لا توجد ورقة بيانات قابلة للقراءة في الملف.');
  }
  throw new MissingColumnError(bestMissing);
}

/* ── Public entry ─────────────────────────────────────────────────── */

const ACCESS_EXTENSIONS = ['.mdb', '.accdb'] as const;
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

/** Parse `buffer` (the result of `FileReader.readAsArrayBuffer`)
 *  into typed grade rows for the given kind. Dispatches to the
 *  right parser based on `fileName`'s extension.
 *
 *  Throws `MissingColumnError` when the source file is readable
 *  but is missing one or more required columns for `kind`, or
 *  `ParseError` for any lower-level failure (corrupt file, no usable
 *  sheet/table, unknown extension, etc.). */
export async function parseAccessFile(
  buffer: ArrayBuffer,
  kind: GradeKind,
  fileName?: string,
): Promise<ImportedGradeRow[]> {
  const map = MAPS[kind];
  const lower = (fileName ?? '').toLowerCase();
  const isAccess = ACCESS_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const isSpreadsheet = SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
  /* `fileName` is optional for back-compat with the original parser
   * signature; when omitted, default to the Access branch since that
   * was the original contract. */
  let rows: ImportedGradeRow[];
  if (isSpreadsheet) {
    rows = await parseSpreadsheet(buffer, map);
  } else if (isAccess || !fileName) {
    rows = await parseAccess(buffer, map);
  } else {
    throw new ParseError(`صيغة الملف غير مدعومة: ${fileName}`);
  }
  /* Skip rows whose primary identifier is missing — the Ministry
   * dumps and hand-prepared sheets sometimes carry trailing nulls
   * left by the export script or blank trailing rows. */
  return rows.filter((r) => r.nid.length > 0 && r.seat > 0);
}
