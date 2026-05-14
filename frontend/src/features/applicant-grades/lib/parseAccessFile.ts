/**
 * Parse a Ministry-issued Access database (.mdb / .accdb) into the
 * `ImportedGradeRow` shape the wizard's staging step expects.
 *
 * Columns by secondary type (verified against the legacy import
 * scripts under `frontend/_legacy/` and the karasa schema spec):
 *
 *   general  (.mdb)  → table contains: seating_no · national_no ·
 *                      arabic_name · sex_name · school_name ·
 *                      moderia_name · branch_desc_new · total_degree ·
 *                      student_case_desc · …
 *   azhar    (.accdb) → table contains: StSeatNo · StudenName ·
 *                       DevisionName · National_Code · ZonName ·
 *                       InstituteName · Total2 · Sub · …
 *
 * Errors surface as typed exceptions so the wizard can route to the
 * right step:
 *   - `MissingColumnError`  → MISSING_REQUIRED_COLUMN (error step)
 *   - `ParseError`          → generic parse failure (error tile)
 */

import { Buffer } from 'buffer';
import MDBReader from 'mdb-reader';
import type { Value } from 'mdb-reader';
import type { GradeKind } from '../types';

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

interface ColumnMap {
  /** Per-row table column names the parser will read. */
  required: readonly string[];
  /** Maps a raw row (keyed by source-column name) to the canonical
   *  `ImportedGradeRow` shape. */
  toRow: (raw: Record<string, Value>) => ImportedGradeRow;
}

const GENERAL_MAP: ColumnMap = {
  required: [
    'seating_no',
    'national_no',
    'arabic_name',
    'school_name',
    'moderia_name',
    'branch_desc_new',
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
    'DevisionName',
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
    /* Azhar exports don't carry the student-case dimension; default to
     * the dash placeholder so the UI's status column reads as N/A. */
    status: '—',
  }),
};

const MAPS: Record<GradeKind, ColumnMap> = { general: GENERAL_MAP, azhar: AZHAR_MAP };

/* ── Helpers ──────────────────────────────────────────────────────── */

function stringish(v: Value): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v).trim();
  if (v instanceof Date) return v.toISOString();
  return '';
}

function numericish(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Pick the first table whose column set is a superset of `required`.
 *  Ministry exports usually carry a single data table plus internal
 *  index tables; this scan tolerates either ordering. */
function findDataTable(
  reader: MDBReader,
  required: readonly string[],
): { table: ReturnType<MDBReader['getTable']>; missing: string[] } {
  const names = reader.getTableNames();
  let bestMissing: string[] = [...required];
  let bestTable: ReturnType<MDBReader['getTable']> | null = null;
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

/* ── Public entry ─────────────────────────────────────────────────── */

/** Parse `buffer` (the result of `FileReader.readAsArrayBuffer`)
 *  into typed grade rows for the given kind.
 *
 *  Throws `MissingColumnError` when the source table is found but is
 *  missing one or more required columns, or `ParseError` for any
 *  lower-level failure (corrupt file, no usable table, etc.). */
export function parseAccessFile(
  buffer: ArrayBuffer,
  kind: GradeKind,
): ImportedGradeRow[] {
  const map = MAPS[kind];

  let reader: MDBReader;
  try {
    /* `mdb-reader` constructor signature requires a Node `Buffer`; in
     * the browser we polyfill via the `buffer` package so the same
     * call works in both environments. `Buffer.from(arrayBuffer)`
     * wraps the bytes without copying. */
    reader = new MDBReader(Buffer.from(buffer));
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
  /* Skip rows whose primary identifier is missing — the Ministry
   * dumps sometimes carry trailing nulls left by the export script. */
  return raws.map(map.toRow).filter((r) => r.nid.length > 0 && r.seat > 0);
}
