/**
 * MultiSelect — Combobox with multiple selection.
 * Source: Tasks/DESIGN_SYSTEM.md §4.15.
 *
 * Same internal mechanics as Combobox; differences: rendered chips for
 * selections inside the trigger; click-to-remove; check icons toggle
 * membership rather than select-and-close.
 *
 * Usage:
 *   <MultiSelect
 *     options={certificates}
 *     value={selected}
 *     onChange={setSelected}
 *     label="أنواع الشهادات المقبولة"
 *   />
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { ComboboxGroup, ComboboxOption } from './Combobox';

const POPOVER_GAP = 8;

interface MultiSelectProps {
  value?: readonly string[];
  onChange?: (next: string[]) => void;
  options: readonly ComboboxOption[];
  label?: string;
  helper?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
  /** When provided, options are reordered to match this group sequence
   *  and rendered under sticky section headers (same shape as Combobox).
   *  Options without a matching `groupId` sink to the end. */
  groups?: readonly ComboboxGroup[];
  /** When `true`, surfaces "تحديد الكل" / "إلغاء الكل" action buttons in
   *  the popover header. The actions operate on the currently filtered
   *  slice, so search + select-all composes naturally. */
  enableSelectAll?: boolean;
  /** Optional override for the trigger's body. When set, replaces the
   *  chip cluster with a compact summary (e.g. "5 تخصصات مختارة"). The
   *  popover still surfaces full chip semantics, and removal is one click
   *  away inside it. Receives the resolved option list for the picked
   *  values; an empty list signals "no selection — render placeholder". */
  selectionSummary?: (selected: readonly ComboboxOption[]) => ReactNode;
}

export function MultiSelect({
  value = [],
  onChange,
  options,
  label,
  helper,
  error,
  placeholder = 'اختر…',
  disabled,
  required,
  className,
  ariaLabel,
  groups,
  enableSelectAll,
  selectionSummary,
}: MultiSelectProps): JSX.Element {
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
  const valueSet = useMemo(() => new Set(value), [value]);

  /* Portal-anchor: trigger's left edge + width — keeps the dropdown
   * visually attached to the input even after escaping overflow ancestors. */
  const computePosition = (): void => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + POPOVER_GAP, left: rect.left, width: rect.width });
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
    return base
      .map((opt, i) => ({ opt, i, gi: opt.groupId ? order.get(opt.groupId) ?? Infinity : Infinity }))
      .sort((a, b) => (a.gi - b.gi) || (a.i - b.i))
      .map(({ opt }) => opt);
  }, [options, term, grouped, groups]);

  const groupById = useMemo(
    () => (grouped ? new Map(groups!.map((g) => [g.id, g])) : null),
    [grouped, groups],
  );

  const selectedOptions = options.filter((o) => valueSet.has(o.value));

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
  }, [open, position]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggle = (val: string): void => {
    const next = new Set(value);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange?.(Array.from(next));
  };

  /* Select-all / clear-all operate on the currently filtered slice so the
   * search input composes naturally — "filter to faculty X, hit تحديد الكل,
   * clear search" picks every option under that faculty without touching
   * unrelated rows. */
  const filteredValues = useMemo(() => filtered.map((o) => o.value), [filtered]);
  const allFilteredSelected = filteredValues.length > 0
    && filteredValues.every((v) => valueSet.has(v));
  const selectAll = (): void => {
    const next = new Set(value);
    for (const v of filteredValues) next.add(v);
    onChange?.(Array.from(next));
  };
  const clearAll = (): void => {
    const next = new Set(value);
    for (const v of filteredValues) next.delete(v);
    onChange?.(Array.from(next));
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
            'flex min-h-[36px] w-full items-center gap-2 rounded-md border bg-surface-card ps-3 pe-3 py-1.5 text-start text-sm transition-colors duration-fast ease-standard',
            error ? 'border-terra-500' : 'border-ink-200 hover:border-ink-300',
            'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selectionSummary ? (
              selectedOptions.length === 0 ? (
                <span className="text-ink-400">{placeholder}</span>
              ) : (
                <span className="text-sm text-ink-900">
                  {selectionSummary(selectedOptions)}
                </span>
              )
            ) : selectedOptions.length === 0 ? (
              <span className="text-ink-400">{placeholder}</span>
            ) : (
              selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-xs text-teal-700"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(opt.value);
                    }}
                    className="rounded-sm p-0.5 hover:bg-teal-100"
                    aria-label="إزالة"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              ))
            )}
          </span>
          <ChevronDown size={16} strokeWidth={1.75} className="text-ink-500" aria-hidden />
        </button>

        {open && position && createPortal(
          <div
            ref={popoverRef}
            data-portal-popover="multiselect"
            className="rounded-lg border border-border-subtle bg-surface-elevated shadow-lg"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 'var(--z-popover)' as unknown as number,
            }}
          >
            <div className="flex flex-col gap-1.5 border-b border-border-subtle px-3 py-2">
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
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="ابحث…"
                  className="w-full rounded-md border border-transparent bg-ink-50 ps-7 pe-2 py-1 text-sm focus-visible:border-teal-500 focus-visible:bg-surface-card focus-visible:outline-none"
                />
              </div>
              {enableSelectAll && filtered.length > 0 && (
                <div className="flex items-center justify-between text-2xs text-ink-500">
                  <span>
                    {selectedOptions.length > 0
                      ? `محدد: ${selectedOptions.length}`
                      : 'لم يتم اختيار شيء'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectAll(); }}
                      disabled={allFilteredSelected}
                      className={cn(
                        'rounded-sm px-1.5 py-0.5 font-medium',
                        'transition-colors duration-fast ease-standard',
                        'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
                        allFilteredSelected
                          ? 'cursor-not-allowed text-ink-300'
                          : 'text-teal-700 hover:bg-teal-50',
                      )}
                    >
                      تحديد الكل
                    </button>
                    <span aria-hidden className="text-ink-300">·</span>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); clearAll(); }}
                      disabled={selectedOptions.length === 0}
                      className={cn(
                        'rounded-sm px-1.5 py-0.5 font-medium',
                        'transition-colors duration-fast ease-standard',
                        'focus-visible:outline-none focus-visible:shadow-[var(--ring)]',
                        selectedOptions.length === 0
                          ? 'cursor-not-allowed text-ink-300'
                          : 'text-terra-700 hover:bg-terra-50',
                      )}
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>
              )}
            </div>
            <ul
              ref={listRef}
              role="listbox"
              aria-multiselectable="true"
              aria-label={label ?? ariaLabel ?? 'options'}
              className="max-h-[280px] overflow-auto"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-500">لا توجد نتائج</li>
              )}
              {filtered.map((opt, idx) => {
                const checked = valueSet.has(opt.value);
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
                      aria-selected={checked}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggle(opt.value);
                      }}
                      className={cn(
                        'flex h-9 cursor-pointer items-center gap-2 px-3 text-sm hover:bg-teal-50',
                        checked && 'font-medium text-teal-700',
                        opt.disabled && 'cursor-not-allowed text-ink-300',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-sm border',
                          checked ? 'border-teal-500 bg-teal-500 text-white' : 'border-border-strong',
                        )}
                        aria-hidden
                      >
                        {checked && <Check size={11} strokeWidth={2.4} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {opt.badge && (
                        <span className="rounded-pill bg-ink-100 px-2.5 py-1 text-2xs text-ink-700">
                          {opt.badge}
                        </span>
                      )}
                    </li>
                  </Fragment>
                );
              })}
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
    .replace(/[ً-ْ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه');
}
