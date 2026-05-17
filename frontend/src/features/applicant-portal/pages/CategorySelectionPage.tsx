/**
 * CategorySelectionPage — pre-wizard gate, MOI-aligned (PDF p.3).
 *
 * Reference layout: a `Card`-wrapped vertical stack with read-only header
 * rows (applicant identity, eligibility, specializations, instructions —
 * each opens a `Drawer` via a blue `عرض` button) followed by one row per
 * RFP category whose action enables/disables based on the cycle window.
 * The previous card-grid UI is gone.
 *
 * The applicant identity rows are populated from `MOI_APPLICANT_SESSION`
 * (the mock for the moi.gov.eg handoff). The cycle picker remains for
 * the multi-cycle case (e.g. concurrent male/female cohorts).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarRange,
  ChevronLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  Info,
  Layers,
  Lock,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import type {
  AdmissionCycle,
  ApplicantCategory,
  CategoryCondition,
} from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import {
  TEST_KIND_LABEL_AR,
  TEST_KIND_ICON,
} from '../lib/category-test-labels';
import {
  useActiveCycles,
  useCategories,
} from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';

const COHORT_LABEL: Record<AdmissionCycle['cohort'], string> = {
  male: 'الذكور',
  female: 'الإناث',
};

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
  any: 'أي مؤهل معتمد',
};

const APPLICATION_FEE_LABEL = 'مقابل تقديم الخدمة إلكترونياً: ٢٥٠ جنيه';

type DrawerKind = 'identity' | 'eligibility' | 'specializations' | 'instructions' | null;

export function CategorySelectionPage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const cyclesQuery = useActiveCycles();
  const storedCycleId = useApplicantPortalStore((s) => s.selectedCycleId);
  const setStoredCycleId = useApplicantPortalStore((s) => s.setSelectedCycleId);

  const cycles = cyclesQuery.data ?? [];
  const cycleParam = params.get('cycle');

  const selectedCycle = useMemo<AdmissionCycle | null>(() => {
    if (!cycles.length) return null;
    const tryFind = (id: string | null): AdmissionCycle | null =>
      id ? cycles.find((c) => c.id === id) ?? null : null;
    return (
      tryFind(cycleParam) ??
      tryFind(storedCycleId) ??
      (cycles.length === 1 ? cycles[0]! : null)
    );
  }, [cycles, cycleParam, storedCycleId]);

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
        error={cyclesQuery.error as Error}
        onRetry={() => cyclesQuery.refetch()}
      />
    );
  }
  if (cycles.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد دورة قبول مفتوحة حالياً"
        description="يرجى المتابعة لاحقاً لمتابعة فتح باب القبول."
      />
    );
  }

  const cycleYear = selectedCycle?.year ?? new Date().getFullYear();

  const onPickCategory = (categoryKey: string, enabled: boolean): void => {
    if (!enabled || !selectedCycle) return;
    navigate(
      `${ROUTES.applicantEligibility}?category=${categoryKey}&cycle=${selectedCycle.id}`,
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`التقدم للإلتحاق بكلية الشرطة للعام الدراسي ${cycleYear}`}
          subtitle="راجع البيانات المُسجَّلة على بوابة وزارة الداخلية ثم اختر القسم المناسب للتقدم."
          breadcrumbs={[
            { label: 'بوابة المتقدم', href: ROUTES.applicant },
            { label: 'اختيار الفئة' },
          ]}
        />

        {cycles.length > 1 && (
          <CyclePickerStrip
            cycles={cycles}
            selectedId={selectedCycle?.id ?? null}
            onPick={(id) => {
              setStoredCycleId(id);
              const next = new URLSearchParams(params);
              next.set('cycle', id);
              setParams(next, { replace: false });
            }}
          />
        )}

        <Card variant="elevated" className="overflow-hidden p-0">
          {/* ── Header rows (4) — applicant identity + 3 drawer triggers ── */}
          <HeaderRow
            icon={<User size={16} strokeWidth={1.75} aria-hidden />}
            content={
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-800">
                <LabeledFact label="إسم المتقدم" value={MOI_APPLICANT_SESSION.fullName} />
                <LabeledFact label="الرقم القومي" value={MOI_APPLICANT_SESSION.nationalId} ltr mono />
                <LabeledFact label="تاريخ الميلاد" value={MOI_APPLICANT_SESSION.dateOfBirthAr} />
                <LabeledFact
                  label="النوع"
                  value={MOI_APPLICANT_SESSION.gender === 'male' ? 'ذكر' : 'أنثى'}
                />
              </div>
            }
            action={
              <ViewButton onClick={() => setDrawer('identity')} ariaLabel="عرض بيانات المتقدم" />
            }
          />
          <HeaderRow
            icon={<ShieldCheck size={16} strokeWidth={1.75} aria-hidden />}
            content={<span className="text-sm font-medium text-ink-900">شروط الإلتحاق</span>}
            action={
              <ViewButton onClick={() => setDrawer('eligibility')} ariaLabel="عرض شروط الإلتحاق" />
            }
          />
          <HeaderRow
            icon={<Layers size={16} strokeWidth={1.75} aria-hidden />}
            content={<span className="text-sm font-medium text-ink-900">التخصصات المطلوبة</span>}
            action={
              <ViewButton onClick={() => setDrawer('specializations')} ariaLabel="عرض التخصصات المطلوبة" />
            }
          />
          <HeaderRow
            icon={<ClipboardList size={16} strokeWidth={1.75} aria-hidden />}
            content={
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-medium text-ink-900">إرشادات التقدم</span>
                <span className="text-2xs text-ink-500">{APPLICATION_FEE_LABEL}</span>
              </div>
            }
            action={
              <ViewButton onClick={() => setDrawer('instructions')} ariaLabel="عرض إرشادات التقدم" />
            }
          />

          {/* ── Category rows ── */}
          <CategoryRows
            categoriesQuery={categoriesQuery}
            onPick={onPickCategory}
          />
        </Card>

        {/* ── Drawers ── */}
        <Drawer
          open={drawer === 'identity'}
          onClose={() => setDrawer(null)}
          title="بيانات المتقدم"
        >
          <Drawer.Body>
            <IdentityDrawerBody />
          </Drawer.Body>
        </Drawer>

        <Drawer
          open={drawer === 'eligibility'}
          onClose={() => setDrawer(null)}
          title="شروط الإلتحاق"
        >
          <Drawer.Body>
            <EligibilityDrawerBody
              cycle={selectedCycle}
              categories={categoriesQuery.data ?? []}
            />
          </Drawer.Body>
        </Drawer>

        <Drawer
          open={drawer === 'specializations'}
          onClose={() => setDrawer(null)}
          title="التخصصات المطلوبة"
        >
          <Drawer.Body>
            <SpecializationsDrawerBody categories={categoriesQuery.data ?? []} />
          </Drawer.Body>
        </Drawer>

        <Drawer
          open={drawer === 'instructions'}
          onClose={() => setDrawer(null)}
          title="إرشادات التقدم"
        >
          <Drawer.Body>
            <InstructionsDrawerBody />
          </Drawer.Body>
        </Drawer>
      </div>
    </TooltipProvider>
  );
}

/* ─── header / category rows ────────────────────────────────────────── */

function HeaderRow({
  icon,
  content,
  action,
}: {
  icon: React.ReactNode;
  content: React.ReactNode;
  action: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-border-default bg-ink-50/40 px-5 py-3 last:border-b-0">
      <span
        aria-hidden
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">{content}</div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

function LabeledFact({
  label,
  value,
  ltr,
  mono,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-2xs uppercase tracking-wide text-ink-500">{label}:</span>
      <span
        className={cn('text-sm font-medium text-ink-900', mono && 'font-mono')}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </span>
    </span>
  );
}

function ViewButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md border border-teal-500/30 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors duration-fast ease-standard hover:border-teal-500 hover:bg-teal-100 focus-visible:shadow-focus-teal focus-visible:outline-none"
    >
      <span>عرض</span>
      <ChevronLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />
    </button>
  );
}

function CategoryRows({
  categoriesQuery,
  onPick,
}: {
  categoriesQuery: ReturnType<typeof useCategories>;
  onPick: (key: string, enabled: boolean) => void;
}): JSX.Element {
  if (categoriesQuery.isLoading) {
    return (
      <div className="px-5 py-4">
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }
  if (categoriesQuery.error) {
    return (
      <div className="px-5 py-4">
        <ErrorState
          error={categoriesQuery.error as Error}
          onRetry={() => categoriesQuery.refetch()}
        />
      </div>
    );
  }
  const categories = categoriesQuery.data ?? [];
  if (categories.length === 0) {
    return (
      <div className="px-5 py-6">
        <EmptyState variant="generic" title="لا توجد فئات متاحة في هذه الدورة" />
      </div>
    );
  }

  return (
    <div className="border-t border-border-default">
      {categories.map((c, i) => (
        <CategoryRow
          key={c.key}
          category={c}
          onPick={(enabled) => onPick(c.key, enabled)}
          isLast={i === categories.length - 1}
        />
      ))}
    </div>
  );
}

function CategoryRow({
  category,
  onPick,
  isLast,
}: {
  category: ApplicantCategory;
  onPick: (enabled: boolean) => void;
  isLast: boolean;
}): JSX.Element {
  const enabled = category.isOpen;
  const disabledReason = enabled
    ? null
    : category.conditions.nominationOnly
      ? 'هذا القسم يفتح عبر الترشيح الإداري فقط — لا تقديم مباشر.'
      : 'باب التقدم غير مفتوح لهذه الفئة في الدورة الحالية.';

  const button = (
    <Button
      variant="primary"
      size="md"
      disabled={!enabled}
      onClick={() => onPick(enabled)}
    >
      التقدم للإلتحاق
    </Button>
  );

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-4 px-5 py-4',
        !isLast && 'border-b border-border-default',
      )}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-teal-500" />
        <span className="font-ar-display text-md font-bold text-ink-900">
          {category.labelAr}
        </span>
        {!enabled && (
          <Badge tone="neutral">
            <Lock size={11} strokeWidth={1.75} className="me-1 inline-block" />
            مغلق
          </Badge>
        )}
      </div>
      <p className="text-sm leading-normal text-ink-700">{category.description}</p>
      <div className="flex-shrink-0">
        {disabledReason ? (
          <Tooltip content={disabledReason}>
            <span tabIndex={0} className="inline-block">
              {button}
            </span>
          </Tooltip>
        ) : (
          button
        )}
      </div>
    </div>
  );
}

/* ─── drawer bodies ─────────────────────────────────────────────────── */

function IdentityDrawerBody(): JSX.Element {
  const s = MOI_APPLICANT_SESSION;
  const rows: Array<{ label: string; value: string; ltr?: boolean; mono?: boolean }> = [
    { label: 'الإسم رباعي', value: s.fullName },
    { label: 'الرقم القومي', value: s.nationalId, ltr: true, mono: true },
    { label: 'تاريخ الميلاد', value: s.dateOfBirthAr },
    { label: 'النوع', value: s.gender === 'male' ? 'ذكر' : 'أنثى' },
    { label: 'محل الميلاد', value: `${s.birthGovernorate} — ${s.birthDistrict}` },
    { label: 'الديانة', value: s.religion },
    { label: 'رقم المحمول', value: s.mobile, ltr: true, mono: true },
    { label: 'البريد الإلكتروني', value: s.email, ltr: true, mono: true },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
        هذه البيانات مستوردة من بوابة وزارة الداخلية ولا يمكن تعديلها من داخل البوابة.
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-2xs uppercase tracking-wide text-ink-500">{r.label}</dt>
            <dd
              className={cn('mt-0.5 text-sm font-medium text-ink-900', r.mono && 'font-mono')}
              dir={r.ltr ? 'ltr' : undefined}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EligibilityDrawerBody({
  cycle,
  categories,
}: {
  cycle: AdmissionCycle | null;
  categories: readonly ApplicantCategory[];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {cycle && (
        <div className="rounded-md border border-border-default bg-ink-50 px-3 py-2 text-2xs text-ink-700">
          الدورة الحالية: <span className="font-medium">{cycle.nameAr}</span> · فترة التقدم تنتهي في{' '}
          {fmtDate(cycle.closeDate, 'short')}
        </div>
      )}
      {categories.length === 0 ? (
        <p className="text-sm text-ink-700">لا توجد شروط معروضة في الوقت الحالي.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {categories.map((c) => (
            <li key={c.key}>
              <p className="mb-1.5 font-ar-display text-md font-bold text-ink-900">{c.labelAr}</p>
              <ul className="space-y-1 text-sm text-ink-700">
                {summariseConditions(c.conditions).map((line, i) => (
                  <li key={`${c.key}-c-${i}`} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {c.conditions.freeText.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-2xs text-ink-500">
                  {c.conditions.freeText.map((t, i) => (
                    <li key={`${c.key}-f-${i}`}>{t}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summariseConditions(c: CategoryCondition): string[] {
  const lines: string[] = [];
  if (c.egyptianNationalityRequired) lines.push('مصري الجنسية ومن أب وأم مصريين');
  if (c.conductCheck) lines.push('حسن السير والسلوك');
  if (c.maritalStatus === 'single') lines.push('غير متزوج');
  if (c.medicalRequired) lines.push('لائق طبياً');
  if (c.minHeightCm !== null) lines.push(`الطول لا يقل عن ${c.minHeightCm} سم`);
  if (c.ageMax !== null && c.ageMin !== null) lines.push(`السن من ${c.ageMin} إلى ${c.ageMax} سنة`);
  else if (c.ageMax !== null) lines.push(`السن حتى ${c.ageMax} سنة`);
  else if (c.ageMin !== null) lines.push(`السن لا يقل عن ${c.ageMin} سنة`);
  if (c.requiredQualification !== 'any') lines.push(QUALIFICATION_LABEL[c.requiredQualification]);
  if (c.minScorePercent !== null) lines.push(`الحد الأدنى لمجموع المؤهل: ${c.minScorePercent}%`);
  if (c.employerApprovalRequired) lines.push('موافقة جهة العمل');
  if (c.gender === 'female') lines.push('للإناث فقط');
  if (c.gender === 'male') lines.push('للذكور فقط');
  return lines;
}

function SpecializationsDrawerBody({
  categories,
}: {
  categories: readonly ApplicantCategory[];
}): JSX.Element {
  if (categories.length === 0) {
    return <p className="text-sm text-ink-700">لا توجد تخصصات معروضة في الوقت الحالي.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {categories.map((c) => (
        <li key={c.key}>
          <p className="mb-1.5 inline-flex items-center gap-2 font-ar-display text-md font-bold text-ink-900">
            <GraduationCap size={14} strokeWidth={1.75} className="text-teal-700" aria-hidden />
            {c.labelAr}
          </p>
          {c.requiredTests.length === 0 ? (
            <p className="text-2xs text-ink-500">لم تُحدَّد اختبارات بعد لهذه الفئة.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-ink-700">
              {c.requiredTests.map((t) => {
                const Icon = TEST_KIND_ICON[t.kind];
                return (
                  <li key={`${c.key}-t-${t.kind}`} className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-ink-50 text-ink-700">
                      <Icon size={12} strokeWidth={1.75} />
                    </span>
                    <span className="font-numeric tnum text-2xs text-ink-500">{t.order}.</span>
                    <span>{TEST_KIND_LABEL_AR[t.kind]}</span>
                    {t.passingCriteria && (
                      <span className="ms-1 text-2xs text-ink-500">— {t.passingCriteria}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function InstructionsDrawerBody(): JSX.Element {
  return (
    <div className="flex flex-col gap-3 text-sm leading-normal text-ink-800">
      <p>
        <strong>قبل التقدم:</strong> راجع البيانات المُسجَّلة على بوابة وزارة الداخلية (الاسم رباعي
        والرقم القومي ورقم المحمول)، وتأكد من صحتها — حيث ستُستخدم لاستكمال إجراءات التقدم وارسال
        إخطارات التقدم.
      </p>
      <p>
        <strong>أثناء التقدم:</strong> سيُطلب منك إدخال بيانات الدراسة بدقة طبقاً لأوراقك الثبوتية.
        أيّ مخالفة بين البيان المُدرَج والأوراق الأصلية قد تؤدي إلى منعك من الإختبار.
      </p>
      <p>
        <strong>مقابل الخدمة:</strong> {APPLICATION_FEE_LABEL.replace('مقابل تقديم الخدمة إلكترونياً: ', '')} — يُسدَّد مرة واحدة
        خلال الدورة الحالية، ويُستحَق فور تأكيد البيانات.
      </p>
      <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
        <FileText size={12} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
        احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي
        الأمر.
      </p>
    </div>
  );
}

/* ─── cycle picker strip (multi-cycle case only) ────────────────────── */

function CyclePickerStrip({
  cycles,
  selectedId,
  onPick,
}: {
  cycles: readonly AdmissionCycle[];
  selectedId: string | null;
  onPick: (id: string) => void;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-ar-display text-md font-bold text-ink-900">
          <Info size={14} strokeWidth={1.75} aria-hidden />
          توجد أكثر من دورة قبول نشطة — اختر الدورة المناسبة
        </h2>
        <Badge tone="info">
          <Users size={12} strokeWidth={1.75} className="me-1 inline-block" />
          {cycles.length} دورات
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cycles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            aria-pressed={c.id === selectedId}
            className={cn(
              'flex items-center gap-3 rounded-md border bg-surface-card p-3 text-start transition-colors duration-fast ease-standard',
              'focus-visible:shadow-focus-teal focus-visible:outline-none',
              c.id === selectedId
                ? 'border-teal-500 bg-teal-50 shadow-card ring-2 ring-teal-500/30'
                : 'border-border-default hover:border-teal-500 hover:bg-teal-50',
            )}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <CalendarRange size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-ar-display text-sm font-bold text-ink-900">
                {c.nameAr}
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {COHORT_LABEL[c.cohort]} · حتى {fmtDate(c.closeDate, 'short')}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
