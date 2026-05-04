/**
 * ImportPreviewTable — first-20-rows preview for the bulk question import wizard.
 *
 * Per-row severity badge (✅ صالح / ⚠ تحذير / ❌ خطأ) plus a tooltip-style
 * details column listing every error/warning. Read-only — fixes happen in
 * the source file, not in-table.
 */

import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/shared/components';
import type { BadgeTone } from '@/shared/components';
import type { ImportRow, ImportSeverity } from '../lib/import-questions';

const SEVERITY_TONE: Record<ImportSeverity, BadgeTone> = {
  valid: 'success',
  warning: 'warning',
  error: 'danger',
};

const SEVERITY_LABEL: Record<ImportSeverity, string> = {
  valid: 'صالح',
  warning: 'تحذير',
  error: 'خطأ',
};

const SEVERITY_ICON: Record<ImportSeverity, JSX.Element> = {
  valid: <CheckCircle2 size={11} strokeWidth={2} aria-hidden />,
  warning: <AlertTriangle size={11} strokeWidth={2} aria-hidden />,
  error: <XCircle size={11} strokeWidth={2} aria-hidden />,
};

interface ImportPreviewTableProps {
  rows: readonly ImportRow[];
  /** Cap the rendered rows. Defaults to 20 per the brief. */
  limit?: number;
}

export function ImportPreviewTable({ rows, limit = 20 }: ImportPreviewTableProps): JSX.Element {
  const visible = rows.slice(0, limit);
  const hidden = Math.max(0, rows.length - visible.length);

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      <table className="w-full text-2xs">
        <thead className="bg-surface-sunken text-ink-500">
          <tr>
            <th className="px-3 py-2 text-start font-medium uppercase tracking-wide">#</th>
            <th className="px-3 py-2 text-start font-medium uppercase tracking-wide">الحالة</th>
            <th className="px-3 py-2 text-start font-medium uppercase tracking-wide">الفئة</th>
            <th className="px-3 py-2 text-center font-medium uppercase tracking-wide">الصعوبة</th>
            <th className="px-3 py-2 text-start font-medium uppercase tracking-wide">نص السؤال</th>
            <th className="px-3 py-2 text-start font-medium uppercase tracking-wide">ملاحظات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {visible.map((r) => {
            const issues = [...r.errors, ...r.warnings];
            return (
              <tr key={r.rowNumber} className="bg-surface-card hover:bg-ink-50">
                <td className="px-3 py-2 align-top font-mono text-ink-500" dir="ltr">{r.rowNumber}</td>
                <td className="px-3 py-2 align-top">
                  <Badge tone={SEVERITY_TONE[r.severity]} icon={SEVERITY_ICON[r.severity]}>
                    {SEVERITY_LABEL[r.severity]}
                  </Badge>
                </td>
                <td className="px-3 py-2 align-top text-ink-700">{r.category || '—'}</td>
                <td className="px-3 py-2 text-center align-top font-numeric tnum">
                  {r.difficulty === null ? '—' : '★'.repeat(Math.max(0, Math.min(5, r.difficulty)))}
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 align-top text-ink-900" title={r.text}>
                  {r.text || '—'}
                </td>
                <td className="px-3 py-2 align-top text-ink-500">
                  {issues.length === 0 ? (
                    <span className="text-2xs text-ink-400">—</span>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {issues.map((m, i) => (
                        <li key={i} className="leading-snug">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hidden > 0 && (
        <p className="border-t border-border-subtle bg-surface-sunken px-3 py-2 text-2xs text-ink-500">
          و <span className="font-numeric tnum font-medium">{hidden}</span> صف إضافي بعد المعاينة الأولى.
        </p>
      )}
    </div>
  );
}
