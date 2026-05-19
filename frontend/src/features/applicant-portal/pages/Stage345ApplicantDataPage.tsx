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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import {
  Check,
  Download,
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
  Input,
  LoadingState,
  SearchSelect,
  Select,
  toast,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { stage345Schema, type Stage345Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  DEMO_APPLICANT_GRADES,
  MOI_APPLICANT_SESSION,
  mockMoiLookup,
  type MoiApplicantSession,
} from '../lib/moi-session.mock';
import { REF_GOVERNORATES } from '@/shared/mock-data/referenceData';
import { CITIES } from '@/shared/mock-data/dictionaries';
import {
  useApplicantGradeByNid,
  useGrades,
} from '@/features/applicant-grades/api/grades.queries';
import { useApplicantCategories, useLookup } from '@/features/lookups/api/lookups.queries';
import type { GradeRow } from '@/features/applicant-grades/types';
import type { SchoolCategoryRow } from '@/features/lookups';
import { emitAudit } from '@/shared/lib/audit';

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
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const moiSessionFromStore = useApplicantPortalStore((s) => s.moiSession);
  const selectedCycleId = useApplicantPortalStore((s) => s.selectedCycleId);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);

  /* The MOI snapshot is captured at login and persisted in the portal
   * store. For the "not found in MOI" path it's intentionally null —
   * fall back to a stub session built from the entered NID rather than
   * the static demo Ahmed, so the identity rows don't leak another
   * user's data. The MOI verification badge is suppressed in that case.
   *
   * Defensive fallback: when the persisted store predates the moiSession
   * field (or got cleared mid-flow) we re-derive the MOI verdict from
   * the entered NID via mockMoiLookup. That way scenario 1 (Ahmed) still
   * shows MOI-verified UI even if the store didn't capture the session
   * for some reason. */
  const nid = storeNid ?? moiSessionFromStore?.nationalId ?? '';
  const lookupSession = useMemo<MoiApplicantSession | null>(() => {
    if (!nid) return null;
    const r = mockMoiLookup(nid);
    return r.kind === 'eligible' || r.kind === 'ineligible' ? r.session : null;
  }, [nid]);
  const effectiveSession = moiSessionFromStore ?? lookupSession;
  const session: MoiApplicantSession =
    effectiveSession ??
    {
      applicantId: storeNid ? `APP-MAN-${storeNid.slice(-6)}` : 'APP-MANUAL',
      fullName: '',
      nationalId: nid,
      dateOfBirth: '',
      dateOfBirthAr: '',
      gender: 'male',
      mobile: '',
      email: '',
      birthGovernorate: '',
      birthDistrict: '',
      religion: 'مسلم',
    };
  const isMoiVerified = effectiveSession !== null;

  const gradeByNidQuery = useApplicantGradeByNid(nid, selectedCycleId);
  const allCategoriesQuery = useApplicantCategories();

  const gateLoading = gradeByNidQuery.isLoading || allCategoriesQuery.isLoading;
  const gradesMatched = gradeByNidQuery.data ?? null;

  /* Audit emit once per (nid + cycle + match-state + selection) tuple so
   * refreshes / re-renders don't spam the audit log. */
  const auditKey = `${nid}|${selectedCycleId ?? ''}|${gradesMatched?.seat ?? 'none'}|${selectedCategoryKey ?? ''}`;
  const [lastAuditKey, setLastAuditKey] = useState<string | null>(null);
  useEffect(() => {
    if (gateLoading) return;
    if (!selectedCategoryKey) return;
    if (auditKey === lastAuditKey) return;
    emitAudit({
      action: 'applicant.transition',
      module: 'applicants',
      entityType: 'applicant_eligibility',
      entityLabel: 'تأهيل المتقدم — مرحلة 3',
      entityId: session.applicantId,
      details: `تم تحديد الفئة (${selectedCategoryKey}) ${
        gradesMatched ? `بناءً على نتيجة الثانوية (رقم الجلوس ${gradesMatched.seat})` : 'بدون مطابقة للنتائج'
      }`,
      after: {
        nid,
        cycleId: selectedCycleId,
        matchedGradeId: gradesMatched ? String(gradesMatched.seat) : null,
        selectedCategoryKey,
      },
      actor: {
        id: session.applicantId,
        name: session.fullName || 'متقدم بدون مصدر MOI',
        role: 'applicant',
      },
    });
    setLastAuditKey(auditKey);
  }, [auditKey, gateLoading, lastAuditKey, selectedCategoryKey, nid, selectedCycleId, gradesMatched]);

  const showBachelor = selectedCategoryKey !== 'officers_general';

  /* Manual-entry buffer for the personal-data block. Used only on the
   * not_found-in-MOI path; if MOI returned a session these inputs aren't
   * rendered at all. Local state (no schema entry) — the values are
   * surfaced on the submit payload below. */
  const [manualPersonal, setManualPersonal] = useState({
    fullName: '',
    gender: '' as '' | 'male' | 'female',
    religion: '' as '' | 'مسلم' | 'مسيحي',
    dateOfBirthAr: '',
    birthGovernorate: '',
    birthDistrict: '',
    mobile: '',
    email: '',
    /** Nickname — always editable per client direction 2026-05-19
     *  (was read-only-from-MOI before). */
    shuhra: '',
    /** Marital status — required in البيانات الشخصية for every applicant
     *  (MOI doesn't carry this field, so it's always editable). */
    maritalStatus: '' as '' | 'single' | 'married' | 'divorced' | 'widowed',
    /** Sub-type the applicant must declare when MOI didn't return data
     *  AND they're applying to the general-officers category. Values:
     *  'expat' (وافدين) / 'foreign_certificate' (شهادات أجنبية). */
    officerApplicantType: '' as '' | 'expat' | 'foreign_certificate',
  });
  const setManual = <K extends keyof typeof manualPersonal>(
    key: K,
    value: (typeof manualPersonal)[K],
  ): void => {
    setManualPersonal((prev) => ({ ...prev, [key]: value }));
  };

  /* قسم الضباط (قسم عام) is male-only — hide the gender dropdown for
   * the manual-entry path and force the stored value to 'male' so
   * downstream consumers still get a non-empty gender. */
  useEffect(() => {
    if (selectedCategoryKey !== 'officers_general') return;
    if (isMoiVerified) return;
    if (manualPersonal.gender === 'male') return;
    setManualPersonal((p) => ({ ...p, gender: 'male' }));
  }, [selectedCategoryKey, isMoiVerified, manualPersonal.gender]);

  /* Thanawi data is sourced from the admin /admin/applicant-grades dataset
   * by NID. If the applicant is found, the row is rendered read-only +
   * synced into the form on mount. If not found, the school-type Select
   * narrows to lookup rows whose `externalGradesImport` is false (the
   * manual-entry tracks: foreign equivalent diplomas, etc.). */
  const gradesQuery = useGrades();
  const schoolCategoriesQuery = useLookup('school-categories');
  const matchedGradeRow = useMemo<GradeRow | null>(() => {
    /* Prefer a real row from the backend when available. */
    const fromBackend = gradesQuery.data?.find((r) => r.nid === session.nationalId) ?? null;
    if (fromBackend) return fromBackend;
    /* Fallback for mock-only demo runs (no `/admin/grades` endpoint) —
     * known eligible NIDs (e.g. Ahmed) get a hardcoded Thanaweya row so
     * the ExternalGradesPanel actually populates instead of falling
     * through to an empty manual-entry form. */
    const demo = DEMO_APPLICANT_GRADES[session.nationalId];
    if (!demo) return null;
    return {
      seat: 0,
      seatingNumber: demo.seatingNumber,
      nid: session.nationalId,
      name: session.fullName || 'متقدم',
      kind: demo.kind,
      gender: session.gender,
      branch: demo.branch,
      graduationYear: null,
      schoolCategoryCode: null,
      school: demo.school,
      region: demo.region,
      total: demo.total,
      importMax: demo.importMax,
      overrideMax: null,
      lastEditedAt: null,
      lastEditedBy: null,
      gradeChangedAt: null,
      previousGrade: null,
      status: '—',
      log: [],
    };
  }, [gradesQuery.data, session.nationalId, session.fullName, session.gender]);
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
      thanawiGradDate: '',
      birthDistrict: '',
      currentAddressDetail: '',
      addressGovernorate: '',
      addressDistrict: '',
      homePhone: '',
      fax: '',
      secondaryMobile: '',
      facebook: '',
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
    /* Summary step was removed from the wizard — go straight to payment. */
    navigate(ROUTES.applicantPayment);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Client direction 2026-05-19: page now starts directly with
       *  البيانات الشخصية — the page header card, MOI verification card,
       *  and eligibility-gate card were dropped per client request. */}
      {showBachelor && (
        <Card className="order-5">
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

      {isMoiVerified && (
        <Card className="order-4">
          <SectionHeader
            icon={<GraduationCap size={16} strokeWidth={1.75} />}
            title="بيانات التعليم"
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
      )}

      <Card variant="compact" className="order-1">
        <SectionHeader
          icon={<User size={16} strokeWidth={1.75} />}
          title="البيانات الشخصية"
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
          {isMoiVerified ? (
            <ReadOnlyRow label="الإسم رباعي" value={session.fullName} />
          ) : (
            <Input
              label="الإسم رباعي"
              required
              value={manualPersonal.fullName}
              onChange={(e) => setManual('fullName', e.target.value)}
            />
          )}
          <Input
            label="اسم الشهرة (إن وجد)"
            value={manualPersonal.shuhra}
            onChange={(e) => setManual('shuhra', e.target.value)}
          />
          {isMoiVerified ? (
            <ReadOnlyRow label="النوع" value={session.gender === 'male' ? 'ذكر' : 'أنثى'} />
          ) : selectedCategoryKey !== 'officers_general' ? (
            <Field label="النوع" required>
              <Select
                value={manualPersonal.gender}
                onChange={(e) => setManual('gender', e.target.value as 'male' | 'female' | '')}
                options={[
                  { value: '', label: '— اختر —' },
                  { value: 'male', label: 'ذكر' },
                  { value: 'female', label: 'أنثى' },
                ]}
              />
            </Field>
          ) : null}
          {isMoiVerified ? (
            <ReadOnlyRow label="الديانة" value={session.religion} />
          ) : (
            <Field label="الديانة" required>
              <Select
                value={manualPersonal.religion}
                onChange={(e) => setManual('religion', e.target.value as 'مسلم' | 'مسيحي' | '')}
                options={[
                  { value: '', label: '— اختر —' },
                  { value: 'مسلم', label: 'مسلم' },
                  { value: 'مسيحي', label: 'مسيحي' },
                ]}
              />
            </Field>
          )}
          {isMoiVerified ? (
            <ReadOnlyRow label="تاريخ الميلاد" value={session.dateOfBirthAr} />
          ) : (
            <Input
              label="تاريخ الميلاد"
              type="date"
              dir="ltr"
              required
              value={manualPersonal.dateOfBirthAr}
              onChange={(e) => setManual('dateOfBirthAr', e.target.value)}
            />
          )}
          <ReadOnlyRow label="الرقم القومي" value={session.nationalId} ltr mono />
          {/* Marital status — required for every applicant. Red error
              label appears immediately when empty so the field is visually
              flagged on first paint (no need to blur first). */}
          <Field
            label="الحالة الاجتماعية"
            required
            error={manualPersonal.maritalStatus === '' ? 'مطلوب' : undefined}
          >
            <Select
              value={manualPersonal.maritalStatus}
              onChange={(e) =>
                setManual(
                  'maritalStatus',
                  e.target.value as 'single' | 'married' | 'divorced' | 'widowed' | '',
                )
              }
              options={[
                { value: '', label: '— اختر —' },
                { value: 'single', label: 'أعزب' },
                { value: 'married', label: 'متزوج' },
                { value: 'divorced', label: 'مطلق' },
                { value: 'widowed', label: 'أرمل' },
              ]}
            />
          </Field>
          {!isMoiVerified && selectedCategoryKey === 'officers_general' && (
            <Field label="فئة المدرسة" required>
              <Select
                value={manualPersonal.officerApplicantType}
                onChange={(e) =>
                  setManual(
                    'officerApplicantType',
                    e.target.value as 'expat' | 'foreign_certificate' | '',
                  )
                }
                options={[
                  { value: '', label: '— اختر —' },
                  { value: 'expat', label: 'وافدين' },
                  { value: 'foreign_certificate', label: 'شهادات أجنبية' },
                ]}
              />
            </Field>
          )}
        </div>
      </Card>

      <Card className="order-2">
        <SectionHeader
          icon={<MapPin size={16} strokeWidth={1.75} />}
          title="محل الإقامة والميلاد"
        />
        <div className="grid gap-3 md:grid-cols-2">
          {/* محل الميلاد — auto-filled from MOI when available, manual otherwise. */}
          {isMoiVerified ? (
            <ReadOnlyRow label="محل الميلاد" value={session.birthGovernorate} />
          ) : (
            <Input
              label="محل الميلاد"
              value={manualPersonal.birthGovernorate}
              onChange={(e) => setManual('birthGovernorate', e.target.value)}
            />
          )}
          <Field label="القسم / مركز الميلاد" required error={errors.birthDistrict?.message}>
            <Controller
              control={control}
              name="birthDistrict"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="القسم / مركز الميلاد"
                  placeholder="اختر القسم أو المركز"
                  options={DISTRICT_OPTIONS}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Field label="محافظة الإقامة" required error={errors.addressGovernorate?.message}>
            <Controller
              control={control}
              name="addressGovernorate"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="محافظة الإقامة"
                  placeholder="اختر المحافظة"
                  options={GOV_OPTIONS}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Field label="القسم / مركز الإقامة" required error={errors.addressDistrict?.message}>
            <Controller
              control={control}
              name="addressDistrict"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="القسم / مركز الإقامة"
                  placeholder="اختر القسم أو المركز"
                  options={DISTRICT_OPTIONS}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                />
              )}
            />
          </Field>
          <Input
            label="رقم تليفون المنزل"
            type="tel"
            dir="ltr"
            {...register('homePhone')}
            error={errors.homePhone?.message}
          />
          {isMoiVerified ? (
            <ReadOnlyInline
              label="رقم المحمول"
              value={session.mobile}
              ltr
              mono
              icon={<Phone size={14} strokeWidth={1.75} />}
            />
          ) : (
            <Input
              label="رقم المحمول"
              type="tel"
              dir="ltr"
              required
              value={manualPersonal.mobile}
              onChange={(e) => setManual('mobile', e.target.value)}
            />
          )}
          <Input
            label="رقم محمول آخر"
            type="tel"
            dir="ltr"
            {...register('secondaryMobile')}
            error={errors.secondaryMobile?.message}
          />
          {isMoiVerified ? (
            <ReadOnlyInline
              label="البريد الإلكتروني"
              value={session.email}
              ltr
              mono
              icon={<ShieldCheck size={14} strokeWidth={1.75} />}
            />
          ) : (
            <Input
              label="البريد الإلكتروني"
              type="email"
              dir="ltr"
              required
              value={manualPersonal.email}
              onChange={(e) => setManual('email', e.target.value)}
            />
          )}
        </div>
      </Card>

      <Card className="order-3">
        <SectionHeader
          icon={<ShieldCheck size={16} strokeWidth={1.75} />}
          title="بيانات التواصل"
        />
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="فيسبوك"
            dir="ltr"
            placeholder="@username أو https://facebook.com/username"
            {...register('facebook')}
            error={errors.facebook?.message}
          />
          <Input
            label="تويتر"
            dir="ltr"
            placeholder="@username أو https://twitter.com/username"
            {...register('twitter')}
            error={errors.twitter?.message}
          />
          <Input
            label="إنستجرام"
            dir="ltr"
            placeholder="@username أو https://instagram.com/username"
            {...register('instagram')}
            error={errors.instagram?.message}
          />
        </div>
      </Card>

      <Card className="order-6">
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
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            leadingIcon={<Download size={16} strokeWidth={1.75} />}
            onClick={downloadInstructions}
          >
            تحميل ملف الإرشادات
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!selectedCategoryKey}
          >
            حفظ والمتابعة
          </Button>
        </div>
      </Card>
    </form>
  );
}

/**
 * Open the applicant instructions as a printable document in a new
 * window and immediately trigger the browser's print dialog so the
 * user can save it as PDF. Avoids pulling a heavy PDF library for
 * what's a one-off demo asset.
 */
function downloadInstructions(): void {
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>إرشادات التقديم — أكاديمية الشرطة</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Sans Arabic', 'Tajawal', Tahoma, system-ui, Arial;
      color: #1a1a1a;
      line-height: 1.85;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }
    header { border-bottom: 3px solid #1a6868; padding-bottom: 12px; margin-bottom: 24px; }
    header h1 { font-size: 22px; color: #1a6868; margin: 0 0 4px; }
    header p { font-size: 12px; color: #555; margin: 0; }
    h2 { font-size: 16px; color: #1a6868; margin: 24px 0 8px; }
    p { margin: 8px 0; }
    ul { padding-right: 22px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    .note { background: #fff8e6; border: 1px dashed #d4a445; padding: 10px 14px; border-radius: 6px; font-size: 13px; }
    .meta { font-size: 11px; color: #777; margin-top: 32px; border-top: 1px dashed #ccc; padding-top: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>إرشادات التقديم لأكاديمية الشرطة</h1>
    <p>منظومة القبول — وزارة الداخلية</p>
  </header>

  <h2>قبل التقدم</h2>
  <ul>
    <li>راجع البيانات المُسجَّلة على بوابة وزارة الداخلية (الاسم رباعي والرقم القومي ورقم المحمول)، وتأكد من صحتها.</li>
    <li>ستُستخدم هذه البيانات لاستكمال إجراءات التقدم وإرسال الإخطارات.</li>
    <li>للتعديل على البيانات الخاطئة يجب التوجه إلى الجهة المختصة قبل بدء التقدم.</li>
  </ul>

  <h2>أثناء التقدم</h2>
  <ul>
    <li>سيُطلب منك إدخال بيانات الدراسة بدقة طبقاً لأوراقك الثبوتية.</li>
    <li>أيّ مخالفة بين البيانات المُدرَجة والأوراق الأصلية قد تؤدي إلى منعك من الاختبار.</li>
    <li>تأكد من إدخال البيانات الشخصية، محل الإقامة والميلاد، وبيانات التواصل بشكل كامل.</li>
    <li>أدخل بيانات أفراد العائلة بدقة، فهي تخضع للتحقق الأمني قبل الموافقة على الطلب.</li>
  </ul>

  <h2>مقابل الخدمة</h2>
  <ul>
    <li>مقابل تقديم الخدمة إلكترونياً: ٢٥٠ جنيه.</li>
    <li>يُسدَّد مرة واحدة خلال الدورة الحالية، ويُستحَق فور تأكيد البيانات.</li>
    <li>الدفع متاح عبر بوابة فوري.</li>
  </ul>

  <h2>يوم الاختبار</h2>
  <ul>
    <li>احضر إلى موقع الاختبار قبل الموعد المُحدَّد بنصف ساعة على الأقل.</li>
    <li>أحضر معك المستندات الأصلية: بطاقة الرقم القومي، أصل الثانوية العامة، شهادة طبية معتمدة، كارت التردد المطبوع، ٤ صور شخصية حديثة، شهادة حسن السير والسلوك.</li>
    <li>احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي الأمر.</li>
  </ul>

  <p class="note">
    تأكيدك على الإقرار الإلكتروني يعني موافقتك على أن البيانات المُدرَجة صحيحة ومطابقة للأوراق الثبوتية،
    وأنك ستلتزم بإحضارها يوم الاختبار.
  </p>

  <p class="meta">
    وثيقة الإرشادات للعرض والتحميل · أكاديمية الشرطة — وزارة الداخلية · ${new Date().getFullYear()}
  </p>
</body>
</html>`;
  const win = window.open('', '_blank');
  if (!win) {
    toast('يرجى السماح بفتح النوافذ المنبثقة لتنزيل ملف الإرشادات', 'warning');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  /* Wait for fonts/layout to settle before triggering print so the
   * Arabic text renders correctly in the PDF preview. */
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 350);
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
        className={
          'mt-0.5 text-sm font-medium text-ink-900 ' +
          /* For LTR-direction values (digits) `text-end` resolves to
           * right, which aligns them under the RTL right-aligned label.
           * Without it the digits stick to the left edge of the column. */
          (ltr ? 'text-end ' : '') +
          (mono ? 'font-mono' : '')
        }
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
          className={
            'flex-1 text-sm text-ink-900 ' +
            (ltr ? 'text-end ' : '') +
            (mono ? 'font-mono' : '')
          }
          dir={ltr ? 'ltr' : undefined}
        >
          {value}
        </span>
        {/* <span className="text-2xs text-ink-500">من بوابة وزارة الداخلية</span> */}
      </div>
    </div>
  );
}

/* ─── ثانوية sub-panels ──────────────────────────────────────────── */

function ExternalGradesPanel({ row }: { row: GradeRow }): JSX.Element {
  const percent = ((row.total / row.importMax) * 100).toFixed(2);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
        <ReadOnlyRow label="اسم المدرسة" value={row.school} />
        <ReadOnlyRow
          label="عنوان المدرسة"
          value={`${row.region} — شارع مصطفى النحاس — مدينة نصر`}
        />
        <ReadOnlyRow label="دولة المدرسة" value="مصر" />
        <ReadOnlyRow label="تاريخ الحصول على الثانوية" value="2024 - 2025" />
      </dl>
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
