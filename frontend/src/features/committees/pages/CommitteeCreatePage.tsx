/**
 * CommitteeCreatePage — local create form (does not share with edit).
 *
 * The committee is scoped to a single applicant category. Distribution
 * filters (gender, نوع المؤهل) are derived from that category's
 * `conditions` (reused from /admin/categories — no duplicated data).
 * The form drops the legacy capacity input in favour of a single
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
  type CategoryCondition,
  type CommitteeRules,
  type CommitteeStatus,
} from '@/shared/types/domain';
import { useCategoriesAdmin } from '@/features/admin/api/categories.queries';

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
  any: 'كل المؤهلات',
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
  filterApplicantType: z.string(),
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
      filterApplicantType: 'any',
    },
  });

  const categoryKey = watch('categoryKey');
  const filterGender = watch('filterGender');
  const filterApplicantType = watch('filterApplicantType');

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

  /* Filter option sets are derived from the selected category's
   * `conditions` so the form never offers a value the category has
   * locked out. When the category fixes a value (e.g. gender = 'male'),
   * the filter is rendered with that single option only. */
  const genderOptions = useMemo<GenderOption[]>(() => {
    if (!selectedCategory) return [];
    const g = selectedCategory.conditions.gender;
    if (g === 'any') return ['any', 'male', 'female'];
    return [g];
  }, [selectedCategory]);

  const qualificationOptions = useMemo<CategoryCondition['requiredQualification'][]>(() => {
    if (!selectedCategory) return [];
    const q = selectedCategory.conditions.requiredQualification;
    if (q === 'any') {
      return Object.keys(QUALIFICATION_LABEL) as CategoryCondition['requiredQualification'][];
    }
    return ['any', q];
  }, [selectedCategory]);

  /* Reset filter values to a known-safe default whenever the category
   * changes — the new category may not permit the previously-picked
   * gender / qualification. */
  const handleCategoryChange = (next: string | null): void => {
    const key: ApplicantCategoryKey | '' =
      next && isApplicantCategoryKey(next) ? next : '';
    setValue('categoryKey', key, { shouldValidate: true });
    setValue('filterGender', 'any', { shouldValidate: false });
    setValue('filterApplicantType', 'any', { shouldValidate: false });
  };

  const onSubmit = (values: FormValues): void => {
    if (!isApplicantCategoryKey(values.categoryKey)) return;

    /* Map filter values back through the existing rule bag — gender and
     * applicantType already live on `CommitteeRules`. maxPercentage is
     * the closest match for the service's `gradeMax` field. */
    const rules: CommitteeRules = {
      gradeFrom: 0,
      gradeTo: values.maxPercentage,
      academicGradeFromId: null,
      academicGradeToId: null,
      ...(values.filterGender !== 'any' ? { gender: values.filterGender } : {}),
      ...(values.filterApplicantType !== 'any'
        ? { applicantType: values.filterApplicantType }
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
              <Field
                label="الفئة"
                required
                error={errors.categoryKey?.message}
                helper={
                  isCategoryLocked
                    ? 'محدّدة من القائمة'
                    : 'الفئة التي ستستقبلها اللجنة (مصدر القائمة: /admin/categories)'
                }
                className="md:col-span-2"
              >
                <Combobox
                  value={categoryKey || null}
                  onChange={handleCategoryChange}
                  options={categoryOptions}
                  placeholder="اختر الفئة…"
                  ariaLabel="الفئة"
                  disabled={isCategoryLocked}
                />
              </Field>

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
              />
            </div>
          </CardBody>
        </Card>

        {/* ── Section 3 — Category-driven filters ─────────────────── */}
        <Card>
          <CardHeader
            title="فلاتر التوزيع"
            subtitle="الخيارات مستمدّة من شروط الفئة المختارة (/admin/categories)"
          />
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
                <Field label="نوع المؤهل">
                  <Combobox
                    value={filterApplicantType}
                    onChange={(v) =>
                      setValue('filterApplicantType', v ?? 'any', {
                        shouldValidate: false,
                      })
                    }
                    options={qualificationOptions.map((q) => ({
                      value: q,
                      label: QUALIFICATION_LABEL[q],
                    }))}
                    placeholder="اختر المؤهل…"
                    ariaLabel="نوع المؤهل"
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
