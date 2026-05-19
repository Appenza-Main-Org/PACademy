/**
 * Combobox — searchable dropdown with virtualised list for large option sets.
 * Source: Tasks/DESIGN_SYSTEM.md §4.15.
 *
 * Header inside dropdown: search input (always visible). Item: 36px tall,
 * optional avatar/icon + label + optional badge. Selected: check icon at end.
 *
 * Used for: governorates, certificates, committees, stations, exam categories.
 *
 * Virtualisation kicks in only when options.length > 100 — we render a
 * windowed slice of ~16 visible rows + buffer to avoid pulling in a third
 * party. For <=100 rows we render the full list.
 *
 * Usage:
 *   <Combobox value={gov} onChange={setGov} options={governorates}
 *             label="المحافظة" placeholder="اختر..." />
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

const POPOVER_GAP = 8;

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional badge text rendered at the end-edge of the row. */
  badge?: string;
  /** Optional leading icon. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Searchable extra text not rendered in the row. */
  keywords?: string;
  /** ID of the group this option belongs to. Pair with `groups` prop on
   *  the Combobox to render section headers. */
  groupId?: string;
}

export interface ComboboxGroup {
  id: string;
  label: string;
}

interface ComboboxProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  options: readonly ComboboxOption[];
  label?: string;
  helper?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Fires when the user types in the search input. Useful for async fetch. */
  onSearchChange?: (term: string) => void;
  className?: string;
  /** Optional class names merged onto the trigger `<button>` itself.
   *  Use this when a consumer needs to override sizing / typography /
   *  border on the closed-state control (the outer `className` only
   *  targets the wrapper). */
  triggerClassName?: string;
  ariaLabel?: string;
  /** When provided, options are reordered to match this group sequence and
   *  rendered under sticky section headers. Virtualisation is disabled. */
  groups?: readonly ComboboxGroup[];
  /** Render an inline clear (×) affordance whenever a value is selected.
   *  Clicking it calls `onChange(null)`. Default false so existing
   *  consumers keep their non-clearable behavior. */
  clearable?: boolean;
}

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 8;
const BUFFER = 6;

export function Combobox({
  value,
  onChange,
  options,
  label,
  helper,
  error,
  placeholder = 'اختر…',
  disabled,
  required,
  onSearchChange,
  className,
  triggerClassName,
  ariaLabel,
  groups,
  clearable = false,
}: ComboboxProps): JSX.Element {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<
    { top: number; left: number; width: number } | null
  >(null);
  const [term, setTerm] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  /* Match the trigger's left edge + width so the dropdown looks
   * "anchored" to the input even after we portal it out of the
   * (potentially overflow:hidden) ancestor. If there isn't enough room
   * below the trigger, flip above so the option list stays visible and
   * scrollable inside the viewport. Approx popover height = listbox
   * max-h (16rem ≈ 256px) + search-row chrome (~52px). */
  const computePosition = (): void => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverMaxH = 320;
    const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP;
    const spaceAbove = rect.top - POPOVER_GAP;
    const placeAbove = spaceBelow < popoverMaxH && spaceAbove > spaceBelow;
    const top = placeAbove
      ? Math.max(8, rect.top - POPOVER_GAP - Math.min(popoverMaxH, spaceAbove))
      : rect.bottom + POPOVER_GAP;
    setPosition({ top, left: rect.left, width: rect.width });
  };

  const grouped = groups != null && groups.length > 0;

  const filtered = useMemo(() => {
    const base = !term.trim()
      ? options
      : (() => {
          const needle = normalize(term);
          return options.filter((o) =>
            [o.label, o.value, o.keywords ?? ''].some((s) => normalize(s).includes(needle)),
          );
        })();
    if (!grouped) return base;
    const order = new Map(groups!.map((g, i) => [g.id, i]));
    /* Stable sort by group order; options with no/unknown groupId sink to end. */
    return base
      .map((opt, i) => ({ opt, i, gi: opt.groupId ? order.get(opt.groupId) ?? Infinity : Infinity }))
      .sort((a, b) => (a.gi - b.gi) || (a.i - b.i))
      .map(({ opt }) => opt);
  }, [options, term, grouped, groups]);

  const virtualised = !grouped && filtered.length > 100;
  const totalHeight = filtered.length * ROW_HEIGHT;
  const startIndex = virtualised
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER)
    : 0;
  const endIndex = virtualised
    ? Math.min(filtered.length, startIndex + VISIBLE_ROWS + BUFFER * 2)
    : filtered.length;
  const slice = filtered.slice(startIndex, endIndex);
  const groupById = useMemo(
    () => (grouped ? new Map(groups!.map((g) => [g.id, g])) : null),
    [grouped, groups],
  );

  const selected = options.find((o) => o.value === value) ?? null;

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
      if (!inTrigger && !inPopover) setOpen(false);
    };
    const onScroll = (event: Event): void => {
      // Ignore scrolls originating inside the popover (e.g. the option list).
      // Without this guard the dropdown closes the instant the user scrolls
      // the list of options.
      const target = event.target as Node | null;
      if (popoverRef.current && target && popoverRef.current.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onResize = (): void => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    /* When the popover is portaled into `document.body` while a Radix
     * Dialog is open, the dialog's `react-remove-scroll` wrapper intercepts
     * wheel/touchmove at the document level and calls `preventDefault` for
     * any element outside its tree — which blocks the option list from
     * scrolling. We can't beat its document-bubble listener with a sibling
     * listener reliably (capture-phase stopPropagation isn't enough once
     * the layer is locked), so we drive the scroll ourselves: a non-passive
     * capture-phase wheel listener on the option list manually updates
     * `scrollTop` and calls `preventDefault`. Browser's native scroll never
     * runs, and the dialog's lock has nothing to cancel. */
    const list = listRef.current;
    const onWheel = (event: WheelEvent): void => {
      if (!list) return;
      const canScrollDown = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
      const canScrollUp = list.scrollTop > 0;
      if ((event.deltaY > 0 && canScrollDown) || (event.deltaY < 0 && canScrollUp)) {
        list.scrollTop += event.deltaY;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    list?.addEventListener('wheel', onWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      list?.removeEventListener('wheel', onWheel, true);
    };
    /* `position` is intentionally not in the deps: it's *written* by this
     * effect (computePosition → setPosition). Adding it would make the
     * effect refire after every write, producing a fresh object ref each
     * time and an infinite render loop. The original deps caused the loop
     * to be latent behind a Dialog wrapper; it surfaces when the Combobox
     * mounts inline. */
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commit = (opt: ComboboxOption): void => {
    if (opt.disabled) return;
    onChange?.(opt.value);
    setTerm('');
    /* Return focus to the trigger before unmounting the popover. Otherwise
     * the search input (which had focus) is removed mid-cycle and the
     * browser dumps focus on <body>, which a Radix Dialog ancestor
     * interprets as focusoutside and dismisses itself. */
    triggerRef.current?.focus();
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = filtered[activeIndex] ?? null;
      if (opt) commit(opt);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
          {required && <span className="ms-1 text-terra-500">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-surface-card px-3 text-start text-sm transition-colors duration-fast ease-standard',
            error ? 'border-terra-500' : 'border-border-strong hover:border-ink-400',
            'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
            disabled && 'cursor-not-allowed opacity-60',
            triggerClassName,
          )}
        >
          <span className={cn(selected ? 'truncate text-ink-900' : 'text-ink-400')}>
            {selected?.label ?? placeholder}
          </span>
          <span className="flex items-center gap-1">
            {clearable && selected && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="مسح الاختيار"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange?.(null);
                  }
                }}
                className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-700"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </span>
            )}
            <ChevronDown size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
          </span>
        </button>

        {open && position && createPortal(
          <div
            ref={popoverRef}
            data-portal-popover="combobox"
            className="pointer-events-auto rounded-lg border border-border-subtle bg-surface-elevated shadow-lg"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              /* `pointer-events-auto`: react-remove-scroll (used by Radix
               * Dialog/Sheet) sets `pointer-events: none` on <body>, which
               * the portaled popover inherits — clicks would pass through
               * without this opt-in. */
              zIndex: 'var(--z-popover)' as unknown as number,
            }}
          >
            <div className="border-b border-border-subtle px-3 py-2">
              <div className="relative">
                <Search
                  size={14}
                  strokeWidth={1.75}
                  className="absolute inset-y-0 my-auto text-ink-400"
                  style={{ insetInlineStart: 8 }}
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  type="search"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={`${id}-listbox`}
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    onSearchChange?.(e.target.value);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="ابحث…"
                  className="w-full rounded-md border border-transparent bg-ink-50 ps-7 pe-2 py-1 text-sm focus-visible:border-teal-500 focus-visible:bg-surface-card focus-visible:outline-none"
                />
              </div>
            </div>

            <ul
              ref={listRef}
              id={`${id}-listbox`}
              role="listbox"
              aria-label={label ?? ariaLabel ?? 'options'}
              onScroll={virtualised ? (e) => setScrollTop((e.currentTarget as HTMLUListElement).scrollTop) : undefined}
              className="relative max-h-[16rem] overflow-y-auto"
            >
              {virtualised && <li aria-hidden style={{ height: startIndex * ROW_HEIGHT }} />}
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-500">
                  لا توجد نتائج
                </li>
              )}
              {slice.map((opt, sliceIdx) => {
                const idx = startIndex + sliceIdx;
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                const prev = idx > 0 ? filtered[idx - 1] : null;
                const showHeader =
                  grouped && opt.groupId != null && opt.groupId !== prev?.groupId;
                const headerGroup =
                  showHeader && groupById ? groupById.get(opt.groupId!) : null;
                return (
                  <Fragment key={opt.value}>
                    {headerGroup && (
                      <li
                        role="presentation"
                        className="sticky top-0 z-10 bg-ink-50/95 px-3 py-1 text-2xs font-medium text-ink-500 backdrop-blur"
                      >
                        {headerGroup.label}
                      </li>
                    )}
                    <li
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(opt);
                      }}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-2 px-3 text-sm',
                        isActive && 'bg-teal-50',
                        isSelected && 'font-medium text-teal-700',
                        opt.disabled && 'cursor-not-allowed text-ink-300',
                      )}
                    >
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {opt.badge && (
                        <span className="rounded-pill bg-ink-100 px-2.5 py-1 text-2xs text-ink-700">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} strokeWidth={2} className="text-teal-500" aria-hidden />}
                    </li>
                  </Fragment>
                );
              })}
              {virtualised && (
                <li aria-hidden style={{ height: totalHeight - endIndex * ROW_HEIGHT }} />
              )}
            </ul>
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ْ]/g, '') // strip Arabic harakat
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه');
}
