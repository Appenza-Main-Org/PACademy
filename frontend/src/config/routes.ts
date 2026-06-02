import type { AppKey } from '@/shared/lib/constants';

export const ROUTES = {
  /* ── Public surface (no auth required) ── */
  landing: '/',
  staffLogin: '/staff-login',
  /** Applicant-only login (NID + password). Separate from /staff-login —
   *  no role picker, no OTP step. Lands on /applicant on success. */
  applicantLogin: '/applicant-login',
  /** Backwards-compat alias — `/login` redirects to `/staff-login`. */
  login: '/staff-login',
  terms: '/terms',
  help: '/help',
  examRoom: (token = ':token'): string => `/exam-room/${token}`,

  /* ── Staff surface (AuthGuard required) ── */
  hub: '/hub',
  architecture: '/architecture',
  designRevamp: '/design-revamp',
  profile: '/profile',
  admin: {
    dashboard: '/admin',
    applicants: '/admin/applicants',
    applicantNew: '/admin/applicants/new',
    applicantDetail: (id = ':id'): string => `/admin/applicants/${id}`,
    applicantEdit: (id = ':id'): string => `/admin/applicants/${id}/edit`,
    users: '/admin/users',
    userNew: '/admin/users/new',
    userDetail: (id = ':id'): string => `/admin/users/${id}`,
    userEdit: (id = ':id'): string => `/admin/users/${id}/edit`,
    roles: '/admin/users/roles',
    audit: '/admin/audit',
    settings: '/admin/settings',
    reports: '/admin/reports',
    /** @deprecated — superseded by `adminLookups`. The route now redirects. */
    referenceData: (tab = ':tab'): string => `/admin/reference-data/${tab}`,
    /** @deprecated — superseded by `adminLookups`. The route now redirects. */
    referenceDataRoot: '/admin/reference-data',
    /* Lookup Management Module — `/admin/lookups`, replaces reference-data. */
    adminLookups: '/admin/lookups',
    adminLookupsType: (typeCode = ':typeCode'): string => `/admin/lookups/${typeCode}`,
    adminLookupsMappings: (kind = ':kind'): string => `/admin/lookups/mappings/${kind}`,
    /** Read-only detail view for an applicant-categories lookup row. */
    adminLookupsApplicantCategoryDetail: (id = ':id'): string =>
      `/admin/lookups/applicant-categories/${id}`,
    cycles: '/admin/cycles',
    cycleDetail: (id = ':id'): string => `/admin/cycles/${id}`,
    cycleNew: '/admin/cycles/new',
    cycleEdit: (id = ':id'): string => `/admin/cycles/${id}/edit`,
    categories: '/admin/categories',
    categoryEdit: (key = ':key'): string => `/admin/categories/${key}`,
    /* Committee instances — cycle-bound, dated, capacity-bearing committee
     * assignments. This is the canonical management surface for list,
     * filter, inline capacity edits, transfer, and delete. */
    committeesExamConfig: '/admin/committees-exam-config',
    /** @deprecated — renamed to `committeesExamConfig`. The route now
     *  redirects so external bookmarks keep landing on the new page. */
    committees: '/admin/committees-exam-config',
    workflows: '/admin/workflows',
    workflowEdit: (id = ':id'): string => `/admin/workflows/${id}`,
    workflowNew: '/admin/workflows/new',
    /** Applicant Grades — import + adjustments console (per-cycle data). */
    applicantGrades: '/admin/applicant-grades',
    /** Data Exchange hub — centralized Excel export/import for all domains. */
    dataExchange: '/admin/data-exchange',
    /** Standalone v2 import wizard (renders inside AdminLayout). */
    applicantGradesImport: '/admin/applicant-grades/import',
    /** Import audit history + downloadable reports. */
    applicantGradesImportHistory: '/admin/applicant-grades/import-history',
    /** Audit view: students whose grades have changed since initial import. */
    applicantGradesChanges: '/admin/applicant-grades/changes',
    notifications: '/admin/notifications',
    payments: '/admin/payments',
    admissionRules: '/admin/admission-rules',
    /* Admission Setup section — ordered configuration steps. The keys
     * mirror `AdmissionSetupStepKey` (camelCased) so feature code can
     * derive the URL from a step key without a second lookup. Cycle
     * metadata is NOT a step — admins enter the wizard by selecting an
     * already-configured cycle from `/admin/cycles`. */
    admissionSetup: {
      index: '/admin/cycles/admission-setup',
      /** Wizard entry — top-stepper flow. `stepKey` is either an
       *  `AdmissionSetupStepKey` or the literal `'review'`. */
      wizard: (stepKey = ':stepKey'): string =>
        `/admin/cycles/admission-setup/wizard/${stepKey}`,
      wizardReview: '/admin/cycles/admission-setup/wizard/review',
      applicationSettings: '/admin/cycles/admission-setup/application-settings',
      /** Read-only pre-review checkpoint — sits between application_settings
       *  and the final review step. Renders the same shared summary the
       *  review step renders. */
      applicationSettingsReview: '/admin/cycles/admission-setup/application-settings-review',
      applicationStatus: '/admin/cycles/admission-setup/application-status',
      maritalStatusRules: '/admin/cycles/admission-setup/marital-status-rules',
      fees: '/admin/cycles/admission-setup/fees',
      exams: '/admin/cycles/admission-setup/exams',
      committees: '/admin/committees-exam-config',
      electronicDeclaration: '/admin/cycles/admission-setup/electronic-declaration',
    },
  },

  /* ── Applicant surface (own auth via Stage 1+2) ──
   *  `applicant` is a string for backwards-compat with concatenations
   *  like `${ROUTES.applicant}/auth/step-1`. Pre-wizard gate routes are
   *  flat top-level keys to avoid breaking those callsites. */
  applicant: '/applicant',
  applicantStart: '/applicant/start',
  applicantEligibility: '/applicant/eligibility',
  /** Polite-rejection screen shown when MOI returned a session but the
   *  applicant doesn't qualify for any open category. */
  applicantIneligible: '/applicant/ineligible',
  applicantTests: '/applicant/tests',
  applicantApplicationSummary: '/applicant/application/summary',
  /* MOI-alignment additions:
   *  - `applicantProfile` collapses the old `/applicant/profile/{personal,education,marital}`
   *    triplet into a single scrollable page per the MOI reference (PDF p.4).
   *    The three legacy paths redirect here.
   *  - `applicantVerify` is the التحقق من المستخدم screen (PDF p.5 lower);
   *    sits between profile and summary.
   *  - `applicantFamily` is unchanged at `/applicant/profile/family`. */
  applicantProfile: '/applicant/profile',
  applicantVerify: '/applicant/verify',
  applicantFamily: '/applicant/profile/family',
  /** Review + اعتماد step — surfaces the family summary table as a
   *  dedicated wizard stop between data entry and exam-date selection. */
  applicantFamilyReview: '/applicant/profile/family-review',
  applicantPayment: '/applicant/payment',
  applicantExamSchedule: '/applicant/exam-schedule',
  applicantPrintCard: '/applicant/print-card',
  applicantFollowUp: '/applicant/follow-up',

  /* ── Internal staff apps ── */
  committee: {
    overview: '/admin/committee',
    schedule: '/admin/committee/schedule',
    create: '/admin/committee/create',
    detail: (id = ':id'): string => `/admin/committee/${id}`,
    edit: (id = ':id'): string => `/admin/committee/${id}/edit`,
    applicants: (id = ':id'): string => `/admin/committee/${id}/applicants`,
  },
  board: {
    overview: '/board',
    sessions: '/board/sessions',
    sessionCreate: '/board/sessions/create',
    sessionLive: (id = ':id'): string => `/board/sessions/${id}/live`,
    decisions: '/board/decisions',
    members: '/board/members',
  },
  investigations: {
    overview: '/investigations',
    incoming: '/investigations/incoming',
    outgoing: '/investigations/outgoing',
    distribution: '/investigations/distribution',
    create: '/investigations/create',
    detail: (id = ':id'): string => `/investigations/cases/${id}`,
  },
  medical: {
    overview: '/medical',
    queue: '/medical/queue',
    results: '/medical/results',
    station: (key = ':station'): string => `/medical/station/${key}`,
    certificate: '/medical/certificate',
  },
  barcode: {
    overview: '/barcode',
    lookup: '/barcode/lookup',
    batch: '/barcode/batch',
    scan: '/barcode/scan',
    replace: '/barcode/replace',
    scans: '/barcode/scans',
  },
  biometric: {
    overview: '/biometric',
    enroll: '/biometric/enroll',
    verify: '/biometric/verify',
    gate: '/biometric/gate',
    attendance: '/biometric/attendance',
    roleInquiry: '/biometric/role-inquiry',
    history: '/biometric/history',
    verifyOps: '/biometric/verify-ops',
    monitoring: '/biometric/monitoring',
  },
  questionBank: {
    overview: '/question-bank',
    crud: '/question-bank/manage',
    exams: '/question-bank/exams',
    examCreate: '/question-bank/exams/create',
    examDetail: (id = ':examId'): string => `/question-bank/exams/${id}`,
    examPreview: (id = ':examId'): string => `/question-bank/exams/${id}/preview`,
    examTake: (id = ':examId'): string => `/question-bank/exams/${id}/take`,
    take: '/question-bank/take',
    examProctor: (id = ':examId'): string => `/question-bank/exams/${id}/proctor`,
    proctor: '/question-bank/proctor',
    results: '/question-bank/results',
  },
} as const;

export const ROOT_PATH_BY_APP: Record<AppKey, string> = {
  admin: ROUTES.admin.dashboard,
  applicant: ROUTES.applicant,
  committee: ROUTES.committee.overview,
  board: ROUTES.board.overview,
  investigations: ROUTES.investigations.overview,
  medical: ROUTES.medical.overview,
  barcode: ROUTES.barcode.overview,
  biometric: ROUTES.biometric.overview,
  exams: ROUTES.questionBank.overview,
  architecture: ROUTES.architecture,
};
