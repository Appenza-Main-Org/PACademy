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
        className="hidden items-center gap-1 rounded-pill border border-terra-300 bg-terra-50 px-3 py-1 text-2xs font-medium text-terra-700 md:inline-flex"
        title="لا توجد دورة قبول نشطة"
      >
        <CalendarOff size={12} strokeWidth={1.75} />
        لا توجد دورة نشطة
      </span>
    );
  }

  const isExtended = cycle.status === 'extended';
  return (
    <span
      className="hidden items-center gap-1 rounded-pill border border-teal-200 bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700 md:inline-flex"
      title={`الدورة النشطة · ${cycle.nameAr}`}
    >
      <CalendarClock size={12} strokeWidth={1.75} />
      {cycle.nameAr}
      {isExtended && <span className="ms-1 text-2xs text-gold-700">(ممدّدة)</span>}
    </span>
  );
}
