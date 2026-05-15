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
import { createPortal } from 'react-dom';
import { Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { CalendarGrid } from './DatePicker';

const POPOVER_GAP = 8;
/* Estimated popover width on md+ (two month grids side-by-side + quick-range
 * chips column + padding/gaps). Used to clamp the left position so the
 * popover never spills off the viewport's start edge — the trigger is often
 * in the last column of an RTL filter row, where simple right-edge anchoring
 * overflows leftward. Mobile collapses to a single column via `md:flex-row`
 * so the narrower estimate is used below md. */
const POPOVER_WIDTH_DESKTOP = 720;
const POPOVER_WIDTH_MOBILE = 320;
const POPOVER_HEIGHT_ESTIMATE = 360;

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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [cursor, setCursor] = useState<Date>(value?.start ?? new Date());
  const [draftStart, setDraftStart] = useState<Date | null>(value?.start ?? null);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value?.end ?? null);

  /* Anchor the popover's right edge to the trigger's right edge (the start
   * edge in RTL) and clamp its left edge to the viewport so it never spills
   * off the screen. Use a static width estimate per breakpoint; the popover
   * also carries a `maxWidth: calc(100vw - 16px)` belt so any underestimate
   * just compresses gracefully instead of overflowing. Flip upward when
   * there isn't room below — same logic as DatePicker. */
  const computePosition = (): void => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const estimatedWidth = isMobile
      ? Math.min(POPOVER_WIDTH_MOBILE, window.innerWidth - 16)
      : POPOVER_WIDTH_DESKTOP;
    const desiredLeft = rect.right - estimatedWidth;
    const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - estimatedWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const needsFlip =
      spaceBelow < POPOVER_HEIGHT_ESTIMATE + POPOVER_GAP && spaceAbove > spaceBelow;
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
      const inTrigger = wrapperRef.current?.contains(target) ?? false;
      const inPopover = popoverRef.current?.contains(target) ?? false;
      if (!inTrigger && !inPopover) {
        commitIfReady();
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    /* Capture-phase scroll listener catches scroll from any clipping
     * ancestor (table wrapper, sticky shells, etc.). */
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
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-surface-card px-3 text-start text-sm transition-colors duration-fast ease-standard',
          error ? 'border-terra-500' : 'border-ink-200 hover:border-ink-300',
          'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn(value?.start && value?.end ? 'text-ink-900' : 'text-ink-400')}>
          {display}
        </span>
        <Calendar size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
      </button>

      {open && position && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="اختر فترة"
          data-portal-popover="daterangepicker"
          className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-elevated p-3 shadow-lg md:flex-row"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            maxWidth: 'calc(100vw - 16px)',
            zIndex: 'var(--z-popover)' as unknown as number,
          }}
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
        </div>,
        document.body,
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
