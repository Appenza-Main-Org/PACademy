/**
 * CommitteeCreatePage — local create form (does not share with edit).
 *
 * The committee is scoped to a single applicant category. The gender
 * filter is derived from that category's `conditions` (reused from
 * /admin/categories — no duplicated data); the academic-degree filter
 * is sourced from the `academic-degrees` reference lookup. The form
 * drops the legacy capacity input in favour of a single
 * "الحد الأقصى (نسبة %)" cap that doubles as the committee grade ceiling.
 */

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { z } from 'zod';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Combobox,
  Field,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { useCreateCommittee } from '../api/committee.queries';
import { ROUTES } from '@/config/routes';
import {
  APPLICANT_CATEGORY_KEYS,
  type ApplicantCategoryKey,
  type CommitteeRules,
  type CommitteeStatus,
} from '@/shared/types/domain';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';
import { ACADEMIC_DEGREES } from '@/features/lookups';

const ACADEMIC_YEARS = [
  { value: '2026-2027', label: 'العام الدراسي 2026 / 2027' },
  { value: '2025-2026', label: 'العام الدراسي 2025 / 2026' },
  { value: '2024-2025', label: 'العام الدراسي 2024 / 2025' },
] as const;

const CYCLE_OPTIONS = [
  { value: 'CYC-2026-M', label: 'دورة التقديم 2026' },
  { value: 'CYC-2025-M', label: 'دورة 2025 - الذكور' },
  { value: 'CYC-2025-F', label: 'دورة 2025 - الإناث' },
] as const;

const STATUS_OPTIONS: ReadonlyArray<{ value: CommitteeStatus; label: string }> = [
  { value: 'active', label: 'مفعّلة' },
  { value: 'inactive', label: 'موقوفة' },
];

type GenderOption = 'any' | 'male' | 'female';

const GENDER_LABEL: Record<GenderOption, string> = {
  any: 'كل المتقدمين',
  male: 'ذكور',
  female: 'إناث',
};

const isApplicantCategoryKey = (v: string): v is ApplicantCategoryKey =>
  (APPLICANT_CATEGORY_KEYS as readonly string[]).includes(v);

const schema = z.object({
  categoryKey: z
    .string()
    .min(1, 'اختر الفئة')
    .refine((v) => v === '' || isApplicantCategoryKey(v), 'الفئة غير صحيحة'),
  name: z.string().trim().min(2, 'أدخِل اسم اللجنة'),
  academicYearId: z.string().min(1, 'اختر العام الدراسي'),
  status: z.enum(['active', 'inactive']),
  cycleId: z.string().min(1, 'اختر الدورة المرتبطة'),
  maxPercentage: z
    .number({ invalid_type_error: 'أدخِل قيمة الحد الأقصى' })
    .int('قيمة الحد الأقصى عدد صحيح')
    .min(1, 'الحد الأقصى لا يقل عن 1٪')
    .max(100, 'الحد الأقصى لا يتجاوز 100٪'),
  filterGender: z.enum(['any', 'male', 'female']),
  academicDegree: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function CommitteeCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateCommittee();
  const categoriesQuery = useCategoriesAdmin({ includeDeleted: false });

  /* When the admin clicks "إنشاء لجنة" from /admin/committee/list, the
   * active tab's key is passed via `?category=<key>` so the create form
   * lands pre-scoped to that category. Invalid / missing values fall
   * through to the editable selector. */
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category');
  const presetCategoryKey: ApplicantCategoryKey | null =
    requestedCategory && isApplicantCategoryKey(requestedCategory)
      ? requestedCategory
      : null;
  const isCategoryLocked = presetCategoryKey !== null;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryKey: presetCategoryKey ?? '',
      name: '',
      academicYearId: ACADEMIC_YEARS[0].value,
      status: 'active',
      cycleId: CYCLE_OPTIONS[0].value,
      maxPercentage: 100,
      filterGender: 'any',
      academicDegree: 'any',
    },
  });

  const categoryKey = watch('categoryKey');
  const filterGender = watch('filterGender');
  const academicDegree = watch('academicDegree');

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((c) => ({
        value: c.key,
        label: c.labelAr,
        badge: c.labelEn || c.key,
      })),
    [categoriesQuery.data],
  );

  const selectedCategory = useMemo(
    () => (categoriesQuery.data ?? []).find((c) => c.key === categoryKey),
    [categoriesQuery.data, categoryKey],
  );

  /* Gender filter options are derived from the selected category's
   * `conditions.gender` so the form never offers a value the category
   * has locked out. When the category fixes a value (e.g. 'male'), the
   * filter is rendered with that single option only. */
  const genderOptions = useMemo<GenderOption[]>(() => {
    if (!selectedCategory) return [];
    const g = selectedCategory.conditions.gender;
    if (g === 'any') return ['any', 'male', 'female'];
    return [g];
  }, [selectedCategory]);

  /* Academic-degree options sourced from the `academic-degrees` reference
   * lookup. Prepended with an "any" sentinel so the filter can opt out. */
  const academicDegreeOptions = useMemo(
    () => [
      { value: 'any', label: 'كل الدرجات' },
      ...ACADEMIC_DEGREES.filter((d) => d.isActive).map((d) => ({
        value: d.code,
        label: d.name,
      })),
    ],
    [],
  );

  /* Reset filter values to a known-safe default whenever the category
   * changes — the new category may not permit the previously-picked
   * gender. */
  const handleCategoryChange = (next: string | null): void => {
    const key: ApplicantCategoryKey | '' =
      next && isApplicantCategoryKey(next) ? next : '';
    setValue('categoryKey', key, { shouldValidate: true });
    setValue('filterGender', 'any', { shouldValidate: false });
    setValue('academicDegree', 'any', { shouldValidate: false });
  };

  const onSubmit = (values: FormValues): void => {
    if (!isApplicantCategoryKey(values.categoryKey)) return;

    /* Map filter values back through the existing rule bag — gender lives
     * on `CommitteeRules` directly; the picked academic-degree lookup
     * code rides on `applicantType` (free-form lookup-key field).
     * maxPercentage maps to the service's `gradeMax`. */
    const rules: CommitteeRules = {
      gradeFrom: 0,
      gradeTo: values.maxPercentage,
      academicGradeFromId: null,
      academicGradeToId: null,
      ...(values.filterGender !== 'any' ? { gender: values.filterGender } : {}),
      ...(values.academicDegree !== 'any'
        ? { applicantType: values.academicDegree }
        : {}),
    };

    createMut.mutate(
      {
        name: values.name,
        head: '',
        type: 'capacities',
        members: 0,
        capacityPerSession: 0,
        cycleId: values.cycleId,
        categoryKey: values.categoryKey,
        capacity: 0,
        gradeType: 'score',
        gradeMin: 0,
        gradeMax: values.maxPercentage,
        academicYearId: values.academicYearId,
        status: values.status,
        specializationIds: [values.categoryKey],
        rules,
      },
      {
        onSuccess: (committee) => {
          toast(`تم إنشاء لجنة ${committee.name}`, 'success');
          navigate(ROUTES.committee.list);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  const filtersAvailable = Boolean(selectedCategory);

  return (
    <CenteredShell>
      <PageHeader
        title="إنشاء لجنة جديدة"
        subtitle="اختر الفئة، عرّف بيانات اللجنة، حدّد الفلاتر والحد الأقصى للقبول."
        breadcrumbs={[
          { label: 'لجان القبول', href: ROUTES.committee.list },
          { label: 'إنشاء لجنة' },
        ]}
      />
      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        {/* ── Section 1 — Basic information ─────────────────────── */}
        <Card>
          <CardHeader title="المعلومات الأساسية" subtitle="الفئة، اسم اللجنة، العام الدراسي، الحالة" />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              {isCategoryLocked ? (
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm font-medium text-ink-700">الفئة</span>
                  <div
                    className="flex h-9 items-center rounded-md border px-3"
                    style={{
                      background: 'var(--accent-50)',
                      borderColor: 'var(--accent-200)',
                    }}
                  >
                    <span
                      className="text-md font-bold"
                      style={{ color: 'var(--accent-700)' }}
                    >
                      {selectedCategory?.labelAr ?? presetCategoryKey}
                    </span>
                  </div>
                  <span className="text-xs text-ink-500">محدّدة من القائمة</span>
                </div>
              ) : (
                <Field
                  label="الفئة"
                  required
                  error={errors.categoryKey?.message}
                  className="md:col-span-2"
                >
                  <Combobox
                    value={categoryKey || null}
                    onChange={handleCategoryChange}
                    options={categoryOptions}
                    placeholder="اختر الفئة…"
                    ariaLabel="الفئة"
                  />
                </Field>
              )}

              <Input
                label="اسم اللجنة"
                required
                {...register('name')}
                error={errors.name?.message}
                containerClassName="md:col-span-2"
              />
              <Select
                label="العام الدراسي"
                required
                {...register('academicYearId')}
                options={ACADEMIC_YEARS}
                error={errors.academicYearId?.message}
              />
              <Select
                label="الحالة"
                {...register('status')}
                options={STATUS_OPTIONS}
              />
              <Select
                label="الدورة المرتبطة"
                required
                {...register('cycleId')}
                options={CYCLE_OPTIONS}
                error={errors.cycleId?.message}
                containerClassName="md:col-span-2"
              />
            </div>
          </CardBody>
        </Card>

        {/* ── Section 2 — Cap ─────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="حدود القبول"
            subtitle="الحد الأقصى للنسبة المئوية التي تقبلها اللجنة"
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="الحد الأقصى (نسبة %)"
                type="number"
                min={1}
                max={100}
                step={1}
                required
                {...register('maxPercentage', { valueAsNumber: true })}
                trailingIcon={<span className="text-sm text-ink-500">٪</span>}
                error={errors.maxPercentage?.message}
                helper="نسبة قبول من 1 إلى 100"
                className="ps-4 pe-12"
                containerClassName="max-w-xs"
              />
            </div>
          </CardBody>
        </Card>

        {/* ── Section 3 — Category-driven filters ─────────────────── */}
        <Card>
          <CardHeader title="فلاتر التوزيع" />
          <CardBody>
            {!filtersAvailable ? (
              <p
                className="rounded-md border border-dashed px-3 py-2 text-sm"
                style={{
                  borderColor: 'var(--accent-200)',
                  background: 'var(--accent-50)',
                  color: 'var(--accent-700)',
                }}
              >
                اختر الفئة أولاً لعرض الفلاتر المتاحة
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="النوع">
                  <Combobox
                    value={filterGender}
                    onChange={(v) =>
                      setValue('filterGender', (v ?? 'any') as GenderOption, {
                        shouldValidate: false,
                      })
                    }
                    options={genderOptions.map((g) => ({
                      value: g,
                      label: GENDER_LABEL[g],
                    }))}
                    placeholder="اختر النوع…"
                    ariaLabel="النوع"
                  />
                </Field>
                <Field label="الدرجة العلمية">
                  <Combobox
                    value={academicDegree}
                    onChange={(v) =>
                      setValue('academicDegree', v ?? 'any', {
                        shouldValidate: false,
                      })
                    }
                    options={academicDegreeOptions}
                    placeholder="اختر الدرجة…"
                    ariaLabel="الدرجة العلمية"
                  />
                </Field>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(ROUTES.committee.list)}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={createMut.isPending || isSubmitting}
            leadingIcon={<Save size={14} strokeWidth={1.75} />}
          >
            إنشاء اللجنة
          </Button>
        </div>
      </form>
    </CenteredShell>
  );
}
