/**
 * Cloud RBAC seed — admin app, the question bank, and applicant portal.
 * Operational on-prem roles (committee_admin, committee_user, medical_admin,
 * medical_doctor, investigator, board_admin, biometric_user, records_clerk)
 * are intentionally absent here; the on-prem deployment owns their RBAC plane.
 *
 * The static `ROLE_DEFINITIONS` table in features/auth/rbac.ts keeps the
 * on-prem keys in its union so legacy mock data and transition guards
 * type-check cleanly; those keys are not surfaced in the RolesPage UI.
 */

import type { RoleDefinitionRow } from '@/shared/types/domain';

const now = new Date().toISOString();

interface CloudRoleBlueprint {
  key: string;
  labelAr: string;
  labelEn?: string;
  apps: RoleDefinitionRow['apps'];
  permissions: string[];
}

const QUESTION_BANK_PERMISSIONS = [
  'questions:view',
  'questions:create',
  'questions:edit',
  'questions:delete',
  'questions:publish',
  'questions:import',
];

const EXAM_PERMISSIONS = [
  'exams:view',
  'exams:create',
  'exams:edit',
  'exams:delete',
  'exams:publish',
  'exams:proctor',
  'exams:results',
];

/** Barcode operator caps (generate / print / reprint / replace / bulk-print
 *  / scan); excludes `barcode:config`. Mirrors rbac.ts. */
const BARCODE_OPERATOR_PERMISSIONS = [
  'barcode:view',
  'barcode:generate',
  'barcode:print',
  'barcode:reprint',
  'barcode:replace',
  'barcode:bulk-print',
  'barcode:scan',
];

/** Barcode admin caps = operator caps + `barcode:config`. */
const BARCODE_ADMIN_PERMISSIONS = [...BARCODE_OPERATOR_PERMISSIONS, 'barcode:config'];

const CLOUD_ROLE_BLUEPRINT: ReadonlyArray<CloudRoleBlueprint> = [
  {
    key: 'super_admin',
    labelAr: 'مدير النظام الرئيسي',
    apps: ['admin', 'applicant', 'committee', 'board', 'investigations', 'medical', 'barcode', 'biometric', 'exams', 'architecture'],
    permissions: ['*'],
  },
  {
    key: 'admissions_manager',
    labelAr: 'مدير القبول',
    labelEn: 'Admissions Manager',
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
  {
    key: 'applicants_officer',
    labelAr: 'موظف ملفات المتقدمين',
    labelEn: 'Applicants Officer',
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
  {
    key: 'setup_admin',
    labelAr: 'مهندس إعدادات القبول',
    labelEn: 'Setup Admin',
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
  {
    key: 'payments_officer',
    labelAr: 'موظف المدفوعات',
    labelEn: 'Payments Officer',
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
  {
    key: 'auditor',
    labelAr: 'مراجع النظام',
    labelEn: 'Auditor',
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
  {
    key: 'exams_admin',
    labelAr: 'مدير بنك الأسئلة والاختبارات',
    labelEn: 'Question Bank & Exams Admin',
    apps: ['exams'],
    permissions: [...QUESTION_BANK_PERMISSIONS, ...EXAM_PERMISSIONS],
  },
  {
    key: 'applicant',
    labelAr: 'متقدم',
    apps: ['applicant'],
    permissions: ['applicant:view', 'applicant:apply'],
  },
  {
    key: 'student_committee_head',
    labelAr: 'رئيس لجنة الطلبة',
    labelEn: 'Student Committee Head',
    apps: ['committee', 'barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:history', ...BARCODE_OPERATOR_PERMISSIONS],
  },
  {
    key: 'exam_committee_head',
    labelAr: 'رئيس لجنة الاختبار',
    labelEn: 'Exam Committee Head',
    apps: ['committee', 'barcode', 'biometric', 'exams'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:history', ...EXAM_PERMISSIONS, ...BARCODE_OPERATOR_PERMISSIONS],
  },
  {
    key: 'security_gate_user',
    labelAr: 'مستخدم بوابة التأمين',
    labelEn: 'Security Gate User',
    apps: ['barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:gate', 'biometric:history', 'barcode:view', 'barcode:scan'],
  },
  {
    key: 'admissions_system_admin',
    labelAr: 'مدير نظام القبول',
    labelEn: 'Admissions System Admin',
    apps: ['admin', 'committee', 'barcode', 'biometric'],
    permissions: ['admin:view', 'applicants:view', 'audit:view', 'reports:view', 'biometric:*', ...BARCODE_ADMIN_PERMISSIONS],
  },
  {
    key: 'medical_committee_head',
    labelAr: 'رئيس اللجنة الطبية',
    labelEn: 'Medical Committee Head',
    apps: ['medical', 'barcode', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:verify', 'biometric:medical', 'biometric:history', ...BARCODE_OPERATOR_PERMISSIONS],
  },
  {
    key: 'medical_clinic_manager',
    labelAr: 'مدير عيادة طبية',
    labelEn: 'Medical Clinic Manager',
    apps: ['medical', 'biometric'],
    permissions: ['biometric:view', 'biometric:lookup', 'biometric:medical', 'biometric:history'],
  },
];

const systemRows: RoleDefinitionRow[] = CLOUD_ROLE_BLUEPRINT.map((b) => ({
  id: `ROLE-${b.key.toUpperCase()}`,
  key: b.key,
  labelAr: b.labelAr,
  ...(b.labelEn ? { labelEn: b.labelEn } : {}),
  isSystem: true,
  permissions: [...b.permissions],
  apps: [...b.apps],
  createdAt: now,
  updatedAt: now,
}));

export const ROLE_DEFINITION_SEED: RoleDefinitionRow[] = [...systemRows];

/** Legacy on-prem keys retired from the cloud roles seed. */
export const ROLES_REMOVED_FROM_CLOUD_SEED = [
  'committee_admin',
  'committee_user',
  'medical_admin',
  'medical_doctor',
  'investigator',
  'board_admin',
  'biometric_user',
  'records_clerk',
  'finance_review',
] as const;
