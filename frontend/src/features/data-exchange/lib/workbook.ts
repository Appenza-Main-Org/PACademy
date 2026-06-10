/**
 * Multi-sheet workbook build/parse for the Data-Exchange hub. Uses SheetJS
 * (`xlsx`, already a dependency), lazy-loaded so it doesn't block prod boot.
 *
 * The header row of each sheet is the machine column keys (stable contract the
 * importer maps by); the LOCKED §0a sheet names are the tab names. A workbook's
 * sheets are matched back to domains by tab name on import.
 */

import type { ExportInfo, ExchangeCellMap, ExportSheet, ImportSheetInput } from '../types';
import { EXPORT_INFO_SHEET_NAME, SHEET_NAMES } from '../types';

const VALID_SHEET_NAMES = new Set<string>(Object.values(SHEET_NAMES));

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Workbook-level metadata for the curated snapshot export. The backend supplies
 * `info` (cycle name, environment, export date, actor); the browser supplies the
 * URL/route it owns. When present, an `ExportInfo` sheet is written first.
 */
export interface WorkbookMeta {
  info?: ExportInfo | null;
  fullUrl?: string;
  sourceRoute?: string;
  sourceModule?: string;
  /** Preferred display name for "Exported By" (falls back to `info.exportedBy`). */
  exportedByName?: string;
}

type XlsxModule = typeof import('xlsx');

/** Per-column width hints (auto-fit, clamped). SheetJS community supports `!cols`. */
function autoColumnWidths(aoa: unknown[][]): Array<{ wch: number }> {
  const widths: number[] = [];
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const len = cell == null ? 0 : String(cell).length;
      if (len > (widths[i] ?? 0)) widths[i] = len;
    });
  }
  return widths.map((w) => ({ wch: Math.min(60, Math.max(10, (w || 0) + 2)) }));
}

/** Append one data sheet: header row + data, auto-fit columns, header autofilter. */
function appendDataSheet(XLSX: XlsxModule, wb: ReturnType<XlsxModule['utils']['book_new']>, sheet: ExportSheet): void {
  const aoa: unknown[][] = [sheet.columns, ...sheet.rows.map((row) => sheet.columns.map((c) => row[c] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoColumnWidths(aoa);
  // Header autofilter (community-writable) — keeps the header anchored + filterable,
  // standing in for frozen panes (Pro-only on write in SheetJS 0.18).
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, sheet.rows.length), c: Math.max(0, sheet.columns.length - 1) } }),
  };
  XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
}

/** Append the leading ExportInfo metadata sheet (property/value). */
function appendInfoSheet(XLSX: XlsxModule, wb: ReturnType<XlsxModule['utils']['book_new']>, meta: WorkbookMeta): void {
  const info = meta.info;
  const pairs: Array<[string, string]> = [
    ['Source Module', meta.sourceModule ?? 'Data Exchange'],
    ['Source Route', meta.sourceRoute ?? '/admin/data-exchange'],
    ['Full URL', meta.fullUrl ?? ''],
    ['Cycle ID', info?.cycleId ?? ''],
    ['Cycle Name', info?.cycleName ?? ''],
    ['Export Date', info?.exportDate ?? new Date().toISOString()],
    ['Exported By', meta.exportedByName ?? info?.exportedBy ?? ''],
    ['Environment', info?.environment ?? ''],
  ];
  const aoa: unknown[][] = [['Property', 'Value'], ...pairs];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoColumnWidths(aoa);
  XLSX.utils.book_append_sheet(wb, ws, EXPORT_INFO_SHEET_NAME);
}

/**
 * Build a single .xlsx Blob: optional `ExportInfo` sheet first, then one sheet
 * per domain under the locked tab names. Workbook is right-to-left (Arabic),
 * columns auto-fit, headers carry an autofilter. Empty sheets keep their header.
 */
export async function buildWorkbookBlob(sheets: ExportSheet[], meta?: WorkbookMeta): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // workbook-level RTL → <DisplayRightToLeft/>
  if (meta && (meta.info || meta.fullUrl)) appendInfoSheet(XLSX, wb, meta);
  for (const sheet of sheets) appendDataSheet(XLSX, wb, sheet);
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], { type: XLSX_MIME });
}

/** Build one Blob per sheet (file-per-type layout) — RTL + auto-fit, no info sheet. */
export async function buildPerTypeBlobs(sheets: ExportSheet[]): Promise<Array<{ sheetName: string; blob: Blob }>> {
  const out: Array<{ sheetName: string; blob: Blob }> = [];
  for (const sheet of sheets) {
    out.push({ sheetName: sheet.sheetName, blob: await buildWorkbookBlob([sheet]) });
  }
  return out;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedWorkbook {
  sheets: ImportSheetInput[];
  /** Sheet tab names present in the file that are NOT in the locked registry. */
  unknownSheets: string[];
}

/** Parse every recognized sheet of an uploaded workbook into ImportSheetInput[]. */
export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets: ImportSheetInput[] = [];
  const unknownSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    if (!VALID_SHEET_NAMES.has(sheetName)) {
      unknownSheets.push(sheetName);
      continue;
    }
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false });
    if (aoa.length === 0) continue;
    const headers = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
    const rows: ExchangeCellMap[] = [];
    for (let i = 1; i < aoa.length; i += 1) {
      const cells = aoa[i] ?? [];
      if (cells.length === 0 || cells.every((c) => c === '' || c === null || c === undefined)) continue;
      const row: ExchangeCellMap = {};
      headers.forEach((h, j) => {
        row[h] = cells[j] === undefined || cells[j] === null ? '' : String(cells[j]);
      });
      rows.push(row);
    }
    sheets.push({ sheetName, rows });
  }
  return { sheets, unknownSheets };
}

/** Build a validation-errors workbook for download (one row per failed/invalid row). */
export async function buildErrorsBlob(
  rows: Array<{ sheetName: string; rowIndex: number; businessKey: string; errors: string[] }>,
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const headers = ['sheet', 'row', 'business_key', 'errors'];
  const aoa: unknown[][] = [headers];
  for (const r of rows) aoa.push([r.sheetName, r.rowIndex + 1, r.businessKey, r.errors.join(' | ')]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
