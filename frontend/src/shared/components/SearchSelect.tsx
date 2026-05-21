/**
 * SearchSelect — Radix-based searchable single-select dropdown.
 *
 * Built on `@radix-ui/react-popover` plus a hand-rolled list with
 * Arabic-aware filtering via `normalizeArabic()` from `@/shared/lib/arabic`.
 *
 * The brief named this "Combobox.tsx", but a Combobox already ships in
 * `shared/components/Combobox.tsx` (consumed by `MultiSelect`). Renaming it
 * would force a downstream migration this task is explicitly told not to do
 * (Phase 2B intro: "Do NOT migrate any existing screen to use the new
 * components in this task"). The Radix version therefore lives alongside the
 * legacy one as `SearchSelect`. A follow-up task can retire the legacy
 * implementation and rename — see RADIX_ADOPTION_REPORT.md.
 *
 * Behaviour
 * ---------
 *  • search input is always visible at the top of the dropdown
 *  • arrow keys move highlight; Enter selects; Esc closes; Home/End jump
 *  • outside-click closes (Radix Popover)
 *  • Arabic normalization on the search term (alef variants, ya/alef-maqsura,
 *    ta-marbuta → ha, diacritics stripped, case-insensitive)
 *  • announces filter results via `aria-live`
 *
 * Visual
 * ------
 *  • trigger styled like a button.secondary (matches existing Select height)
 *  • dropdown surface-elevated, shadow-md, rounded-lg
 *  • selected row marked with check at the end-edge
 *  • highlighted row uses `var(--accent-50)` background — picks up data-app
 *
 * Usage
 * -----
 *   const [gov, setGov] = useState<string | null>(null);
 *   <SearchSelect
 *     value={gov}
 *     onChange={setGov}
 *     options={GOVERNORATES}
 *     placeholder="اختر المحافظة"
 *     ariaLabel="المحافظة"
 *   />
 */

import { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { normalizeArabic } from '@/shared/lib/arabic';
import {
  dropdownChevronClassName,
  dropdownContentClassName,
  dropdownOptionClassName,
  dropdownSearchInputClassName,
  dropdownTriggerClassName,
} from './dropdownStyles';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Optional leading icon (16px). */
  icon?: ReactNode;
  /** Searchable extra text not rendered in the row (e.g. English alias). */
  keywords?: string;
  disabled?: boolean;
}

interface SearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: readonly SearchSelectOption[];
  placeholder?: string;
  /** Required for screen readers when there's no visible label. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Render the trigger in error state (matches Input's error chrome:
   *  terra-500 border + terra focus shadow). Mirrors Input's `error`-driven
   *  visual state — not bound to validity automatically; consumers pass it
   *  alongside the same flag they already render on the surrounding `Field`. */
  invalid?: boolean;
  className?: string;
  /** Search input placeholder (defaults to Arabic "بحث..."). */
  searchPlaceholder?: string;
  /** Empty-state copy when filtering yields no matches. */
  emptyText?: string;
}

export function SearchSelect({
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
}: SearchSelectProps): JSX.Element {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const needle = normalizeArabic(term);
    if (!needle) return options;
    return options.filter((o) => {
      const hay = `${normalizeArabic(o.label)} ${normalizeArabic(o.keywords ?? '')}`;
      return hay.includes(needle);
    });
  }, [options, term]);

  function commit(opt: SearchSelectOption): void {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setTerm('');
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
      if (opt) commit(opt);
    }
  }

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTerm('');
        else setActiveIndex(Math.max(0, filtered.findIndex((o) => o.value === value)));
      }}
    >
      {/* Trigger chrome mirrors `<Input>` verbatim (height, border, padding,
          hover, focus, disabled, error) so a SearchSelect inside `<Field>` is
          visually indistinguishable from an `<Input>` sibling. The single
          divergence is the absolute end-edge chevron — same pattern Input uses
          for trailingIcon (`pe-9` reserves the space). When the popover is
          open, the trigger keeps the focused-style chrome via `data-[state=open]`
          so it doesn't read as "off" while the menu is showing. */}
      <RadixPopover.Trigger
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={dropdownTriggerClassName({ invalid, className })}
      >
        <span className={cn('block flex-1 truncate', !selected && 'text-ink-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={dropdownChevronClassName()}
        />
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={4}
          dir="rtl"
          className={cn(
            /* Width: at least the trigger, grows with longest option label,
               capped at 24rem (or viewport - 2rem) so long Arabic committee
               names like "اللجنة الأولى قسم خاص (طالبات)" stay readable in
               narrow grid columns without overflowing the viewport. */
            'w-max min-w-48',
            dropdownContentClassName('p-2'),
          )}
          style={{
            animation: 'pageEnter var(--duration-fast) var(--ease-standard)',
            /* --z-popover (1050) sits above --z-modal (1000) so the option
             * list renders on top when SearchSelect is opened from inside a
             * Dialog/Drawer. The earlier `z-dropdown` (200) sat below
             * `--z-modal`, which hid the list behind the move-day dialog on
             * /admin/committees-exam-config. */
            zIndex: 'var(--z-popover)' as unknown as number,
            minWidth: 'var(--radix-popover-trigger-width)',
            maxWidth: 'min(calc(100vw - 2rem), 24rem)',
            /* Clamp to whatever vertical space Radix Popper picked. Without
               this the popover renders at full content height and clips off
               the top of the viewport when flipped above a near-bottom
               trigger (iPad portrait on Stage 4 was the original repro). */
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

          <div className="mt-2 max-h-64 min-h-0 flex-1 overflow-auto" aria-live="polite">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-400">{emptyText}</p>
            ) : (
              <ul ref={listRef} id={listboxId} role="listbox" className="space-y-0.5">
                {filtered.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIndex;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault(); /* keep focus on input */
                        commit(opt);
                      }}
                      className={dropdownOptionClassName({
                        active: isActive,
                        selected: isSelected,
                        disabled: opt.disabled,
                      })}
                    >
                      {opt.icon && <span className="flex h-4 w-4 items-center justify-center">{opt.icon}</span>}
                      <span className="flex-1 min-w-0 truncate">{opt.label}</span>
                      {isSelected && <Check size={14} className="text-[var(--accent-600)] shrink-0" aria-hidden />}
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
