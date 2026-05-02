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
  profile: '/profile',
  admin: {
    dashboard: '/admin',
    applicants: '/admin/applicants',
    applicantDetail: (id = ':id'): string => `/admin/applicants/${id}`,
    users: '/admin/users',
    audit: '/admin/audit',
    settings: '/admin/settings',
    reports: '/admin/reports',
    referenceData: (tab = ':tab'): string => `/admin/reference-data/${tab}`,
    referenceDataRoot: '/admin/reference-data',
    admissionRules: '/admin/admission-rules',
    cycles: '/admin/cycles',
    cycleDetail: (id = ':id'): string => `/admin/cycles/${id}`,
  },

  /* ── Applicant surface (own auth via Stage 1+2) ── */
  applicant: '/applicant',

  /* ── Internal staff apps ── */
  committee: {
    overview: '/committee',
    list: '/committee/list',
    schedule: '/committee/schedule',
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
    examTake: (id = ':examId'): string => `/question-bank/exams/${id}/take`,
    examProctor: (id = ':examId'): string => `/question-bank/exams/${id}/proctor`,
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
