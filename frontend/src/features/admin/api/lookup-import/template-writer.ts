/**
 * template-writer.ts — buildTemplate(lookupKey) → Blob (.xlsx)
 *
 * Uses SheetJS (dynamic import — same lazy chunk as xlsx-parser).
 * Returns an xlsx Blob with:
 *   Row 1: Arabic column headers (required then optional)
 *   Row 2: Per-schema example row
 * Column widths set to 20 chars to fit Arabic text.
 */

import { ARABIC_SCHEMAS } from './arabic-schema';
import type { ImportLookupKey } from './types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Generate a per-lookup import template as an xlsx Blob.
 * The first sheet has Arabic headers + one example row.
 */
export async function buildTemplate(lookupKey: ImportLookupKey): Promise<Blob> {
  const XLSX = await import('xlsx');
  const schema = ARABIC_SCHEMAS[lookupKey];

  const headers = [...schema.requiredHeaders, ...schema.optionalHeaders];
  const exampleRow = headers.map((h) => schema.exampleRow[h] ?? '');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

  // Set column widths (wch = width in characters).
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  XLSX.utils.book_append_sheet(wb, ws, 'البيانات');

  // SheetJS write returns Uint8Array in 'array' mode; cast buffer to satisfy strict DOM types.
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  return new Blob([wbout.buffer as ArrayBuffer], { type: XLSX_MIME });
}

/** Trigger a file download from a Blob (browser only). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after a tick to allow the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
