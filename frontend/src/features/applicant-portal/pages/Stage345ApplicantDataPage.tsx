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

import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { GraduationCap, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import {
  Button,
  Card,
  Field,
  Input,
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

const THANAWI_TYPE_OPTIONS = [
  { value: 'علمي علوم', label: 'ثانوية عامة — علمي علوم' },
  { value: 'علمي رياضة', label: 'ثانوية عامة — علمي رياضة' },
  { value: 'أدبي', label: 'ثانوية عامة — أدبي' },
  { value: 'علمي', label: 'ثانوية أزهرية — علمي' },
] as const;

export function Stage345ApplicantDataPage(): JSX.Element {
  const navigate = useNavigate();
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const showBachelor = selectedCategoryKey !== 'officers_general';

  const session = MOI_APPLICANT_SESSION;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
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

  const onSubmit = async (values: Stage345Values): Promise<void> => {
    await applicantPortalService.submitStage(APPLICANT_ID, 3, { profile: values });
    toast('تم حفظ بيانات الطالب', 'success');
    navigate(ROUTES.applicantVerify);
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
          <Input
            label="مجموع الثانوية العامة"
            type="number"
            required
            dir="ltr"
            {...register('thanawiTotal')}
            error={errors.thanawiTotal?.message}
          />
          <Select
            label="نوع الثانوية العامة"
            required
            {...register('thanawiType')}
            options={[...THANAWI_TYPE_OPTIONS]}
            error={errors.thanawiType?.message}
          />
          <Input
            label="النسبة المئوية للثانوية العامة"
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
