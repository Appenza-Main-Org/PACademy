export const APP_NAME = 'منظومة القبول · أكاديمية الشرطة';
export const APP_OWNER = 'وزارة الداخلية · أكاديمية الشرطة';
export const SUPPORT_PHONE = '19000';
export const SUPPORT_EMAIL = 'support@police-academy.gov.eg';

export const STAGE_LABELS = [
  'تسجيل أولي',
  'دفع رسوم',
  'بيانات الأسرة',
  'بيانات الأقارب',
  'موعد اختبار',
  'كارت تردد',
  'القومسيون الطبي',
  'اختبار اللياقة',
  'المقابلة الشخصية',
  'الاختبار النهائي',
  'النتيجة',
] as const;

export const APP_KEYS = [
  'admin',
  'applicant',
  'committee',
  'board',
  'investigations',
  'medical',
  'barcode',
  'biometric',
  'exams',
  'architecture',
] as const;

export type AppKey = (typeof APP_KEYS)[number];

/* Cloud-vs-on-prem split. The cloud RBAC matrix (features/admin/users/lib/
 * cloudPermissions.ts + shared/mock-data/roles.ts) is deliberately closed —
 * it only models cloud-deployed apps. Operational on-prem modules have a
 * separate RBAC surface that the cloud frontend can't edit but still needs
 * to *render* correctly in the unified hub. See CLAUDE.md §1, §5 + brief
 * "Cloud-vs-on-prem RBAC split". */
export const CLOUD_APPS: readonly AppKey[] = ['admin', 'applicant', 'architecture'];
export const ON_PREM_APPS: readonly AppKey[] = [
  'committee',
  'board',
  'investigations',
  'medical',
  'barcode',
  'biometric',
  'exams',
];
