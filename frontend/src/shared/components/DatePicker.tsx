/**
 * DatePicker — single-month calendar dropdown.
 * Source: Tasks/DESIGN_SYSTEM.md §4.12.
 *
 * Arabic month names, week starts Saturday (Egyptian convention),
 * numeric grid uses Latin tabular figures (per §3.4).
 *
 * Usage:
 *   <DatePicker value={date} onChange={setDate} label="تاريخ الميلاد" />
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 8;
/* Approximate rendered height of the popover (calendar grid + month
 * header + container padding). Used to decide whether to flip upward
 * when the viewport doesn't have enough room below the trigger.
 * Measuring the live node would be ideal, but the popover renders
 * after this function runs — a static estimate is sufficient for the
 * 6-row calendar (the only layout we render). */
const POPOVER_HEIGHT_ESTIMATE = 340;

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'إبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export const ARABIC_WEEKDAYS_SAT_FIRST = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
] as const;

/**
 * Single-character weekday abbreviations, Saturday-first.
 * Every Arabic weekday name begins with "ال", so the previous header
 * truncation (`name.slice(0, 2)`) collapsed all seven labels to "ال".
 * Use this distinguishing letter map instead — same order as
 * `ARABIC_WEEKDAYS_SAT_FIRST`.
 */
export const ARABIC_WEEKDAYS_SHORT_SAT_FIRST = [
  'س', // السبت
  'ح', // الأحد
  'ن', // الإثنين
  'ث', // الثلاثاء
  'ر', // الأربعاء
  'خ', // الخميس
  'ج', // الجمعة
] as const;

interface DatePickerProps {
  value?: Date | null;
  onChange?: (next: Date | null) => void;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** ISO date string (YYYY-MM-DD) for min boundary. */
  min?: string;
  max?: string;
  /** Per-cell predicate: return `true` to mark a date as unavailable.
   *  Stacks with `min`/`max` — any of them being true disables the cell. */
  isDateDisabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  helper,
  error,
  required,
  disabled,
  min,
  max,
  isDateDisabled,
  placeholder = 'يوم/شهر/سنة',
  className,
}: DatePickerProps): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(value ?? cairoToday());
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  /* Compute the portal popover position based on the trigger's bounding
   * rect. Right-aligned by default (RTL-friendly: popover's end edge =
   * trigger's end edge in LTR; in RTL we still align to the trigger's
   * right edge so the popover extends leftward). Clamps to viewport so
   * it never spills off screen. Flips upward when there isn't enough room
   * below the trigger but there is room above — the common case inside a
   * modal whose body sits in the upper half of the viewport. */
  const computePosition = (): void => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8),
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const needsFlip =
      spaceBelow < POPOVER_HEIGHT_ESTIMATE + POPOVER_GAP &&
      spaceAbove > spaceBelow;
    const top = needsFlip
      ? Math.max(8, rect.top - POPOVER_GAP - POPOVER_HEIGHT_ESTIMATE)
      : rect.bottom + POPOVER_GAP;
    setPosition({ top, left });
  };

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    computePosition();
    const onDocClick = (event: MouseEvent): void => {
      const target = event.target as Node;
      /* Outside-click closes only when the click is outside BOTH the
       * trigger wrapper AND the portaled popover (which is no longer a
       * descendant of the wrapper after createPortal). */
      const inTrigger = wrapperRef.current?.contains(target) ?? false;
      const inPopover = popoverRef.current?.contains(target) ?? false;
      if (!inTrigger && !inPopover) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    /* On scroll/resize, close — repositioning while a click target moves
     * underfoot is worse UX than re-opening. Capture phase catches scroll
     * events from any ancestor (including the table wrapper). */
    const onScroll = (): void => setOpen(false);
    const onResize = (): void => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const todayDate = useMemo(() => cairoToday(), []);
  const configuredMinDate = min ? parseDateOnly(min) : null;
  const minDate =
    configuredMinDate && configuredMinDate.getTime() > todayDate.getTime()
      ? configuredMinDate
      : todayDate;
  const maxDate = max ? parseDateOnly(max) : null;

  return (
    <div ref={wrapperRef} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
          {required && <span aria-hidden className="ms-1 align-middle text-base font-bold leading-none text-terra-500">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            /* border-solid: base.css resets button borders to none. */
            'flex w-full items-center justify-between rounded-md border border-solid bg-surface-card px-3 text-start text-sm transition-colors duration-fast ease-standard',
            'h-9',
            error ? 'border-terra-500' : 'border-ink-200 hover:border-ink-300',
            'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className={cn(value ? 'text-ink-900' : 'text-ink-400')}>
            {value ? formatDate(value) : placeholder}
          </span>
          <Calendar size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
        </button>

        {open &&
          position &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="اختر تاريخاً"
              data-portal-popover="datepicker"
              className="pointer-events-auto rounded-lg border border-border-subtle bg-surface-elevated p-3 shadow-lg"
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: POPOVER_WIDTH,
                /* --z-popover (1050) sits above --z-modal (1000) so the
                 * calendar renders on top when opened from inside a modal.
                 *
                 * `pointer-events-auto` is required because Radix Dialog
                 * (via react-remove-scroll) sets `pointer-events: none`
                 * on <body>, which the portaled popover inherits. Without
                 * the opt-in, clicks on day cells pass through to the
                 * trigger underneath and never reach onSelect. */
                zIndex: 'var(--z-popover)' as unknown as number,
              }}
            >
              <CalendarGrid
                cursor={cursor}
                setCursor={setCursor}
                selected={value ?? null}
                minDate={minDate}
                maxDate={maxDate}
                isDateDisabled={isDateDisabled}
                onSelect={(d) => {
                  onChange?.(d);
                  setOpen(false);
                }}
              />
            </div>,
            document.body,
          )}
      </div>
      {error ? (
        <p className="text-xs text-terra-700">{error}</p>
      ) : helper ? (
        <p className="text-xs text-ink-500">{helper}</p>
      ) : null}
    </div>
  );
}

interface CalendarGridProps {
  cursor: Date;
  setCursor: (d: Date) => void;
  selected: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  minDate?: Date | null;
  maxDate?: Date | null;
  /** Per-cell predicate: return `true` to mark a date as unavailable.
   *  Stacks with `minDate`/`maxDate`. */
  isDateDisabled?: (date: Date) => boolean;
  onSelect: (d: Date) => void;
}

export function CalendarGrid({
  cursor,
  setCursor,
  selected,
  rangeStart,
  rangeEnd,
  minDate,
  maxDate,
  isDateDisabled,
  onSelect,
}: CalendarGridProps): JSX.Element {
  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const todayDate = useMemo(() => cairoToday(), []);
  const monthIndex = cursor.getMonth();
  const year = cursor.getFullYear();

  const isInRange = (d: Date): boolean => {
    if (!rangeStart || !rangeEnd) return false;
    const t = stripTime(d).getTime();
    return t >= stripTime(rangeStart).getTime() && t <= stripTime(rangeEnd).getTime();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="rounded-md p-1 text-ink-500 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
          aria-label="الشهر السابق"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
        <span className="text-sm font-bold text-ink-900">
          {ARABIC_MONTHS[monthIndex]}{' '}
          <span className="font-numeric tnum" dir="ltr">
            {year}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="rounded-md p-1 text-ink-500 hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
          aria-label="الشهر التالي"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-2xs text-ink-500">
        {ARABIC_WEEKDAYS_SAT_FIRST.map((full, i) => (
          <span
            key={full}
            className="flex h-6 items-center justify-center"
            title={full}
            aria-label={full}
          >
            {ARABIC_WEEKDAYS_SHORT_SAT_FIRST[i]}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <span key={i} className="block h-9 w-9" />;
          const sel =
            selected && stripTime(selected).getTime() === stripTime(cell).getTime();
          const start =
            rangeStart && stripTime(rangeStart).getTime() === stripTime(cell).getTime();
          const end = rangeEnd && stripTime(rangeEnd).getTime() === stripTime(cell).getTime();
          const inRange = isInRange(cell);
          const isToday = stripTime(todayDate).getTime() === stripTime(cell).getTime();
          const disabled =
            (minDate && stripTime(cell).getTime() < stripTime(minDate).getTime()) ||
            (maxDate && stripTime(cell).getTime() > stripTime(maxDate).getTime()) ||
            (isDateDisabled ? isDateDisabled(cell) : false);
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onSelect(cell)}
              disabled={Boolean(disabled)}
              aria-pressed={Boolean(sel || start || end)}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md font-numeric tnum text-sm transition-colors duration-fast ease-standard',
                'hover:bg-teal-50',
                disabled && 'cursor-not-allowed text-ink-300 hover:bg-transparent',
                isToday && !sel && !start && !end && !inRange && 'ring-1 ring-inset ring-teal-500 font-semibold text-teal-700',
                inRange && !sel && !start && !end && 'bg-teal-50 text-teal-700',
                (sel || start || end) && 'bg-teal-500 text-white hover:bg-teal-600',
              )}
            >
              <span dir="ltr">{cell.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildMonthCells(d: Date): (Date | null)[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  // JS getDay: 0 Sun..6 Sat. We want Saturday-first → Sat=0..Fri=6.
  const startCol = (first.getDay() + 1) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startCol; i += 1) cells.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(new Date(d.getFullYear(), d.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return stripTime(new Date(value));
  return new Date(year, month - 1, day);
}

/**
 * Returns a local-time Date whose Y/M/D match the current calendar day
 * in Africa/Cairo, regardless of the browser's local timezone. The cells
 * built by `buildMonthCells` are local-time Dates, so comparing a
 * Cairo-anchored "today" against them via Y/M/D works correctly even
 * when the user's browser is set to a different zone.
 */
export function cairoToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'));
}

function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
