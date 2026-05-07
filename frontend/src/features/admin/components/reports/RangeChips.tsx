/**
 * RangeChips — global time-range selector for the command center.
 * Wired to UI state in the page; service queries are already cycle-scoped,
 * so the selection currently affects display copy only.
 */

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
    <div className="no-print mb-6 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="نطاق زمني">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={value === opt.key}
          onClick={() => onChange(opt.key)}
          className={
            value === opt.key
              ? 'rounded-pill px-3 py-1 text-2xs font-medium transition-colors'
              : 'rounded-pill border border-border-subtle px-3 py-1 text-2xs text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-700'
          }
          style={value === opt.key ? { background: 'var(--accent-500)', color: 'var(--ink-50)' } : undefined}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
