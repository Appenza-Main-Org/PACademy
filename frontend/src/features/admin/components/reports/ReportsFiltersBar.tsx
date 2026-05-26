import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import { Badge, Button, Card, DateRangePicker, Input, Select, Sheet } from '@/shared/components';
import type { DateRange } from '@/shared/components';
import { useCycles } from '../../api/cycles.queries';
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
  const cycles = useCycles();
  const categories = useLookup('applicant-categories');
  const specializations = useLookup('specializations');
  const filters = useReportsFiltersStore((state) => state.filters);
  const setFilters = useReportsFiltersStore((state) => state.set);
  const reset = useReportsFiltersStore((state) => state.reset);

  const activeCycle = cycles.data?.find((cycle) => cycle.isActive) ?? cycles.data?.[0];
  const effectiveCycleId = filters.cycleId ?? activeCycle?.id ?? '';

  const categoryOptions = [
    { value: '', label: 'الكل' },
    ...(categories.data ?? []).map((row) => ({ value: row.code, label: row.name })),
  ];
  const specializationOptions = [
    { value: '', label: 'الكل' },
    ...(specializations.data ?? []).map((row) => ({ value: row.code, label: row.name })),
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
        filters.committeeId && filters.committeeId !== 'all' && { key: 'committeeId' as const, label: 'لجنة محددة' },
        filters.specializationCode && { key: 'specializationCode' as const, label: 'تخصص محدد' },
        filters.paymentStatus && { key: 'paymentStatus' as const, label: 'حالة الدفع' },
      ].filter(Boolean) as Array<{ key: keyof ReportsFilters; label: string }>,
    [filters],
  );

  const controls = (
    <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-6">
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
      <div className="grid grid-cols-2 gap-2">
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
      <Select
        label="اللجنة"
        value={filters.committeeId ?? 'all'}
        options={[{ value: 'all', label: 'كل اللجان' }]}
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
      <div className="flex items-end gap-2">
        <Button variant="accent" leadingIcon={<Search size={16} />} onClick={() => setFilters({ cycleId: effectiveCycleId })}>
          تطبيق
        </Button>
        <Button variant="ghost" leadingIcon={<RotateCcw size={16} />} onClick={reset}>
          إعادة ضبط
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="sticky top-3 z-sticky mb-5">
      <div className="hidden lg:block">{controls}</div>
      <div className="lg:hidden">
        <Button variant="secondary" leadingIcon={<SlidersHorizontal size={16} />} onClick={() => setMobileOpen(true)}>
          تصفية
        </Button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title="تصفية التقارير" size="md">
          {controls}
        </Sheet>
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Badge key={chip.key} tone="neutral">
              <span className="inline-flex items-center gap-1">
                {chip.label}
                <button type="button" aria-label="إزالة الفلتر" onClick={() => useReportsFiltersStore.setState({ filters: without(filters, chip.key) })}>
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
