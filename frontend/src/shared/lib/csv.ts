/**
 * Minimal CSV serializer/parser used by the universal list-actions stack
 * (`ListActions` + `ImportDialog`).
 *
 * Goals:
 *  - UTF-8 with BOM so Excel renders Arabic without re-encoding.
 *  - RFC-4180 quoting for values containing `,`, `"`, or line breaks.
 *  - Lenient parsing — tolerates CRLF/LF, trailing newline, header row.
 *
 * Not goals:
 *  - Streaming / chunked parsing for >100MB inputs.
 *  - Custom delimiters / locale-specific separators.
 *
 * Consumers should treat parse output as `unknown` and narrow via zod.
 */

const BOM = '﻿';

export interface ParseResult {
  /** Parsed header column labels (verbatim). */
  headers: string[];
  /** Each row is a `{ headerLabel: cellValue }` record. */
  rows: Record<string, string>[];
  /** Row-level parse warnings (mismatched column counts, etc.). */
  parseErrors: { rowIndex: number; message: string }[];
}

const SHOULD_QUOTE = /[",\r\n]/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (!SHOULD_QUOTE.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Serialize a header row + value rows into a UTF-8 CSV string.
 * Prepends BOM so Excel detects UTF-8 for the Arabic labels.
 */
export function serializeCsv(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return BOM + lines.join('\r\n');
}

/**
 * Parse a CSV string into a header row + value rows. The first non-empty
 * line is treated as the header; subsequent lines map to row records.
 *
 * Mismatched column counts are surfaced in `parseErrors` but do not block —
 * missing cells become empty strings; extra cells are dropped.
 */
export function parseCsv(input: string): ParseResult {
  const text = input.startsWith(BOM) ? input.slice(1) : input;
  const tokens = tokenize(text);
  if (tokens.length === 0) return { headers: [], rows: [], parseErrors: [] };
  const [headerTokens, ...bodyTokens] = tokens;
  const headers = (headerTokens ?? []).map((t) => t.trim());
  const rows: Record<string, string>[] = [];
  const parseErrors: { rowIndex: number; message: string }[] = [];
  bodyTokens.forEach((cells, i) => {
    if (cells.length === 1 && cells[0] === '') return; // skip blank line
    if (cells.length !== headers.length) {
      parseErrors.push({
        rowIndex: i,
        message: `عدد الأعمدة لا يطابق رأس الجدول (${cells.length} مقابل ${headers.length}).`,
      });
    }
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = (cells[j] ?? '').trim();
    });
    rows.push(row);
  });
  return { headers, rows, parseErrors };
}

/**
 * Tokenize a CSV string into rows of cells, honoring quoted cells with
 * embedded `,`, `"` (escaped as `""`), and newlines.
 */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      /* Swallow CR so we only emit on LF. */
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  /* Flush trailing cell/row. */
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
