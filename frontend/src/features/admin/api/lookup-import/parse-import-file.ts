/**
 * parse-import-file.ts — parseImportFile(file, lookupKey)
 *
 * Detects the file format by extension, dispatches to the correct parser,
 * and returns { rows, rejection }. Never throws.
 */

import { parseCSV } from './csv-parser';
import { parseXLSX } from './xlsx-parser';
import type {
  ImportLookupKey,
  ImportRejection,
  ParsedRow,
  ParentLookup,
} from './types';

/** Detect format by extension. Returns null for unsupported formats. */
function detectFormat(file: File): 'xlsx' | 'csv' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.csv')) return 'csv';
  return null;
}

/**
 * Parse an xlsx or csv file and validate against the given lookup schema.
 *
 * @param file       The File object from the drop / file-input event.
 * @param lookupKey  Which of the 21 lookup schemas to validate against.
 * @param existingSortMax  Max sortOrder of existing rows (used for default
 *                         sortOrder on rows that omit it). Defaults to 0.
 * @param parents    Pre-fetched parent lookup rows (for hierarchical lookups).
 *
 * @returns `{ rows, rejection }` — rejection non-null means the whole file
 * was rejected before any row is shown.
 */
export async function parseImportFile(
  file: File,
  lookupKey: ImportLookupKey,
  existingSortMax = 0,
  parents: ParentLookup = { active: new Map(), archived: new Map() },
): Promise<{ rows: ParsedRow[]; rejection: ImportRejection | null }> {
  const format = detectFormat(file);
  if (format === null) {
    return {
      rows: [],
      rejection: {
        code: 'unsupported_format',
        messageAr: 'نوع الملف غير مدعوم. يُرجى رفع ملف بصيغة .xlsx أو .csv',
      },
    };
  }

  const sortOrderBase = existingSortMax + 10;

  if (format === 'xlsx') {
    return parseXLSX(file, lookupKey, sortOrderBase, parents);
  }
  return parseCSV(file, lookupKey, sortOrderBase, parents);
}
