/**
 * ActiveCycleIndicator — Gap F (admin-gaps).
 *
 * Compact pill that surfaces the currently-active admission cycle in the
 * AppShell header. Wires through `useActiveCycle()` so it auto-refreshes
 * after every cycle lifecycle transition (activate / close / extend /
 * archive).
 */

import { CalendarClock, CalendarOff } from 'lucide-react';
import { useActiveCycle } from '../../api/cycles.queries';

export function ActiveCycleIndicator(): JSX.Element | null {
  const { data: cycle, isLoading } = useActiveCycle();

  if (isLoading) return null;

  if (!cycle) {
    return (
      <span
        className="hidden h-7 items-center gap-1.5 rounded-pill border border-terra-200 bg-terra-50 px-2.5 text-2xs font-medium text-terra-700 md:inline-flex"
        title="لا توجد دورة قبول نشطة"
      >
        <CalendarOff size={12} strokeWidth={1.75} className="text-terra-500" />
        لا توجد دورة نشطة
      </span>
    );
  }

  const isExtended = cycle.status === 'extended';
  return (
    <span
      className="hidden h-7 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-page px-2.5 text-2xs font-medium text-ink-700 md:inline-flex"
      title={`الدورة النشطة · ${cycle.nameAr}`}
    >
      <CalendarClock size={12} strokeWidth={1.75} className="text-teal-600" />
      <span className="text-ink-900">{cycle.nameAr}</span>
      {isExtended && (
        <span className="ms-0.5 inline-flex h-4 items-center rounded-sm bg-gold-50 px-1 text-2xs font-medium text-gold-700">
          ممدّدة
        </span>
      )}
    </span>
  );
}
