/**
 * RangeChips — global time-range selector for the command center.
 * The selected range drives comparative windows in cycle tempo, audit
 * activity, and the executive decision brief.
 */

import { SlidersHorizontal } from 'lucide-react';

export type TimeRange = 'today' | '7d' | '30d' | 'cycle' | 'compare';

const OPTIONS: { key: TimeRange; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '٧ أيام' },
  { key: '30d', label: '٣٠ يوم' },
  { key: 'cycle', label: 'هذه الدورة' },
  { key: 'compare', label: 'مقارنة بالدورة السابقة' },
];

interface RangeChipsProps {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
}

export function RangeChips({ value, onChange }: RangeChipsProps): JSX.Element {
  return (
    <div className="no-print mb-6 rounded-lg border border-border-subtle bg-surface-card px-4 py-3 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <SlidersHorizontal size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
          <span>نطاق التحليل</span>
        </div>
        <div className="flex items-center gap-2 text-2xs text-ink-500">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span>قراءة شبه فورية، تتحدث عند وصول بيانات الخدمة</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="نطاق زمني">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={value === opt.key}
            onClick={() => onChange(opt.key)}
            className={
              value === opt.key
                ? 'rounded-pill px-3 py-1 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus-teal'
                : 'rounded-pill border border-border-subtle px-3 py-1 text-2xs text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700 focus-visible:outline-none focus-visible:shadow-focus-teal'
            }
            style={value === opt.key ? { background: 'var(--accent-500)', color: 'var(--ink-50)' } : undefined}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
