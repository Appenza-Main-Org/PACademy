/**
 * Admin applicant form — used by both /admin/applicants/new and
 * /admin/applicants/:id/edit. Mirrors the RFP Scope Document pp.22-36 1:1
 * across 7 sections (identity, address, contact, department, education,
 * family, relatives), with the education sub-form swapping per department.
 *
 * Layout: single scrollable page with section anchors + a sticky right-rail
 * jump-list (collapses to a sticky bottom anchor strip <900px).
 *
 * State:
 *   - react-hook-form composed of per-section zod schemas (see schemas.ts).
 *   - 30-second localStorage autosave with last-saved indicator; cleared on
 *     successful submit.
 *   - NID input auto-decodes birthDate / gender / governorate code as
 *     read-only confirmation chips beside the field.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { FieldPath, Resolver } from 'react-hook-form';
import {
  AlertCircle,
  ChevronUp,
  Lock,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button, Card, CardHeader, Field, Input, SearchSelect, Select, Textarea } from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors } from '@/shared/lib/validation-errors';
import { parseNationalId } from '@/shared/lib/national-id';
import { date as fmtDate } from '@/shared/lib/format';
import { GOVERNORATES } from '@/shared/mock-data/dictionaries';
import { REF_RELATIONSHIPS } from '@/shared/mock-data/referenceData';
import {
  applicantInputSchema,
  EDUCATION_KIND_BY_DEPT,
  SECTION_LABELS,
  SECTION_ORDER,
  type ApplicantInput,
  type SectionKey,
} from '@/features/applicants/schemas';
import { DEPARTMENT_LABELS, type DepartmentKey } from '@/shared/types/domain';

const NID_GOVERNORATE_LABELS: Record<string, string> = {
  '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس',
  '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية',
  '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة',
  '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم',
  '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا',
  '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد',
  '33': 'مرسى مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء',
};

const RELATIONSHIP_OPTIONS = REF_RELATIONSHIPS.map((r) => ({
  value: r.id,
  label: r.nameAr,
}));

const GOV_OPTIONS: readonly SearchSelectOption[] = GOVERNORATES.map((g) => ({
  value: g,
  label: g,
}));

const DEPARTMENT_OPTIONS: { value: DepartmentKey; label: string }[] = (
  Object.entries(DEPARTMENT_LABELS) as [DepartmentKey, string][]
).map(([value, label]) => ({ value, label }));

const RELIGION_OPTIONS = [
  { value: 'مسلم', label: 'مسلم' },
  { value: 'مسيحي', label: 'مسيحي' },
];

const MARITAL_OPTIONS = [
  { value: 'أعزب', label: 'أعزب' },
  { value: 'متزوج', label: 'متزوج' },
  { value: 'مطلق', label: 'مطلق' },
  { value: 'أرمل', label: 'أرمل' },
];

const SCIENCE_BRANCH_OPTIONS = [
  { value: 'علمي علوم', label: 'علمي علوم' },
  { value: 'علمي رياضة', label: 'علمي رياضة' },
  { value: 'أدبي', label: 'أدبي' },
];

const EMPTY_FAMILY_MEMBER = {
  fullName: '',
  alive: true,
  nationalId: '',
  occupation: '',
  governorate: '',
  education: '',
};

export interface ApplicantFormProps {
  initialValues?: Partial<ApplicantInput>;
  /** Read-only banner — set when applicant is suspended (`موقوف`). */
  fullyLocked?: boolean;
  /** Locks personal + academic fields; only contact remains editable. */
  personalAcademicLocked?: boolean;
  submitLabel?: string;
  /** Called with the full form values on successful submit. */
  onSubmit: (values: ApplicantInput) => Promise<void> | void;
  /** Optional NID inline error (e.g. duplicate detected at server). */
  nidServerError?: string | null;
  /** Storage key for the autosave draft. Pass null to disable autosave. */
  autosaveKey?: string | null;
}

const NEW_DRAFT_KEY = 'admin-applicant-draft-new';

const DEFAULT_VALUES: ApplicantInput = {
  nationalId: '',
  fullName: { first: '', second: '', third: '', fourth: '' },
  religion: 'مسلم',
  maritalStatus: 'أعزب',
  currentAddress: { governorate: '', city: '', detail: '', street: '' },
  contact: {
    homePhone: '',
    mobilePhone: '',
    email: '',
    socialFacebook: '',
    socialInstagram: '',
    socialX: '',
    socialOther: '',
  },
  department: 'general_first',
  education: {
    kind: 'general',
    certificateName: 'ثانوية عامة 2026',
    schoolName: '',
    totalScore: 0,
    branch: 'علمي علوم',
    schoolCategory: '',
    graduationYear: 2025,
    percentage: 0,
  },
  family: {
    siblings: [],
    relatives: [],
  },
};

function mergeDefaults(initial?: Partial<ApplicantInput>): ApplicantInput {
  if (!initial) return DEFAULT_VALUES;
  return {
    ...DEFAULT_VALUES,
    ...initial,
    fullName: { ...DEFAULT_VALUES.fullName, ...(initial.fullName ?? {}) },
    currentAddress: { ...DEFAULT_VALUES.currentAddress, ...(initial.currentAddress ?? {}) },
    contact: { ...DEFAULT_VALUES.contact, ...(initial.contact ?? {}) },
    education: initial.education ?? DEFAULT_VALUES.education,
    family: { ...DEFAULT_VALUES.family, ...(initial.family ?? {}) },
  };
}

export function ApplicantForm({
  initialValues,
  fullyLocked = false,
  personalAcademicLocked = false,
  submitLabel = 'حفظ المتقدم',
  onSubmit,
  nidServerError,
  autosaveKey = NEW_DRAFT_KEY,
}: ApplicantFormProps): JSX.Element {
  const seed = useMemo(() => mergeDefaults(initialValues), [initialValues]);

  /* Hydrate from autosave once, only when no initialValues were passed
   * (autosave is for the "new" path). */
  const [hydrated] = useState<ApplicantInput>(() => {
    if (initialValues || !autosaveKey) return seed;
    try {
      const raw = localStorage.getItem(autosaveKey);
      if (!raw) return seed;
      return mergeDefaults(JSON.parse(raw) as Partial<ApplicantInput>);
    } catch {
      return seed;
    }
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ApplicantInput>({
    resolver: zodResolver(applicantInputSchema) as Resolver<ApplicantInput>,
    defaultValues: hydrated,
  });

  /* Re-seed when an upstream prefilled query lands later than mount. */
  useEffect(() => {
    if (initialValues) reset(mergeDefaults(initialValues));
  }, [initialValues, reset]);

  /* ── Autosave (every 30s) ────────────────────────────────────────────── */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!autosaveKey) return undefined;
    const interval = window.setInterval(() => {
      try {
        localStorage.setItem(autosaveKey, JSON.stringify(getValues()));
        setSavedAt(Date.now());
      } catch {
        /* localStorage may be full; silently skip — not critical */
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [autosaveKey, getValues]);

  /* ── Active section anchor (driven by intersection observer) ─────────── */
  const [activeSection, setActiveSection] = useState<SectionKey>('identity');
  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({
    identity: null,
    address: null,
    contact: null,
    department: null,
    education: null,
    family: null,
    relatives: null,
  });
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const key = (visible.target as HTMLElement).dataset.section as SectionKey;
          if (key) setActiveSection(key);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  /* ── NID auto-decode (read-only confirmation chips) ──────────────────── */
  const nidValue = watch('nationalId');
  const nidInfo = useMemo(() => parseNationalId(nidValue || ''), [nidValue]);

  /* ── Department-driven education swap ─────────────────────────────────── */
  const department = watch('department') as DepartmentKey;
  const educationKind = useWatch({ control, name: 'education.kind' });
  useEffect(() => {
    const targetKind = EDUCATION_KIND_BY_DEPT[department];
    if (educationKind === targetKind) return;
    if (targetKind === 'general') {
      setValue('education', {
        kind: 'general',
        certificateName: 'ثانوية عامة',
        schoolName: '',
        totalScore: 0,
        branch: 'علمي علوم',
        schoolCategory: '',
        graduationYear: 2025,
        percentage: 0,
      });
    } else if (targetKind === 'overseas') {
      setValue('education', {
        kind: 'overseas',
        certificateName: '',
        schoolName: '',
        totalScore: 0,
        country: '',
        graduationYear: 2025,
      });
    } else {
      setValue('education', {
        kind: 'higher',
        specialization: '',
        university: '',
        faculty: '',
        totalScore: 0,
        graduationYear: 2024,
        secondary: { certificateName: 'ثانوية عامة', totalScore: 0 },
      });
    }
  }, [department, educationKind, setValue]);

  const submitting = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      if (autosaveKey) {
        try { localStorage.removeItem(autosaveKey); } catch { /* noop */ }
      }
    } catch (err) {
      if (isValidationError(err)) {
        const fieldErrors = validationFieldErrors(err);
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as FieldPath<ApplicantInput>, { type: 'server', message });
        }
      }
      throw err;
    }
  });

  const siblingsArr = useFieldArray({ control, name: 'family.siblings' });
  const relativesArr = useFieldArray({ control, name: 'family.relatives' });

  const allowEdit = !fullyLocked;
  const allowPersonalAcademic = allowEdit && !personalAcademicLocked;
  const lockedFieldHint = (
    <span className="ms-1 inline-flex items-center gap-1 text-2xs text-ink-500">
      <Lock size={11} strokeWidth={1.75} />
      محجوز
    </span>
  );

  const sectionRef = (key: SectionKey) => (el: HTMLElement | null) => {
    sectionRefs.current[key] = el;
  };

  return (
    <form onSubmit={submitting} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="flex min-w-0 flex-col gap-5">
        {fullyLocked && (
          <div className="flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-sm text-gold-700">
            <ShieldCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
            <p>
              <strong>هذا المتقدم موقوف</strong> · لا يمكن التعديل. لرفع الإيقاف،
              غيّر الحالة من سجل الإجراءات.
            </p>
          </div>
        )}
        {personalAcademicLocked && !fullyLocked && (
          <div className="flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-sm text-gold-700">
            <Lock size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
            <p>
              <strong>تم طباعة كارت التردد</strong> · البيانات الشخصية والدراسية
              محجوزة. يمكن تعديل بيانات الاتصال فقط.
            </p>
          </div>
        )}

        {/* §1 — Identity */}
        <section
          id="section-identity"
          ref={sectionRef('identity')}
          data-section="identity"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader title={SECTION_LABELS.identity} subtitle="بيانات بطاقة الرقم القومي" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label={
                    <span className="flex items-center">
                      الرقم القومي (14 رقم)
                      {(initialValues || personalAcademicLocked) && lockedFieldHint}
                    </span>
                  }
                  required
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={14}
                  disabled={Boolean(initialValues) || !allowPersonalAcademic}
                  error={errors.nationalId?.message ?? nidServerError ?? undefined}
                  helper={
                    nidInfo.valid && nidInfo.birthDate
                      ? `تاريخ الميلاد: ${fmtDate(nidInfo.birthDate, 'short')} · النوع: ${nidInfo.gender === 'male' ? 'ذكر' : 'أنثى'} · المحافظة: ${NID_GOVERNORATE_LABELS[nidInfo.governorateCode ?? ''] ?? '—'}`
                      : 'يتم استخراج تاريخ الميلاد والنوع والمحافظة تلقائياً من الرقم'
                  }
                  {...register('nationalId')}
                />
              </div>
              <Input label="الاسم الأول" required disabled={!allowPersonalAcademic} error={errors.fullName?.first?.message} {...register('fullName.first')} />
              <Input label="اسم الأب" required disabled={!allowPersonalAcademic} error={errors.fullName?.second?.message} {...register('fullName.second')} />
              <Input label="اسم الجد" required disabled={!allowPersonalAcademic} error={errors.fullName?.third?.message} {...register('fullName.third')} />
              <Input label="اسم العائلة" required disabled={!allowPersonalAcademic} error={errors.fullName?.fourth?.message} {...register('fullName.fourth')} />
              <Select
                label="الديانة"
                required
                disabled={!allowPersonalAcademic}
                error={errors.religion?.message}
                options={RELIGION_OPTIONS}
                {...register('religion')}
              />
              <Select
                label="الحالة الاجتماعية"
                required
                disabled={!allowEdit}
                error={errors.maritalStatus?.message}
                options={MARITAL_OPTIONS}
                {...register('maritalStatus')}
              />
            </div>
          </Card>
        </section>

        {/* §2 — Address */}
        <section
          id="section-address"
          ref={sectionRef('address')}
          data-section="address"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader title={SECTION_LABELS.address} subtitle="عنوان الإقامة الفعلي" />
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="المحافظة"
                required
                error={errors.currentAddress?.governorate?.message}
              >
                <Controller
                  control={control}
                  name="currentAddress.governorate"
                  render={({ field }) => (
                    <SearchSelect
                      value={field.value ? field.value : null}
                      onChange={(next) => field.onChange(next ?? '')}
                      options={GOV_OPTIONS}
                      ariaLabel="المحافظة"
                      placeholder="اختر المحافظة"
                      disabled={!allowEdit}
                    />
                  )}
                />
              </Field>
              <Input
                label="المدينة / القرية"
                required
                disabled={!allowEdit}
                error={errors.currentAddress?.city?.message}
                {...register('currentAddress.city')}
              />
              <Input
                label="العنوان التفصيلي"
                required
                disabled={!allowEdit}
                error={errors.currentAddress?.detail?.message}
                containerClassName="md:col-span-2"
                {...register('currentAddress.detail')}
              />
              <Input
                label="الشارع (اختياري)"
                disabled={!allowEdit}
                {...register('currentAddress.street')}
              />
            </div>
          </Card>
        </section>

        {/* §3 — Contact (always editable when applicant exists) */}
        <section
          id="section-contact"
          ref={sectionRef('contact')}
          data-section="contact"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader title={SECTION_LABELS.contact} subtitle="هاتف وبريد إلكتروني وروابط تواصل" />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="هاتف ثابت"
                disabled={!allowEdit}
                dir="ltr"
                {...register('contact.homePhone')}
              />
              <Input
                label="محمول رئيسي"
                required
                disabled={!allowEdit}
                dir="ltr"
                error={errors.contact?.mobilePhone?.message}
                {...register('contact.mobilePhone')}
              />
              <Input
                label="البريد الإلكتروني"
                disabled={!allowEdit}
                dir="ltr"
                error={errors.contact?.email?.message}
                {...register('contact.email')}
              />
              <Input
                label="فيسبوك"
                disabled={!allowEdit}
                dir="ltr"
                {...register('contact.socialFacebook')}
              />
              <Input label="إنستجرام" disabled={!allowEdit} dir="ltr" {...register('contact.socialInstagram')} />
              <Input label="X (تويتر)" disabled={!allowEdit} dir="ltr" {...register('contact.socialX')} />
              <Input
                label="رابط آخر"
                disabled={!allowEdit}
                dir="ltr"
                containerClassName="md:col-span-2"
                {...register('contact.socialOther')}
              />
            </div>
          </Card>
        </section>

        {/* §4 — Department */}
        <section
          id="section-department"
          ref={sectionRef('department')}
          data-section="department"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader
              title={SECTION_LABELS.department}
              subtitle="تحديد الفئة يحدد البيانات الدراسية المطلوبة"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="فئة التقدم"
                required
                disabled={!allowPersonalAcademic}
                error={errors.department?.message}
                options={DEPARTMENT_OPTIONS}
                {...register('department')}
              />
              <Input
                label="رقم الدورة (اختياري)"
                disabled={!allowEdit}
                placeholder={initialValues?.cycleId ?? 'CYC-2026-M-1'}
                {...register('cycleId')}
              />
            </div>
          </Card>
        </section>

        {/* §5 — Education (variant by department) */}
        <section
          id="section-education"
          ref={sectionRef('education')}
          data-section="education"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader
              title={SECTION_LABELS.education}
              subtitle={
                educationKind === 'general'
                  ? 'بيانات قسم عام · دور أول/ثاني'
                  : educationKind === 'overseas'
                    ? 'بيانات قسم وافد مصري / دبلومات أجنبية'
                    : 'بيانات قسم خاص / حقوقيين / ماجستير-دكتوراه'
              }
            />
            {educationKind === 'general' && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="اسم الشهادة" required disabled={!allowPersonalAcademic} {...register('education.certificateName')} />
                <Input label="اسم المدرسة" required disabled={!allowPersonalAcademic} {...register('education.schoolName')} />
                <Input label="المجموع" type="number" required disabled={!allowPersonalAcademic} {...register('education.totalScore' as const, { valueAsNumber: true })} />
                <Input label="نوع الجلوس" disabled={!allowPersonalAcademic} {...register('education.seatType')} />
                <Select
                  label="الشعبة"
                  required
                  disabled={!allowPersonalAcademic}
                  options={SCIENCE_BRANCH_OPTIONS}
                  {...register('education.branch')}
                />
                <Input label="فئة المدرسة" disabled={!allowPersonalAcademic} {...register('education.schoolCategory')} />
                <Input label="سنة التخرج" type="number" required disabled={!allowPersonalAcademic} {...register('education.graduationYear' as const, { valueAsNumber: true })} />
                <Input label="النسبة المئوية" type="number" step="any" disabled={!allowPersonalAcademic} {...register('education.percentage' as const, { valueAsNumber: true })} />
              </div>
            )}
            {educationKind === 'overseas' && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="اسم الشهادة من منصة التحقق" required disabled={!allowPersonalAcademic} {...register('education.certificateName')} />
                <Input label="اسم المدرسة" required disabled={!allowPersonalAcademic} {...register('education.schoolName')} />
                <Input label="المجموع" type="number" required disabled={!allowPersonalAcademic} {...register('education.totalScore' as const, { valueAsNumber: true })} />
                <Input label="نوع الجلوس" disabled={!allowPersonalAcademic} {...register('education.seatType')} />
                <Input label="فئة المدرسة" disabled={!allowPersonalAcademic} {...register('education.schoolCategory')} />
                <Input label="دولة الدراسة" required disabled={!allowPersonalAcademic} {...register('education.country')} />
                <Input label="سنة التخرج" type="number" required disabled={!allowPersonalAcademic} {...register('education.graduationYear' as const, { valueAsNumber: true })} />
              </div>
            )}
            {educationKind === 'higher' && (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input label="التخصص" required disabled={!allowPersonalAcademic} {...register('education.specialization')} />
                  <Input label="الجامعة" required disabled={!allowPersonalAcademic} {...register('education.university')} />
                  <Input label="الكلية" required disabled={!allowPersonalAcademic} {...register('education.faculty')} />
                  <Input label="المجموع" type="number" required disabled={!allowPersonalAcademic} {...register('education.totalScore' as const, { valueAsNumber: true })} />
                  <Input label="التقدير" disabled={!allowPersonalAcademic} {...register('education.grade')} />
                  <Input
                    label="تخصص المؤهل الأعلى (ماجستير/دكتوراه)"
                    disabled={!allowPersonalAcademic}
                    {...register('education.higherSpecialization')}
                  />
                  <Input label="سنة التخرج" type="number" required disabled={!allowPersonalAcademic} {...register('education.graduationYear' as const, { valueAsNumber: true })} />
                </div>
                <div className="rounded-md border border-border-subtle bg-ink-50/40 p-3">
                  <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">
                    بيانات الثانوية العامة (مرفقة بالطلب)
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input label="اسم الشهادة" required disabled={!allowPersonalAcademic} {...register('education.secondary.certificateName')} />
                    <Input label="المجموع" type="number" required disabled={!allowPersonalAcademic} {...register('education.secondary.totalScore' as const, { valueAsNumber: true })} />
                    <Input label="فئة المدرسة" disabled={!allowPersonalAcademic} {...register('education.secondary.schoolCategory')} />
                    <Input label="الدولة" disabled={!allowPersonalAcademic} {...register('education.secondary.country')} />
                    <Input label="النسبة المئوية" type="number" step="any" disabled={!allowPersonalAcademic} {...register('education.secondary.percentage' as const, { valueAsNumber: true })} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* §6 — Family (mirrors Stage7 portal — admin form, not portal) */}
        <section
          id="section-family"
          ref={sectionRef('family')}
          data-section="family"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader title={SECTION_LABELS.family} subtitle="الوالدان والأجداد" />
            <div className="flex flex-col gap-4">
              <FixedFamilyMember
                title="الأب"
                prefix="father"
                disabled={!allowEdit}
                register={register}
              />
              <FixedFamilyMember
                title="الأم"
                prefix="mother"
                disabled={!allowEdit}
                register={register}
              />
              <FixedFamilyMember
                title="الجد لأب"
                prefix="paternalGrandfather"
                disabled={!allowEdit}
                register={register}
              />
              <FixedFamilyMember
                title="الجدة لأب"
                prefix="paternalGrandmother"
                disabled={!allowEdit}
                register={register}
              />
              <FixedFamilyMember
                title="الجد لأم"
                prefix="maternalGrandfather"
                disabled={!allowEdit}
                register={register}
              />
              <FixedFamilyMember
                title="الجدة لأم"
                prefix="maternalGrandmother"
                disabled={!allowEdit}
                register={register}
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-ar-display text-md font-bold text-ink-900">الإخوة والأخوات</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Plus size={12} strokeWidth={1.75} />}
                    onClick={() => siblingsArr.append({ ...EMPTY_FAMILY_MEMBER })}
                    disabled={!allowEdit}
                  >
                    إضافة
                  </Button>
                </div>
                {siblingsArr.fields.length === 0 && (
                  <p className="text-2xs text-ink-500">لا توجد بيانات إخوة مسجلة</p>
                )}
                <div className="flex flex-col gap-2">
                  {siblingsArr.fields.map((field, i) => (
                    <div
                      key={field.id}
                      className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <Input label="الاسم" disabled={!allowEdit} {...register(`family.siblings.${i}.fullName` as const)} />
                      <Input label="الرقم القومي" dir="ltr" disabled={!allowEdit} {...register(`family.siblings.${i}.nationalId` as const)} />
                      <Input label="المهنة" disabled={!allowEdit} {...register(`family.siblings.${i}.occupation` as const)} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="حذف"
                        onClick={() => siblingsArr.remove(i)}
                        disabled={!allowEdit}
                        className="self-end"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* §7 — Relatives */}
        <section
          id="section-relatives"
          ref={sectionRef('relatives')}
          data-section="relatives"
          className="scroll-mt-20"
        >
          <Card>
            <CardHeader title={SECTION_LABELS.relatives} subtitle="الأقارب حتى الدرجة الرابعة" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-2xs text-ink-500">
                تُستخدم هذه البيانات للتحريات الأمنية.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={<Plus size={12} strokeWidth={1.75} />}
                onClick={() => relativesArr.append({ ...EMPTY_FAMILY_MEMBER, relationshipId: '' })}
                disabled={!allowEdit}
              >
                إضافة قريب
              </Button>
            </div>
            {relativesArr.fields.length === 0 && (
              <p className="text-2xs text-ink-500">لا توجد بيانات أقارب مسجلة</p>
            )}
            <div className="flex flex-col gap-2">
              {relativesArr.fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <Input label="الاسم" disabled={!allowEdit} {...register(`family.relatives.${i}.fullName` as const)} />
                  <Input label="الرقم القومي" dir="ltr" disabled={!allowEdit} {...register(`family.relatives.${i}.nationalId` as const)} />
                  <Select
                    label="درجة القرابة"
                    required
                    disabled={!allowEdit}
                    options={[{ value: '', label: '— اختر —' }, ...RELATIONSHIP_OPTIONS]}
                    {...register(`family.relatives.${i}.relationshipId` as const)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="حذف"
                    onClick={() => relativesArr.remove(i)}
                    disabled={!allowEdit}
                    className="self-end"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Footer submit + autosave indicator */}
        <div className="sticky bottom-0 -mx-4 mt-2 flex flex-col items-stretch gap-2 border-t border-border-subtle bg-surface-page/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-2xs text-ink-500">
            {savedAt
              ? <span className="inline-flex items-center gap-1"><ScrollText size={11} /> تم الحفظ التلقائي · {fmtDate(savedAt, 'rel')}</span>
              : autosaveKey
                ? 'الحفظ التلقائي نشط — كل 30 ثانية'
                : null}
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!allowEdit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Sticky right rail (anchor jumps); collapses to a flat top strip on small screens */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card variant="compact" className="hidden lg:block">
          <h4 className="mb-2 text-2xs font-bold uppercase tracking-wide text-ink-500">
            انتقال للأقسام
          </h4>
          <nav aria-label="أقسام النموذج" className="flex flex-col">
            {SECTION_ORDER.map((key) => {
              const isActive = activeSection === key;
              return (
                <a
                  key={key}
                  href={`#section-${key}`}
                  className={`flex items-center justify-between rounded-md border-s-2 ps-3 py-1.5 text-sm transition-colors duration-fast ease-standard ${
                    isActive
                      ? 'border-s-[var(--accent-500,theme(colors.teal.500))] text-ink-900'
                      : 'border-s-transparent text-ink-500 hover:text-ink-700'
                  }`}
                >
                  <span>{SECTION_LABELS[key]}</span>
                  {isActive && <ChevronUp size={12} className="rotate-180" />}
                </a>
              );
            })}
          </nav>
        </Card>
        {/* Compact strip on small screens */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
          {SECTION_ORDER.map((key) => (
            <a
              key={key}
              href={`#section-${key}`}
              className={`whitespace-nowrap rounded-pill border px-3 py-1.5 text-2xs ${
                activeSection === key
                  ? 'border-[var(--accent-500,theme(colors.teal.500))] bg-[var(--accent-50,theme(colors.teal.50))] text-ink-900'
                  : 'border-border-subtle text-ink-500'
              }`}
            >
              {SECTION_LABELS[key]}
            </a>
          ))}
        </div>
        {/* Form-wide error pulse */}
        {Object.keys(errors).length > 0 && (
          <Card variant="compact" className="mt-3">
            <p className="flex items-center gap-2 text-2xs font-medium text-terra-700">
              <AlertCircle size={12} strokeWidth={1.75} />
              يوجد {Object.keys(errors).length} خطأ يحتاج للتصحيح
            </p>
          </Card>
        )}
      </aside>
    </form>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function FixedFamilyMember({
  title,
  prefix,
  disabled,
  register,
}: {
  title: string;
  prefix:
    | 'father' | 'mother'
    | 'paternalGrandfather' | 'paternalGrandmother'
    | 'maternalGrandfather' | 'maternalGrandmother';
  disabled: boolean;
  register: any;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <h4 className="mb-2 text-sm font-bold text-ink-900">{title}</h4>
      <div className="grid gap-2 md:grid-cols-3">
        <Input label="الاسم بالكامل" disabled={disabled} {...register(`family.${prefix}.fullName`)} />
        <Input label="الرقم القومي" dir="ltr" disabled={disabled} {...register(`family.${prefix}.nationalId`)} />
        <Input label="المهنة" disabled={disabled} {...register(`family.${prefix}.occupation`)} />
        <Input label="المحافظة" disabled={disabled} {...register(`family.${prefix}.governorate`)} />
        <Input label="المؤهل التعليمي" disabled={disabled} {...register(`family.${prefix}.education`)} />
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-ink-700">
          <input
            type="checkbox"
            disabled={disabled}
            {...register(`family.${prefix}.alive`)}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          على قيد الحياة
        </label>
      </div>
    </div>
  );
}

/* Re-export Textarea consumers expect to find here. */
export { Textarea };
