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
    let table: ReturnType<MDBReaderType['getTable']>;
    let columns: string[];
    let totalRows: number;
    try {
      table = reader.getTable(tableName);
      columns = [...table.getColumnNames()];
      totalRows = table.rowCount;
    } catch {
      /* Skip tables that fail to enumerate — Ministry exports
       * occasionally carry index/system tables we can't parse. */
      continue;
    }
    if (!Number.isFinite(totalRows) || totalRows > MAX_ROWS) {
      throw new ParseGradesError(OVER_LIMIT_MESSAGE);
    }
    /* Page through `getData({ rowOffset, rowLimit })` in `CHUNK_SIZE`
     * batches — mdb-reader's bulk `getData()` allocates the full row
     * array up-front and trips `Invalid array length` on big tables,
     * mirroring the SheetJS sparse-allocation problem the spreadsheet
     * branch fixes with `dense: true`. Paging keeps the per-iteration
     * allocation bounded; the parser yields to the event loop
     * between pages so the progress UI advances and the tab stays
     * responsive. */
    const rows: Array<Record<string, ParsedCell>> = [];
    let rowOffset = 0;
    try {
      while (rowOffset < totalRows) {
        const page = table.getData<Record<string, Value>>({
          rowOffset,
          rowLimit: CHUNK_SIZE,
        });
        if (page.length === 0) break;
        for (const raw of page) {
          const out: Record<string, ParsedCell> = {};
          for (const col of columns) out[col] = coerceCell(raw[col]);
          rows.push(out);
        }
        rowOffset += page.length;
        onProgress?.({ processed: rowOffset, total: totalRows, tableName });
        // eslint-disable-next-line no-await-in-loop
        await yieldToEventLoop();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (/invalid array length/i.test(raw)) {
        throw new ParseGradesError(OVER_LIMIT_MESSAGE, raw);
      }
      /* Other per-table errors (encrypted page, malformed record) —
       * fall through and let the table appear with whatever rows
       * survived the loop; if none did, we drop it from `tables`
       * below. Continue keeps multi-table Access files usable when
       * one stray table goes bad. */
    }
    onProgress?.({ processed: rows.length, total: totalRows, tableName });
    tables.push({ name: tableName, columns, rows, rowCount: rows.length });
  }
  if (tables.length === 0) {
    throw new ParseGradesError(ACCESS_FALLBACK_HINT);
  }
  return tables;
}

/* ── CSV (.csv) streaming branch ──────────────────────────────────── */

/** Parse a single CSV record (one logical row's worth of text — may
 *  contain escaped quotes but, by the time it reaches here, contains
 *  no unquoted newlines). Handles RFC 4180 quoting: a field wrapped in
 *  `"…"` may contain `,` and embedded newlines, and a literal `"`
 *  inside a quoted field is escaped as `""`. */
function parseCsvRecord(record: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < record.length; i += 1) {
    const ch = record[i];
    if (inQuote) {
      if (ch === '"') {
        if (record[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Stream-parse a CSV file row-by-row off `file.stream()`. Built for
 * Ministry exports that run into the hundreds of thousands of rows —
 * SheetJS's `XLSX.read(text, { type: 'string' })` allocates the full
 * file as a JS string *plus* a dense 2D cell-object array, which on a
 * 700k-row × ~13-col file trips V8's `Invalid array length` guard
 * even with `dense: true`. Streaming the bytes through a
 * `TextDecoderStream` keeps the in-flight buffer bounded and pushes
 * one plain object per row so the resulting memory footprint scales
 * with populated cells, not declared sheet range.
 *
 * Handles quoted fields (with embedded `,` and newlines), `""`-escaped
 * quotes, and both `\n` and `\r\n` line endings. Skips a leading UTF-8
 * BOM. Yields to the event loop every `CHUNK_SIZE` rows so the
 * progress bar in Step 2 advances and the tab stays responsive.
 */
async function parseCsvStreaming(
  file: File,
  onProgress: ParseProgressCallback | undefined,
): Promise<ParsedTable[]> {
  const tableName = 'بيانات';
  /* Approximate row total off file size so the progress bar has
   * something to draw against. Refined once we've actually seen a few
   * rows so the bar tracks reality rather than the initial guess. */
  const SIZE_PER_ROW_GUESS = 120;
  let total = Math.max(1, Math.floor(file.size / SIZE_PER_ROW_GUESS));

  const reader = file.stream().getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let columns: string[] | null = null;
  const rows: Array<Record<string, ParsedCell>> = [];
  let processed = 0;
  let sawAnyByte = false;

  /** Walk `buffer` looking for the next unquoted line terminator;
   *  returns `{ record, nextIdx }` for the slice up to (but not
   *  including) the terminator, plus the index just past it. Returns
   *  `null` when no complete record is buffered yet. */
  const consumeRecord = (start: number): { record: string; nextIdx: number } | null => {
    let inQuote = false;
    for (let i = start; i < buffer.length; i += 1) {
      const ch = buffer[i];
      if (ch === '"') {
        if (inQuote && buffer[i + 1] === '"') {
          i += 1;
        } else {
          inQuote = !inQuote;
        }
      } else if (!inQuote && (ch === '\n' || ch === '\r')) {
        const record = buffer.slice(start, i);
        let nextIdx = i + 1;
        if (ch === '\r' && buffer[nextIdx] === '\n') nextIdx += 1;
        return { record, nextIdx };
      }
    }
    return null;
  };

  const ingestRecord = (record: string): void => {
    if (record.length === 0) return;
    const cells = parseCsvRecord(record);
    if (!columns) {
      columns = cells.map((c, i) => {
        const t = c.trim();
        return t === '' ? `العمود ${i + 1}` : t;
      });
      return;
    }
    const row: Record<string, ParsedCell> = {};
    let nonEmpty = false;
    const width = columns.length;
    for (let i = 0; i < width; i += 1) {
      const v = coerceCell(cells[i] ?? null);
      row[columns[i]!] = v;
      if (v != null) nonEmpty = true;
    }
    processed += 1;
    if (nonEmpty) rows.push(row);
  };

  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) {
        const tail = decoder.decode();
        if (tail) buffer += tail;
        if (buffer.length > 0) ingestRecord(buffer);
        break;
      }
      sawAnyByte = true;
      buffer += decoder.decode(value, { stream: true });
      /* Strip a UTF-8 BOM if it landed at the very start of the file. */
      if (processed === 0 && !columns && buffer.charCodeAt(0) === 0xfeff) {
        buffer = buffer.slice(1);
      }

      let cursor = 0;
      while (true) {
        const next = consumeRecord(cursor);
        if (!next) break;
        ingestRecord(next.record);
        cursor = next.nextIdx;
        if (processed > 0 && processed % CHUNK_SIZE === 0) {
          if (processed > total) total = processed * 2;
          onProgress?.({ processed, total, tableName });
          // eslint-disable-next-line no-await-in-loop
          await yieldToEventLoop();
        }
        if (processed > MAX_ROWS) {
          throw new ParseGradesError(OVER_LIMIT_MESSAGE);
        }
      }
      buffer = buffer.slice(cursor);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* lock release is best-effort — if the stream errored mid-read
       * the lock may already be gone. */
    }
  }

  if (!sawAnyByte || !columns || rows.length === 0) {
    throw new ParseGradesError('لا توجد ورقة بيانات قابلة للقراءة في الملف.');
  }

  onProgress?.({ processed, total: processed, tableName });

  return [{ name: tableName, columns, rows, rowCount: rows.length }];
}

/* ── Spreadsheet (.xlsx / .xls) branch ────────────────────────────── */

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
 *  was read without `dense: true` (older parser variants). Either way
 *  the iteration yields to the event loop every `CHUNK_SIZE` rows so
 *  the progress UI advances and the tab stays responsive. */
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
  /* Clamp the effective end-row at MAX_ROWS above the header. If the
   * workbook's `!ref` is corrupted (or the cap during `XLSX.read`
   * didn't fully bound the range), this keeps the dense iteration
   * below from spinning over billions of synthetic empty rows while
   * still letting the file's real data through. */
  const rawEndRow = range.e.r;
  const endRow =
    Number.isFinite(rawEndRow) && rawEndRow - startRow > MAX_ROWS
      ? startRow + MAX_ROWS
      : rawEndRow;
  const colCount = endCol - startCol + 1;
  const dataRowCount = Math.max(0, endRow - startRow); // excludes header

  if (!Number.isFinite(dataRowCount) || !Number.isFinite(colCount) || colCount < 0) {
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

  const readOpts: XLSXType.ParsingOptions = {
    ...baseOpts,
    type: 'array',
    codepage: 65001,
  };
  const source = await file.arrayBuffer();

  const tryRead = (extra?: XLSXType.ParsingOptions): XLSXType.WorkBook =>
    XLSX.read(source, extra ? { ...readOpts, ...extra } : readOpts);

  let workbook: XLSXType.WorkBook;
  try {
    workbook = tryRead();
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    /* `Invalid array length` here means SheetJS hit V8's array-size
     * ceiling while materialising the workbook even with dense mode
     * on — usually a malformed `!ref` range pointing at billions of
     * rows. Don't bail yet: retry with `sheetRows` capped, which
     * tells SheetJS to truncate the read range at parse time so the
     * dense allocation stays bounded. Real data in such files is
     * almost always small; only the metadata is corrupted. */
    if (/invalid array length/i.test(raw)) {
      try {
        workbook = tryRead({ sheetRows: MAX_ROWS + 1 });
      } catch (retryErr) {
        const retryRaw = retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (/invalid array length/i.test(retryRaw)) {
          throw new ParseGradesError(OVER_LIMIT_MESSAGE, retryRaw);
        }
        throw new ParseGradesError(`تعذّر قراءة الملف: ${retryRaw}`, retryRaw);
      }
    } else {
      throw new ParseGradesError(`تعذّر قراءة الملف: ${raw}`, raw);
    }
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
  let tables: ParsedTable[];
  if (format === 'accdb' || format === 'mdb') {
    tables = await parseAccess(file, options.onProgress);
  } else if (format === 'csv') {
    /* CSV gets its own streaming reader — SheetJS chokes on real
     * Ministry exports that run past ~500k rows even with dense mode
     * on, because it allocates the full file as a JS string plus a
     * 2D cell-object array up-front. Streaming off `file.stream()`
     * keeps the in-flight buffer bounded. */
    tables = await parseCsvStreaming(file, options.onProgress);
  } else {
    tables = await parseSpreadsheet(file, options.onProgress);
  }
  return { sourceName: file.name, format, tables };
}
