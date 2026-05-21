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
import { Controller, useForm, useWatch } from 'react-hook-form';
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
  Textarea,
  toast,
} from '@/shared/components';
import type { SearchSelectOption } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { stage345Schema, type Stage345Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { saveProfileSnapshot } from '../lib/profileData';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  DEMO_APPLICANT_GRADES,
  MOI_APPLICANT_SESSION,
  SUBMITTED_APPLICANT_NID,
  SUBMITTED_APPLICANT_PROFILE,
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
import type {
  FacultyRow,
  SchoolCategoryRow,
  UniversityRow,
} from '@/features/lookups';
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
  const selectedFaculty = useApplicantPortalStore((s) => s.selectedFaculty);
  const selectedSpecialization = useApplicantPortalStore((s) => s.selectedSpecialization);

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
  const isSpecializedOfficers = selectedCategoryKey === 'specialized_officers';
  const isLawBachelor = selectedCategoryKey === 'law_bachelor';

  /* ليسانس حقوق applicants pick from a fixed two-faculty set (RFP scope)
   * regardless of what the faculties lookup carries. Other non-officers
   * categories continue to use the full faculties lookup. */
  const LAW_FACULTY_OPTIONS: readonly SearchSelectOption[] = [
    { value: 'كلية حقوق', label: 'كلية حقوق' },
    { value: 'كلية شريعة وقانون', label: 'كلية شريعة وقانون' },
  ];

  /* Qualification level — picked by الضباط المتخصصون applicants to drive
   *  whether the postgraduate block renders (master/doctorate) or just
   *  the bachelor row (license/bachelor). Local state because schemas
   *  for this category vary; the picked value is surfaced on submit. */
  const [qualificationLevel, setQualificationLevel] = useState<
    '' | 'license' | 'bachelor' | 'master' | 'doctorate'
  >('');
  const showPostgrad = isSpecializedOfficers && (qualificationLevel === 'master' || qualificationLevel === 'doctorate');

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

  /* قسم الضباط (قسم عام) requires the applicant to be غير متزوج (single).
   * Picking متزوج anywhere on the page surfaces a blocking error on the
   * marital field AND disables the submit button so the applicant
   * literally cannot proceed. Client direction 2026-05-21. */
  const maritalBlocked =
    selectedCategoryKey === 'officers_general' && manualPersonal.maritalStatus === 'married';

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
  /* Bachelor / postgrad pickers are sourced from the admin lookups module
   * (/admin/lookups/{faculties,specializations,universities}) so the
   * options stay in lockstep with whatever the admin team configures. */
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const universitiesQuery = useLookup('universities');
  const facultyOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      (facultiesQuery.data ?? [])
        .filter((f: FacultyRow) => f.isActive)
        .map((f) => ({ value: f.name, label: f.name })),
    [facultiesQuery.data],
  );
  /* Lookup helpers for the bachelor block — looking faculty up by its
   * Arabic name (which is what the SearchSelect stores) lets us scope
   * specializations to that faculty's FK. */
  const facultyByName = useMemo(() => {
    const m = new Map<string, FacultyRow>();
    for (const f of facultiesQuery.data ?? []) m.set(f.name, f);
    return m;
  }, [facultiesQuery.data]);
  const universityOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      (universitiesQuery.data ?? [])
        .filter((u: UniversityRow) => u.isActive)
        .map((u) => ({ value: u.name, label: u.name })),
    [universitiesQuery.data],
  );
  /* MOI-returned school metadata that doesn't live on the canonical
   * GradeRow shape (yet) — country + graduation date come back together
   * with the matched Thanaweya row and are rendered read-only on the
   * profile page. Only the demo Ahmed seed populates these today;
   * production rows will surface them via the real grades API. */
  const matchedSchoolExtras = useMemo<{ country: string; gradDate: string } | null>(() => {
    const demo = DEMO_APPLICANT_GRADES[session.nationalId];
    if (!demo) return null;
    return { country: demo.country, gradDate: demo.graduationDate };
  }, [session.nationalId]);

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
      examRound: null,
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
      thanawiGrade: '',
      bachelorGrade: '',
      postgradDegree: '',
      postgradSpecialization: '',
      postgradUniversity: '',
      postgradYear: '',
      postgradGrade: '',
      doctorateYear: '',
      doctorateGrade: '',
      birthDistrict: '',
      birthAddressDetail: '',
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

  /* Cascading filter — the التخصص dropdown in the bachelor block lists
   * only the specializations whose facultyCode matches the currently-
   * picked الكلية. Clears the picked specialization whenever the faculty
   * changes to a value where the old specialization no longer fits. */
  const watchedFaculty = useWatch({ control, name: 'bachelorFaculty' });
  const watchedSpecialization = useWatch({ control, name: 'bachelorSpecialization' });
  const scopedSpecializationOptions: readonly SearchSelectOption[] = useMemo(() => {
    if (!watchedFaculty) return [];
    const f = facultyByName.get(watchedFaculty);
    if (!f) return [];
    return (specializationsQuery.data ?? [])
      .filter((s) => s.isActive && s.facultyCode === f.code)
      .map((s) => ({ value: s.name, label: s.name }));
  }, [watchedFaculty, facultyByName, specializationsQuery.data]);
  useEffect(() => {
    if (!watchedSpecialization) return;
    if (scopedSpecializationOptions.length === 0) return;
    const valid = scopedSpecializationOptions.some((o) => o.value === watchedSpecialization);
    if (!valid) setValue('bachelorSpecialization', '');
  }, [scopedSpecializationOptions, watchedSpecialization, setValue]);

  /* Demo prefill for the "submitted" user. Reads from a single source
   * (SUBMITTED_APPLICANT_PROFILE) shared with ApplicantPortalPage so the
   * summary view and the editable form stay in lockstep. */
  useEffect(() => {
    if (nid !== SUBMITTED_APPLICANT_NID) return;
    const p = SUBMITTED_APPLICANT_PROFILE;
    setValue('bachelorMajor', p.bachelorMajor);
    setValue('bachelorBranch', p.bachelorBranch);
    setValue('bachelorSpecialization', p.bachelorSpecialization);
    setValue('bachelorFaculty', p.bachelorFaculty);
    setValue('bachelorUniversity', p.bachelorUniversity);
    setValue('bachelorPercentage', p.bachelorPercentage);
    setValue('bachelorYear', p.bachelorYear);
    setValue('thanawiCountry', p.thanawiCountry);
    setValue('thanawiType', p.thanawiType);
    setValue('thanawiTotal', p.thanawiTotal);
    setValue('thanawiPercentage', p.thanawiPercentage);
    setValue('schoolNameAr', p.schoolNameAr);
    setValue('schoolAddress', p.schoolAddress);
    setValue('thanawiGradDate', p.thanawiGradDate);
    setValue('currentAddressDetail', p.currentAddressDetail);
    setValue('addressGovernorate', p.addressGovernorate);
    setValue('addressDistrict', p.addressDistrict);
    setValue('homePhone', p.homePhone);
    setValue('secondaryMobile', p.secondaryMobile);
    setValue('facebook', p.facebook);
    setValue('twitter', p.twitter);
    setValue('instagram', p.instagram);
    setValue('declaration', true as unknown as true);
    setManualPersonal((prev) => ({
      ...prev,
      shuhra: p.shuhra,
      maritalStatus: p.maritalStatus,
      religion: 'مسلم',
    }));
  }, [nid, setValue]);

  /* For specialized-officers applicants the التخصص + الكلية are picked
   * on /applicant/start (sourced from the lookups module). Mirror them
   * into the form so the submit payload still carries the values even
   * though their inputs are read-only. */
  useEffect(() => {
    if (!isSpecializedOfficers) return;
    if (selectedSpecialization) setValue('bachelorSpecialization', selectedSpecialization);
    if (selectedFaculty) setValue('bachelorFaculty', selectedFaculty);
  }, [isSpecializedOfficers, selectedFaculty, selectedSpecialization, setValue]);

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
    /* School name / address are still manual on the matched path (the
     * MOI grades feed doesn't carry them today). Country + graduation
     * date DO come back when present — sync into the form so the
     * read-only display in SchoolDetailFields stays in lockstep with
     * the submit payload. Client direction 2026-05-21. */
    if (matchedSchoolExtras) {
      setValue('thanawiCountry', matchedSchoolExtras.country);
      setValue('thanawiGradDate', matchedSchoolExtras.gradDate);
    }
    /* Branch maps from the imported grade row's branch field. */
    const branch = matchedGradeRow.branch.trim();
    const known = THANAWI_BRANCH_OPTIONS.find((b) => b.value === branch);
    if (known) {
      setValue('thanawiType', known.value);
    }
  }, [matchedGradeRow, matchedSchoolExtras, setValue]);

  const onSubmit = async (values: Stage345Values): Promise<void> => {
    await applicantPortalService.submitStage(APPLICANT_ID, 3, { profile: values });
    /* Mirror the form payload + the manual-personal block to
     * sessionStorage so the print-card step can pull them into the
     * طلب الالتحاق PDF. The MOI session (when present) is the canonical
     * source for personal data — manualPersonal is only used on the
     * not_found path. */
    saveProfileSnapshot({
      values,
      manualPersonal: manualPersonal,
      qualificationLevel,
    });
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
            title="بيانات المؤهل الجامعي "
          />
          {isSpecializedOfficers && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              {selectedFaculty && <ReadOnlyRow label="الكلية" value={selectedFaculty} />}
              {selectedSpecialization && (
                <ReadOnlyRow label="التخصص" value={selectedSpecialization} />
              )}
              <Field label="المؤهل / الدرجة العلمية" required>
                <Select
                  value={qualificationLevel}
                  onChange={(e) =>
                    setQualificationLevel(
                      e.target.value as '' | 'license' | 'bachelor' | 'master' | 'doctorate',
                    )
                  }
                  options={[
                    { value: '', label: '— اختر —' },
                    { value: 'license', label: 'ليسانس' },
                    { value: 'bachelor', label: 'بكالوريوس' },
                    { value: 'master', label: 'ماجستير' },
                    { value: 'doctorate', label: 'دكتوراه' },
                  ]}
                />
              </Field>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {/* Field order (client direction 2026-05-19):
                الجامعة → الكلية → التخصص (scoped to الكلية) → rest. */}
            <Field label="الجامعة" error={errors.bachelorUniversity?.message}>
              <Controller
                control={control}
                name="bachelorUniversity"
                render={({ field }) => (
                  <SearchSelect
                    ariaLabel="الجامعة"
                    placeholder="اختر الجامعة"
                    options={universityOptions}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                )}
              />
            </Field>
            {/* For specialized-officers الكلية + التخصص are shown in the
                read-only strip above (picked on /applicant/start); other
                categories pick الكلية from the faculties lookup, then
                التخصص narrows to that faculty's options. */}
            {!isSpecializedOfficers && (
              <Field label="الكلية" error={errors.bachelorFaculty?.message}>
                <Controller
                  control={control}
                  name="bachelorFaculty"
                  render={({ field }) => (
                    <SearchSelect
                      ariaLabel="الكلية"
                      placeholder="اختر الكلية"
                      options={isLawBachelor ? LAW_FACULTY_OPTIONS : facultyOptions}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? '')}
                    />
                  )}
                />
              </Field>
            )}
            {/* ليسانس حقوق applicants don't pick a sub-specialization,
                المجموعة / الشعبة / النسبة المئوية — RFP scope is narrowed
                to faculty + سنة + التقدير only. */}
            {!isSpecializedOfficers && !isLawBachelor && (
              <Field label="التخصص" error={errors.bachelorSpecialization?.message}>
                <Controller
                  control={control}
                  name="bachelorSpecialization"
                  render={({ field }) => (
                    <SearchSelect
                      ariaLabel="التخصص"
                      placeholder={
                        watchedFaculty ? 'اختر التخصص' : 'اختر الكلية أولاً'
                      }
                      options={scopedSpecializationOptions}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v ?? '')}
                      disabled={!watchedFaculty}
                    />
                  )}
                />
              </Field>
            )}
            {!isLawBachelor && (
              <Input label="المجموعة" {...register('bachelorMajor')} error={errors.bachelorMajor?.message} />
            )}
            {!isLawBachelor && (
              <Input label="الشعبة" {...register('bachelorBranch')} error={errors.bachelorBranch?.message} />
            )}
            {!isLawBachelor && (
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
            )}
            <Input
              label="سنة التخرج"
              type="number"
              min={1990}
              max={2099}
              dir="ltr"
              {...register('bachelorYear')}
              error={errors.bachelorYear?.message as string | undefined}
            />
            <Select
              label="التقدير العام"
              {...register('bachelorGrade')}
              options={GRADE_RATING_OPTIONS as unknown as { value: string; label: string }[]}
              error={errors.bachelorGrade?.message as string | undefined}
            />
          </div>
        </Card>
      )}

      {/* بيانات الماجستير — required for both master AND doctorate
       *  applicants. The doctorate hierarchy: bachelor + master +
       *  doctorate, so doctorate applicants fill master data here and
       *  the doctorate-specific block below. */}
      {showPostgrad && (
        <Card className="order-5">
          <SectionHeader
            icon={<GraduationCap size={16} strokeWidth={1.75} />}
            title="بيانات الماجستير"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="سنة الحصول على الشهادة"
              type="number"
              min={1990}
              max={2099}
              dir="ltr"
              {...register('postgradYear')}
              error={errors.postgradYear?.message as string | undefined}
            />
            <Select
              label="التقدير"
              {...register('postgradGrade')}
              options={GRADE_RATING_OPTIONS as unknown as { value: string; label: string }[]}
              error={errors.postgradGrade?.message as string | undefined}
            />
          </div>
        </Card>
      )}

      {/* بيانات الدكتوراه — only for doctorate-level applicants.
       *  Renders after the master card so the form reads bottom-up as
       *  bachelor → master → doctorate. */}
      {isSpecializedOfficers && qualificationLevel === 'doctorate' && (
        <Card className="order-5">
          <SectionHeader
            icon={<GraduationCap size={16} strokeWidth={1.75} />}
            title="بيانات الدكتوراه"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="سنة الحصول على الشهادة"
              type="number"
              min={1990}
              max={2099}
              dir="ltr"
              {...register('doctorateYear')}
              error={errors.doctorateYear?.message as string | undefined}
            />
            <Select
              label="التقدير"
              {...register('doctorateGrade')}
              options={GRADE_RATING_OPTIONS as unknown as { value: string; label: string }[]}
              error={errors.doctorateGrade?.message as string | undefined}
            />
          </div>
        </Card>
      )}

      {/* Education block — when MOI returned a session AND a matching grade
       *  row exists, render the read-only imported panel + manual school
       *  detail fields. Otherwise (MOI not_found OR MOI verified but no
       *  imported grades) the applicant enters every education field
       *  manually. Per client direction 2026-05-19, not_found applicants
       *  must enter the full education chain themselves. */}
      <Card className="order-4">
        <SectionHeader
          icon={<GraduationCap size={16} strokeWidth={1.75} />}
          title="بيانات الدراسة"
        />
        {gradesQuery.isLoading || schoolCategoriesQuery.isLoading ? (
          <LoadingState variant="list" rows={3} />
        ) : externalImport && matchedGradeRow ? (
          <div className="flex flex-col gap-4">
            <ExternalGradesPanel row={matchedGradeRow} />
            <SchoolDetailFields
              register={register}
              control={control}
              errors={errors}
              lockedCountry={matchedSchoolExtras?.country ?? null}
              lockedGradDate={matchedSchoolExtras?.gradDate ?? null}
            />
          </div>
        ) : (
          <ManualThanawiFields
            register={register}
            control={control}
            errors={errors}
            categories={manualSchoolCategories}
            isMoiVerified={isMoiVerified}
          />
        )}
      </Card>

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
              flagged on first paint (no need to blur first).
              Additionally, قسم الضباط (قسم عام) blocks متزوج applicants
              outright — surfaces a hard-stop message + disables submit. */}
          <Field
            label="الحالة الاجتماعية"
            required
            error={
              maritalBlocked
                ? 'لا يمكنك التقدم لقسم الضباط (قسم عام) في حالة الزواج — يُشترط أن يكون المتقدم غير متزوج.'
                : manualPersonal.maritalStatus === ''
                  ? 'مطلوب'
                  : undefined
            }
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
          {/* ── Birth block ── محافظة + قسم + العنوان التفصيلي للميلاد */}
          {/* محل الميلاد — dropdown. For MOI-verified applicants the
              value is pre-filled and disabled; for not_found the
              applicant picks from GOV_OPTIONS. */}
          <Field label="محل الميلاد" required>
            <SearchSelect
              ariaLabel="محل الميلاد"
              placeholder="اختر المحافظة"
              options={GOV_OPTIONS}
              value={
                (isMoiVerified ? session.birthGovernorate : manualPersonal.birthGovernorate) ||
                null
              }
              onChange={(v) => setManual('birthGovernorate', v ?? '')}
              disabled={isMoiVerified}
            />
          </Field>
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
          <Textarea
            label="العنوان التفصيلي لمحل الميلاد"
            rows={2}
            required
            {...register('birthAddressDetail')}
            error={errors.birthAddressDetail?.message}
            containerClassName="md:col-span-2"
          />

          {/* ── Residence block ── محافظة + قسم + العنوان التفصيلي للإقامة */}
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
          <Textarea
            label="العنوان التفصيلي لمحل الإقامة"
            rows={2}
            required
            {...register('currentAddressDetail')}
            error={errors.currentAddressDetail?.message}
            containerClassName="md:col-span-2"
          />
        </div>
      </Card>

      <Card className="order-3">
        <SectionHeader
          icon={<ShieldCheck size={16} strokeWidth={1.75} />}
          title="بيانات التواصل"
        />
        <div className="grid gap-3 md:grid-cols-2">
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
            disabled={!selectedCategoryKey || maritalBlocked}
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
      </dl>
    </div>
  );
}

/* Manual school fields rendered alongside the matched-grades panel.
 *
 * School name + address stay editable on the matched path (MOI grades
 * feed doesn't carry them today). Country + graduation date arrive WITH
 * the matched Thanaweya row when the lookup returns extras — those two
 * render read-only with a small "from MOI" marker. When the extras
 * aren't present (forward compat / partial responses) the fields fall
 * back to editable inputs. */
function SchoolDetailFields({
  register,
  control,
  errors,
  lockedCountry,
  lockedGradDate,
}: {
  register: ReturnType<typeof useForm<Stage345Values>>['register'];
  control: ReturnType<typeof useForm<Stage345Values>>['control'];
  errors: ReturnType<typeof useForm<Stage345Values>>['formState']['errors'];
  lockedCountry: string | null;
  lockedGradDate: string | null;
}): JSX.Element {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="اسم المدرسة"
        required
        {...register('schoolNameAr')}
        error={errors.schoolNameAr?.message}
      />
      <Input
        label="عنوان المدرسة"
        required
        {...register('schoolAddress')}
        error={errors.schoolAddress?.message}
      />
      {lockedCountry ? (
        <ReadOnlyRow label="دولة المدرسة" value={lockedCountry} />
      ) : (
        <Field label="دولة المدرسة" required error={errors.thanawiCountry?.message}>
          <Controller
            control={control}
            name="thanawiCountry"
            render={({ field }) => (
              <SearchSelect
                ariaLabel="دولة المدرسة"
                placeholder="اختر الدولة"
                options={COUNTRY_OPTIONS}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? '')}
              />
            )}
          />
        </Field>
      )}
      {lockedGradDate ? (
        <ReadOnlyRow label="تاريخ الحصول على الثانوية" value={lockedGradDate} ltr />
      ) : (
        <Input
          label="تاريخ الحصول على الثانوية"
          type="date"
          dir="ltr"
          required
          {...register('thanawiGradDate')}
          error={errors.thanawiGradDate?.message}
        />
      )}
    </div>
  );
}

/* Options for التقدير (qualitative grade rating) — shared between thanawi
 * and bachelor selects in the manual-entry path. */
const GRADE_RATING_OPTIONS = [
  { value: '', label: '— اختر —' },
  { value: 'ممتاز', label: 'ممتاز' },
  { value: 'جيد جداً', label: 'جيد جداً' },
  { value: 'جيد', label: 'جيد' },
  { value: 'مقبول', label: 'مقبول' },
] as const;

function ManualThanawiFields({
  register,
  control,
  errors,
  categories,
  isMoiVerified,
}: {
  register: ReturnType<typeof useForm<Stage345Values>>['register'];
  control: ReturnType<typeof useForm<Stage345Values>>['control'];
  errors: ReturnType<typeof useForm<Stage345Values>>['formState']['errors'];
  categories: readonly SchoolCategoryRow[];
  /** When true the gold "not in MOI" banner renders (MOI-verified user
   *  whose grades didn't import). When false (not_found path) we skip
   *  the banner since the applicant already knows MOI didn't return
   *  data — the message would be redundant. */
  isMoiVerified: boolean;
}): JSX.Element {
  const typeOptions = categories.map((c) => ({ value: c.name, label: c.name }));
  return (
    <div className="flex flex-col gap-3">
      {isMoiVerified && (
        <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
          <Info size={11} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
          لم يتم العثور على بياناتك في قاعدة الثانوية العامة / الأزهرية. يرجى إدخالها يدوياً —
          نوع الشهادة يقتصر على الفئات التي لا تُستورَد آلياً.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="دولة المدرسة" required error={errors.thanawiCountry?.message}>
          <Controller
            control={control}
            name="thanawiCountry"
            render={({ field }) => (
              <SearchSelect
                ariaLabel="دولة المدرسة"
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
          label="اسم المدرسة"
          required
          {...register('schoolNameAr')}
          error={errors.schoolNameAr?.message}
        />
        <Input
          label="عنوان المدرسة"
          required
          {...register('schoolAddress')}
          error={errors.schoolAddress?.message}
        />
        <Input
          label="تاريخ الحصول على الشهادة"
          type="date"
          dir="ltr"
          {...register('thanawiGradDate')}
          error={errors.thanawiGradDate?.message}
        />
        <Select
          label="التقدير"
          {...register('thanawiGrade')}
          options={GRADE_RATING_OPTIONS as unknown as { value: string; label: string }[]}
          error={errors.thanawiGrade?.message as string | undefined}
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
      </div>
    </div>
  );
}
