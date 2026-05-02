import type { AppKey } from '@/shared/lib/constants';

export const ROUTES = {
  login: '/login',
  hub: '/',
  architecture: '/architecture',
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
  applicant: '/applicant',
  committee: {
    overview: '/committee',
    list: '/committee/list',
    schedule: '/committee/schedule',
  },
  board: {
    overview: '/board',
    sessions: '/board/sessions',
    decisions: '/board/decisions',
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
  },
  biometric: {
    overview: '/biometric',
    enroll: '/biometric/enroll',
    history: '/biometric/history',
  },
  questionBank: {
    overview: '/question-bank',
    exams: '/question-bank/exams',
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
