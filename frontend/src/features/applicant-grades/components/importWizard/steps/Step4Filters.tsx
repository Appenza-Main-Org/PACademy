/**
 * Step 4 — تصفية القيم.
 *
 * For every mapped source column the wizard renders a card showing the
 * distinct value count + a Popover with a checkbox tree of every value
 * (capped at 200; the remainder is gated behind a "+N قيمة أخرى" link
 * that expands the list).
 *
 * The "ستُستورد X من Y" counter at the top updates live as the admin
 * toggles values — driven by `countFiltered`. Default mode for every
 * column is `all`; switching to `include` only after the admin actively
 * uses the filter UI.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Filter as FilterIcon } from 'lucide-react';
import { Button, Popover } from '@/shared/components';
import { useImportWizardStore, type FilterState } from '../../../store/importWizard.store';
import { TARGET_FIELDS } from '../../../lib/targetFields';
import { countFiltered, distinctValues } from '../../../lib/normalise';

const COLUMN_VALUE_CAP = 200;

export function Step4Filters(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const setFilter = useImportWizardStore((s) => s.setFilter);

  const table = useMemo(
    () => parsed?.tables.find((t) => t.name === selectedTableName) ?? null,
    [parsed, selectedTableName],
  );

  const mappedColumns = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ targetLabel: string; column: string }> = [];
    for (const d of TARGET_FIELDS) {
      const c = mapping[d.key];
      if (c && !seen.has(c)) {
        out.push({ targetLabel: d.labelAr, column: c });
        seen.add(c);
      }
    }
    return out;
  }, [mapping]);

  const filteredCount = useMemo(
    () => (table ? countFiltered(table, filters) : 0),
    [table, filters],
  );
  const totalCount = table?.rowCount ?? 0;

  if (!table) {
    return (
      <div className="rounded-md border border-border-subtle bg-white p-6 text-sm text-ink-500">
        لا توجد بيانات متاحة للتصفية.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
        ستُستورد{' '}
        <strong className="font-en font-bold">
          {filteredCount.toLocaleString('en')}
        </strong>{' '}
        من{' '}
        <strong className="font-en font-bold">
          {totalCount.toLocaleString('en')}
        </strong>{' '}
        صفًا بعد التصفية.
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {mappedColumns.map(({ targetLabel, column }) => {
          const state: FilterState = filters[column] ?? { mode: 'all', values: [] };
          const values = distinctValues(table, column);
          const totalValues = values.length;
          return (
            <li key={column}>
              <FilterCard
                targetLabel={targetLabel}
                column={column}
                state={state}
                values={values}
                totalValues={totalValues}
                onChange={(next) => setFilter(column, next)}
              />
            </li>
          );
        })}
        {mappedColumns.length === 0 && (
          <li className="rounded-md border border-dashed border-border-default bg-white px-4 py-6 text-center text-sm text-ink-500">
            لا توجد أعمدة مربوطة بعد. ارجع للخطوة السابقة لربط الأعمدة.
          </li>
        )}
      </ul>
    </div>
  );
}

interface FilterCardProps {
  targetLabel: string;
  column: string;
  state: FilterState;
  values: ReadonlyArray<{ value: string; count: number }>;
  totalValues: number;
  onChange: (next: FilterState) => void;
}

function FilterCard({
  targetLabel,
  column,
  state,
  values,
  totalValues,
  onChange,
}: FilterCardProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const slice = showAll ? values : values.slice(0, COLUMN_VALUE_CAP);
  const isInclude = state.mode === 'include';
  const selected = new Set(state.values);

  function toggleMode(): void {
    onChange(
      isInclude
        ? { mode: 'all', values: [] }
        : { mode: 'include', values: values.map((v) => v.value) },
    );
  }
  function toggleValue(v: string): void {
    if (state.mode !== 'include') return;
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange({ mode: 'include', values: Array.from(next) });
  }

  return (
    <article className="overflow-hidden rounded-md border border-border-subtle bg-white">
      <header className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink-900">{targetLabel}</span>
          <span className="font-mono text-2xs text-ink-500">{column}</span>
        </div>
        <div className="flex items-center gap-2 text-2xs text-ink-500">
          <span>
            <span className="font-en">{totalValues.toLocaleString('en')}</span> قيمة مميزة
          </span>
          <button
            type="button"
            onClick={toggleMode}
            className="cursor-pointer rounded-full border border-border-default bg-white px-2 py-0.5 text-2xs font-medium text-ink-700"
            style={{
              background: isInclude ? 'var(--teal-50)' : '#fff',
              borderColor: isInclude ? 'var(--teal-300)' : 'var(--border-default)',
              color: isInclude ? 'var(--teal-700)' : 'var(--ink-700)',
            }}
          >
            {isInclude ? 'تصفية مفعّلة' : 'الكل'}
          </button>
          {isInclude && (
            <Popover>
              <Popover.Trigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<FilterIcon size={12} strokeWidth={1.75} />}
                  trailingIcon={<ChevronDown size={12} strokeWidth={1.75} />}
                >
                  اختيار القيم
                </Button>
              </Popover.Trigger>
              <Popover.Content className="w-72">
                <div className="mb-2 text-2xs font-semibold uppercase text-ink-500">
                  القيم المسموح بها
                </div>
                <ul className="m-0 flex max-h-72 list-none flex-col gap-px overflow-auto p-0">
                  {slice.map(({ value, count }) => {
                    const checked = selected.has(value);
                    return (
                      <li key={value}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleValue(value)}
                            className="h-3.5 w-3.5 cursor-pointer accent-teal-500"
                          />
                          <span className="flex-1 truncate">{value === '' ? '(فارغ)' : value}</span>
                          <span className="font-en text-2xs text-ink-500">{count}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {totalValues > COLUMN_VALUE_CAP && !showAll && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="mt-2 cursor-pointer border-0 bg-transparent text-2xs text-teal-700 hover:underline"
                  >
                    +{(totalValues - COLUMN_VALUE_CAP).toLocaleString('en')} قيمة أخرى
                  </button>
                )}
              </Popover.Content>
            </Popover>
          )}
        </div>
      </header>
      {isInclude && (
        <footer className="border-t border-border-subtle bg-ink-50 px-3.5 py-1.5 text-2xs text-ink-500">
          <Check size={12} className="me-1 inline-block text-teal-500" aria-hidden />
          <span className="font-en">{state.values.length.toLocaleString('en')}</span> من{' '}
          <span className="font-en">{totalValues.toLocaleString('en')}</span> قيمة مفعّلة
        </footer>
      )}
    </article>
  );
}
