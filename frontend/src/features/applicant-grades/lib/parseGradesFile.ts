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
 *
 * The spreadsheet path walks the worksheet cell-by-cell via
 * `decode_range` + manual cell lookup rather than `sheet_to_json` so a
 * 700k-row workbook doesn't trigger an `Invalid array length` blow-up
 * from SheetJS's bulk-allocation path. Rows are pushed in chunks of
 * `CHUNK_SIZE` and the parser yields to the event loop between chunks
 * so progress UI updates and the tab stays responsive.
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

export interface ParseProgress {
  /** Rows fed through the iterator so far (excluding the header row). */
  processed: number;
  /** Total data-row count derived from the sheet/table range. */
  total: number;
  /** Identifier of the sheet/table currently being read. */
  tableName: string;
}

export type ParseProgressCallback = (progress: ParseProgress) => void;

export interface ParseGradesOptions {
  /** Fires roughly every `CHUNK_SIZE` rows so progress UI can advance. */
  onProgress?: ParseProgressCallback;
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

/** Chunk size for row iteration — rows are pushed in batches of this
 *  size and the parser yields to the event loop between batches so
 *  progress UI updates and the tab doesn't freeze on a 700k-row file. */
const CHUNK_SIZE = 5_000;

/** Hard ceiling on data-row count derived from a worksheet's range —
 *  beyond this the file is almost certainly malformed (corrupted range
 *  metadata) and trying to allocate the row array crashes with
 *  `Invalid array length`. Bail with a friendly Arabic message instead. */
const MAX_ROWS = 2_000_000;

const OVER_LIMIT_MESSAGE =
  'تعذّر قراءة الملف: عدد الصفوف يتجاوز الحد المسموح به';

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

/** Yield to the event loop. Using `setTimeout(0)` rather than a
 *  microtask so the browser actually paints between chunks. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

async function parseAccess(
  file: File,
  onProgress: ParseProgressCallback | undefined,
): Promise<ParsedTable[]> {
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
    if (raws.length > MAX_ROWS) {
      throw new ParseGradesError(OVER_LIMIT_MESSAGE);
    }
    const rows: Array<Record<string, ParsedCell>> = [];
    for (let i = 0; i < raws.length; i += 1) {
      const raw = raws[i]!;
      const out: Record<string, ParsedCell> = {};
      for (const col of columns) out[col] = coerceCell(raw[col]);
      rows.push(out);
      if ((i + 1) % CHUNK_SIZE === 0) {
        onProgress?.({ processed: i + 1, total: raws.length, tableName });
        // eslint-disable-next-line no-await-in-loop
        await yieldToEventLoop();
      }
    }
    onProgress?.({ processed: rows.length, total: raws.length, tableName });
    tables.push({ name: tableName, columns, rows, rowCount: rows.length });
  }
  if (tables.length === 0) {
    throw new ParseGradesError(ACCESS_FALLBACK_HINT);
  }
  return tables;
}

/* ── Spreadsheet (.xlsx / .xls / .csv) branch ─────────────────────── */

/**
 * SheetJS shape for dense-mode worksheets. The library writes a 2D row
 * array onto `sheet['!data']` instead of populating sparse `A1`/`B1`
 * properties — this skips the multi-million-property allocation that
 * causes `Invalid array length` blow-ups on workbooks with very large
 * `!ref` ranges. The type isn't part of SheetJS's public typings so
 * we shape-narrow it locally.
 */
interface DenseSheet {
  '!data'?: ReadonlyArray<ReadonlyArray<{ v?: unknown } | undefined> | undefined>;
}

function denseRows(
  sheet: XLSXType.WorkSheet,
): ReadonlyArray<ReadonlyArray<{ v?: unknown } | undefined> | undefined> | null {
  const data = (sheet as unknown as DenseSheet)['!data'];
  return Array.isArray(data) ? data : null;
}

/** Read a single worksheet row-by-row. Uses SheetJS's dense storage
 *  (`sheet['!data']`) when present — it's a row-of-arrays 2D structure
 *  that side-steps the sparse-property bulk allocation that crashes on
 *  ~700k-row files. Falls back to the A1-address lookup when a sheet
 *  was read without `dense: true` (CSV path, older parser variants).
 *  Either way the iteration yields to the event loop every
 *  `CHUNK_SIZE` rows so the progress UI advances and the tab stays
 *  responsive. */
async function readSheetRows(
  XLSX: typeof XLSXType,
  sheet: XLSXType.WorkSheet,
  sheetName: string,
  onProgress: ParseProgressCallback | undefined,
): Promise<{ columns: string[]; rows: Array<Record<string, ParsedCell>> } | null> {
  const ref = sheet['!ref'];
  if (!ref) return null;

  let range: XLSXType.Range;
  try {
    range = XLSX.utils.decode_range(ref);
  } catch {
    return null;
  }

  const startCol = range.s.c;
  const endCol = range.e.c;
  const startRow = range.s.r;
  const endRow = range.e.r;
  const colCount = endCol - startCol + 1;
  const dataRowCount = Math.max(0, endRow - startRow); // excludes header

  if (
    !Number.isFinite(dataRowCount) ||
    !Number.isFinite(colCount) ||
    colCount < 0 ||
    dataRowCount > MAX_ROWS
  ) {
    throw new ParseGradesError(OVER_LIMIT_MESSAGE);
  }

  const dense = denseRows(sheet);

  /* Build the header row first. Empty header cells get a stable
   * positional name so downstream mapping has something to bind to. */
  const columns: string[] = [];
  if (dense) {
    const headerRow = dense[startRow] ?? [];
    for (let c = startCol; c <= endCol; c += 1) {
      const cell = headerRow[c];
      const raw = cell == null ? '' : String(cell.v ?? '').trim();
      columns.push(raw === '' ? `العمود ${c - startCol + 1}` : raw);
    }
  } else {
    for (let c = startCol; c <= endCol; c += 1) {
      const addr = XLSX.utils.encode_cell({ r: startRow, c });
      const cell = sheet[addr];
      const raw = cell == null ? '' : String(cell.v ?? '').trim();
      columns.push(raw === '' ? `العمود ${c - startCol + 1}` : raw);
    }
  }

  const rows: Array<Record<string, ParsedCell>> = [];
  let processed = 0;
  for (let r = startRow + 1; r <= endRow; r += 1) {
    const row: Record<string, ParsedCell> = {};
    let nonEmpty = false;
    const denseRow = dense ? dense[r] : null;
    for (let c = startCol; c <= endCol; c += 1) {
      let cellV: unknown = null;
      if (denseRow) {
        const cell = denseRow[c];
        if (cell != null) cellV = cell.v ?? null;
      } else {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell != null) cellV = cell.v ?? null;
      }
      const v = coerceCell(cellV);
      row[columns[c - startCol]!] = v;
      if (v != null) nonEmpty = true;
    }
    processed += 1;
    if (nonEmpty) rows.push(row);
    if (processed % CHUNK_SIZE === 0) {
      onProgress?.({ processed, total: dataRowCount, tableName: sheetName });
      // eslint-disable-next-line no-await-in-loop
      await yieldToEventLoop();
    }
  }
  onProgress?.({ processed, total: dataRowCount, tableName: sheetName });

  return { columns, rows };
}

async function parseSpreadsheet(
  file: File,
  onProgress: ParseProgressCallback | undefined,
): Promise<ParsedTable[]> {
  const XLSX = (await import('xlsx')) as typeof XLSXType;
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  let workbook: XLSXType.WorkBook;
  try {
    /* `dense: true` is the critical flag for large workbooks — it
     * tells SheetJS to store cells in a per-sheet `!data` 2D array
     * instead of materialising a sparse property bag keyed by every
     * cell address. On a 700k-row × N-col file the sparse form
     * allocates millions of object properties up-front and trips
     * V8's `Invalid array length` guard; dense mode reads in linear
     * memory proportional to populated cells.
     * `cellHTML/cellFormula/cellStyles: false` strip out parse-time
     * work we don't need — header text + numeric values is all the
     * wizard ever reads. */
    const baseOpts: XLSXType.ParsingOptions = {
      dense: true,
      cellHTML: false,
      cellFormula: false,
      cellStyles: false,
      cellDates: true,
    } as unknown as XLSXType.ParsingOptions;
    if (isCsv) {
      /* SheetJS's `type: 'array'` defaults to cp1252 for CSV inputs that
       * lack a BOM, which mangles Arabic into Ø-mojibake. Read the file
       * as UTF-8 text first via the browser's `File.text()` (which uses
       * `TextDecoder('utf-8')`) and feed it as a string instead. The
       * `xlsx`/`xls` branch still goes through the array path because
       * those formats carry their own encoding metadata. */
      const text = await file.text();
      workbook = XLSX.read(text, { ...baseOpts, type: 'string' });
    } else {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { ...baseOpts, type: 'array', codepage: 65001 });
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    /* `Invalid array length` here means SheetJS hit V8's array-size
     * ceiling while materialising the workbook even with dense mode
     * on — usually a malformed `!ref` range pointing at billions of
     * rows. Surface the friendly over-limit message; the raw cause
     * is still attached for the technical-details disclosure. */
    if (/invalid array length/i.test(raw)) {
      throw new ParseGradesError(OVER_LIMIT_MESSAGE, raw);
    }
    throw new ParseGradesError(`تعذّر قراءة الملف: ${raw}`, raw);
  }
  const tables: ParsedTable[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    let result: { columns: string[]; rows: Array<Record<string, ParsedCell>> } | null;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await readSheetRows(XLSX, sheet, name, onProgress);
    } catch (err) {
      if (err instanceof ParseGradesError) throw err;
      continue;
    }
    if (!result || result.rows.length === 0) continue;
    tables.push({
      name,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rows.length,
    });
  }
  if (tables.length === 0) {
    throw new ParseGradesError('لا توجد ورقة بيانات قابلة للقراءة في الملف.');
  }
  return tables;
}

/* ── Public entry ─────────────────────────────────────────────────── */

export async function parseGradesFile(
  file: File,
  options: ParseGradesOptions = {},
): Promise<ParsedSheet> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new ParseGradesError(`صيغة الملف غير مدعومة: ${file.name}`);
  }
  const tables =
    format === 'accdb' || format === 'mdb'
      ? await parseAccess(file, options.onProgress)
      : await parseSpreadsheet(file, options.onProgress);
  return { sourceName: file.name, format, tables };
}
