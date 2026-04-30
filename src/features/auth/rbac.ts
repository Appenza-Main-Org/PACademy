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
    permissions: ['applicants:view', 'applicants:edit', 'committees:manage', 'barcode:print', 'biometric:verify'],
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
