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

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { ComboboxOption } from './Combobox';

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
}: MultiSelectProps): JSX.Element {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  const filtered = useMemo(() => {
    if (!term.trim()) return options;
    const needle = normalize(term);
    return options.filter((o) =>
      [o.label, o.value, o.keywords ?? ''].some((s) => normalize(s).includes(needle)),
    );
  }, [options, term]);

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
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggle = (val: string): void => {
    const next = new Set(value);
    if (next.has(val)) next.delete(val);
    else next.add(val);
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
            error ? 'border-terra-500' : 'border-border-default hover:border-border-strong',
            'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selectedOptions.length === 0 ? (
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
            className="rounded-lg border border-border-subtle bg-surface-elevated shadow-lg"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 'var(--z-dropdown)' as unknown as number,
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
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="ابحث…"
                  className="w-full rounded-md border border-transparent bg-ink-50 ps-7 pe-2 py-1 text-sm focus-visible:border-teal-500 focus-visible:bg-surface-card focus-visible:outline-none"
                />
              </div>
            </div>
            <ul
              role="listbox"
              aria-multiselectable="true"
              aria-label={label ?? ariaLabel ?? 'options'}
              className="max-h-[280px] overflow-auto"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-500">لا توجد نتائج</li>
              )}
              {filtered.map((opt) => {
                const checked = valueSet.has(opt.value);
                return (
                  <li
                    key={opt.value}
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
