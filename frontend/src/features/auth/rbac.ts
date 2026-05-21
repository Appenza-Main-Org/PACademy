/**
 * RBAC matrix — 11 roles, granular permissions, app-level access.
 * Direct port of legacy auth.service.js ROLE_DEFINITIONS, made type-safe.
 */

import type { AppKey } from '@/shared/lib/constants';

export const ROLES = [
  'super_admin',
  'committee_admin',
  'committee_user',
  'medical_admin',
  'medical_doctor',
  'investigator',
  'board_admin',
  'exams_admin',
  'biometric_user',
  'records_clerk',
  'applicant',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Typed permission union — narrow enough that the type system catches typos
 * in feature configs (e.g. admission-setup), wide enough that legacy
 * `readonly string[]` permission arrays in `ROLE_DEFINITIONS` keep working
 * (string literals are assignable to `string`). Add an entry here whenever
 * a new permission is referenced from typed code.
 */
export type Permission =
  | '*'
  | 'admin:view'
  | 'reports:view'
  | 'reports:export'
  | 'dashboard:view'
  | 'applicants:view'
  | 'applicants:edit'
  | 'applicants:transition'
  | 'applicants:delete'
  | 'cycles:view'
  | 'cycles:create'
  | 'cycles:edit'
  | 'cycles:delete'
  | 'cycles:transition'
  | 'categories:view'
  | 'categories:edit'
  | 'categories:delete'
  | 'lookups:view'
  | 'lookups:create'
  | 'lookups:edit'
  | 'lookups:delete'
  | 'lookups:transition'
  | 'lookup-mappings:view'
  | 'lookup-mappings:edit'
  | 'applicant-grades:view'
  | 'applicant-grades:import'
  | 'applicant-grades:edit'
  | 'committees-exam-config:view'
  | 'committees-exam-config:edit'
  | 'committees-exam-config:create'
  | 'committees-exam-config:delete'
  | 'committees-exam-config:transfer'
  | 'admission-setup:read'
  | 'admission-setup:write'
  | 'admission-rules:view'
  | 'admission-rules:manage'
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:manage'
  | 'roles:view'
  | 'roles:manage'
  | 'audit:view'
  | 'audit:export'
  | 'settings:view'
  | 'settings:manage'
  | 'notifications:view'
  | 'notifications:create'
  | 'notifications:edit'
  | 'notifications:delete'
  | 'notifications:publish'
  | 'payments:review'
  | 'payments:sync'
  | 'payments:approve'
  | 'workflows:view'
  | 'workflows:create'
  | 'workflows:edit'
  | 'workflows:delete';

export interface RoleDefinition {
  labelAr: string;
  apps: readonly AppKey[];
  permissions: readonly string[];
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  super_admin: {
    labelAr: 'مدير النظام الرئيسي',
    apps: ['admin', 'applicant', 'committee', 'board', 'investigations', 'medical', 'barcode', 'biometric', 'exams', 'architecture'],
    permissions: ['*'],
  },
  committee_admin: {
    labelAr: 'مدير لجنة قبول',
    apps: ['admin', 'committee', 'barcode', 'biometric'],
    permissions: [
      'admin:view',
      'reports:view',
      'applicants:view',
      'applicants:edit',
      'applicants:transition',
      'cycles:view',
      'categories:view',
      'lookups:view',
      'applicant-grades:view',
      'committees-exam-config:view',
      'committees-exam-config:edit',
      'committees:manage',
      'barcode:print',
      'biometric:verify',
      'workflows:read',
      'workflows:write',
      /* Admission-setup section visibility for cycle-management roles. Write
       * is reserved to super_admin per the brief — reading the steps lets
       * committee admins audit the active cycle's setup. */
      'admission-setup:read',
    ],
  },
  committee_user: {
    labelAr: 'موظف لجنة قبول',
    apps: ['committee', 'barcode', 'biometric'],
    permissions: ['applicants:view', 'barcode:print', 'biometric:verify'],
  },
  medical_admin: {
    labelAr: 'مدير القومسيون الطبي',
    apps: ['medical', 'barcode', 'biometric'],
    permissions: ['medical:manage', 'results:enter', 'biometric:verify'],
  },
  medical_doctor: {
    labelAr: 'طبيب عيادة',
    apps: ['medical'],
    permissions: ['medical:examine', 'results:enter'],
  },
  investigator: {
    labelAr: 'محقق',
    apps: ['investigations'],
    permissions: ['investigations:view', 'investigations:edit'],
  },
  board_admin: {
    labelAr: 'أمين سر الهيئة',
    apps: ['board'],
    permissions: ['board:manage'],
  },
  exams_admin: {
    labelAr: 'مدير الاختبارات',
    apps: ['exams'],
    permissions: ['exams:manage', 'questions:manage', 'results:view'],
  },
  biometric_user: {
    labelAr: 'مستخدم بوابة الأمن',
    apps: ['biometric'],
    permissions: ['biometric:verify'],
  },
  records_clerk: {
    labelAr: 'مدخل نتائج',
    apps: ['medical', 'exams'],
    permissions: ['results:enter'],
  },
  applicant: {
    labelAr: 'متقدم',
    apps: ['applicant'],
    permissions: ['applicant:view', 'applicant:apply'],
  },
};

export function hasPermission(permissions: readonly string[], required: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  // Wildcard prefix match: "applicants:*" satisfies "applicants:view"
  const [resource] = required.split(':');
  if (resource && permissions.includes(`${resource}:*`)) return true;
  return false;
}

export function canAccessApp(apps: readonly AppKey[], app: AppKey): boolean {
  return apps.includes(app);
}
