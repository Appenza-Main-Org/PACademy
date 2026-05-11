/**
 * ImportLookupResult — post-commit summary panel.
 *
 * Displays created / updated / restored / skipped / errored counts
 * and an expandable list of errored rows.
 *
 * Usage:
 *   <ImportLookupResult summary={session.summary!} onClose={handleClose} />
 */

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { Badge, Button } from '@/shared/components';
import type { ImportSummary } from '../../api/lookup-import';

interface ImportLookupResultProps {
  summary: ImportSummary;
  onClose: () => void;
  onImportAnother?: () => void;
}

/** Post-commit outcome panel. */
export function ImportLookupResult({
  summary,
  onClose,
  onImportAnother,
}: ImportLookupResultProps): JSX.Element {
  const [errorsOpen, setErrorsOpen] = useState(false);
  const allOk = summary.errored === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Icon + headline */}
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        {allOk ? (
          <CheckCircle2 size={40} strokeWidth={1.5} className="text-teal-500" />
        ) : (
          <XCircle size={40} strokeWidth={1.5} className="text-terra-500" />
        )}
        <p className="font-ar-display text-lg font-bold text-ink-900">
          {allOk ? 'اكتمل الاستيراد بنجاح' : 'اكتمل الاستيراد مع أخطاء'}
        </p>
        <p className="text-sm text-ink-500">
          {`${summary.total} صف · ${Math.round(summary.durationMs / 1000)} ث`}
        </p>
      </div>

      {/* Count grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.created > 0 && <CountCard label="تم إنشاؤه" count={summary.created} tone="success" />}
        {summary.updated > 0 && <CountCard label="تم تحديثه" count={summary.updated} tone="success" />}
        {summary.restored > 0 && <CountCard label="تمت استعادته" count={summary.restored} tone="info" />}
        {summary.skipped > 0 && <CountCard label="تم تخطيه" count={summary.skipped} tone="neutral" />}
        {summary.errored > 0 && <CountCard label="فشل" count={summary.errored} tone="danger" />}
      </div>

      {/* Error details */}
      {summary.errored > 0 && (
        <div className="rounded-md border border-terra-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-terra-700 hover:bg-terra-50"
            onClick={() => setErrorsOpen((v) => !v)}
            aria-expanded={errorsOpen}
          >
            <span>تفاصيل الصفوف الفاشلة ({summary.errored})</span>
            {errorsOpen ? (
              <ChevronUp size={14} strokeWidth={1.75} />
            ) : (
              <ChevronDown size={14} strokeWidth={1.75} />
            )}
          </button>
          {errorsOpen && (
            <ul className="divide-y divide-terra-100 px-3 pb-2">
              {summary.errors.map((r) => (
                <li key={r.index} className="py-2 text-sm">
                  <span className="font-numeric font-medium text-ink-700">صف {r.index + 2}: </span>
                  <span className="text-terra-700">{r.error?.messageAr ?? 'خطأ غير محدد'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onImportAnother && (
          <Button variant="secondary" onClick={onImportAnother}>
            استيراد ملف آخر
          </Button>
        )}
        <Button variant="primary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function CountCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: 'success' | 'info' | 'neutral' | 'danger';
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border-subtle bg-surface-card py-3">
      <span className="font-numeric tnum text-2xl font-bold text-ink-900">
        {count.toLocaleString('en-US')}
      </span>
      <Badge tone={tone}>{label}</Badge>
    </div>
  );
}
