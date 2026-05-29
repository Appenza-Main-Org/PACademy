/**
 * RBAC matrix — cloud + on-prem roles.
 *
 * Cloud-aligned roles (super_admin, admissions_manager, applicants_officer,
 * setup_admin, payments_officer, auditor, exams_admin, applicant) are the
 * surface backed by `apiClient` and the cloud permission matrix in
 * `features/admin/users/lib/cloudPermissions.ts`. Their `permissions`
 * arrays are derived from the matrix cells.
 *
 * On-prem roles (committee_admin, committee_user, medical_admin,
 * medical_doctor, investigator, board_admin, biometric_user, records_clerk)
 * stay in the union to keep legacy mock data + transition guards typing
 * cleanly. Their cloud `apps` + `permissions` are deliberately empty so
 * they cannot reach cloud surfaces; the on-prem deployment owns their
 * RBAC plane.
 */

import type { AppKey } from '@/shared/lib/constants';

export const ROLES = [
  /* Cloud roles ─────────────────────────────────────────────────────── */
  'super_admin',
  'admissions_manager',
  'applicants_officer',
  'setup_admin',
  'payments_officer',
  'auditor',
  'exams_admin',
  'applicant',
  'student_committee_head',
  'exam_committee_head',
  'security_gate_user',
  'admissions_system_admin',
  'medical_committee_head',
  'medical_clinic_manager',
  /* On-prem roles (legacy keys — see file header) ───────────────────── */
  'committee_admin',
  'committee_user',
  'medical_admin',
  'medical_doctor',
  'investigator',
  'board_admin',
  'biometric_user',
  'records_clerk',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Typed permission union — narrow enough that the type system catches typos
 * in feature configs (e.g. admission-setup), wide enough that legacy
 * `readonly string[]` permission arrays in `ROLE_DEFINITIONS` keep working
 * (string literals are assignable to `string`).
 *
 * Cloud permissions match cells in `cloudPermissions.ts → CELL_PERMISSION_MAP`.
 */
export type Permission =
  | '*'
  | 'admin:view'
  | 'reports:view'
  | 'reports:export'
  | 'dashboard:view'
  | 'applicants:view'
  | 'applicants:create'
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
  | 'users:reset-2fa'
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
  | 'workflows:delete'
  | 'questions:view'
  | 'questions:create'
  | 'questions:edit'
  | 'questions:delete'
  | 'questions:publish'
  | 'questions:import'
  | 'exams:view'
  | 'exams:create'
  | 'exams:edit'
  | 'exams:delete'
  | 'exams:publish'
  | 'exams:proctor'
  | 'exams:results'
  | 'biometric:view'
  | 'biometric:lookup'
  | 'biometric:enroll'
  | 'biometric:verify'
  | 'biometric:gate'
  | 'biometric:medical'
  | 'biometric:history'
  | 'biometric:reports'
  | 'biometric:audit';

export interface RoleDefinition {
  labelAr: string;
  apps: readonly AppKey[];
  permissions: readonly string[];
}

/** Convenience bundles built once so the role definitions stay readable. */
const QUESTION_BANK_PERMISSIONS: readonly Permission[] = [
  'questions:view',
  'questions:create',
  'questions:edit',
  'questions:delete',
  'questions:publish',
  'questions:import',
];

const EXAM_PERMISSIONS: readonly Permission[] = [
  'exams:view',
  'exams:create',
  'exams:edit',
  'exams:delete',
  'exams:publish',
  'exams:proctor',
  'exams:results',
];

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  /* ── Cloud roles ──────────────────────────────────────────────────── */

  super_admin: {
    labelAr: 'مدير النظام الرئيسي',
    apps: ['admin', 'applicant', 'committee', 'board', 'investigations', 'medical', 'barcode', 'biometric', 'exams', 'architecture'],
    permissions: ['*'],
  },

  admissions_manager: {
    labelAr: 'مدير القبول',
    apps: ['admin'],
    permissions: [
      'admin:view',
      'reports:view',
      'reports:export',
      'applicants:view',
      'applicants:create',
      'applicants:edit',
      'applicants:transition',
      'cycles:view',
      'cycles:create',
      'cycles:edit',
      'cycles:transition',
      'categories:view',
      'categories:edit',
      'admission-setup:read',
      'admission-setup:write',
      'admission-rules:view',
      'admission-rules:manage',
      'lookups:view',
      'lookups:edit',
      'lookup-mappings:view',
      'lookup-mappings:edit',
      'applicant-grades:view',
      'applicant-grades:edit',
      'applicant-grades:import',
      'committees-exam-config:view',
      'committees-exam-config:create',
      'committees-exam-config:edit',
      'committees-exam-config:transfer',
      'workflows:view',
      'workflows:create',
      'workflows:edit',
      'notifications:view',
      'notifications:create',
      'notifications:edit',
      'notifications:publish',
      'audit:view',
      'payments:review',
    ],
  },

  applicants_officer: {
    labelAr: 'موظف ملفات المتقدمين',
    apps: ['admin'],
    permissions: [
      'admin:view',
      'reports:view',
      'applicants:view',
      'applicants:edit',
      'applicants:transition',
      'applicant-grades:view',
      'applicant-grades:edit',
      'cycles:view',
      'categories:view',
      'lookups:view',
      'audit:view',
    ],
  },

  setup_admin: {
    labelAr: 'مهندس إعدادات القبول',
    apps: ['admin'],
    permissions: [
      'admin:view',
      'reports:view',
      'cycles:view',
      'cycles:create',
      'cycles:edit',
      'cycles:delete',
      'cycles:transition',
      'categories:view',
      'categories:edit',
      'categories:delete',
      'admission-setup:read',
      'admission-setup:write',
      'admission-rules:view',
      'admission-rules:manage',
      'lookups:view',
      'lookups:create',
      'lookups:edit',
      'lookups:delete',
      'lookups:transition',
      'lookup-mappings:view',
      'lookup-mappings:edit',
      'committees-exam-config:view',
      'committees-exam-config:create',
      'committees-exam-config:edit',
      'committees-exam-config:delete',
      'committees-exam-config:transfer',
    ],
  },

  payments_officer: {
    labelAr: 'موظف المدفوعات',
    apps: ['admin'],
    permissions: [
      'admin:view',
      'reports:view',
      'payments:review',
      'payments:approve',
      'payments:sync',
      'audit:view',
    ],
  },

  auditor: {
    labelAr: 'مراجع النظام',
    apps: ['admin'],
    permissions: [
      'admin:view',
      'reports:view',
      'reports:export',
      'audit:view',
      'audit:export',
      'applicants:view',
      'lookups:view',
    ],
  },

  exams_admin: {
    labelAr: 'مدير بنك الأسئلة والاختبارات',
    apps: ['exams'],
    permissions: [...QUESTION_BANK_PERMISSIONS, ...EXAM_PERMISSIONS],
  },

  applicant: {
    labelAr: 'متقدم',
    apps: ['applicant'],
    permissions: ['applicant:view', 'applicant:apply'],
  },

  student_committee_head: {
    labelAr: 'رئيس لجنة الطلبة',
    apps: ['committee', 'barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:history'],
  },

  exam_committee_head: {
    labelAr: 'رئيس لجنة الاختبار',
    apps: ['committee', 'barcode', 'biometric', 'exams'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:history', ...EXAM_PERMISSIONS],
  },

  security_gate_user: {
    labelAr: 'مستخدم بوابة التأمين',
    apps: ['barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:gate', 'biometric:history'],
  },

  admissions_system_admin: {
    labelAr: 'مدير نظام القبول',
    apps: ['admin', 'committee', 'barcode', 'biometric'],
    permissions: ['admin:view', 'applicants:view', 'audit:view', 'reports:view', 'biometric:*'],
  },

  medical_committee_head: {
    labelAr: 'رئيس اللجنة الطبية',
    apps: ['medical', 'barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:medical', 'biometric:history'],
  },

  medical_clinic_manager: {
    labelAr: 'مدير عيادة طبية',
    apps: ['medical', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:medical', 'biometric:history'],
  },

  /* ── On-prem roles ─────────────────────────────────────────────────
   * Kept as valid role keys for legacy mock data + transition guards.
   * No cloud apps; no cloud permissions. The on-prem deployment owns
   * their RBAC plane and authentication path. */

  committee_admin: {
    labelAr: 'مدير لجنة قبول',
    apps: [],
    permissions: [],
  },
  committee_user: {
    labelAr: 'موظف لجنة قبول',
    apps: [],
    permissions: [],
  },
  medical_admin: {
    labelAr: 'مدير القومسيون الطبي',
    apps: [],
    permissions: [],
  },
  medical_doctor: {
    labelAr: 'طبيب عيادة',
    apps: [],
    permissions: [],
  },
  investigator: {
    labelAr: 'محقق',
    apps: [],
    permissions: [],
  },
  board_admin: {
    labelAr: 'أمين سر الهيئة',
    apps: [],
    permissions: [],
  },
  biometric_user: {
    labelAr: 'مستخدم بوابة الأمن',
    apps: [],
    permissions: [],
  },
  records_clerk: {
    labelAr: 'مدخل نتائج',
    apps: [],
    permissions: [],
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
