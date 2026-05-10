/**
 * CategorySelectionPage — pre-wizard gate (Bucket B3).
 *
 * Step 1 — pick an active admission cycle. The platform may run more than
 *          one cycle at the same time (e.g. a male and a female cohort
 *          concurrently). When ≥2 cycles are live, the page shows a picker;
 *          with exactly one, it auto-selects.
 * Step 2 — pick one of the public departments (general, specialized,
 *          postgraduate). Their open/closed state and conditions are
 *          computed against the chosen cycle's openCategories +
 *          conditionOverrides. Nomination-only departments are filtered
 *          out at the service layer and never reach this page.
 */

import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarRange,
  Check,
  Home,
  Info,
  Lock,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconStamp,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import type {
  AdmissionCycle,
  ApplicantCategory,
  CategoryCondition,
  RequiredTest,
} from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import {
  TEST_KIND_ICON,
  TEST_KIND_LABEL_AR,
} from '../lib/category-test-labels';
import {
  useActiveCycles,
  useCategories,
} from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';

const LINK_GHOST =
  'inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-semibold text-teal-600 transition-colors duration-fast ease-standard hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none';

const LINK_SECONDARY =
  'inline-flex items-center gap-2 h-9 rounded-md border border-border-default bg-surface-card px-3 text-sm font-semibold text-ink-900 transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none';

const QUALIFICATION_LABEL: Record<CategoryCondition['requiredQualification'], string> = {
  thanaweya_amma: 'الثانوية العامة',
  azhar: 'الثانوية الأزهرية',
  bachelor: 'مؤهل عالي',
  bachelor_law: 'بكالوريوس حقوق',
  bachelor_medicine: 'بكالوريوس طب',
  bachelor_engineering: 'بكالوريوس هندسة',
  bachelor_media: 'بكالوريوس إعلام',
  police_academy_grad: 'خريج كلية الشرطة',
  serving_officer: 'ضابط شرطة',
  any: '',
};

const COHORT_LABEL: Record<AdmissionCycle['cohort'], string> = {
  male: 'الذكور',
  female: 'الإناث',
};

export function CategorySelectionPage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cyclesQuery = useActiveCycles();
  const storedCycleId = useApplicantPortalStore((s) => s.selectedCycleId);
  const setStoredCycleId = useApplicantPortalStore((s) => s.setSelectedCycleId);

  const cycles = cyclesQuery.data ?? [];
  const cycleParam = params.get('cycle');

  /* Pick the active cycle. Order of precedence: explicit URL → store → only
   * one available → none (forces user to choose when ≥2 are live). */
  const selectedCycle = useMemo<AdmissionCycle | null>(() => {
    if (!cycles.length) return null;
    const tryFind = (id: string | null) =>
      id ? cycles.find((c) => c.id === id) ?? null : null;
    return (
      tryFind(cycleParam) ??
      tryFind(storedCycleId) ??
      (cycles.length === 1 ? cycles[0] : null)
    );
  }, [cycles, cycleParam, storedCycleId]);

  /* Mirror the resolved cycle into the URL + store so deep-links and the
   * eligibility step both inherit the choice. */
  useEffect(() => {
    if (!selectedCycle) return;
    if (cycleParam !== selectedCycle.id) {
      const next = new URLSearchParams(params);
      next.set('cycle', selectedCycle.id);
      setParams(next, { replace: true });
    }
    if (storedCycleId !== selectedCycle.id) {
      setStoredCycleId(selectedCycle.id);
    }
  }, [selectedCycle, cycleParam, params, setParams, storedCycleId, setStoredCycleId]);

  const categoriesQuery = useCategories(selectedCycle?.id);

  if (cyclesQuery.isLoading) return <LoadingState variant="page" />;
  if (cyclesQuery.error) {
    return (
      <ErrorState
        error={cyclesQuery.error}
        onRetry={() => cyclesQuery.refetch()}
      />
    );
  }

  const onPickCycle = (id: string): void => {
    setStoredCycleId(id);
    const next = new URLSearchParams(params);
    next.set('cycle', id);
    setParams(next, { replace: false });
  };

  const onSelectCategory = (categoryKey: string): void => {
    if (!selectedCycle) return;
    navigate(
      `${ROUTES.applicantEligibility}?category=${categoryKey}&cycle=${selectedCycle.id}`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="اختر فئة التقديم"
        subtitle="حدد دورة القبول ثم القسم المناسب وراجع شروطه واختباراته قبل بدء التقديم"
        breadcrumbs={[
          { label: 'الرئيسية', href: ROUTES.hub },
          { label: 'بوابة المتقدم', href: ROUTES.applicant },
          { label: 'اختيار الفئة' },
        ]}
        actions={
          <>
            <Link to={ROUTES.applicant} className={LINK_GHOST}>
              <ArrowRight size={16} className="rtl:rotate-180" /> بوابة المتقدم
            </Link>
            <Link to={ROUTES.hub} className={LINK_SECONDARY}>
              <Home size={16} />
              الرئيسية
            </Link>
          </>
        }
      />

      {cycles.length === 0 ? (
        <EmptyState
          variant="generic"
          title="لا توجد دورة قبول مفتوحة حالياً"
          description="يرجى المتابعة لاحقاً لمتابعة فتح باب القبول."
        />
      ) : (
        <CyclePicker
          cycles={cycles}
          selectedId={selectedCycle?.id ?? null}
          onPick={onPickCycle}
        />
      )}

      {selectedCycle && (
        <CategoriesSection
          categoriesQuery={categoriesQuery}
          onSelectCategory={onSelectCategory}
        />
      )}

      {cycles.length > 1 && !selectedCycle && (
        <Card variant="compact" className="border-dashed border-gold-300 bg-gold-50">
          <p className="text-sm text-gold-700">
            هناك أكثر من دورة قبول مفتوحة حالياً. اختر الدورة المناسبة من
            القائمة أعلاه لعرض الفئات المتاحة فيها.
          </p>
        </Card>
      )}
    </div>
  );
}

function CyclePicker({
  cycles,
  selectedId,
  onPick,
}: {
  cycles: readonly AdmissionCycle[];
  selectedId: string | null;
  onPick: (id: string) => void;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ar-display text-md font-bold text-ink-900">
          {cycles.length > 1 ? 'دورات القبول النشطة' : 'دورة القبول النشطة'}
        </h2>
        {cycles.length > 1 && (
          <Badge tone="info">
            <Users size={12} strokeWidth={1.75} className="me-1 inline-block" />
            {cycles.length} دورات مفتوحة
          </Badge>
        )}
      </div>

      <div
        className={cn(
          'grid gap-3',
          cycles.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : '',
        )}
      >
        {cycles.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            selected={cycle.id === selectedId}
            onPick={() => onPick(cycle.id)}
          />
        ))}
      </div>
    </section>
  );
}

function CycleCard({
  cycle,
  selected,
  onPick,
}: {
  cycle: AdmissionCycle;
  selected: boolean;
  onPick: () => void;
}): JSX.Element {
  const openCount = Object.values(cycle.openCategories ?? {}).filter(
    (c) => c?.isOpen,
  ).length;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        'group relative flex flex-col gap-3 rounded-lg border bg-surface-card p-4 text-start transition-all duration-fast ease-standard',
        'focus-visible:shadow-focus-teal focus-visible:outline-none',
        selected
          ? 'border-teal-500 bg-teal-50 shadow-card ring-2 ring-teal-500/30'
          : 'border-border-default hover:-translate-y-px hover:border-teal-500 hover:bg-teal-50 hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
              selected ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-700',
            )}
          >
            <CalendarRange size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-ar-display text-md font-bold text-ink-900">
              {cycle.nameAr}
            </p>
            <p className="mt-0.5 text-2xs text-ink-500">
              {COHORT_LABEL[cycle.cohort]} · مفتوحة حتى{' '}
              {fmtDate(cycle.closeDate, 'short')}
            </p>
          </div>
        </div>
        {selected ? (
          <Badge tone="success">
            <Check size={12} strokeWidth={1.75} className="me-1 inline-block" />
            مختارة
          </Badge>
        ) : (
          <Badge tone="success">
            <IconStamp width={12} height={12} className="me-1 inline-block" />
            نشطة
          </Badge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-2xs text-ink-500">
        <div className="rounded-md bg-ink-50 px-2 py-1.5">
          <dt className="text-ink-500">السعة المتوقعة</dt>
          <dd className="font-numeric tnum mt-0.5 font-bold text-ink-900">
            {cycle.expectedCapacity}
          </dd>
        </div>
        <div className="rounded-md bg-ink-50 px-2 py-1.5">
          <dt className="text-ink-500">فئات مفتوحة</dt>
          <dd className="font-numeric tnum mt-0.5 font-bold text-ink-900">
            {openCount}
          </dd>
        </div>
      </dl>
    </button>
  );
}

function CategoriesSection({
  categoriesQuery,
  onSelectCategory,
}: {
  categoriesQuery: ReturnType<typeof useCategories>;
  onSelectCategory: (categoryKey: string) => void;
}): JSX.Element {
  if (categoriesQuery.isLoading) return <LoadingState variant="card-grid" count={3} />;
  if (categoriesQuery.error) {
    return (
      <ErrorState
        error={categoriesQuery.error}
        onRetry={() => categoriesQuery.refetch()}
      />
    );
  }
  const categories = categoriesQuery.data ?? [];
  if (categories.length === 0) return <></>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard
          key={category.key}
          category={category}
          onSelect={() => onSelectCategory(category.key)}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  onSelect,
}: {
  category: ApplicantCategory;
  onSelect: () => void;
}): JSX.Element {
  return (
    <Card variant="feature" className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-ar-display text-lg font-bold text-ink-900">{category.labelAr}</h3>
          <p className="mt-1 text-sm text-ink-500">{category.description}</p>
        </div>
        {category.isOpen ? (
          <Badge tone="success">
            <IconStamp width={12} height={12} className="me-1 inline-block" />
            مفتوح للتقديم
          </Badge>
        ) : (
          <Badge tone="neutral">
            <Lock size={12} strokeWidth={1.75} className="me-1 inline-block" />
            التقديم مغلق
          </Badge>
        )}
      </header>

      <ConditionsPanel conditions={category.conditions} freeText={category.conditions.freeText} />

      {category.requiredTests.length > 0 && (
        <TestsPanel tests={category.requiredTests} />
      )}

      {category.procedures.length > 0 && (
        <ProceduresPanel procedures={category.procedures} />
      )}

      <Button variant="primary" disabled={!category.isOpen} onClick={onSelect}>
        اختيار هذه الفئة
      </Button>
    </Card>
  );
}

function ConditionsPanel({
  conditions,
  freeText,
}: {
  conditions: CategoryCondition;
  freeText: readonly string[];
}): JSX.Element {
  const items: string[] = [];
  if (conditions.egyptianNationalityRequired) items.push('مصري الجنسية');
  if (conditions.conductCheck) items.push('حسن السير والسلوك');
  if (conditions.maritalStatus === 'single') items.push('غير متزوج');
  if (conditions.minHeightCm !== null) items.push(`الطول حوالي ${conditions.minHeightCm} سم أو أكثر`);
  if (conditions.medicalRequired) items.push('لائق طبياً');
  if (conditions.ageMax !== null && conditions.ageMin !== null) {
    items.push(`السن من ${conditions.ageMin} إلى ${conditions.ageMax} سنة`);
  } else if (conditions.ageMax !== null) {
    items.push(`السن حتى ${conditions.ageMax} سنة`);
  } else if (conditions.ageMin !== null) {
    items.push(`السن من ${conditions.ageMin} سنة`);
  }
  if (conditions.requiredQualification !== 'any') {
    const label = QUALIFICATION_LABEL[conditions.requiredQualification];
    if (label) items.push(label);
  }
  if (conditions.minScorePercent !== null) {
    items.push(`الحد الأدنى للمجموع: ${conditions.minScorePercent}%`);
  }
  if (conditions.employerApprovalRequired) items.push('موافقة جهة العمل');

  return (
    <section>
      <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">الشروط</h4>
      <ul className="space-y-1 text-sm text-ink-700">
        {items.map((item, i) => (
          <li key={`cond-${i}`} className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {freeText.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-gold-300 bg-gold-50 p-2 text-2xs text-gold-700">
          <p className="font-bold">ملاحظات</p>
          <ul className="mt-1 space-y-0.5">
            {freeText.map((line, i) => (
              <li key={`note-${i}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TestsPanel({ tests }: { tests: RequiredTest[] }): JSX.Element {
  return (
    <section>
      <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">الاختبارات</h4>
      <ol className="space-y-1.5 text-sm text-ink-700">
        {tests.map((test) => {
          const Icon = TEST_KIND_ICON[test.kind];
          return (
            <li key={test.kind} className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-ink-50 text-ink-700">
                <Icon size={12} strokeWidth={1.75} />
              </span>
              <span className="font-numeric tnum text-2xs text-ink-500">{test.order}.</span>
              <span>{TEST_KIND_LABEL_AR[test.kind]}</span>
              {test.passingCriteria && (
                <span className="ms-1 text-2xs text-ink-500">— {test.passingCriteria}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProceduresPanel({ procedures }: { procedures: string[] }): JSX.Element {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1 text-2xs font-bold uppercase tracking-wide text-ink-500">
        <Info size={12} strokeWidth={1.75} />
        الإجراءات
      </h4>
      <ol className="list-inside list-decimal space-y-1 text-sm text-ink-700">
        {procedures.map((p, i) => (
          <li key={`proc-${i}`}>{p}</li>
        ))}
      </ol>
    </section>
  );
}
