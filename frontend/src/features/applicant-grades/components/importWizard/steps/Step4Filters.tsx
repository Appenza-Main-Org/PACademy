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
import { Check, ChevronDown, Filter as FilterIcon, Search } from 'lucide-react';
import { Button, Popover, SearchSelect } from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { normalizeArabic } from '@/shared/lib/arabic';
import { useLookup } from '@/features/lookups';
import {
  useImportWizardStore,
  type FilterState,
  type LookupValueMappings,
} from '../../../store/importWizard.store';
import { TARGET_FIELDS, type TargetField } from '../../../lib/targetFields';
import { countFiltered, distinctValues } from '../../../lib/normalise';

const COLUMN_VALUE_CAP = 200;

export function Step4Filters(): JSX.Element {
  const parsed = useImportWizardStore((s) => s.parsed);
  const selectedTableName = useImportWizardStore((s) => s.selectedTableName);
  const mapping = useImportWizardStore((s) => s.mapping);
  const filters = useImportWizardStore((s) => s.filters);
  const setFilter = useImportWizardStore((s) => s.setFilter);
  const lookupValueMappings = useImportWizardStore((s) => s.lookupValueMappings);
  const setLookupValueMapping = useImportWizardStore((s) => s.setLookupValueMapping);
  const schoolCategoriesQuery = useLookup('school-categories');
  const examRoundsQuery = useLookup('exam-rounds');

  const table = useMemo(
    () => parsed?.tables.find((t) => t.name === selectedTableName) ?? null,
    [parsed, selectedTableName],
  );

  const mappedColumns = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ targetKey: TargetField; targetLabel: string; column: string }> = [];
    for (const d of TARGET_FIELDS) {
      const c = mapping[d.key];
      if (c && !seen.has(c)) {
        out.push({ targetKey: d.key, targetLabel: d.labelAr, column: c });
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
        {mappedColumns.map(({ targetKey, targetLabel, column }) => {
          const state: FilterState = filters[column] ?? { mode: 'all', values: [] };
          const values = distinctValues(table, column);
          const totalValues = values.length;
          const lookupMapping = buildLookupMapping({
            targetKey,
            lookupValueMappings,
            schoolCategoryOptions: (schoolCategoriesQuery.data ?? [])
              .filter((row) => row.isActive)
              .map((row) => ({ value: row.code, label: row.name })),
            examRoundOptions: (examRoundsQuery.data ?? [])
              .filter((row) => row.isActive)
              .map((row) => ({ value: row.code, label: row.name })),
            onMap: setLookupValueMapping,
          });
          return (
            <li key={column}>
              <FilterCard
                targetLabel={targetLabel}
                column={column}
                state={state}
                values={values}
                totalValues={totalValues}
                lookupMapping={lookupMapping}
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
  lookupMapping: LookupMappingConfig | null;
  onChange: (next: FilterState) => void;
}

interface LookupMappingConfig {
  kind: keyof LookupValueMappings;
  title: string;
  description: string;
  placeholder: string;
  options: SearchSelectOption[];
  valueByRaw: Record<string, string>;
  onMap: (kind: keyof LookupValueMappings, rawValue: string, lookupCode: string | null) => void;
}

function FilterCard({
  targetLabel,
  column,
  state,
  values,
  totalValues,
  lookupMapping,
  onChange,
}: FilterCardProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchedValues = useMemo(() => {
    const needle = normalizeArabic(searchTerm);
    if (!needle) return values;
    return values.filter(({ value }) => normalizeArabic(value || '(فارغ)').includes(needle));
  }, [searchTerm, values]);
  const slice = showAll ? searchedValues : searchedValues.slice(0, COLUMN_VALUE_CAP);
  const isInclude = state.mode === 'include';
  const selected = new Set(isInclude ? state.values : values.map((v) => v.value));
  const selectedCount = selected.size;
  const selectedValues = values.filter(({ value }) => value !== '' && selected.has(value));

  function toggleMode(): void {
    onChange(
      isInclude
        ? { mode: 'all', values: [] }
        : { mode: 'include', values: values.map((v) => v.value) },
    );
  }
  function toggleValue(v: string): void {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    if (next.size === values.length) {
      onChange({ mode: 'all', values: [] });
      return;
    }
    onChange({ mode: 'include', values: Array.from(next) });
  }

  function includeAll(): void {
    onChange({ mode: 'all', values: [] });
  }

  function excludeAll(): void {
    onChange({ mode: 'include', values: [] });
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
            <span className="font-en">{totalValues.toLocaleString('en')}</span> قيمة غير مكررة
          </span>
          <button
            type="button"
            onClick={toggleMode}
            className="cursor-pointer rounded-full border border-border-default bg-white px-2 py-0.5 text-2xs font-medium text-ink-700"
            style={{
              background: isInclude ? 'var(--teal-50)' : 'var(--surface-card)',
              borderColor: isInclude ? 'var(--teal-300)' : 'var(--border-default)',
              color: isInclude ? 'var(--teal-700)' : 'var(--ink-700)',
            }}
          >
            {isInclude ? 'تصفية مفعّلة' : 'الكل'}
          </button>
          <Popover>
            <Popover.Trigger asChild>
              <Button
                size="sm"
                variant="secondary"
                leadingIcon={<FilterIcon size={12} strokeWidth={1.75} />}
                trailingIcon={<ChevronDown size={12} strokeWidth={1.75} />}
              >
                اختيار القيم
              </Button>
            </Popover.Trigger>
            <Popover.Content className="flex w-[min(92vw,28rem)] max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden">
              <div className="mb-3 flex flex-none items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xs font-semibold uppercase text-ink-500">
                    القيم المسموح بها
                  </div>
                  <div className="mt-0.5 text-2xs text-ink-500">
                    <span className="font-en">{selectedCount.toLocaleString('en')}</span> من{' '}
                    <span className="font-en">{totalValues.toLocaleString('en')}</span> محددة
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={includeAll}>
                    اختيار الكل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={excludeAll}>
                    إلغاء اختيار الكل
                  </Button>
                </div>
              </div>
              <label className="relative mb-2 flex h-9 flex-none items-center">
                <Search
                  size={14}
                  strokeWidth={1.75}
                  className="absolute start-3 text-ink-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowAll(false);
                  }}
                  placeholder="ابحث داخل القيم…"
                  className="h-9 w-full rounded-md border border-border-default bg-surface-card ps-9 pe-3 text-sm focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
                />
              </label>
              <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto overscroll-contain p-0 pe-1">
                {slice.map(({ value, count }) => {
                  const checked = selected.has(value);
                  const label = value === '' ? '(فارغ)' : value;
                  return (
                    <li key={value}>
                      <button
                        type="button"
                        onClick={() => toggleValue(value)}
                        className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border-subtle bg-white px-3 py-2 text-start transition-colors hover:border-border-default hover:bg-ink-50 focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-2xs text-ink-500">
                            تكررت{' '}
                            <span className="font-en tabular-nums">
                              {count.toLocaleString('en')}
                            </span>{' '}
                            مرة
                          </span>
                        </span>
                        <span
                          className={`inline-flex min-w-[5.5rem] items-center justify-center rounded-pill border px-2.5 py-1 text-2xs font-medium ${
                            checked
                              ? 'border-teal-300 bg-teal-50 text-teal-700'
                              : 'border-terra-200 bg-terra-50 text-terra-700'
                          }`}
                        >
                          {checked ? 'محدد' : 'مستبعد'}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {slice.length === 0 && (
                  <li className="rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-6 text-center text-sm text-ink-500">
                    لا توجد قيم مطابقة للبحث.
                  </li>
                )}
              </ul>
              {searchedValues.length > COLUMN_VALUE_CAP && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-2 cursor-pointer border-0 bg-transparent text-2xs text-teal-700 hover:underline focus-visible:shadow-focus-teal focus-visible:outline-none"
                >
                  +{(searchedValues.length - COLUMN_VALUE_CAP).toLocaleString('en')} قيمة أخرى
                </button>
              )}
            </Popover.Content>
          </Popover>
        </div>
      </header>
      {isInclude && (
        <footer className="border-t border-border-subtle bg-ink-50 px-3.5 py-1.5 text-2xs text-ink-500">
          <Check size={12} className="me-1 inline-block text-teal-500" aria-hidden />
          <span className="font-en">{state.values.length.toLocaleString('en')}</span> من{' '}
          <span className="font-en">{totalValues.toLocaleString('en')}</span> قيمة مفعّلة
        </footer>
      )}
      {lookupMapping && selectedValues.length > 0 && (
        <LookupValueMappingPanel
          config={lookupMapping}
          values={selectedValues}
        />
      )}
    </article>
  );
}

function buildLookupMapping({
  targetKey,
  lookupValueMappings,
  schoolCategoryOptions,
  examRoundOptions,
  onMap,
}: {
  targetKey: TargetField | undefined;
  lookupValueMappings: LookupValueMappings;
  schoolCategoryOptions: SearchSelectOption[];
  examRoundOptions: SearchSelectOption[];
  onMap: LookupMappingConfig['onMap'];
}): LookupMappingConfig | null {
  if (targetKey === 'schoolCategory') {
    return {
      kind: 'schoolCategory',
      title: 'ربط قيم فئة المدرسة',
      description: 'اختر الكود المرجعي المطابق لكل قيمة واردة من الملف.',
      placeholder: 'اختر فئة المدرسة',
      options: schoolCategoryOptions,
      valueByRaw: lookupValueMappings.schoolCategory,
      onMap,
    };
  }
  if (targetKey === 'examRound') {
    return {
      kind: 'examRound',
      title: 'ربط قيم الدور',
      description: 'اختر دور الامتحان المرجعي المطابق لكل قيمة واردة من الملف.',
      placeholder: 'اختر الدور',
      options: examRoundOptions,
      valueByRaw: lookupValueMappings.examRound,
      onMap,
    };
  }
  return null;
}

function LookupValueMappingPanel({
  config,
  values,
}: {
  config: LookupMappingConfig;
  values: ReadonlyArray<{ value: string; count: number }>;
}): JSX.Element {
  return (
    <div className="border-t border-border-subtle bg-ink-50/50 px-3.5 py-3">
      <div className="mb-2">
        <div className="text-xs font-semibold text-ink-900">{config.title}</div>
        <div className="mt-0.5 text-2xs text-ink-500">{config.description}</div>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
        {values.map(({ value, count }) => (
          <li
            key={value}
            className="grid gap-1.5 rounded-md border border-border-subtle bg-surface-card p-2.5"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-ink-900">{value}</span>
              <span className="shrink-0 text-2xs text-ink-500">
                <span className="font-en tabular-nums">{count.toLocaleString('en')}</span> صف
              </span>
            </div>
            <SearchSelect
              value={config.valueByRaw[value] ?? null}
              onChange={(next) => config.onMap(config.kind, value, next)}
              options={config.options}
              placeholder={config.placeholder}
              ariaLabel={`${config.title}: ${value}`}
              className="h-9"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
