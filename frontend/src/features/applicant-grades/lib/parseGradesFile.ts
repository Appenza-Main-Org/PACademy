/**
 * Generic source-file parser for the v2 applicant-grades import wizard.
 *
 * Where `parseAccessFile.ts` is opinionated (validates against a fixed
 * column contract per kind, throws on missing columns), this parser is
 * structural — it surfaces every table/sheet in the file with its raw
 * header row and rows of cell values, and leaves field-mapping +
 * validation to the wizard's downstream steps.
 *
 *   .mdb / .accdb         → `mdb-reader` (every table)
 *   .xlsx / .xls / .csv   → SheetJS `xlsx` (every sheet)
 *
 * Both parsers are dynamically imported on first call so the heavy
 * chunks ship only when an admin actually picks a file. The `buffer`
 * polyfill is planted on `globalThis.Buffer` before `mdb-reader` is
 * evaluated — every page read inside the library calls the global
 * `Buffer.allocUnsafe()` / `Buffer.from()` directly, so wrapping the
 * input alone isn't enough.
 */

import type MDBReaderType from 'mdb-reader';
import type { Value } from 'mdb-reader';
import type * as XLSXType from 'xlsx';

export type ParsedSheetFormat = 'accdb' | 'mdb' | 'xlsx' | 'xls' | 'csv';

export type ParsedCell = string | number | null;

export interface ParsedTable {
  /** Sheet name (xlsx/xls) or table name (mdb/accdb). For CSV, the synthetic value `'بيانات'`. */
  name: string;
  /** Header row as found in the source — verbatim, no normalisation. */
  columns: string[];
  /** Row dicts keyed by source-column name. Empty cells coerce to `null`. */
  rows: Array<Record<string, ParsedCell>>;
  /** Cached `rows.length` for convenient surfacing in the picker. */
  rowCount: number;
}

export interface ParsedSheet {
  sourceName: string;
  format: ParsedSheetFormat;
  tables: ParsedTable[];
}

export class ParseGradesError extends Error {
  /** Raw underlying message (for the developer console / dev logs). */
  readonly rawMessage?: string;
  constructor(message: string, rawMessage?: string) {
    super(message);
    this.name = 'ParseGradesError';
    this.rawMessage = rawMessage;
  }
}

/**
 * Friendly Arabic suggestion shown when `mdb-reader` chokes on a
 * Ministry `.accdb` export. Some real-world exports use Access 2010+
 * features (encryption headers, newer page-usage map variants) that
 * the open-source `mdb-reader` parser doesn't fully cover yet. When
 * that happens the admin has a workable escape hatch: open the file
 * in Microsoft Access and "Save As" to `.xlsx`, then re-upload.
 */
const ACCESS_FALLBACK_HINT =
  'يبدو أن صيغة ملف Access هذه غير مدعومة. جرّب فتحه في Microsoft Access وحفظه بصيغة Excel (.xlsx) ثم أعد الرفع.';

const ACCESS_EXTENSIONS = ['.mdb', '.accdb'] as const;
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

function detectFormat(fileName: string): ParsedSheetFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.accdb')) return 'accdb';
  if (lower.endsWith('.mdb')) return 'mdb';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

export function isSupportedGradesFile(fileName: string): boolean {
  return detectFormat(fileName) !== null;
}

export const SUPPORTED_GRADES_EXTENSIONS = [
  ...ACCESS_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
] as const;

function coerceCell(v: unknown): ParsedCell {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  return null;
}

/* ── Access (.mdb / .accdb) branch ────────────────────────────────── */

async function loadMdbReader(): Promise<typeof MDBReaderType> {
  /* Order matters — `mdb-reader` reaches for the global `Buffer` while
   * its module code evaluates, so the polyfill must be planted first. */
  const bufferMod = await import('buffer');
  if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
    (globalThis as unknown as { Buffer: typeof bufferMod.Buffer }).Buffer = bufferMod.Buffer;
  }
  const mod = await import('mdb-reader');
  return (
    (mod as { default?: typeof MDBReaderType }).default ?? (mod as unknown as typeof MDBReaderType)
  );
}

async function parseAccess(file: File): Promise<ParsedTable[]> {
  const MDBReader = await loadMdbReader();
  const { Buffer } = await import('buffer');
  const buffer = await file.arrayBuffer();

  /* The MDBReader constructor doesn't just validate the file header —
   * it eagerly traverses the system-object table, walks page-usage
   * maps, and may throw deep inside `usage-map.js` for `.accdb`
   * variants the open-source parser doesn't cover (e.g. encrypted
   * pages, mixed Access 2010+ layout). Catch everything that bubbles
   * out and rewrap with the friendly fallback hint while keeping the
   * raw message available for dev console + Sprint-10 telemetry. */
  let reader: MDBReaderType;
  try {
    reader = new MDBReader(Buffer.from(buffer));
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    /* eslint-disable-next-line no-console */
    console.error('[applicant-grades] mdb-reader ctor failed:', err);
    throw new ParseGradesError(ACCESS_FALLBACK_HINT, raw);
  }

  let tableNames: string[];
  try {
    tableNames = [...reader.getTableNames()];
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new ParseGradesError(ACCESS_FALLBACK_HINT, raw);
  }
  if (tableNames.length === 0) {
    throw new ParseGradesError('لا يوجد جدول قابل للقراءة في الملف.');
  }
  const tables: ParsedTable[] = [];
  for (const tableName of tableNames) {
    let columns: string[];
    let raws: Array<Record<string, Value>>;
    try {
      const table = reader.getTable(tableName);
      columns = [...table.getColumnNames()];
      raws = table.getData<Record<string, Value>>();
    } catch {
      /* Skip tables that fail to enumerate — Ministry exports
       * occasionally carry index/system tables we can't parse. */
      continue;
    }
    const rows: Array<Record<string, ParsedCell>> = raws.map((raw) => {
      const out: Record<string, ParsedCell> = {};
      for (const col of columns) out[col] = coerceCell(raw[col]);
      return out;
    });
    tables.push({ name: tableName, columns, rows, rowCount: rows.length });
  }
  if (tables.length === 0) {
    throw new ParseGradesError(ACCESS_FALLBACK_HINT);
  }
  return tables;
}

/* ── Spreadsheet (.xlsx / .xls / .csv) branch ─────────────────────── */

async function parseSpreadsheet(file: File): Promise<ParsedTable[]> {
  const XLSX = (await import('xlsx')) as typeof XLSXType;
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  let workbook: XLSXType.WorkBook;
  try {
    if (isCsv) {
      /* SheetJS's `type: 'array'` defaults to cp1252 for CSV inputs that
       * lack a BOM, which mangles Arabic into Ø-mojibake. Read the file
       * as UTF-8 text first via the browser's `File.text()` (which uses
       * `TextDecoder('utf-8')`) and feed it as a string instead. The
       * `xlsx`/`xls` branch still goes through the array path because
       * those formats carry their own encoding metadata. */
      const text = await file.text();
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    }
  } catch (err) {
    throw new ParseGradesError(
      err instanceof Error ? `تعذّر قراءة الملف: ${err.message}` : 'تعذّر قراءة الملف.',
    );
  }
  const tables: ParsedTable[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    let aoa: unknown[][];
    try {
      aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        blankrows: false,
        raw: true,
      });
    } catch {
      continue;
    }
    if (aoa.length === 0) continue;
    const headerRow = aoa[0] ?? [];
    const columns: string[] = headerRow.map((h, i) => {
      const s = h == null ? '' : String(h).trim();
      return s === '' ? `العمود ${i + 1}` : s;
    });
    const rows: Array<Record<string, ParsedCell>> = [];
    for (let i = 1; i < aoa.length; i += 1) {
      const cells = aoa[i] ?? [];
      const row: Record<string, ParsedCell> = {};
      let nonEmpty = false;
      columns.forEach((col, j) => {
        const v = coerceCell(cells[j]);
        row[col] = v;
        if (v != null) nonEmpty = true;
      });
      if (nonEmpty) rows.push(row);
    }
    tables.push({ name, columns, rows, rowCount: rows.length });
  }
  if (tables.length === 0) {
    throw new ParseGradesError('لا توجد ورقة بيانات قابلة للقراءة في الملف.');
  }
  return tables;
}

/* ── Public entry ─────────────────────────────────────────────────── */

export async function parseGradesFile(file: File): Promise<ParsedSheet> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new ParseGradesError(`صيغة الملف غير مدعومة: ${file.name}`);
  }
  const tables =
    format === 'accdb' || format === 'mdb'
      ? await parseAccess(file)
      : await parseSpreadsheet(file);
  return { sourceName: file.name, format, tables };
}
