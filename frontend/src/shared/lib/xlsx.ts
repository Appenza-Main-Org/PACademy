/**
 * Thin wrapper around `xlsx@0.18` for the universal list-actions stack.
 *
 * The `xlsx` package is already a project dependency (see
 * `frontend/package.json`). Used for both the legacy question-bank import
 * wizard and the new generic `ImportDialog` / `ExportMenu`.
 *
 * Parser output mirrors `parseCsv` — `{ headers, rows, parseErrors }` so
 * downstream code is format-agnostic.
 */

import * as XLSX from 'xlsx';
import type { ParseResult } from './csv';

export interface XlsxWorkbookSheet {
  name: string;
  headers: readonly string[];
  rows: ReadonlyArray<readonly unknown[]>;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const INVALID_SHEET_NAME_CHARS = /[:\\/?*[\]]/g;

function safeSheetName(name: string, fallback: string, used: Set<string>): string {
  const base = name.replace(INVALID_SHEET_NAME_CHARS, ' ').trim().slice(0, 31) || fallback;
  let next = base;
  let i = 2;
  while (used.has(next)) {
    const suffix = ` ${i}`;
    next = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    i += 1;
  }
  used.add(next);
  return next;
}

function sheetFromRows(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): XLSX.WorkSheet {
  const aoa: unknown[][] = [headers as unknown[]];
  for (const row of rows) {
    aoa.push(row as unknown[]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((header, index) => {
    const maxCellLength = rows.reduce((max, row) => {
      const value = row[index];
      return Math.max(max, String(value ?? '').length);
    }, String(header).length);
    return { wch: Math.min(Math.max(maxCellLength + 2, 12), 48) };
  });
  return ws;
}

/**
 * Convert a header row + value rows into a binary Blob containing a single
 * sheet named "بيانات". Cell formatting is left to defaults; Excel infers
 * numbers / dates from cell contents.
 */
export function buildXlsxBlob(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): Blob {
  return buildXlsxWorkbookBlob([{ name: 'بيانات', headers, rows }]);
}

/**
 * Convert multiple named sheets into one XLSX workbook. Sheet names are
 * sanitized for Excel compatibility and kept stable for import templates.
 */
export function buildXlsxWorkbookBlob(sheets: readonly XlsxWorkbookSheet[]): Blob {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const [index, sheet] of sheets.entries()) {
    const ws = sheetFromRows(sheet.headers, sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name, `Sheet ${index + 1}`, usedNames));
  }
  const bin = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bin], { type: XLSX_MIME });
}

/**
 * Parse the first sheet of an XLSX file into `{ headers, rows, parseErrors }`.
 *
 * The first row is treated as the header. All cells are stringified so the
 * consumer can run them through the same zod schema regardless of source.
 */
export async function parseXlsx(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [], parseErrors: [] };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [], parseErrors: [] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  if (aoa.length === 0) return { headers: [], rows: [], parseErrors: [] };
  const headers = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
  const rows: Record<string, string>[] = [];
  const parseErrors: { rowIndex: number; message: string }[] = [];
  for (let i = 1; i < aoa.length; i += 1) {
    const cells = aoa[i] ?? [];
    if (cells.length === 0 || cells.every((c) => c === '' || c === null || c === undefined)) {
      continue;
    }
    if (cells.length !== headers.length) {
      parseErrors.push({
        rowIndex: i - 1,
        message: `عدد الأعمدة لا يطابق رأس الجدول (${cells.length} مقابل ${headers.length}).`,
      });
    }
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = String(cells[j] ?? '').trim();
    });
    rows.push(row);
  }
  return { headers, rows, parseErrors };
}
