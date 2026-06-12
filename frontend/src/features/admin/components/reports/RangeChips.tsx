/**
 * RangeChips — global time-range selector for the command center.
 * Single-row toolbar: label at the start, a joined segmented control,
 * and the live-read note at the end. The selected range drives
 * comparative windows in cycle tempo, audit activity, and the
 * executive decision brief.
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
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-card px-4 py-2 shadow-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
          <SlidersHorizontal size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
          <span>نطاق التحليل</span>
        </span>
        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-ink-100 p-1"
          role="radiogroup"
          aria-label="نطاق زمني"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={value === opt.key}
              onClick={() => onChange(opt.key)}
              className={
                value === opt.key
                  ? 'rounded-md px-3 py-1 text-2xs font-semibold shadow-xs transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus-teal'
                  : 'rounded-md px-3 py-1 text-2xs text-ink-500 transition-colors duration-fast hover:bg-surface-card hover:text-ink-700 focus-visible:outline-none focus-visible:shadow-focus-teal'
              }
              style={value === opt.key ? { background: 'var(--accent-600)', color: 'var(--ink-50)' } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden items-center gap-2 text-2xs text-ink-500 md:flex">
        <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        <span>قراءة شبه فورية، تتحدث عند وصول بيانات الخدمة</span>
      </div>
    </div>
  );
}
