/**
 * EligibilityCheckPage — Bucket B3.
 * Two-column layout: left = NID input + submit, right = the chosen
 * category's conditions/tests/procedures recap. Submit calls the
 * eligibility mutation and renders either an "eligible → Start" panel
 * or a "not eligible" panel with the specific reasons.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Home, ShieldCheck, XCircle } from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import type {
  ApplicantCategory,
  CategoryCondition,
  EligibilityRejectionReason,
  EligibilityResult,
  RequiredTest,
} from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import {
  TEST_KIND_ICON,
  TEST_KIND_LABEL_AR,
} from '../lib/category-test-labels';
import {
  useActiveCycle,
  useCategories,
  useEligibilityMutation,
} from '../api/categories.queries';
import { useApplicantPortalStore } from '../store/applicantPortal.store';

const REJECTION_LABEL: Record<EligibilityRejectionReason, string> = {
  cycle_not_active: 'لا توجد دورة قبول نشطة حالياً',
  application_closed: 'باب التقديم مغلق لهذه الفئة في الدورة الحالية',
  nomination_required: 'هذه الفئة بالترشيح فقط ولا تتاح للتقديم العام',
  age_out_of_range: 'السن خارج النطاق المسموح به لهذه الفئة',
  gender_mismatch: 'فئة التقديم لا تتوافق مع النوع',
  data_not_found: 'بياناتك غير متاحة لدى وزارة التربية والتعليم / الأزهر الشريف',
  score_below_min: 'المجموع أقل من الحد الأدنى المطلوب',
  nid_already_used: 'تم استخدام هذا الرقم القومي في تقديم سابق',
  qualification_mismatch: 'المؤهل الدراسي لا يطابق متطلبات الفئة',
  height_below_min: 'الطول أقل من الحد الأدنى المطلوب',
  marital_status_mismatch: 'الحالة الاجتماعية لا تتوافق مع شروط الفئة',
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
  any: '',
};

interface EligibilityFormValues {
  nid: string;
}

export function EligibilityCheckPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setNationalId = useApplicantPortalStore((s) => s.setNationalId);
  const setSelectedCategoryKey = useApplicantPortalStore((s) => s.setSelectedCategoryKey);
  const categoriesQuery = useCategories();
  const cycleQuery = useActiveCycle();
  const eligibilityMut = useEligibilityMutation();
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const categoryParam = params.get('category');

  /* If the user hits this page without ?category=, send them back. */
  useEffect(() => {
    if (!categoryParam) navigate(ROUTES.applicantStart, { replace: true });
  }, [categoryParam, navigate]);

  const category: ApplicantCategory | undefined = useMemo(
    () => categoriesQuery.data?.find((c) => c.key === categoryParam),
    [categoriesQuery.data, categoryParam],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EligibilityFormValues>({ defaultValues: { nid: '' } });

  if (categoriesQuery.isLoading || cycleQuery.isLoading) return <LoadingState variant="page" />;
  if (categoriesQuery.error) {
    return <ErrorState error={categoriesQuery.error as Error} onRetry={() => categoriesQuery.refetch()} />;
  }

  /* Category not found in public list — likely nomination-only. The service
   * filters those out, so render the rejection panel pre-filled. */
  if (!category) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التحقق من الأهلية" />
        <RejectionPanel reasons={['nomination_required']} />
        <BackToCategories />
      </div>
    );
  }

  const onSubmit = async (values: EligibilityFormValues): Promise<void> => {
    const r = await eligibilityMut.mutateAsync({
      categoryKey: category.key,
      nid: values.nid,
    });
    setResult(r);
    if (r.eligible) setNationalId(values.nid);
  };

  const onStartApplication = (): void => {
    setSelectedCategoryKey(category.key);
    navigate(ROUTES.applicant);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="التحقق من الأهلية"
        subtitle={`الفئة: ${category.labelAr}`}
        breadcrumbs={[
          { label: 'الرئيسية', href: ROUTES.hub },
          { label: 'بوابة المتقدم', href: ROUTES.applicant },
          { label: 'اختيار الفئة', href: ROUTES.applicantStart },
          { label: 'التحقق من الأهلية' },
        ]}
        actions={
          <>
            <Link to={ROUTES.applicantStart} className="btn btn-ghost">
              <ArrowRight size={16} className="rtl:rotate-180" /> اختيار الفئة
            </Link>
            <Link to={ROUTES.hub} className="btn btn-secondary">
              <Home size={16} className="me-1.5" />
              الرئيسية
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-ar-display text-lg font-bold text-ink-900">
            أدخل رقمك القومي للتحقق
          </h3>
          <p className="mb-4 text-sm text-ink-500">
            سنستخدم رقمك القومي للتحقق من بياناتك ومطابقتها مع شروط هذه الفئة.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <Input
              label="الرقم القومي"
              required
              dir="ltr"
              placeholder="14 رقماً"
              {...register('nid', {
                required: 'مطلوب',
                pattern: { value: /^[0-9]{14}$/, message: 'الرقم القومي يجب أن يكون 14 رقماً' },
              })}
              error={errors.nid?.message}
            />
            <Button type="submit" variant="primary" size="lg" isLoading={eligibilityMut.isPending}>
              تحقق من الأهلية
            </Button>
          </form>

          {result && result.eligible && (
            <div className="mt-5 rounded-md border border-teal-500/40 bg-teal-50/40 p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-teal-500 text-teal-700">
                  <ShieldCheck size={20} strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <p className="font-ar-display text-md font-bold text-teal-700">مؤهل للتقديم</p>
                  <p className="mt-1 text-sm text-ink-700">
                    تستوفي شروط الفئة. يمكنك بدء التقديم الآن.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" onClick={onStartApplication}>
                  ابدأ التقديم
                </Button>
              </div>
            </div>
          )}

          {result && !result.eligible && <RejectionPanel reasons={result.reasons} />}

          <BackToCategories />
        </Card>

        <Card variant="feature">
          <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">{category.labelAr}</h3>
          <p className="text-sm text-ink-500">{category.description}</p>

          <CategoryConditionsList category={category} />
          {category.requiredTests.length > 0 && <CategoryTestsList tests={category.requiredTests} />}
          {category.procedures.length > 0 && <CategoryProceduresList procedures={category.procedures} />}
        </Card>
      </div>
    </div>
  );
}

function RejectionPanel({ reasons }: { reasons: EligibilityRejectionReason[] }): JSX.Element {
  return (
    <div className="mt-5 rounded-md border border-terra-500/40 bg-terra-50 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-terra-500 text-white">
          <XCircle size={20} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <p className="font-ar-display text-md font-bold text-terra-700">غير مؤهل للتقديم</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-terra-500" />
                <span>{REJECTION_LABEL[reason]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BackToCategories(): JSX.Element {
  return (
    <div className="mt-4 flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
        onClick={() => window.history.length > 1 ? window.history.back() : null}
      >
        اختيار فئة أخرى
      </Button>
    </div>
  );
}

function CategoryConditionsList({ category }: { category: ApplicantCategory }): JSX.Element {
  const items: string[] = [];
  const { conditions } = category;
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
    <section className="mt-4">
      <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">الشروط</h4>
      <ul className="space-y-1 text-sm text-ink-700">
        {items.map((item, i) => (
          <li key={`cond-${i}`} className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {conditions.freeText.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-gold-300 bg-gold-50 p-2 text-2xs text-gold-700">
          <p className="font-bold">ملاحظات</p>
          <ul className="mt-1 space-y-0.5">
            {conditions.freeText.map((line, i) => (
              <li key={`note-${i}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CategoryTestsList({ tests }: { tests: RequiredTest[] }): JSX.Element {
  return (
    <section className="mt-4">
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

function CategoryProceduresList({ procedures }: { procedures: string[] }): JSX.Element {
  return (
    <section className="mt-4">
      <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">الإجراءات</h4>
      <ol className="list-inside list-decimal space-y-1 text-sm text-ink-700">
        {procedures.map((p, i) => (
          <li key={`proc-${i}`}>{p}</li>
        ))}
      </ol>
    </section>
  );
}

