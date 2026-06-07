/**
 * Pure export-runner used by `ExportMenu` — converts a `(rows, config)`
 * pair into a downloaded CSV/XLSX file and emits the `entity_exported`
 * audit row.
 *
 * Chunking note: serialization yields to the event loop every 100 rows
 * via `requestAnimationFrame` when row counts exceed 500. Keeps the UI
 * responsive on full-cycle exports.
 */

import { downloadBlob } from '@/shared/lib/download';
import { emitAudit } from '@/shared/lib/audit';
import { serializeCsv } from '@/shared/lib/csv';
import { buildXlsxBlob, buildXlsxWorkbookBlob } from '@/shared/lib/xlsx';
import type { AuditModule } from '@/shared/types/domain';
import type { ExportConfig, ExportFormat } from './list-actions.types';

const LARGE_EXPORT_THRESHOLD = 500;

function isoDateStamp(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function rowToCells<TRow>(
  row: TRow,
  config: ExportConfig<TRow>,
): unknown[] {
  return config.columns.map((col) => {
    const raw = (row as Record<string, unknown>)[col.key];
    if (col.format) return col.format(raw, row);
    if (raw === null || raw === undefined) return '';
    if (Array.isArray(raw)) return raw.join('، ');
    if (typeof raw === 'object') {
      try {
        return JSON.stringify(raw);
      } catch {
        return '';
      }
    }
    return raw;
  });
}

async function buildBody<TRow>(
  rows: readonly TRow[],
  config: ExportConfig<TRow>,
  onProgress?: (count: number, total: number) => void,
): Promise<unknown[][]> {
  const body: unknown[][] = [];
  const chunk = 100;
  for (let i = 0; i < rows.length; i += 1) {
    body.push(rowToCells(rows[i]!, config));
    if (i > 0 && i % chunk === 0 && rows.length > LARGE_EXPORT_THRESHOLD) {
      onProgress?.(i, rows.length);
      /* Yield to the browser so progress UI can paint. */
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
  }
  onProgress?.(rows.length, rows.length);
  return body;
}

export interface RunExportArgs<TRow> {
  rows: readonly TRow[];
  config: ExportConfig<TRow>;
  format: ExportFormat;
  /** Override the filename (without extension). Defaults to `${prefix}${ISO}`. */
  filenameOverride?: string;
  /** Used by progress UI on >500-row exports. */
  onProgress?: (count: number, total: number) => void;
  /** Audit context. */
  entityKey: string;
  entityLabelAr: string;
  auditModule: AuditModule;
  /** `'filtered'` or `'all'` — recorded on the audit row. */
  scope: 'filtered' | 'all';
}

export async function runExport<TRow>(args: RunExportArgs<TRow>): Promise<void> {
  const { rows, config, format } = args;
  const headers = config.columns.map((c) => c.labelAr);
  const body = await buildBody(rows, config, args.onProgress);
  const baseName = args.filenameOverride ?? `${config.filenamePrefix}${isoDateStamp()}`;
  const filename = `${baseName}.${format}`;
  if (format === 'csv') {
    const blob = new Blob([serializeCsv(headers, body)], {
      type: 'text/csv;charset=utf-8',
    });
    downloadBlob(blob, filename);
  } else {
    const workbookSheets = config.xlsxSheets ? await config.xlsxSheets(rows) : null;
    const blob = workbookSheets && workbookSheets.length > 0
      ? buildXlsxWorkbookBlob(workbookSheets)
      : buildXlsxBlob(headers, body);
    downloadBlob(blob, filename);
  }
  emitAudit({
    action: 'entity_exported',
    module: args.auditModule,
    entityType: args.entityKey,
    entityLabel: args.entityLabelAr,
    entityId: filename,
    details: `تم تصدير ${rows.length} سجل من ${args.entityLabelAr} (${
      args.scope === 'filtered' ? 'النتائج المُصفّاة' : 'كل البيانات'
    }) بصيغة ${format.toUpperCase()}.`,
    after: { rows: rows.length, format, scope: args.scope, filename },
  });
}
