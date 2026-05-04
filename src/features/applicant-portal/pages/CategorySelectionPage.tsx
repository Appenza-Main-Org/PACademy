/**
 * CategorySelectionPage — pre-wizard gate (Bucket B3).
 * Renders the active-cycle banner + the 3 public departments (general,
 * specialized, postgraduate) with conditions, tests, and procedures.
 * Departments where `nominationOnly: true` are filtered out at the
 * service layer and never reach this page.
 */

import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarRange, Home, Info, Lock } from 'lucide-react';
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
import type {
  ApplicantCategory,
  CategoryCondition,
  RequiredTest,
} from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import {
  TEST_KIND_ICON,
  TEST_KIND_LABEL_AR,
} from '../lib/category-test-labels';
import { useActiveCycle, useCategories } from '../api/categories.queries';

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

export function CategorySelectionPage(): JSX.Element {
  const cycleQuery = useActiveCycle();
  const categoriesQuery = useCategories();

  if (cycleQuery.isLoading || categoriesQuery.isLoading) return <LoadingState variant="page" />;
  if (cycleQuery.error || categoriesQuery.error) {
    return (
      <ErrorState
        error={(cycleQuery.error ?? categoriesQuery.error) as Error}
        onRetry={() => {
          cycleQuery.refetch();
          categoriesQuery.refetch();
        }}
      />
    );
  }

  const cycle = cycleQuery.data;
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="اختر فئة التقديم"
        subtitle="حدد قسم القبول المناسب وراجع شروطه واختباراته قبل بدء التقديم"
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

      {cycle ? (
        <Card variant="compact" className="border-teal-500/40 bg-teal-50/40">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-500 text-white">
              <CalendarRange size={18} strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="font-ar-display text-md font-bold text-ink-900">
                دورة القبول: {cycle.nameAr}
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                مفتوحة حتى {fmtDate(cycle.closeDate, 'short')}
              </p>
            </div>
            <Badge tone="success">
              <IconStamp width={12} height={12} className="me-1 inline-block" />
              نشطة
            </Badge>
          </div>
        </Card>
      ) : (
        <EmptyState
          variant="generic"
          title="لا توجد دورة قبول نشطة حالياً"
          description="يرجى المتابعة لاحقاً لمتابعة فتح باب القبول."
        />
      )}

      {cycle && categories.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.key} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ category }: { category: ApplicantCategory }): JSX.Element {
  const navigate = useNavigate();
  const onSelect = (): void => {
    navigate(`${ROUTES.applicantEligibility}?category=${category.key}`);
  };

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
