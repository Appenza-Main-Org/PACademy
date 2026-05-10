/**
 * Role definitions seed — Gap C (admin-gaps).
 *
 * Mirrors the 11-role legacy `ROLE_DEFINITIONS` as `isSystem: true` rows,
 * plus the new `finance_review` role called out by the meeting notes.
 * System rows lock label/permissions; only `scope` is editable.
 */

import type { RoleDefinitionRow } from '@/shared/types/domain';

/* shared/ cannot import from features/, so the 11 system rows are
 * inlined here. Keep in sync with features/auth/rbac.ts ROLE_DEFINITIONS. */

const now = new Date().toISOString();

const SYSTEM_ROLE_BLUEPRINT: ReadonlyArray<{
  key: string;
  labelAr: string;
  apps: RoleDefinitionRow['apps'];
  permissions: string[];
}> = [
  { key: 'super_admin',     labelAr: 'مدير النظام الرئيسي', apps: ['admin', 'applicant', 'committee', 'board', 'investigations', 'medical', 'barcode', 'biometric', 'exams', 'architecture'], permissions: ['*'] },
  { key: 'committee_admin', labelAr: 'مدير لجنة قبول',      apps: ['admin', 'committee', 'barcode', 'biometric'], permissions: ['applicants:view', 'applicants:edit', 'applicants:transition', 'committees:manage', 'barcode:print', 'biometric:verify', 'workflows:read', 'workflows:write'] },
  { key: 'committee_user',  labelAr: 'موظف لجنة قبول',      apps: ['committee', 'barcode', 'biometric'], permissions: ['applicants:view', 'barcode:print', 'biometric:verify'] },
  { key: 'medical_admin',   labelAr: 'مدير القومسيون الطبي', apps: ['medical', 'barcode', 'biometric'], permissions: ['medical:manage', 'results:enter', 'biometric:verify'] },
  { key: 'medical_doctor',  labelAr: 'طبيب عيادة',           apps: ['medical'], permissions: ['medical:examine', 'results:enter'] },
  { key: 'investigator',    labelAr: 'محقق',                  apps: ['investigations'], permissions: ['investigations:view', 'investigations:edit'] },
  { key: 'board_admin',     labelAr: 'أمين سر الهيئة',        apps: ['board'], permissions: ['board:manage'] },
  { key: 'exams_admin',     labelAr: 'مدير الاختبارات',        apps: ['exams'], permissions: ['exams:manage', 'questions:manage', 'results:view'] },
  { key: 'biometric_user',  labelAr: 'مستخدم بوابة الأمن',     apps: ['biometric'], permissions: ['biometric:verify'] },
  { key: 'records_clerk',   labelAr: 'مدخل نتائج',            apps: ['medical', 'exams'], permissions: ['results:enter'] },
  { key: 'applicant',       labelAr: 'متقدم',                 apps: ['applicant'], permissions: ['applicant:view', 'applicant:apply'] },
];

const systemRows: RoleDefinitionRow[] = SYSTEM_ROLE_BLUEPRINT.map((b) => ({
  id: `ROLE-${b.key.toUpperCase()}`,
  key: b.key,
  labelAr: b.labelAr,
  isSystem: true,
  permissions: [...b.permissions],
  apps: [...b.apps],
  createdAt: now,
  updatedAt: now,
}));

const financeReview: RoleDefinitionRow = {
  id: 'ROLE-FINANCE_REVIEW',
  key: 'finance_review',
  labelAr: 'مراجع مالي',
  labelEn: 'Finance Review',
  isSystem: true,
  permissions: ['payments:review', 'payments:refund_eligibility', 'reports:view'],
  apps: ['admin'],
  createdAt: now,
  updatedAt: now,
};

export const ROLE_DEFINITION_SEED: RoleDefinitionRow[] = [...systemRows, financeReview];

/* ── Permission matrix taxonomy — drives the <PermissionMatrix> UI ───── */

export const PERMISSION_MODULES = [
  'applicants',
  'committees',
  'medical',
  'investigations',
  'board',
  'exams',
  'questions',
  'biometric',
  'barcode',
  'workflows',
  'reports',
  'audit',
  'settings',
  'users',
  'roles',
  'lookups',
  'notifications',
  'payments',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ['view', 'edit', 'create', 'delete', 'manage', 'transition', 'review'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const MODULE_LABELS_AR: Record<PermissionModule, string> = {
  applicants: 'المتقدمون',
  committees: 'اللجان',
  medical: 'القومسيون الطبي',
  investigations: 'التحريات',
  board: 'الهيئة',
  exams: 'الاختبارات',
  questions: 'بنك الأسئلة',
  biometric: 'البوابة الأمنية',
  barcode: 'الباركود',
  workflows: 'سير العمل',
  reports: 'التقارير',
  audit: 'سجل النشاط',
  settings: 'الإعدادات',
  users: 'المستخدمون',
  roles: 'الأدوار',
  lookups: 'البيانات المرجعية',
  notifications: 'الإشعارات',
  payments: 'المدفوعات',
};

export const ACTION_LABELS_AR: Record<PermissionAction, string> = {
  view: 'عرض',
  edit: 'تعديل',
  create: 'إنشاء',
  delete: 'حذف',
  manage: 'إدارة',
  transition: 'تغيير الحالة',
  review: 'اعتماد',
};
