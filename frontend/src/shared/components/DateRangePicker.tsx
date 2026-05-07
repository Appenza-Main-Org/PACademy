/**
 * DateRangePicker — two-month range calendar with quick-range chips.
 * Source: Tasks/DESIGN_SYSTEM.md §4.12.
 *
 * Quick ranges: اليوم · الأسبوع · الشهر · آخر 30 يوم · هذا الفصل.
 *
 * Usage:
 *   <DateRangePicker value={range} onChange={setRange} label="فترة الإحصاء" />
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { CalendarGrid } from './DatePicker';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  label?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

const QUICK_RANGES: { key: string; label: string; build: () => DateRange }[] = [
  {
    key: 'today',
    label: 'اليوم',
    build: () => {
      const now = new Date();
      return { start: stripTime(now), end: stripTime(now) };
    },
  },
  {
    key: 'week',
    label: 'الأسبوع',
    build: () => {
      const now = new Date();
      const start = stripTime(now);
      start.setDate(start.getDate() - 6);
      return { start, end: stripTime(now) };
    },
  },
  {
    key: 'month',
    label: 'الشهر',
    build: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: stripTime(now) };
    },
  },
  {
    key: 'last-30',
    label: 'آخر 30 يوم',
    build: () => {
      const now = new Date();
      const start = stripTime(now);
      start.setDate(start.getDate() - 29);
      return { start, end: stripTime(now) };
    },
  },
  {
    key: 'season',
    label: 'هذا الفصل',
    build: () => {
      const now = new Date();
      const seasonStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), seasonStart, 1);
      return { start, end: stripTime(now) };
    },
  },
];

export function DateRangePicker({
  value,
  onChange,
  label,
  helper,
  error,
  disabled,
  className,
}: DateRangePickerProps): JSX.Element {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(value?.start ?? new Date());
  const [draftStart, setDraftStart] = useState<Date | null>(value?.start ?? null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value?.end ?? null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        commitIfReady();
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftStart, draftEnd]);

  const commitIfReady = (): void => {
    if (draftStart && draftEnd) onChange?.({ start: draftStart, end: draftEnd });
  };

  const handleCellSelect = (d: Date): void => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d);
      setDraftEnd(null);
      return;
    }
    if (draftStart && !draftEnd) {
      const start = stripTime(draftStart).getTime() <= stripTime(d).getTime() ? draftStart : d;
      const end = stripTime(draftStart).getTime() <= stripTime(d).getTime() ? d : draftStart;
      setDraftStart(start);
      setDraftEnd(end);
      onChange?.({ start, end });
    }
  };

  const display = value?.start && value?.end
    ? `${formatDate(value.start)} – ${formatDate(value.end)}`
    : 'اختر فترة';

  return (
    <div ref={wrapperRef} className={cn('relative flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-surface-card px-3 text-start text-sm transition-colors duration-fast ease-standard',
          error ? 'border-terra-500' : 'border-border-default hover:border-border-strong',
          'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn(value?.start && value?.end ? 'text-ink-900' : 'text-ink-400')}>
          {display}
        </span>
        <Calendar size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="اختر فترة"
          className="absolute top-full mt-2 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-elevated p-3 shadow-lg md:flex-row"
          style={{ zIndex: 'var(--z-dropdown)' as unknown as number, insetInlineEnd: 0 }}
        >
          <ul className="flex flex-row flex-wrap gap-1 md:flex-col md:border-e md:border-border-subtle md:pe-3">
            {QUICK_RANGES.map((qr) => (
              <li key={qr.key}>
                <button
                  type="button"
                  onClick={() => {
                    const r = qr.build();
                    setDraftStart(r.start);
                    setDraftEnd(r.end);
                    onChange?.(r);
                    setOpen(false);
                  }}
                  className="rounded-md px-3 py-1 text-xs text-ink-700 hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
                >
                  {qr.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 md:flex-row">
            <CalendarGrid
              cursor={cursor}
              setCursor={setCursor}
              selected={null}
              rangeStart={draftStart}
              rangeEnd={draftEnd}
              onSelect={handleCellSelect}
            />
            <CalendarGrid
              cursor={addMonths(cursor, 1)}
              setCursor={(d) => setCursor(addMonths(d, -1))}
              selected={null}
              rangeStart={draftStart}
              rangeEnd={draftEnd}
              onSelect={handleCellSelect}
            />
          </div>
        </div>
      )}
      {error ? (
        <p className="text-xs text-terra-700">{error}</p>
      ) : helper ? (
        <p className="text-xs text-ink-500">{helper}</p>
      ) : null}
    </div>
  );
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
