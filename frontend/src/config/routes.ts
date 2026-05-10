import type { AppKey } from '@/shared/lib/constants';

export const ROUTES = {
  /* ── Public surface (no auth required) ── */
  landing: '/',
  apply: '/apply',
  staffLogin: '/staff-login',
  /** Backwards-compat alias — `/login` redirects to `/staff-login`. */
  login: '/staff-login',
  terms: '/terms',
  help: '/help',

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
    referenceData: (tab = ':tab'): string => `/admin/reference-data/${tab}`,
    referenceDataRoot: '/admin/reference-data',
    admissionRules: '/admin/admission-rules',
    cycles: '/admin/cycles',
    cycleDetail: (id = ':id'): string => `/admin/cycles/${id}`,
    cycleNew: '/admin/cycles/new',
    categories: '/admin/categories',
    categoryEdit: (key = ':key'): string => `/admin/categories/${key}`,
    workflows: '/admin/workflows',
    workflowEdit: (id = ':id'): string => `/admin/workflows/${id}`,
    workflowNew: '/admin/workflows/new',
    notifications: '/admin/notifications',
    payments: '/admin/payments',
    /* Admission Setup section — 14 ordered configuration steps. The keys
     * mirror `AdmissionSetupStepKey` (camelCased) so feature code can
     * derive the URL from a step key without a second lookup. Cycle
     * metadata is NOT a step — admins enter the wizard by selecting an
     * already-configured cycle from `/admin/cycles`. */
    admissionSetup: {
      index: '/admin/admission-setup',
      /** Wizard entry — top-stepper flow. `stepKey` is either an
       *  `AdmissionSetupStepKey` or the literal `'review'`. */
      wizard: (stepKey = ':stepKey'): string =>
        `/admin/admission-setup/wizard/${stepKey}`,
      wizardReview: '/admin/admission-setup/wizard/review',
      applicationSettings: '/admin/admission-setup/application-settings',
      applicationStatus: '/admin/admission-setup/application-status',
      ageRules: '/admin/admission-setup/age-rules',
      maritalStatusRules: '/admin/admission-setup/marital-status-rules',
      fees: '/admin/admission-setup/fees',
      exams: '/admin/admission-setup/exams',
      committees: '/admin/admission-setup/committees',
      committeeMergeSplit: '/admin/admission-setup/committee-merge-split',
      scoreThresholds: '/admin/admission-setup/score-thresholds',
      examDates: '/admin/admission-setup/exam-dates',
      dateCommitteeBinding: '/admin/admission-setup/date-committee-binding',
      totalScore: '/admin/admission-setup/total-score',
      notifications: '/admin/admission-setup/notifications',
      electronicDeclaration: '/admin/admission-setup/electronic-declaration',
    },
  },

  /* ── Applicant surface (own auth via Stage 1+2) ──
   *  `applicant` is a string for backwards-compat with concatenations
   *  like `${ROUTES.applicant}/auth/step-1`. Pre-wizard gate routes are
   *  flat top-level keys to avoid breaking those callsites. */
  applicant: '/applicant',
  applicantStart: '/applicant/start',
  applicantEligibility: '/applicant/eligibility',
  applicantTests: '/applicant/tests',
  applicantApplicationSummary: '/applicant/application/summary',

  /* ── Internal staff apps ── */
  committee: {
    overview: '/committee',
    list: '/committee/list',
    schedule: '/committee/schedule',
    create: '/committee/create',
    detail: (id = ':id'): string => `/committee/${id}`,
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
    examTake: (id = ':examId'): string => `/question-bank/exams/${id}/take`,
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
