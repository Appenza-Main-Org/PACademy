/**
 * Stage345ApplicantDataPage — single scrollable applicant-data form
 * (PDF p.4 / MOI-aligned).
 *
 * Collapses the legacy Stage 3 (personal), Stage 4 (education), and
 * Stage 5 (marital) routes into one page. Marital data is intentionally
 * NOT here — it moves into the family page per the MOI reference (PDF
 * p.8). Personal data (name, NID, DOB, gender, mobile, email) is rendered
 * read-only because it came from the moi.gov.eg SSO handoff.
 *
 * Sections in DOM order:
 *   1. بيانات المؤهل الجامعي (للتقدم)  — only for non-`officers_general`
 *   2. بيانات الشهادة الثانوية
 *   3. البيانات الشخصية (read-only, MOI session)
 *   4. عنوان الإقامة وبيانات التواصل
 *   5. Footer — declaration checkbox + حفظ
 *
 * Submit routes to `/applicant/verify` (PDF p.5 lower).
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import {
  Check,
  GraduationCap,
  Info,
  MapPin,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Field,
  IconStamp,
  Input,
  LoadingState,
  SearchSelect,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { stage345Schema, type Stage345Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { REF_GOVERNORATES } from '@/shared/mock-data/referenceData';
import { CITIES } from '@/shared/mock-data/dictionaries';
import { useGrades } from '@/features/applicant-grades/api/grades.queries';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import type { GradeRow } from '@/features/applicant-grades/types';
import type { SchoolCategoryRow } from '@/features/lookups';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

const GOV_OPTIONS: readonly SearchSelectOption[] = REF_GOVERNORATES.map((g) => ({
  value: g.nameAr,
  label: g.nameAr,
  keywords: g.nameEn,
}));

const DISTRICT_OPTIONS: readonly SearchSelectOption[] = CITIES.map((c) => ({
  value: c,
  label: c,
}));

const COUNTRY_OPTIONS: readonly SearchSelectOption[] = [
  { value: 'مصر', label: 'مصر' },
  { value: 'السعودية', label: 'السعودية' },
  { value: 'الإمارات', label: 'الإمارات' },
  { value: 'الكويت', label: 'الكويت' },
  { value: 'قطر', label: 'قطر' },
  { value: 'البحرين', label: 'البحرين' },
];

const FACULTY_OPTIONS: readonly SearchSelectOption[] = [
  { value: 'الحقوق', label: 'الحقوق' },
  { value: 'الشرطة', label: 'الشرطة' },
  { value: 'التربية الرياضية', label: 'التربية الرياضية' },
  { value: 'الآداب', label: 'الآداب' },
  { value: 'العلوم', label: 'العلوم' },
  { value: 'الهندسة', label: 'الهندسة' },
  { value: 'الإعلام', label: 'الإعلام' },
  { value: 'الطب', label: 'الطب' },
];

const UNIVERSITY_OPTIONS: readonly SearchSelectOption[] = [
  { value: 'القاهرة', label: 'جامعة القاهرة' },
  { value: 'عين شمس', label: 'جامعة عين شمس' },
  { value: 'الإسكندرية', label: 'جامعة الإسكندرية' },
  { value: 'الأزهر', label: 'جامعة الأزهر' },
  { value: 'المنصورة', label: 'جامعة المنصورة' },
  { value: 'الزقازيق', label: 'جامعة الزقازيق' },
  { value: 'أسيوط', label: 'جامعة أسيوط' },
  { value: 'حلوان', label: 'جامعة حلوان' },
  { value: 'بنها', label: 'جامعة بنها' },
];

/* Branch / track options shown when the applicant enters thanawi data
 * manually. The school category itself comes from the
 * `school-categories` lookup; the branch values match the existing zod
 * union to keep the schema stable. */
const THANAWI_BRANCH_OPTIONS = [
  { value: 'علمي علوم', label: 'علمي علوم' },
  { value: 'علمي رياضة', label: 'علمي رياضة' },
  { value: 'أدبي', label: 'أدبي' },
  { value: 'علمي', label: 'علمي' },
] as const;

export function Stage345ApplicantDataPage(): JSX.Element {
  const navigate = useNavigate();
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const showBachelor = selectedCategoryKey !== 'officers_general';

  const session = MOI_APPLICANT_SESSION;

  /* Thanawi data is sourced from the admin /admin/applicant-grades dataset
   * by NID. If the applicant is found, the row is rendered read-only +
   * synced into the form on mount. If not found, the school-type Select
   * narrows to lookup rows whose `externalGradesImport` is false (the
   * manual-entry tracks: foreign equivalent diplomas, etc.). */
  const gradesQuery = useGrades();
  const schoolCategoriesQuery = useLookup('school-categories');
  const matchedGradeRow = useMemo<GradeRow | null>(() => {
    if (!gradesQuery.data) return null;
    return gradesQuery.data.find((r) => r.nid === session.nationalId) ?? null;
  }, [gradesQuery.data, session.nationalId]);
  const externalImport = matchedGradeRow !== null;

  const manualSchoolCategories = useMemo<SchoolCategoryRow[]>(() => {
    const all = schoolCategoriesQuery.data ?? [];
    return all.filter((c) => c.isActive && !c.externalGradesImport);
  }, [schoolCategoriesQuery.data]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
  } = useForm<Stage345Values>({
    resolver: zodResolver(stage345Schema),
    defaultValues: {
      bachelorMajor: '',
      bachelorBranch: '',
      bachelorSpecialization: '',
      bachelorFaculty: '',
      bachelorUniversity: '',
      bachelorPercentage: '',
      bachelorYear: '',
      thanawiCountry: 'مصر',
      thanawiTotal: 0,
      thanawiType: 'علمي علوم',
      thanawiPercentage: 0,
      schoolNameAr: '',
      schoolAddress: '',
      currentAddressDetail: '',
      addressGovernorate: '',
      addressDistrict: '',
      homePhone: '',
      fax: '',
      secondaryMobile: '',
      twitter: '',
      instagram: '',
      declaration: false as unknown as true,
    },
  });

  /* Sync the matched grade row into the form state so submission carries
   * the values even though the inputs are read-only. */
  useEffect(() => {
    if (!matchedGradeRow) return;
    const pct = matchedGradeRow.total / matchedGradeRow.importMax;
    setValue('thanawiTotal', matchedGradeRow.total);
    setValue(
      'thanawiPercentage',
      Number((pct * 100).toFixed(2)),
    );
    setValue('schoolNameAr', matchedGradeRow.school);
    setValue('schoolAddress', matchedGradeRow.region);
    setValue('thanawiCountry', 'مصر');
    /* Branch maps from the imported grade row's branch field. */
    const branch = matchedGradeRow.branch.trim();
    const known = THANAWI_BRANCH_OPTIONS.find((b) => b.value === branch);
    if (known) {
      setValue('thanawiType', known.value);
    }
  }, [matchedGradeRow, setValue]);

  const onSubmit = async (values: Stage345Values): Promise<void> => {
    await applicantPortalService.submitStage(APPLICANT_ID, 3, { profile: values });
    toast('تم حفظ بيانات الطالب', 'success');
    /* MOI-aligned: skip the legacy re-verify step — the applicant's
     * identity was already confirmed on moi.gov.eg. Route directly to
     * the summary. */
    navigate(ROUTES.applicant);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card>
        <h2 className="font-ar-display text-xl font-bold text-ink-900">
          التقدم للإلتحاق بأكاديمية الشرطة
        </h2>
        <p className="mt-1 text-sm text-ink-500 leading-normal">
          املأ البيانات الدراسية وعنوان الإقامة بدقة طبقاً للأوراق الثبوتية. البيانات الشخصية
          ورقم المحمول والبريد الإلكتروني مستوردة من بوابة وزارة الداخلية ولا تُعدَّل.
        </p>
      </Card>

      {showBachelor && (
        <Card>
          <SectionHeader
            icon={<GraduationCap size={16} strokeWidth={1.75} />}
            title="بيانات المؤهل الجامعي (للتقدم)"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="المجموعة" {...register('bachelorMajor')} error={errors.bachelorMajor?.message} />
            <Input label="الشعبة" {...register('bachelorBranch')} error={errors.bachelorBranch?.message} />
            <Input
              label="التخصص"
              {...register('bachelorSpecialization')}
              error={errors.bachelorSpecialization?.message}
            />
            <Field label="الكلية" error={errors.bachelorFaculty?.message}>
              <Controller
                control={control}
                name="bachelorFaculty"
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="الكلية"
                    placeholder="اختر الكلية"
                    options={FACULTY_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </Field>
            <Field label="الجامعة" error={errors.bachelorUniversity?.message}>
              <Controller
                control={control}
                name="bachelorUniversity"
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="الجامعة"
                    placeholder="اختر الجامعة"
                    options={UNIVERSITY_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </Field>
            <Input
              label="النسبة المئوية"
              type="number"
              min={0}
              max={100}
              step="0.01"
              dir="ltr"
              {...register('bachelorPercentage')}
              error={errors.bachelorPercentage?.message as string | undefined}
            />
            <Input
              label="سنة الحصول على المؤهل"
              type="number"
              min={1990}
              max={2099}
              dir="ltr"
              {...register('bachelorYear')}
              error={errors.bachelorYear?.message as string | undefined}
            />
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader
          icon={<GraduationCap size={16} strokeWidth={1.75} />}
          title="بيانات الشهادة الثانوية"
        />
        {gradesQuery.isLoading || schoolCategoriesQuery.isLoading ? (
          <LoadingState variant="list" rows={3} />
        ) : externalImport && matchedGradeRow ? (
          <ExternalGradesPanel row={matchedGradeRow} />
        ) : (
          <ManualThanawiFields
            register={register}
            control={control}
            errors={errors}
            categories={manualSchoolCategories}
          />
        )}
      </Card>

      <Card variant="compact">
        <SectionHeader
          icon={<User size={16} strokeWidth={1.75} />}
          title="البيانات الشخصية"
        />
        <div className="mb-3 inline-flex rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-1.5 text-2xs text-gold-700">
          هذه البيانات مستوردة من بوابة وزارة الداخلية ولا يمكن تعديلها
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          <ReadOnlyRow label="الإسم رباعي" value={session.fullName} />
          <ReadOnlyRow label="إسم الشهرة" value={session.fullName.split(' ').slice(0, 2).join(' ')} />
          <ReadOnlyRow label="النوع" value={session.gender === 'male' ? 'ذكر' : 'أنثى'} />
          <ReadOnlyRow label="الديانة" value={session.religion} />
          <ReadOnlyRow label="تاريخ الميلاد" value={session.dateOfBirthAr} />
          <ReadOnlyRow
            label="محل الميلاد"
            value={`${session.birthGovernorate} — ${session.birthDistrict}`}
          />
          <ReadOnlyRow label="الرقم القومي" value={session.nationalId} ltr mono />
        </dl>
      </Card>

      <Card>
        <SectionHeader
          icon={<MapPin size={16} strokeWidth={1.75} />}
          title="عنوان الإقامة وبيانات التواصل"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Textarea
            label="محل الإقامة الحالي تفصيلياً"
            required
            rows={2}
            {...register('currentAddressDetail')}
            error={errors.currentAddressDetail?.message}
            containerClassName="md:col-span-2"
          />
          <Field label="المحافظة" required error={errors.addressGovernorate?.message}>
            <Controller
              control={control}
              name="addressGovernorate"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="المحافظة"
                  placeholder="اختر المحافظة"
                  options={GOV_OPTIONS}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Field label="القسم / المركز" required error={errors.addressDistrict?.message}>
            <Controller
              control={control}
              name="addressDistrict"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="القسم / المركز"
                  placeholder="اختر القسم أو المركز"
                  options={DISTRICT_OPTIONS}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Input
            label="رقم التليفون السكني"
            type="tel"
            dir="ltr"
            {...register('homePhone')}
            error={errors.homePhone?.message}
          />
          <Input
            label="الفاكس"
            dir="ltr"
            {...register('fax')}
            error={errors.fax?.message}
          />
          <ReadOnlyInline label="رقم المحمول" value={session.mobile} ltr mono icon={<Phone size={14} strokeWidth={1.75} />} />
          <Input
            label="رقم محمول آخر"
            type="tel"
            dir="ltr"
            {...register('secondaryMobile')}
            error={errors.secondaryMobile?.message}
          />
          <Input
            label="تويتر"
            dir="ltr"
            placeholder="@username"
            {...register('twitter')}
            error={errors.twitter?.message}
          />
          <Input
            label="إنستجرام"
            dir="ltr"
            placeholder="@username"
            {...register('instagram')}
            error={errors.instagram?.message}
          />
          <ReadOnlyInline
            label="البريد الإلكتروني"
            value={session.email}
            ltr
            mono
            icon={<ShieldCheck size={14} strokeWidth={1.75} />}
            containerClassName="md:col-span-2"
          />
        </div>
      </Card>

      <Card>
        <Controller
          control={control}
          name="declaration"
          render={({ field }) => (
            <label className="flex items-start gap-3 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-teal-500"
              />
              <span className="leading-normal">
                <span className="font-medium text-ink-900">هل اطلعت على شروط الإلتحاق والإقرار الإلكتروني وتوافق عليها؟</span>
                <br />
                <span className="text-2xs text-ink-500">
                  تأكيدك يعني موافقتك على أن البيانات المُدرَجة صحيحة ومطابقة للأوراق الثبوتية، وأنك ستلتزم بإحضارها يوم الإختبار.
                </span>
              </span>
            </label>
          )}
        />
        {errors.declaration && (
          <p className="mt-2 text-2xs text-terra-700">{errors.declaration.message}</p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            حفظ والمتابعة
          </Button>
        </div>
      </Card>
    </form>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}): JSX.Element {
  return (
    <header className="mb-3 flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700"
      >
        {icon}
      </span>
      <h3 className="font-ar-display text-md font-bold text-ink-900">{title}</h3>
    </header>
  );
}

function ReadOnlyRow({
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
    <div>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={'mt-0.5 text-sm font-medium text-ink-900 ' + (mono ? 'font-mono' : '')}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function ReadOnlyInline({
  label,
  value,
  ltr,
  mono,
  icon,
  containerClassName,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
  icon?: React.ReactNode;
  containerClassName?: string;
}): JSX.Element {
  return (
    <div className={containerClassName}>
      <p className="mb-1 text-sm font-medium text-ink-700">{label}</p>
      <div className="flex items-center gap-2 rounded-md border border-border-default bg-ink-50/70 px-3 py-2">
        {icon && (
          <span aria-hidden className="text-ink-500">
            {icon}
          </span>
        )}
        <span
          className={'flex-1 text-sm text-ink-900 ' + (mono ? 'font-mono' : '')}
          dir={ltr ? 'ltr' : undefined}
        >
          {value}
        </span>
        <span className="text-2xs text-ink-500">من بوابة وزارة الداخلية</span>
      </div>
    </div>
  );
}

/* ─── ثانوية sub-panels ──────────────────────────────────────────── */

function ExternalGradesPanel({ row }: { row: GradeRow }): JSX.Element {
  const percent = ((row.total / row.importMax) * 100).toFixed(2);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-500/30 bg-teal-50/40 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-2xs text-teal-800">
          <IconStamp width={11} height={11} />
          تم استيراد بياناتك تلقائياً من قاعدة بيانات النتائج
        </span>
        <Badge tone="success">
          <Check size={11} strokeWidth={1.75} className="me-1 inline-block" />
          {row.kind === 'azhar' ? 'ثانوية أزهرية' : 'ثانوية عامة'}
        </Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
        <ReadOnlyRow label="رقم الجلوس" value={row.seatingNumber ?? '—'} ltr mono />
        <ReadOnlyRow label="الشعبة" value={row.branch} />
        <ReadOnlyRow label="المجموع" value={`${row.total} / ${row.importMax}`} ltr />
        <ReadOnlyRow label="النسبة المئوية" value={`${percent}%`} ltr />
        <ReadOnlyRow label="إسم المدرسة" value={row.school} />
        <ReadOnlyRow label="المحافظة / المنطقة" value={row.region} />
      </dl>
      <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
        <Info size={11} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
        للتعديل أو الاعتراض يرجى التوجه إلى لجنة القبول مصطحباً الأوراق الثبوتية.
      </p>
    </div>
  );
}

function ManualThanawiFields({
  register,
  control,
  errors,
  categories,
}: {
  register: ReturnType<typeof useForm<Stage345Values>>['register'];
  control: ReturnType<typeof useForm<Stage345Values>>['control'];
  errors: ReturnType<typeof useForm<Stage345Values>>['formState']['errors'];
  categories: readonly SchoolCategoryRow[];
}): JSX.Element {
  const typeOptions = categories.map((c) => ({ value: c.name, label: c.name }));
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
        <Info size={11} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
        لم يتم العثور على بياناتك في قاعدة الثانوية العامة / الأزهرية. يرجى إدخالها يدوياً —
        نوع الشهادة يقتصر على الفئات التي لا تُستورَد آلياً.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="دولة الشهادة الثانوية" required error={errors.thanawiCountry?.message}>
          <Controller
            control={control}
            name="thanawiCountry"
            render={({ field }) => (
              <SearchSelect
                ariaLabel="دولة الشهادة الثانوية"
                placeholder="اختر الدولة"
                options={COUNTRY_OPTIONS}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? '')}
              />
            )}
          />
        </Field>
        <Select
          label="نوع الشهادة"
          required
          {...register('thanawiType')}
          options={
            typeOptions.length > 0
              ? typeOptions
              : [{ value: '', label: 'لا توجد فئات متاحة' }]
          }
          error={errors.thanawiType?.message}
        />
        <Input
          label="المجموع"
          type="number"
          required
          dir="ltr"
          {...register('thanawiTotal')}
          error={errors.thanawiTotal?.message}
        />
        <Input
          label="النسبة المئوية"
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          dir="ltr"
          {...register('thanawiPercentage')}
          error={errors.thanawiPercentage?.message}
        />
        <Input
          label="إسم المدرسة باللغة العربية"
          required
          {...register('schoolNameAr')}
          error={errors.schoolNameAr?.message}
          containerClassName="md:col-span-2"
        />
        <Input
          label="عنوان المدرسة"
          required
          {...register('schoolAddress')}
          error={errors.schoolAddress?.message}
          containerClassName="md:col-span-2"
        />
      </div>
    </div>
  );
}
