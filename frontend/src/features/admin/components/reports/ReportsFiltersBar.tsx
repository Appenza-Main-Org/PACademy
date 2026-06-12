/**
 * ReportsFiltersBar — global filter toolbar for /admin/reports.
 *
 * Collapsed: a slim sticky command bar (icon tile + scope summary +
 * active-filter count + toggle). Expanded: the card leaves the sticky
 * layer and unfolds into three labelled filter groups (report scope /
 * applicant attributes / committees & payment) with a footer action row.
 * Active filters render as removable chips under the bar in both states.
 */

import { CalendarDays, ChevronDown, ChevronUp, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import { useCommittees } from '@/features/committees';
import { Badge, Button, Card, DateRangePicker, Input, Select, Sheet } from '@/shared/components';
import type { DateRange } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { num } from '@/shared/lib/format';
import { useCycles } from '../../api/cycles.queries';
import { resolveActiveCycle } from '../../api/cycles.service';
import { useReportsFiltersStore } from '../../reports/store';
import type { ReportsFilters } from '../../reports/types';

const APPLICANT_TYPES = [
  { value: '', label: 'الكل' },
  { value: 'civilian', label: 'مدني' },
  { value: 'officer', label: 'ضابط' },
  { value: 'specialized', label: 'متخصص' },
  { value: 'doctorate', label: 'دكتوراه' },
  { value: 'law', label: 'حقوق' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'الكل' },
  { value: 'unpaid', label: 'لم يدفع' },
  { value: 'pending', label: 'قيد الدفع' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'refunded', label: 'مسترد' },
];

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function numberValue(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function without<K extends keyof ReportsFilters>(filters: ReportsFilters, key: K): ReportsFilters {
  const next = { ...filters };
  delete next[key];
  return next;
}

export function ReportsFiltersBar(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cycles = useCycles();
  const categories = useLookup('applicant-categories');
  const specializations = useLookup('specializations');
  const committees = useCommittees();
  const filters = useReportsFiltersStore((state) => state.filters);
  const setFilters = useReportsFiltersStore((state) => state.set);
  const reset = useReportsFiltersStore((state) => state.reset);

  const activeCycle = resolveActiveCycle(cycles.data) ?? cycles.data?.[0];
  const effectiveCycleId = filters.cycleId ?? activeCycle?.id ?? '';
  const selectedCycle = cycles.data?.find((cycle) => cycle.id === effectiveCycleId) ?? activeCycle;

  const openCategoryKeys = useMemo(
    () =>
      Object.entries(selectedCycle?.openCategories ?? {})
        .filter(([, config]) => config?.isOpen === true)
        .map(([key]) => key),
    [selectedCycle?.openCategories],
  );
  const categoryOptions = useMemo(() => {
    const labelsByCode = new Map((categories.data ?? []).map((row) => [row.code, row.name]));
    return [
      { value: '', label: 'الكل' },
      ...openCategoryKeys.map((key) => ({ value: key, label: labelsByCode.get(key) ?? key })),
    ];
  }, [categories.data, openCategoryKeys]);
  const selectedCategoryIsOpen =
    !filters.categoryKey || openCategoryKeys.includes(filters.categoryKey);

  useEffect(() => {
    if (!selectedCategoryIsOpen) {
      setFilters({ categoryKey: undefined });
    }
  }, [selectedCategoryIsOpen, setFilters]);
  const specializationOptions = [
    { value: '', label: 'الكل' },
    ...(specializations.data ?? []).map((row) => ({ value: row.code, label: row.name })),
  ];
  const committeeOptions = [
    { value: 'all', label: 'كل اللجان' },
    ...(committees.data ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];
  const cycleOptions = cycles.data?.length
    ? cycles.data.map((cycle) => ({ value: cycle.id, label: cycle.nameAr }))
    : [{ value: '', label: 'لا توجد دورات' }];

  const dateRange: DateRange | undefined = filters.dateRange
    ? { start: new Date(filters.dateRange.from), end: new Date(filters.dateRange.to) }
    : undefined;

  const chips = useMemo(
    () =>
      [
        filters.dateRange && { key: 'dateRange' as const, label: 'الفترة الزمنية' },
        filters.ageMin !== undefined && { key: 'ageMin' as const, label: `من ${filters.ageMin} سنة` },
        filters.ageMax !== undefined && { key: 'ageMax' as const, label: `حتى ${filters.ageMax} سنة` },
        filters.categoryKey && { key: 'categoryKey' as const, label: 'فئة المتقدم' },
        filters.applicantType && { key: 'applicantType' as const, label: 'نوع المتقدم' },
        filters.gender && { key: 'gender' as const, label: filters.gender === 'male' ? 'ذكور' : 'إناث' },
        filters.committeeId && filters.committeeId !== 'all' && {
          key: 'committeeId' as const,
          label: committees.data?.find((row) => row.id === filters.committeeId)?.name ?? 'لجنة محددة',
        },
        filters.specializationCode && { key: 'specializationCode' as const, label: 'تخصص محدد' },
        filters.paymentStatus && { key: 'paymentStatus' as const, label: 'حالة الدفع' },
      ].filter(Boolean) as Array<{ key: keyof ReportsFilters; label: string }>,
    [filters, committees.data],
  );
  const activeFilterCount = chips.length;
  const filterSummary =
    activeFilterCount > 0
      ? `${activeFilterCount} فلاتر مفعلة`
      : 'لا توجد فلاتر إضافية';

  const controls = (
    <div className="space-y-5">
      <FilterGroup label="نطاق التقرير">
        <div className="grid gap-3 lg:grid-cols-2">
          <Select
            label="الدورة"
            value={effectiveCycleId}
            disabled={!cycles.data?.length}
            options={cycleOptions}
            onChange={(event) => setFilters({ cycleId: event.target.value })}
          />
          <DateRangePicker
            label="الفترة الزمنية"
            value={dateRange}
            onChange={(range) =>
              setFilters({
                dateRange: range.start && range.end ? { from: iso(range.start), to: iso(range.end) } : undefined,
              })
            }
          />
        </div>
      </FilterGroup>

      <FilterGroup label="خصائص المتقدم">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="فئة المتقدم"
            value={filters.categoryKey ?? ''}
            options={categoryOptions}
            onChange={(event) => setFilters({ categoryKey: event.target.value || undefined })}
          />
          <Select
            label="نوع المتقدم"
            value={filters.applicantType ?? ''}
            options={APPLICANT_TYPES}
            onChange={(event) => setFilters({ applicantType: (event.target.value || undefined) as ReportsFilters['applicantType'] })}
          />
          <Select
            label="الجنس"
            value={filters.gender ?? ''}
            options={[
              { value: '', label: 'الكل' },
              { value: 'male', label: 'ذكور' },
              { value: 'female', label: 'إناث' },
            ]}
            onChange={(event) => setFilters({ gender: (event.target.value || undefined) as ReportsFilters['gender'] })}
          />
          <Input
            label="السن من"
            type="number"
            value={filters.ageMin ?? ''}
            onChange={(event) => setFilters({ ageMin: numberValue(event.target.value) })}
          />
          <Input
            label="السن إلى"
            type="number"
            value={filters.ageMax ?? ''}
            onChange={(event) => setFilters({ ageMax: numberValue(event.target.value) })}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="اللجان والدفع">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="اللجنة"
            value={filters.committeeId ?? 'all'}
            options={committeeOptions}
            onChange={(event) => setFilters({ committeeId: event.target.value as ReportsFilters['committeeId'] })}
          />
          <Select
            label="التخصص"
            value={filters.specializationCode ?? ''}
            options={specializationOptions}
            onChange={(event) => setFilters({ specializationCode: event.target.value || undefined })}
          />
          <Select
            label="حالة الدفع"
            value={filters.paymentStatus ?? ''}
            options={PAYMENT_OPTIONS}
            onChange={(event) => setFilters({ paymentStatus: (event.target.value || undefined) as ReportsFilters['paymentStatus'] })}
          />
        </div>
      </FilterGroup>
    </div>
  );

  const footer = (onApply: () => void): JSX.Element => (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
      <p className="text-2xs text-ink-500">
        {activeFilterCount > 0 ? (
          <span className="font-medium text-teal-700">{filterSummary}</span>
        ) : (
          filterSummary
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" leadingIcon={<RotateCcw size={14} />} onClick={reset}>
          إعادة ضبط
        </Button>
        <Button variant="accent" size="sm" leadingIcon={<Search size={14} />} onClick={onApply}>
          تطبيق
        </Button>
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        'mb-5 p-0',
        /* Only the collapsed bar earns the sticky layer — pinning the
         * expanded panel would blanket the dashboard while scrolling. */
        !isExpanded && 'sticky top-3 z-sticky shadow-sm',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-50"
            style={{ background: 'var(--accent-600)' }}
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="m-0 text-sm font-bold text-ink-900">تصفية التقارير</p>
              {activeFilterCount > 0 && (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill px-1 font-numeric tnum text-2xs font-bold text-ink-50"
                  style={{ background: 'var(--accent-500)' }}
                >
                  {num(activeFilterCount)}
                </span>
              )}
            </div>
            <p className="m-0 mt-0.5 truncate text-xs text-ink-500">
              {selectedCycle ? `النطاق الحالي: ${selectedCycle.nameAr}` : 'اختر دورة لعرض تقاريرها'}
              <span className="mx-1 text-ink-300">·</span>
              <span className={activeFilterCount > 0 ? 'text-teal-700' : undefined}>
                {filterSummary}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCycle?.isActive && (
            <Badge tone="success">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} />
                دورة نشطة
              </span>
            </Badge>
          )}
          {!isExpanded && activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" leadingIcon={<RotateCcw size={14} />} onClick={reset}>
              إعادة ضبط
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            aria-expanded={isExpanded}
            aria-controls="reports-filters-panel"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? 'إخفاء الفلاتر' : 'عرض الفلاتر'}
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div id="reports-filters-panel" className="border-t border-border-subtle">
          <div className="hidden p-4 lg:block">
            {controls}
            {footer(() => setFilters({ cycleId: effectiveCycleId }))}
          </div>
          <div className="lg:hidden">
            <div className="p-4">
              <Button variant="secondary" leadingIcon={<SlidersHorizontal size={16} />} onClick={() => setMobileOpen(true)} fullWidth>
                ضبط الفلاتر
              </Button>
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="تصفية التقارير" size="md">
              {controls}
              {footer(() => {
                setFilters({ cycleId: effectiveCycleId });
                setMobileOpen(false);
              })}
            </Sheet>
          </div>
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-t border-border-subtle bg-ink-50 px-4 py-2">
          <span className="text-2xs font-medium text-ink-500">الفلاتر المطبقة:</span>
          {chips.map((chip) => (
            <Badge key={chip.key} tone="neutral">
              <span className="inline-flex items-center gap-1">
                {chip.label}
                <button
                  type="button"
                  aria-label="إزالة الفلتر"
                  className="rounded-full p-px transition-colors duration-fast hover:bg-ink-200 focus-visible:shadow-focus-teal focus-visible:outline-none"
                  onClick={() => useReportsFiltersStore.setState({ filters: without(filters, chip.key) })}
                >
                  <X size={12} />
                </button>
              </span>
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="m-0 mb-2 flex w-full items-center gap-2 p-0">
        <span className="text-2xs font-semibold text-ink-500">{label}</span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </legend>
      {children}
    </fieldset>
  );
}
