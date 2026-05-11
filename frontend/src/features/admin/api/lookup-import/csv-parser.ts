/**
 * csv-parser.ts — PapaParse wrapper with strict UTF-8 enforcement.
 *
 * Contract: parseCSV(file, lookupKey) → { rows, rejection }
 * - Never throws; all failure cases land in `rejection`.
 * - Enforces UTF-8 (BOM optional, stripped silently).
 * - Non-UTF-8 byte sequences → ImportRejection 'unsupported_format'.
 * - Size cap (5 MB) enforced before decode.
 * - Row-count cap (1000) enforced after parse.
 */

import Papa from 'papaparse';
import { ARABIC_SCHEMAS } from './arabic-schema';
import type {
  ImportLookupKey,
  ImportRejection,
  LookupSchema,
  ParsedRow,
  ParentLookup,
} from './types';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DATA_ROWS = 1000;

/** UTF-8 BOM bytes. */
const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

function hasBom(bytes: Uint8Array): boolean {
  return bytes.length >= 3
    && bytes[0] === UTF8_BOM[0]
    && bytes[1] === UTF8_BOM[1]
    && bytes[2] === UTF8_BOM[2];
}

/**
 * Reads a File as raw bytes, strips UTF-8 BOM if present, then decodes
 * with TextDecoder(fatal:true) which throws on non-UTF-8 sequences.
 */
async function readAsUtf8(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  let bytes = new Uint8Array(buffer);
  if (hasBom(bytes)) bytes = bytes.slice(3);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Maps header row → parsed rows from PapaParse. */
function parseCsvText(text: string): { headers: string[]; dataRows: Record<string, string>[] } | null {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });
  if (result.errors.length > 0 && result.data.length === 0) return null;
  const headers = result.meta.fields ?? [];
  return { headers, dataRows: result.data };
}

/**
 * Parse a CSV File and classify rows against the given lookup schema.
 *
 * @returns `{ rows, rejection }` — rejection is non-null on file-level failure.
 */
export async function parseCSV(
  file: File,
  lookupKey: ImportLookupKey,
  sortOrderBase: number,
  parents: ParentLookup,
): Promise<{ rows: ParsedRow[]; rejection: ImportRejection | null }> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      rows: [],
      rejection: {
        code: 'too_large',
        messageAr: `حجم الملف يتجاوز الحد المسموح (5 ميجابايت). حجم الملف الحالي: ${(file.size / 1024 / 1024).toFixed(1)} ميجابايت.`,
      },
    };
  }

  const text = await readAsUtf8(file);
  if (text === null) {
    return {
      rows: [],
      rejection: {
        code: 'unsupported_format',
        messageAr: 'ترميز الملف غير مدعوم. يرجى حفظ الملف بترميز UTF-8 (في Excel: حفظ باسم → CSV بترميز UTF-8).',
      },
    };
  }

  const parsed = parseCsvText(text);
  if (!parsed) {
    return {
      rows: [],
      rejection: { code: 'corrupted', messageAr: 'تعذّر قراءة الملف. تأكد من أنه ملف CSV صالح.' },
    };
  }

  const { headers, dataRows } = parsed;
  const schema = ARABIC_SCHEMAS[lookupKey];

  // Validate required headers.
  const missingHeaders = schema.requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      rejection: {
        code: 'schema_mismatch',
        messageAr: `الأعمدة التالية مطلوبة لكنها غير موجودة: ${missingHeaders.join(' ، ')}`,
      },
    };
  }

  if (dataRows.length === 0) {
    return {
      rows: [],
      rejection: { code: 'empty', messageAr: 'الملف لا يحتوي على بيانات. يرجى التحقق من المحتوى.' },
    };
  }

  if (dataRows.length > MAX_DATA_ROWS) {
    return {
      rows: [],
      rejection: {
        code: 'too_many_rows',
        messageAr: `عدد الصفوف (${dataRows.length}) يتجاوز الحد المسموح (1000 صف). يرجى تقسيم الملف.`,
      },
    };
  }

  const rows = classifyRowShapes(dataRows, schema, sortOrderBase, parents);
  return { rows, rejection: null };
}

/** Shape-validates each row using the schema's mapRow. */
function classifyRowShapes(
  dataRows: Record<string, string>[],
  schema: LookupSchema,
  sortOrderBase: number,
  parents: ParentLookup,
): ParsedRow[] {
  return dataRows.map((rawRow, index) => {
    const arabicValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      arabicValues[k] = String(v ?? '').trim();
    }

    try {
      const payload = schema.mapRow(arabicValues, parents, sortOrderBase + index * 10);
      return {
        index,
        arabicValues,
        payload,
        classification: 'valid',
        conflict: null,
        resolution: null,
        outcome: null,
        error: null,
      } satisfies ParsedRow;
    } catch (err) {
      return {
        index,
        arabicValues,
        payload: null,
        classification: 'errored',
        conflict: null,
        resolution: null,
        outcome: null,
        error: {
          code: 'missing_required',
          column: null,
          messageAr: err instanceof Error ? err.message : 'خطأ في البيانات',
        },
      } satisfies ParsedRow;
    }
  });
}
