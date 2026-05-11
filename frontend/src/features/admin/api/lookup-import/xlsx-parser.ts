/**
 * xlsx-parser.ts — SheetJS wrapper (lazy-loaded via dynamic import).
 *
 * IMPORTANT: import('xlsx') is always dynamic so the lookup-page bundle
 * stays flat. Do NOT import xlsx eagerly elsewhere.
 *
 * Contract: parseXLSX(file, lookupKey) → { rows, rejection }
 * - Never throws; all failure cases land in `rejection`.
 * - First sheet only; further sheets ignored.
 * - Size cap (5 MB) and row-count cap (1000) enforced before parse.
 */

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

/**
 * Parse an xlsx File and classify rows against the given lookup schema.
 *
 * @returns `{ rows, rejection }` — rejection is non-null on file-level failure.
 */
export async function parseXLSX(
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

  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    return {
      rows: [],
      rejection: { code: 'corrupted', messageAr: 'تعذّر تحميل مكتبة قراءة Excel.' },
    };
  }

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  } catch {
    return {
      rows: [],
      rejection: { code: 'corrupted', messageAr: 'تعذّر قراءة الملف. تأكد من أنه ملف Excel (.xlsx) صالح وغير محمي بكلمة مرور.' },
    };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      rejection: { code: 'empty', messageAr: 'الملف لا يحتوي على أوراق عمل.' },
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  // sheet_to_json with header:1 returns arrays; row 0 is the header row.
  const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

  if (rawData.length < 2) {
    return {
      rows: [],
      rejection: { code: 'empty', messageAr: 'الملف لا يحتوي على بيانات. يرجى التحقق من المحتوى.' },
    };
  }

  const headers = rawData[0].map((h) => String(h ?? '').trim());
  const dataRowArrays = rawData.slice(1).filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

  const schema = ARABIC_SCHEMAS[lookupKey];
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

  if (dataRowArrays.length === 0) {
    return {
      rows: [],
      rejection: { code: 'empty', messageAr: 'الملف لا يحتوي على بيانات. يرجى التحقق من المحتوى.' },
    };
  }

  if (dataRowArrays.length > MAX_DATA_ROWS) {
    return {
      rows: [],
      rejection: {
        code: 'too_many_rows',
        messageAr: `عدد الصفوف (${dataRowArrays.length}) يتجاوز الحد المسموح (1000 صف). يرجى تقسيم الملف.`,
      },
    };
  }

  const rows = classifyRowShapes(headers, dataRowArrays, schema, sortOrderBase, parents);
  return { rows, rejection: null };
}

function classifyRowShapes(
  headers: string[],
  dataRows: string[][],
  schema: LookupSchema,
  sortOrderBase: number,
  parents: ParentLookup,
): ParsedRow[] {
  return dataRows.map((cells, index) => {
    const arabicValues: Record<string, string> = {};
    headers.forEach((h, i) => {
      arabicValues[h] = String(cells[i] ?? '').trim();
    });

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
