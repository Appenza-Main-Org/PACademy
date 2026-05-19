/**
 * ColumnFilter — per-column filter UI for DataTable.
 *
 * Built on Radix Popover (Popper positioning, focus trap, outside-click,
 * Esc-close) per CLAUDE.md §2.5. Four filter shapes:
 *   - text:        contains-match on a string accessor
 *   - number:      inclusive min/max range
 *   - date:        inclusive from/to range on an ISO date or timestamp
 *   - enum:        multi-select from a fixed option list
 *
 * State is owned by DataTable and threaded in here as `value` +
 * `onChange`. Funnel trigger flips accent + dot indicator when active.
 */

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Popover } from '../Popover';
import { Button } from '../Button';

export type ColumnFilterKind = 'text' | 'number' | 'date' | 'enum';

export interface ColumnFilterOption {
  value: string;
  label: ReactNode;
}

export type ColumnFilterConfig<TRow> =
  | {
      kind: 'text';
      getValue: (row: TRow) => string | null | undefined;
      placeholder?: string;
    }
  | {
      kind: 'number';
      getValue: (row: TRow) => number | null | undefined;
    }
  | {
      kind: 'date';
      /** Returns ISO date string, ms timestamp, or Date. */
      getValue: (row: TRow) => string | number | Date | null | undefined;
    }
  | {
      kind: 'enum';
      /** Returns one value or a list of values (e.g. roles[]). */
      getValue: (row: TRow) => string | readonly string[] | null | undefined;
      options: readonly ColumnFilterOption[];
    };

export interface TextFilterValue {
  kind: 'text';
  contains: string;
}
export interface NumberFilterValue {
  kind: 'number';
  min: number | null;
  max: number | null;
}
export interface DateFilterValue {
  kind: 'date';
  from: string | null;
  to: string | null;
}
export interface EnumFilterValue {
  kind: 'enum';
  values: readonly string[];
}

export type ColumnFilterValue =
  | TextFilterValue
  | NumberFilterValue
  | DateFilterValue
  | EnumFilterValue;

export function emptyFilterValue(kind: ColumnFilterKind): ColumnFilterValue {
  switch (kind) {
    case 'text':
      return { kind: 'text', contains: '' };
    case 'number':
      return { kind: 'number', min: null, max: null };
    case 'date':
      return { kind: 'date', from: null, to: null };
    case 'enum':
      return { kind: 'enum', values: [] };
  }
}

export function isFilterActive(value: ColumnFilterValue | undefined): boolean {
  if (!value) return false;
  switch (value.kind) {
    case 'text':
      return value.contains.trim() !== '';
    case 'number':
      return value.min !== null || value.max !== null;
    case 'date':
      return value.from !== null || value.to !== null;
    case 'enum':
      return value.values.length > 0;
  }
}

function toMs(v: string | number | Date | null | undefined): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function rowPassesFilter<TRow>(
  row: TRow,
  filter: ColumnFilterConfig<TRow>,
  value: ColumnFilterValue,
): boolean {
  switch (value.kind) {
    case 'text': {
      const needle = value.contains.trim().toLowerCase();
      if (!needle) return true;
      const raw = (filter as Extract<ColumnFilterConfig<TRow>, { kind: 'text' }>).getValue(row);
      return String(raw ?? '').toLowerCase().includes(needle);
    }
    case 'number': {
      const raw = (filter as Extract<ColumnFilterConfig<TRow>, { kind: 'number' }>).getValue(row);
      if (raw == null) return value.min === null && value.max === null;
      if (value.min !== null && raw < value.min) return false;
      if (value.max !== null && raw > value.max) return false;
      return true;
    }
    case 'date': {
      const raw = (filter as Extract<ColumnFilterConfig<TRow>, { kind: 'date' }>).getValue(row);
      const ms = toMs(raw ?? null);
      if (ms === null) return value.from === null && value.to === null;
      if (value.from !== null) {
        const fromMs = Date.parse(value.from);
        if (Number.isFinite(fromMs) && ms < fromMs) return false;
      }
      if (value.to !== null) {
        const toEnd = Date.parse(value.to + 'T23:59:59.999');
        if (Number.isFinite(toEnd) && ms > toEnd) return false;
      }
      return true;
    }
    case 'enum': {
      if (value.values.length === 0) return true;
      const raw = (filter as Extract<ColumnFilterConfig<TRow>, { kind: 'enum' }>).getValue(row);
      const selected = new Set<string>(value.values);
      if (raw == null) return false;
      if (Array.isArray(raw)) {
        return raw.some((v) => selected.has(String(v)));
      }
      return selected.has(String(raw));
    }
  }
}

interface ColumnFilterTriggerProps<TRow> {
  /** Arabic label for the column — used in the popover heading + aria. */
  columnLabel: string;
  filter: ColumnFilterConfig<TRow>;
  value: ColumnFilterValue | undefined;
  onChange: (next: ColumnFilterValue | undefined) => void;
}

export function ColumnFilterTrigger<TRow>({
  columnLabel,
  filter,
  value,
  onChange,
}: ColumnFilterTriggerProps<TRow>): JSX.Element {
  const headingId = useId();
  const active = isFilterActive(value);
  const current = value ?? emptyFilterValue(filter.kind);

  const clear = (): void => onChange(undefined);

  return (
    <Popover>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`فلتر ${columnLabel}${active ? ' (مفعّل)' : ''}`}
          className={cn(
            'relative inline-flex h-5 w-5 items-center justify-center rounded-sm',
            'text-ink-400 transition-colors duration-fast ease-standard',
            'hover:bg-ink-100 hover:text-ink-700',
            'focus-visible:outline-none focus-visible:shadow-focus-teal',
            active && 'text-[var(--accent-600)]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter size={12} strokeWidth={1.75} aria-hidden />
          {active && (
            <span
              aria-hidden
              className="absolute -top-0.5 -end-0.5 h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent-600)' }}
            />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content
        align="end"
        side="bottom"
        className="w-72"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <p id={headingId} className="text-xs font-medium text-ink-700">
            تصفية حسب: {columnLabel}
          </p>
          {active && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-terra-700 hover:bg-terra-50 focus-visible:outline-none focus-visible:shadow-focus-terra"
            >
              <X size={11} strokeWidth={2} />
              مسح
            </button>
          )}
        </div>
        <FilterBody filter={filter} value={current} onChange={onChange} />
      </Popover.Content>
    </Popover>
  );
}

interface FilterBodyProps<TRow> {
  filter: ColumnFilterConfig<TRow>;
  value: ColumnFilterValue;
  onChange: (next: ColumnFilterValue | undefined) => void;
}

function FilterBody<TRow>({ filter, value, onChange }: FilterBodyProps<TRow>): JSX.Element {
  if (filter.kind === 'text' && value.kind === 'text') {
    return (
      <input
        type="search"
        autoFocus
        value={value.contains}
        placeholder={filter.placeholder ?? 'يحتوي على…'}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next.trim() === '' ? undefined : { kind: 'text', contains: next });
        }}
        className="h-9 w-full rounded-md border border-border-default bg-surface-card px-3 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
      />
    );
  }
  if (filter.kind === 'number' && value.kind === 'number') {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-2xs text-ink-500">
          أقل قيمة
          <input
            type="number"
            inputMode="numeric"
            value={value.min ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              const min = v === '' ? null : Number(v);
              const next: NumberFilterValue = { ...value, min: Number.isFinite(min ?? NaN) ? min : null };
              const empty = next.min === null && next.max === null;
              onChange(empty ? undefined : next);
            }}
            className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm font-numeric tnum focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs text-ink-500">
          أقصى قيمة
          <input
            type="number"
            inputMode="numeric"
            value={value.max ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              const max = v === '' ? null : Number(v);
              const next: NumberFilterValue = { ...value, max: Number.isFinite(max ?? NaN) ? max : null };
              const empty = next.min === null && next.max === null;
              onChange(empty ? undefined : next);
            }}
            className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm font-numeric tnum focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            dir="ltr"
          />
        </label>
      </div>
    );
  }
  if (filter.kind === 'date' && value.kind === 'date') {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-2xs text-ink-500">
          من تاريخ
          <input
            type="date"
            value={value.from ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const next: DateFilterValue = { ...value, from: v === '' ? null : v };
              const empty = next.from === null && next.to === null;
              onChange(empty ? undefined : next);
            }}
            className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            dir="ltr"
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs text-ink-500">
          إلى تاريخ
          <input
            type="date"
            value={value.to ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              const next: DateFilterValue = { ...value, to: v === '' ? null : v };
              const empty = next.from === null && next.to === null;
              onChange(empty ? undefined : next);
            }}
            className="h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
            dir="ltr"
          />
        </label>
      </div>
    );
  }
  if (filter.kind === 'enum' && value.kind === 'enum') {
    return <EnumFilterList options={filter.options} value={value} onChange={onChange} />;
  }
  return <></>;
}

function EnumFilterList({
  options,
  value,
  onChange,
}: {
  options: readonly ColumnFilterOption[];
  value: EnumFilterValue;
  onChange: (next: ColumnFilterValue | undefined) => void;
}): JSX.Element {
  const [term, setTerm] = useState('');
  const selected = new Set(value.values);
  const needle = term.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => {
        const lbl = typeof o.label === 'string' ? o.label : o.value;
        return lbl.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle);
      })
    : options;

  const toggle = (val: string): void => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    const arr = Array.from(next);
    onChange(arr.length === 0 ? undefined : { kind: 'enum', values: arr });
  };

  return (
    <div className="flex flex-col gap-2">
      {options.length > 8 && (
        <input
          type="search"
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث في الخيارات…"
          className="h-8 w-full rounded-md border border-border-default bg-surface-card px-2 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
        />
      )}
      <ul role="listbox" aria-multiselectable className="max-h-56 overflow-auto">
        {filtered.length === 0 && (
          <li className="px-2 py-3 text-center text-2xs text-ink-500">لا توجد خيارات مطابقة</li>
        )}
        {filtered.map((opt) => {
          const checked = selected.has(opt.value);
          return (
            <li key={opt.value}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-teal-50',
                  checked && 'font-medium text-teal-700',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="h-4 w-4 cursor-pointer accent-teal-500"
                />
                <span className="flex-1 min-w-0 truncate">{opt.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {value.values.length > 0 && (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
            leadingIcon={<X size={12} strokeWidth={1.75} />}
          >
            مسح التحديد
          </Button>
        </div>
      )}
    </div>
  );
}
