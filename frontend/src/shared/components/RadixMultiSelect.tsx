/**
 * RadixMultiSelect — Radix-based searchable multi-select with chips.
 *
 * Built on `@radix-ui/react-popover` plus a hand-rolled checkable list
 * with Arabic-aware filtering via `normalizeArabic()`. Picks up the
 * popper-positioning, focus-trap, dismiss-on-outside-click, and
 * Esc-close behaviours from Radix so we don't reimplement them here.
 *
 * Why a new component (vs. extending the existing `MultiSelect`)?
 *
 *  The existing `MultiSelect` is a hand-rolled portal that ships
 *  `centered` mode, sticky group headers, custom wheel handling, and
 *  ~500 lines of consumers. CLAUDE.md §2.5 mandates Radix primitives for
 *  focus management + popper positioning, so the role picker gets a
 *  Radix-built sibling. The legacy `MultiSelect` keeps serving the rest
 *  of the codebase until a follow-up migrates everyone.
 *
 * Behaviour
 * ---------
 *  • search input always visible at top of the dropdown
 *  • arrow keys move highlight; Enter toggles; Esc closes; Home/End jump
 *  • outside-click closes (Radix Popover)
 *  • chip cluster on trigger with per-chip × remove
 *  • trigger has a "مسح الكل" tail button when ≥1 value picked
 *  • Arabic-aware filtering (normalizeArabic)
 *  • announces filter results via aria-live
 */

import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { normalizeArabic } from '@/shared/lib/arabic';
import {
  dropdownChevronClassName,
  dropdownChipClassName,
  dropdownContentClassName,
  dropdownOptionClassName,
  dropdownSearchInputClassName,
  dropdownTriggerClassName,
} from './dropdownStyles';

export interface RadixMultiSelectOption {
  value: string;
  label: string;
  /** Optional leading icon (16px). */
  icon?: ReactNode;
  /** Searchable extra text not rendered in the row. */
  keywords?: string;
  disabled?: boolean;
}

interface RadixMultiSelectProps {
  value: readonly string[];
  onChange: (next: string[]) => void;
  options: readonly RadixMultiSelectOption[];
  placeholder?: string;
  /** Required for screen readers when there's no visible label. */
  ariaLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

export function RadixMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'اختر…',
  ariaLabel,
  disabled,
  invalid,
  className,
  searchPlaceholder = 'بحث…',
  emptyText = 'لا توجد نتائج مطابقة',
}: RadixMultiSelectProps): JSX.Element {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));

  const filtered = useMemo(() => {
    const needle = normalizeArabic(term);
    if (!needle) return options;
    return options.filter((o) => {
      const hay = `${normalizeArabic(o.label)} ${normalizeArabic(o.keywords ?? '')}`;
      return hay.includes(needle);
    });
  }, [options, term]);

  function toggle(opt: RadixMultiSelectOption): void {
    if (opt.disabled) return;
    const next = new Set(selectedSet);
    if (next.has(opt.value)) next.delete(opt.value);
    else next.add(opt.value);
    onChange(Array.from(next));
  }

  function clearAll(): void {
    onChange([]);
  }

  function handleKey(event: React.KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) toggle(opt);
    }
  }

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTerm('');
      }}
    >
      <RadixPopover.Trigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={dropdownTriggerClassName({ invalid, multiline: true, className })}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1">
          {selectedOptions.length === 0 ? (
            <span className="text-ink-400">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className={dropdownChipClassName()}
              >
                {opt.label}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`إزالة ${opt.label}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(opt);
                  }}
                  className="-mx-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm hover:bg-[var(--accent-100)]"
                >
                  <X size={11} strokeWidth={2} aria-hidden />
                </span>
              </span>
            ))
          )}
        </span>
        {selectedOptions.length > 0 && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="مسح الكل"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              clearAll();
            }}
            className="me-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X size={13} strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            dropdownChevronClassName(),
          )}
        />
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={4}
          dir="rtl"
          className={cn(
            'z-dropdown w-max min-w-48',
            dropdownContentClassName('p-2'),
          )}
          style={{
            animation: 'pageEnter var(--duration-fast) var(--ease-standard)',
            minWidth: 'var(--radix-popover-trigger-width)',
            maxWidth: 'min(calc(100vw - 2rem), 24rem)',
            maxHeight: 'var(--radix-popover-content-available-height)',
            overflow: 'hidden',
          }}
        >
          <label className="relative flex h-9 flex-none items-center gap-2">
            <Search size={14} className="absolute start-3 text-ink-400" aria-hidden />
            <input
              type="text"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKey}
              placeholder={searchPlaceholder}
              className={dropdownSearchInputClassName()}
              autoFocus
              aria-controls={listboxId}
            />
          </label>

          {selectedOptions.length > 0 && (
            <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-1 text-2xs text-ink-500">
              <span>
                <span className="font-numeric tnum">{selectedOptions.length}</span> محدّد
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  clearAll();
                }}
                className="rounded-sm px-1.5 py-0.5 text-2xs font-medium text-terra-700 transition-colors duration-fast ease-standard hover:bg-terra-50 focus-visible:outline-none focus-visible:shadow-[var(--ring)]"
              >
                مسح الكل
              </button>
            </div>
          )}

          <div className="mt-1 max-h-64 min-h-0 flex-1 overflow-auto" aria-live="polite">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-400">{emptyText}</p>
            ) : (
              <ul
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-multiselectable="true"
                aria-label={ariaLabel ?? 'options'}
                className="space-y-0.5"
              >
                {filtered.map((opt, idx) => {
                  const isSelected = selectedSet.has(opt.value);
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        toggle(opt);
                      }}
                      className={dropdownOptionClassName({
                        active: isActive,
                        selected: isSelected,
                        disabled: opt.disabled,
                      })}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                          isSelected
                            ? 'border-[var(--accent-500)] bg-[var(--accent-500)] text-white'
                            : 'border-border-strong',
                        )}
                        aria-hidden
                      >
                        {isSelected && <Check size={11} strokeWidth={2.4} />}
                      </span>
                      {opt.icon && <span className="flex h-4 w-4 items-center justify-center">{opt.icon}</span>}
                      <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
