/**
 * ImportPreviewTable — per-row validation display for the import dialog.
 * Built on top of `DataTable<ImportPreviewRow>` (inception) so the visual
 * language stays consistent with the host page.
 *
 * Each row shows its 1-based source index, a compact key/value summary of
 * the raw cells, and either a success badge or the concatenated errors in
 * `--terra-50`/`--success-bg` tinted rows.
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../DataTable';
import type { ImportPreviewRow } from './list-actions.types';

interface ImportPreviewTableProps<TIn> {
  rows: ReadonlyArray<ImportPreviewRow<TIn>>;
  /** Header labels to show in the summary column, in the desired order.
   *  Falls back to the keys of the first row's `source` map. */
  headerLabels?: ReadonlyArray<string>;
}

export function ImportPreviewTable<TIn>({
  rows,
  headerLabels,
}: ImportPreviewTableProps<TIn>): JSX.Element {
  const resolvedHeaders = useMemo<readonly string[]>(() => {
    if (headerLabels && headerLabels.length > 0) return headerLabels;
    const first = rows[0]?.source;
    return first ? Object.keys(first) : [];
  }, [headerLabels, rows]);

  const columns = useMemo<DataTableColumn<ImportPreviewRow<TIn>>[]>(
    () => [
      {
        key: 'row',
        label: 'الصف',
        align: 'center',
        width: 64,
        render: (r) => (
          <span className="font-numeric tnum" dir="ltr">
            {r.rowIndex + 1}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'الحالة',
        width: 96,
        render: (r) =>
          r.errors.length === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-2xs text-success">
              <CheckCircle2 size={12} strokeWidth={1.75} aria-hidden /> صالح
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-terra-50 px-2 py-0.5 text-2xs text-terra-700">
              <XCircle size={12} strokeWidth={1.75} aria-hidden /> {r.errors.length} خطأ
            </span>
          ),
      },
      {
        key: 'summary',
        label: 'البيانات',
        render: (r) => (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-ink-700">
              {resolvedHeaders.slice(0, 4).map((h) => (
                <span key={h}>
                  <span className="text-ink-400">{h}: </span>
                  <span className="font-medium">{r.source[h] || '—'}</span>
                </span>
              ))}
            </div>
            {r.errors.length > 0 && (
              <ul className="list-disc ps-4 text-2xs text-terra-700">
                {r.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        ),
      },
    ],
    [resolvedHeaders],
  );

  /* The DataTable doesn't expose a row-style hook, so we render two visual
   * groups separated by a thin band. Failed rows first (most actionable). */
  const failedRows = rows.filter((r) => r.errors.length > 0);
  const successRows = rows.filter((r) => r.errors.length === 0);
  const ordered = [...failedRows, ...successRows];

  return (
    <DataTable<ImportPreviewRow<TIn>>
      data={ordered}
      columns={columns}
      rowKey={(r) => r.rowIndex}
      density="compact"
      zebraStripes
      stickyHeader
    />
  );
}
