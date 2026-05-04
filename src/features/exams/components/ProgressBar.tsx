/**
 * ProgressBar — slim accent-filled bar for live proctor row.
 *
 * Caption renders as: "أجاب N / M" on the start edge, percentage on the
 * trailing edge. Accent fill comes from `var(--accent-500)` so the bar
 * inherits the per-app palette via the AppShell's `data-app="..."`.
 */

import { num } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

interface ProgressBarProps {
  value: number;
  max: number;
  /** Pass `false` to hide the caption row above the bar. */
  caption?: boolean;
  className?: string;
  /** Override the bar fill colour. Defaults to `var(--accent-500)`. */
  color?: string;
}

export function ProgressBar({
  value,
  max,
  caption = true,
  className,
  color = 'var(--accent-500)',
}: ProgressBarProps): JSX.Element {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(safeMax, value));
  const pct = Math.round((safeValue / safeMax) * 100);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {caption && (
        <div className="flex items-center justify-between text-2xs text-ink-500">
          <span>
            أجاب <span className="font-numeric tnum text-ink-900">{num(safeValue)}</span> / <span className="font-numeric tnum">{num(safeMax)}</span>
          </span>
          <span className="font-numeric tnum">{pct}٪</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--ink-100)' }}
      >
        <span
          aria-hidden
          className="block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
