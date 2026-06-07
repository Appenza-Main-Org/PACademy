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
  ExternalLink,
  FileText,
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
import { isBackendEnabled } from '@/shared/lib/api-client';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { stage345Schema, type Stage345Values } from '../schemas';
import { usePublishedDeclaration } from '../api/applicantPortal.queries';
import { applicantPortalService } from '../api/applicantPortal.service';
import type { PublishedDeclaration } from '../api/applicantPortal.service';
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
import {
  useApplicantGradeByNid,
} from '@/features/applicant-grades/api/grades.queries';
import { useEligibleCategories } from '../api/categories.queries';
import { useApplicantCategories, useLookup } from '@/features/lookups/api/lookups.queries';
import type { GradeRow } from '@/features/applicant-grades/types';
import type {
  FacultyRow,
  GovernorateRow,
  PoliceStationRow,
  UniversityRow,
} from '@/features/lookups';
import { emitAudit } from '@/shared/lib/audit';
import {
  getEligibilityGradeExtras,
  mapEligibilityGradeToGradeRow,
} from '../lib/grade-prefill';
import {
  SECONDARY_CERTIFICATE_NOT_FOUND_MESSAGE,
  buildManualCertificateTypeOptions,
  shouldShowSecondaryCertificateNotFoundMessage,
} from '../lib/certificate-type-options';
import {
  RELIGION_OPTIONS,
  buildAllowedAcademicDegreeOptions,
  buildAllowedMaritalStatusOptions,
  getAllowedApplicantProfileCodes,
  type AcademicDegreeValue,
  type MaritalStatusValue,
} from '../lib/profile-options';
import {
  policeStationMatchesGovernorate,
  resolveBirthGovernorateRow,
  resolveGovernorateRow,
} from '../lib/governorateLookup';
import {
  buildCycleAcademicGradeOptions,
  buildCycleFacultyOptions,
  buildCycleSpecializationOptions,
  shouldShowPostgraduateQualificationFields,
  shouldShowUniversityQualificationFields,
} from '../lib/university-qualification-options';
import {
  buildGraduationYearError,
  formatAllowedYearsAr,
  readGraduationYear,
  resolveGraduationYearTarget,
} from '../lib/graduation-year-validation';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;

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

  const eligibilityCategoriesQuery = useEligibleCategories(nid, selectedCycleId);
  const allCategoriesQuery = useApplicantCategories();

  const eligibilityGrade = eligibilityCategoriesQuery.data?.grade ?? null;
  const eligibilityGradeRow = useMemo(
    () => mapEligibilityGradeToGradeRow(eligibilityGrade),
    [eligibilityGrade],
  );
  const shouldUseLegacyGradeLookup =
    !isBackendEnabled() &&
    !eligibilityCategoriesQuery.isLoading &&
    !eligibilityGradeRow;
  const gradeByNidQuery = useApplicantGradeByNid(nid, selectedCycleId, {
    enabled: shouldUseLegacyGradeLookup,
  });
  const gateLoading =
    eligibilityCategoriesQuery.isLoading ||
    gradeByNidQuery.isLoading ||
    allCategoriesQuery.isLoading;
  const gradesMatched = eligibilityGradeRow ?? gradeByNidQuery.data ?? null;

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
  const isLawBachelor = selectedCategoryKey === 'law_bachelor';
  const hasPreselectedAcademicProgram = Boolean(selectedFaculty || selectedSpecialization);
  const selectedCategoryEligibility = useMemo(
    () =>
      selectedCategoryKey
        ? eligibilityCategoriesQuery.data?.categories.find(
            (category) => category.categoryId === selectedCategoryKey,
          ) ?? null
        : null,
    [eligibilityCategoriesQuery.data?.categories, selectedCategoryKey],
  );

  /* Qualification level — picked by الضباط المتخصصون applicants to drive
   *  whether the postgraduate block renders (master/doctorate) or just
   *  the bachelor row (license/bachelor). Local state because schemas
   *  for this category vary; the picked value is surfaced on submit. */
  const [qualificationLevel, setQualificationLevel] = useState<'' | AcademicDegreeValue>('');
  const showUniversityQualificationFields =
    showBachelor && shouldShowUniversityQualificationFields(qualificationLevel);
  const showPostgrad = shouldShowPostgraduateQualificationFields(qualificationLevel);

  /* Manual-entry buffer for the personal-data block. Used only on the
   * not_found-in-MOI path; if MOI returned a session these inputs aren't
   * rendered at all. Local state (no schema entry) — the values are
   * surfaced on the submit payload below. */
  const [manualPersonal, setManualPersonal] = useState({
    fullName: '',
    gender: '' as '' | 'male' | 'female',
    religion: 'مسلم' as 'مسلم' | 'مسيحي',
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
    maritalStatus: '' as '' | MaritalStatusValue,
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
  const publishedDeclarationQuery = usePublishedDeclaration();

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
   * synced into the form on mount. If not found, the certificate-type
   * Select is scoped by the selected admission section. */
  const schoolCategoriesQuery = useLookup('school-categories');
  const maritalStatusesQuery = useLookup('marital-statuses');
  const academicDegreesQuery = useLookup('academic-degrees');
  const academicGradesQuery = useLookup('academic-grades');
  /* Bachelor / postgrad pickers are sourced from the admin lookups module
   * (/admin/lookups/{faculties,specializations,universities}) so the
   * options stay in lockstep with whatever the admin team configures. */
  const facultiesQuery = useLookup('faculties');
  const specializationsQuery = useLookup('specializations');
  const universitiesQuery = useLookup('universities');
  const facultyOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      buildCycleFacultyOptions(
        facultiesQuery.data ?? [],
        selectedCategoryEligibility,
      ),
    [facultiesQuery.data, selectedCategoryEligibility],
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

  const governoratesQuery = useLookup('governorates');
  const policeStationsQuery = useLookup('police-stations');
  const allowedProfileCodes = useMemo(
    () =>
      getAllowedApplicantProfileCodes(
        eligibilityCategoriesQuery.data?.categories,
        selectedCategoryKey,
      ),
    [eligibilityCategoriesQuery.data?.categories, selectedCategoryKey],
  );
  const maritalStatusOptions = useMemo(
    () =>
      buildAllowedMaritalStatusOptions(
        maritalStatusesQuery.data ?? [],
        allowedProfileCodes.maritalStatusCodes,
      ),
    [maritalStatusesQuery.data, allowedProfileCodes.maritalStatusCodes],
  );
  const academicDegreeOptions = useMemo(
    () =>
      buildAllowedAcademicDegreeOptions(
        academicDegreesQuery.data ?? [],
        allowedProfileCodes.academicDegreeCodes,
      ),
    [academicDegreesQuery.data, allowedProfileCodes.academicDegreeCodes],
  );
  const universityGradeOptions = useMemo(
    () =>
      buildCycleAcademicGradeOptions(
        academicGradesQuery.data ?? [],
        selectedCategoryEligibility,
      ),
    [academicGradesQuery.data, selectedCategoryEligibility],
  );
  const universityGradeSelectOptions = useMemo(
    () =>
      universityGradeOptions.length > 0
        ? [{ value: '', label: '— اختر —' }, ...universityGradeOptions]
        : [{ value: '', label: 'لا توجد تقديرات متاحة' }],
    [universityGradeOptions],
  );

  const governorateOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      (governoratesQuery.data ?? [])
        .filter((g: GovernorateRow) => g.isActive)
        .map((g) => ({ value: g.name, label: g.name })),
    [governoratesQuery.data],
  );
  /* School metadata that doesn't live on the canonical GradeRow shape
   * (yet) — country + graduation date come back together with some
   * matched Thanaweya feeds and are rendered read-only on the profile
   * page. */
  const matchedSchoolExtras = useMemo<{ country: string; gradDate: string } | null>(() => {
    const fromEligibility = getEligibilityGradeExtras(eligibilityGrade);
    if (fromEligibility) return fromEligibility;
    const demo = DEMO_APPLICANT_GRADES[session.nationalId];
    if (!demo) return null;
    return { country: demo.country, gradDate: demo.graduationDate };
  }, [eligibilityGrade, session.nationalId]);

  const matchedGradeRow = useMemo<GradeRow | null>(() => {
    /* The eligible-categories endpoint is the applicant flow's canonical
     * source: it already uses the active cycle + imported grades table and
     * returns the grade used to compute eligibility. The older by-NID grade
     * endpoint can legitimately 404 in staging, so it is only a fallback. */
    if (eligibilityGradeRow) return eligibilityGradeRow;
    /* Prefer a real row from the backend when available. */
    const fromBackend = gradeByNidQuery.data ?? null;
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
  }, [eligibilityGradeRow, gradeByNidQuery.data, session.nationalId, session.fullName, session.gender]);
  const externalImport = matchedGradeRow !== null;

  const manualCertificateTypeOptions = useMemo(
    () =>
      buildManualCertificateTypeOptions(
        schoolCategoriesQuery.data ?? [],
        selectedCategoryKey,
      ),
    [schoolCategoriesQuery.data, selectedCategoryKey],
  );
  const showSecondaryCertificateNotFoundMessage =
    shouldShowSecondaryCertificateNotFoundMessage(selectedCategoryKey);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    setError,
    clearErrors,
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
  const watchedAddressGovernorate = useWatch({ control, name: 'addressGovernorate' });
  const watchedDeclaration = useWatch({ control, name: 'declaration' });
  const watchedSchoolName = useWatch({ control, name: 'schoolNameAr' });
  const watchedSchoolAddress = useWatch({ control, name: 'schoolAddress' });
  const watchedAddressDistrict = useWatch({ control, name: 'addressDistrict' });
  const watchedThanawiType = useWatch({ control, name: 'thanawiType' });
  const watchedThanawiGradDate = useWatch({ control, name: 'thanawiGradDate' });
  const watchedBachelorYear = useWatch({ control, name: 'bachelorYear' });
  const watchedPostgradYear = useWatch({ control, name: 'postgradYear' });
  const watchedDoctorateYear = useWatch({ control, name: 'doctorateYear' });
  const selectedFacultyCode = useMemo(() => {
    if (!watchedFaculty) return null;
    return (
      facultyByName.get(watchedFaculty)?.code ??
      selectedCategoryEligibility?.academicPrograms.find(
        (program) => program.facultyName === watchedFaculty,
      )?.facultyCode ??
      null
    );
  }, [facultyByName, watchedFaculty, selectedCategoryEligibility]);

  const rawBirthGovernorate =
    (isMoiVerified && session.birthGovernorate) ? session.birthGovernorate : manualPersonal.birthGovernorate;
  const birthGovernorateRow = useMemo(
    () =>
      resolveBirthGovernorateRow(
        governoratesQuery.data ?? [],
        rawBirthGovernorate,
        isMoiVerified ? session.nationalId : null,
      ),
    [governoratesQuery.data, isMoiVerified, rawBirthGovernorate, session.nationalId],
  );
  const birthGovernorateValue = birthGovernorateRow?.name ?? rawBirthGovernorate;
  const addressGovernorateRow = useMemo(
    () => resolveGovernorateRow(governoratesQuery.data ?? [], watchedAddressGovernorate),
    [governoratesQuery.data, watchedAddressGovernorate],
  );
  const birthDistrictOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      birthGovernorateRow
        ? (policeStationsQuery.data ?? [])
            .filter(
              (ps: PoliceStationRow) =>
                ps.isActive && policeStationMatchesGovernorate(ps, birthGovernorateRow),
            )
            .map((ps) => ({ value: ps.name, label: ps.name }))
        : [],
    [policeStationsQuery.data, birthGovernorateRow],
  );
  const addressDistrictOptions: readonly SearchSelectOption[] = useMemo(
    () =>
      addressGovernorateRow
        ? (policeStationsQuery.data ?? [])
            .filter(
              (ps: PoliceStationRow) =>
                ps.isActive && policeStationMatchesGovernorate(ps, addressGovernorateRow),
            )
            .map((ps) => ({ value: ps.name, label: ps.name }))
        : [],
    [policeStationsQuery.data, addressGovernorateRow],
  );
  const scopedSpecializationOptions: readonly SearchSelectOption[] = useMemo(() => {
    if (!watchedFaculty) return [];
    return buildCycleSpecializationOptions(
      specializationsQuery.data ?? [],
      selectedCategoryEligibility,
      watchedFaculty,
      selectedFacultyCode,
    );
  }, [watchedFaculty, selectedCategoryEligibility, selectedFacultyCode, specializationsQuery.data]);
  useEffect(() => {
    if (!watchedSpecialization) return;
    if (scopedSpecializationOptions.length === 0) return;
    const valid = scopedSpecializationOptions.some((o) => o.value === watchedSpecialization);
    if (!valid) setValue('bachelorSpecialization', '');
  }, [scopedSpecializationOptions, watchedSpecialization, setValue]);

  useEffect(() => {
    if (maritalStatusOptions.length === 0) return;
    const currentAllowed =
      manualPersonal.maritalStatus !== '' &&
      maritalStatusOptions.some((option) => option.value === manualPersonal.maritalStatus);
    if (currentAllowed) return;
    setManualPersonal((prev) => ({
      ...prev,
      maritalStatus: maritalStatusOptions.length === 1 ? maritalStatusOptions[0]!.value : '',
    }));
  }, [maritalStatusOptions, manualPersonal.maritalStatus]);

  useEffect(() => {
    if (!showBachelor) {
      if (qualificationLevel !== '') setQualificationLevel('');
      return;
    }
    const currentAllowed =
      qualificationLevel !== '' &&
      academicDegreeOptions.some((option) => option.value === qualificationLevel);
    if (currentAllowed) return;
    if (qualificationLevel !== '') setQualificationLevel('');
  }, [academicDegreeOptions, showBachelor, qualificationLevel]);

  useEffect(() => {
    if (!watchedThanawiType) return;
    const currentAllowed = manualCertificateTypeOptions.some(
      (option) => option.value === watchedThanawiType,
    );
    if (currentAllowed) return;
    setValue('thanawiType', '');
  }, [manualCertificateTypeOptions, watchedThanawiType, setValue]);

  /* Cycle-configured graduation-year guard. The eligibility endpoint
   *  returns the set of years the active cycle's matched rules accept;
   *  the form rejects any year outside that set on the qualifying
   *  credential field (resolved by category + qualification level).
   *  Sibling year fields stay unconstrained — only the terminal credential
   *  the cycle gates on is validated. */
  const allowedGraduationYears = useMemo<readonly number[]>(
    () => selectedCategoryEligibility?.allowedGraduationYears ?? [],
    [selectedCategoryEligibility?.allowedGraduationYears],
  );
  const graduationYearTarget = useMemo(
    () => resolveGraduationYearTarget({ showBachelor, qualificationLevel }),
    [showBachelor, qualificationLevel],
  );
  const enteredGraduationYear = useMemo(() => {
    if (!graduationYearTarget) return null;
    const raw =
      graduationYearTarget.field === 'thanawiGradDate' ? watchedThanawiGradDate
      : graduationYearTarget.field === 'bachelorYear' ? watchedBachelorYear
      : graduationYearTarget.field === 'postgradYear' ? watchedPostgradYear
      : watchedDoctorateYear;
    return readGraduationYear(graduationYearTarget.field, raw as string | number | undefined);
  }, [
    graduationYearTarget,
    watchedThanawiGradDate,
    watchedBachelorYear,
    watchedPostgradYear,
    watchedDoctorateYear,
  ]);
  const graduationYearError = useMemo(
    () =>
      graduationYearTarget
        ? buildGraduationYearError(graduationYearTarget, enteredGraduationYear, allowedGraduationYears)
        : null,
    [graduationYearTarget, enteredGraduationYear, allowedGraduationYears],
  );
  const graduationYearBlocked = graduationYearError !== null;
  const graduationYearHelper = useMemo(() => {
    if (!graduationYearTarget) return null;
    if (allowedGraduationYears.length === 0) return null;
    return `سنوات التخرج المسموح بها في دورة القبول: ${formatAllowedYearsAr(allowedGraduationYears)}`;
  }, [graduationYearTarget, allowedGraduationYears]);
  const helperForYear = (
    field: 'thanawiGradDate' | 'bachelorYear' | 'postgradYear' | 'doctorateYear',
  ): string | undefined =>
    graduationYearHelper && graduationYearTarget?.field === field
      ? graduationYearHelper
      : undefined;
  /* Sync the derived error into react-hook-form so the existing
   *  `errors.<field>.message` plumbing below shows the inline message
   *  under the same input, and so the field gets focused on submit
   *  failure. Clears prior errors when the constraint passes. */
  useEffect(() => {
    if (!graduationYearTarget) return;
    if (graduationYearError) {
      setError(graduationYearTarget.field, {
        type: 'graduation_year_not_allowed',
        message: graduationYearError,
      });
    } else {
      clearErrors(graduationYearTarget.field);
    }
  }, [graduationYearTarget, graduationYearError, setError, clearErrors]);

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

  /* Some categories (e.g. ليسانس حقوق and الضباط المتخصصون) pick الكلية +
   * التخصص on /applicant/start from cycle-scoped eligibility programs. Mirror
   * those values into the form so submit carries them while the inputs render
   * read-only. */
  useEffect(() => {
    if (!hasPreselectedAcademicProgram) return;
    if (selectedSpecialization) setValue('bachelorSpecialization', selectedSpecialization);
    if (selectedFaculty) setValue('bachelorFaculty', selectedFaculty);
  }, [hasPreselectedAcademicProgram, selectedFaculty, selectedSpecialization, setValue]);

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
    if (matchedGradeRow.school) setValue('schoolNameAr', matchedGradeRow.school);
    if (matchedGradeRow.region) setValue('schoolAddress', matchedGradeRow.region);
    /* Country + graduation date arrive with some grade feeds. Sync them
     * into the form so the read-only display in SchoolDetailFields stays
     * in lockstep with the submit payload. Client direction 2026-05-21. */
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
    /* Cycle-configured graduation-year guard. Mirror of the disabled-state
     * on the submit button so Enter-key submissions can't bypass the check
     * — surfaces a toast (the inline error is already on the offending
     * field) and bails before hitting the service. */
    if (graduationYearBlocked && graduationYearError) {
      toast(graduationYearError, 'danger');
      return;
    }
    /* Merge MOI session fields (identity source of truth when verified) and
     * manualPersonal fields (maritalStatus + shuhra are always manual since
     * MOI doesn't carry them; other identity fields come from manual on the
     * not_found path). This ensures every personal field reaches the backend
     * regardless of which form inputs are read-only vs editable. */
    const personalBase = isMoiVerified
      ? {
          fullName: session.fullName,
          nationalId: session.nationalId,
          dateOfBirth: session.dateOfBirth,
          dateOfBirthAr: session.dateOfBirthAr,
          gender: session.gender,
          religion: session.religion,
          birthGovernorate: session.birthGovernorate,
          birthDistrict: session.birthDistrict,
          mobile: session.mobile,
          email: session.email,
        }
      : {
          fullName: manualPersonal.fullName,
          nationalId: nid,
          dateOfBirthAr: manualPersonal.dateOfBirthAr,
          gender: manualPersonal.gender,
          religion: manualPersonal.religion || 'مسلم',
          birthGovernorate: manualPersonal.birthGovernorate,
          birthDistrict: manualPersonal.birthDistrict,
          mobile: manualPersonal.mobile,
          email: manualPersonal.email,
          officerApplicantType: manualPersonal.officerApplicantType,
        };
    const profilePayload = {
      ...personalBase,
      religion: manualPersonal.religion || 'مسلم',
      maritalStatus: manualPersonal.maritalStatus,
      shuhra: manualPersonal.shuhra,
      qualificationLevel,
      ...values,
    };
    await applicantPortalService.submitStage(APPLICANT_ID, 3, {
      profile: profilePayload,
      ...(selectedCategoryKey ? { categoryKey: selectedCategoryKey } : {}),
      ...(selectedCycleId ? { cycleId: selectedCycleId } : {}),
    });
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
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {selectedFaculty && (
              <ReadOnlyRow label="الكلية" value={selectedFaculty} />
            )}
            {selectedSpecialization && (
              <ReadOnlyRow label="التخصص" value={selectedSpecialization} />
            )}
            <Field label="المؤهل / الدرجة العلمية" required>
              <Select
                value={qualificationLevel}
                onChange={(e) =>
                  setQualificationLevel(
                    e.target.value as '' | AcademicDegreeValue,
                  )
                }
                options={[
                  { value: '', label: '— اختر —' },
                  ...academicDegreeOptions,
                ]}
              />
            </Field>
          </div>
          {!showUniversityQualificationFields ? (
            <p className="rounded-md border border-dashed border-border-subtle bg-ink-50/60 px-3 py-3 text-2xs text-ink-600">
              اختر المؤهل / الدرجة العلمية أولاً لعرض الحقول والاختيارات المرتبطة بإعدادات دورة القبول.
            </p>
          ) : (
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
              {/* Categories that picked الكلية + التخصص on /applicant/start show
                  the values in the read-only strip above. Other categories pick
                  الكلية from cycle-scoped admission programs, then التخصص narrows
                  to that faculty's options. */}
              {!hasPreselectedAcademicProgram && (
                <Field label="الكلية" error={errors.bachelorFaculty?.message}>
                  <Controller
                    control={control}
                    name="bachelorFaculty"
                    render={({ field }) => (
                      <SearchSelect
                        ariaLabel="الكلية"
                        placeholder="اختر الكلية"
                        options={facultyOptions}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? '')}
                      />
                    )}
                  />
                </Field>
              )}
              {!hasPreselectedAcademicProgram && (
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
                helper={helperForYear('bachelorYear')}
              />
              <Select
                label="التقدير العام"
                {...register('bachelorGrade')}
                options={universityGradeSelectOptions}
                error={errors.bachelorGrade?.message as string | undefined}
              />
            </div>
          )}
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
              helper={helperForYear('postgradYear')}
            />
            <Select
              label="التقدير"
              {...register('postgradGrade')}
              options={universityGradeSelectOptions}
              error={errors.postgradGrade?.message as string | undefined}
            />
          </div>
        </Card>
      )}

      {/* بيانات الدكتوراه — only for doctorate-level applicants.
       *  Renders after the master card so the form reads bottom-up as
       *  bachelor → master → doctorate. */}
      {qualificationLevel === 'doctorate' && (
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
              helper={helperForYear('doctorateYear')}
            />
            <Select
              label="التقدير"
              {...register('doctorateGrade')}
              options={universityGradeSelectOptions}
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
        {eligibilityCategoriesQuery.isLoading || gradeByNidQuery.isLoading || schoolCategoriesQuery.isLoading ? (
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
              gradDateHelper={helperForYear('thanawiGradDate')}
            />
          </div>
        ) : (
          <ManualThanawiFields
            register={register}
            control={control}
            errors={errors}
            certificateTypeOptions={manualCertificateTypeOptions}
            showNotFoundMessage={showSecondaryCertificateNotFoundMessage}
            gradDateHelper={helperForYear('thanawiGradDate')}
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
          <Field label="الديانة" required>
            <Select
              value={manualPersonal.religion || 'مسلم'}
              onChange={(e) => setManual('religion', e.target.value as 'مسلم' | 'مسيحي')}
              options={RELIGION_OPTIONS}
            />
          </Field>
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
                  e.target.value as MaritalStatusValue | '',
                )
              }
              options={[
                { value: '', label: '— اختر —' },
                ...maritalStatusOptions,
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
              options={governorateOptions}
              value={birthGovernorateValue || null}
              onChange={(v) => {
                setManual('birthGovernorate', v ?? '');
                setValue('birthDistrict', '');
              }}
              disabled={isMoiVerified && !!birthGovernorateRow}
            />
          </Field>
          <Field label="القسم / مركز الميلاد" required error={errors.birthDistrict?.message}>
            <Controller
              control={control}
              name="birthDistrict"
              render={({ field }) => (
                <SearchSelect
                  ariaLabel="القسم / مركز الميلاد"
                  placeholder={birthGovernorateRow ? 'اختر القسم أو المركز' : 'اختر المحافظة أولاً'}
                  options={birthDistrictOptions}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                  disabled={!birthGovernorateRow}
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
                  options={governorateOptions}
                  value={field.value ?? null}
                  onChange={(v) => {
                    field.onChange(v ?? '');
                    setValue('addressDistrict', '');
                  }}
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
                  placeholder={addressGovernorateRow ? 'اختر القسم أو المركز' : 'اختر المحافظة أولاً'}
                  options={addressDistrictOptions}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? '')}
                  disabled={!addressGovernorateRow}
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
        <DeclarationReviewPanel
          declaration={publishedDeclarationQuery.data ?? null}
          isLoading={publishedDeclarationQuery.isLoading}
          hasError={publishedDeclarationQuery.isError}
        />

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
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={
              !watchedDeclaration ||
              !watchedSchoolName?.trim() ||
              !watchedSchoolAddress?.trim() ||
              !watchedAddressGovernorate ||
              !watchedAddressDistrict ||
              !selectedCategoryKey ||
              (showBachelor && !qualificationLevel) ||
              maritalBlocked ||
              graduationYearBlocked
            }
          >
            حفظ والمتابعة
          </Button>
        </div>
      </Card>
    </form>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────── */

function DeclarationReviewPanel({
  declaration,
  isLoading,
  hasError,
}: {
  declaration: PublishedDeclaration | null;
  isLoading: boolean;
  hasError: boolean;
}): JSX.Element {
  const bodyAr = declaration?.bodyAr?.trim() ?? '';
  const document = declaration?.document ?? null;
  const hasText = bodyAr.length > 0;
  const hasPdf = Boolean(document?.fileUrl);
  const modeLabel = hasText && hasPdf ? 'نص + PDF' : hasText ? 'نص' : hasPdf ? 'PDF' : null;

  return (
    <div className="mb-4 rounded-md border border-border-subtle bg-ink-50 p-4">
      <header className="mb-3 flex items-center gap-2">
        <FileText size={16} strokeWidth={1.75} className="text-teal-700" />
        <h3 className="font-ar-display text-md font-bold text-ink-900">
          شروط الإلتحاق والإقرار الإلكتروني
        </h3>
        {modeLabel && (
          <Badge tone="neutral">{modeLabel}</Badge>
        )}
      </header>

      {isLoading ? (
        <LoadingState label="جاري تحميل الإقرار المعتمد..." />
      ) : hasError ? (
        <p className="text-sm leading-relaxed text-ink-700">
          تعذر تحميل الإقرار المعتمد حالياً. يمكنك المتابعة وسيتم التحقق من الإقرار عند مراجعة الطلب.
        </p>
      ) : hasText || hasPdf ? (
        <div className="flex flex-col gap-3">
          {hasText && (
            <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-card p-3 text-sm leading-relaxed text-ink-900">
              {bodyAr}
            </div>
          )}
          {hasPdf && document && (
            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-card p-3 text-sm text-ink-800">
              <p>
                الإقرار المعتمد لهذه الدورة محفوظ أيضاً كمستند PDF. افتح المستند وراجعه قبل تأكيد الموافقة.
              </p>
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-2xs font-medium text-teal-700 hover:bg-teal-50 focus-visible:shadow-focus-teal focus-visible:outline-none"
              >
                <ExternalLink size={12} strokeWidth={1.75} />
                فتح الإقرار
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-ink-700">
          أقر بأنني اطلعت على شروط الإلتحاق بأكاديمية الشرطة، وأن جميع البيانات والمستندات المقدمة صحيحة ومطابقة للأوراق الثبوتية، وألتزم بالحضور في المواعيد المحددة وإحضار الأصول المطلوبة يوم الاختبار.
        </p>
      )}
    </div>
  );
}

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
        {row.school && <ReadOnlyRow label="اسم المدرسة" value={row.school} />}
        {row.graduationYear !== null && (
          <ReadOnlyRow label="سنة التخرج" value={String(row.graduationYear)} ltr />
        )}
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
  gradDateHelper,
}: {
  register: ReturnType<typeof useForm<Stage345Values>>['register'];
  control: ReturnType<typeof useForm<Stage345Values>>['control'];
  errors: ReturnType<typeof useForm<Stage345Values>>['formState']['errors'];
  lockedCountry: string | null;
  lockedGradDate: string | null;
  gradDateHelper?: string;
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
          helper={gradDateHelper}
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
  certificateTypeOptions,
  showNotFoundMessage,
  gradDateHelper,
}: {
  register: ReturnType<typeof useForm<Stage345Values>>['register'];
  control: ReturnType<typeof useForm<Stage345Values>>['control'];
  errors: ReturnType<typeof useForm<Stage345Values>>['formState']['errors'];
  certificateTypeOptions: ReadonlyArray<{ value: string; label: string }>;
  showNotFoundMessage: boolean;
  gradDateHelper?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {showNotFoundMessage && (
        <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
          <Info size={11} strokeWidth={1.75} className="me-1 inline-block" aria-hidden />
          {SECONDARY_CERTIFICATE_NOT_FOUND_MESSAGE}
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
            certificateTypeOptions.length > 0
              ? [{ value: '', label: '— اختر —' }, ...certificateTypeOptions]
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
          helper={gradDateHelper}
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
