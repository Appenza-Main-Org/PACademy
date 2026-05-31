/**
 * Multi-sheet workbook build/parse for the Data-Exchange hub. Uses SheetJS
 * (`xlsx`, already a dependency), lazy-loaded so it doesn't block prod boot.
 *
 * The header row of each sheet is the machine column keys (stable contract the
 * importer maps by); the LOCKED §0a sheet names are the tab names. A workbook's
 * sheets are matched back to domains by tab name on import.
 */

import type { ExchangeCellMap, ExportSheet, ImportSheetInput } from '../types';
import { SHEET_NAMES } from '../types';

const VALID_SHEET_NAMES = new Set<string>(Object.values(SHEET_NAMES));

/** Build a single .xlsx Blob with one sheet per domain under the locked names. */
export async function buildWorkbookBlob(sheets: ExportSheet[]): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: unknown[][] = [sheet.columns];
    for (const row of sheet.rows) {
      aoa.push(sheet.columns.map((c) => row[c] ?? ''));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Build one Blob per sheet (file-per-type layout). */
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
