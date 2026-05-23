/**
 * Cloud RBAC seed — admin app + applicant portal only. Operational
 * on-prem roles (medical_admin, medical_doctor, investigator, board_admin,
 * exams_admin, biometric_user, records_clerk) are intentionally absent;
 * they belong to a separate on-prem RBAC surface.
 *
 * The static `ROLE_DEFINITIONS` table in features/auth/rbac.ts retains
 * the full 11-role union so demo login can still pose as on-prem roles
 * (they auth into the on-prem chrome). That's the legacy fallback
 * `buildAuthUser` reaches when no seed row matches the requested key.
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

/* Seed all 11 canonical roles so RolesPage renders the complete matrix.
 * The permission matrix itself stays cloud-only (admin + applicant);
 * operational permissions remain string claims for the on-prem apps. */
const CLOUD_ROLE_BLUEPRINT: ReadonlyArray<CloudRoleBlueprint> = [
  {
    key: 'super_admin',
    labelAr: 'مدير النظام الرئيسي',
    apps: ['admin', 'applicant', 'committee', 'board', 'investigations', 'medical', 'barcode', 'biometric', 'exams', 'architecture'],
    permissions: ['*'],
  },
  {
    key: 'committee_admin',
    labelAr: 'مدير لجنة قبول',
    apps: ['admin'],
    /* Admin-surface permissions only. On-prem permissions still live in
     * the static RBAC table for the operational cluster. */
    permissions: [
      'admin:view',
      'reports:view',
      'applicants:view',
      'applicants:create',
      'applicants:edit',
      'applicants:transition',
      'cycles:view',
      'categories:view',
      'lookups:view',
      'applicant-grades:view',
      'committees-exam-config:view',
      'committees-exam-config:edit',
      'committees-exam-config:create',
      'committees-exam-config:delete',
      'committees-exam-config:transfer',
      'admission-setup:read',
    ],
  },
  {
    key: 'committee_user',
    labelAr: 'موظف لجنة قبول',
    apps: ['committee', 'barcode', 'biometric'],
    permissions: ['applicants:view', 'barcode:print', 'biometric:verify'],
  },
  {
    key: 'applicant',
    labelAr: 'متقدم',
    apps: ['applicant'],
    /* The applicant role is auto-assigned at portal sign-up; admins don't
     * edit it from the roles screen (filtered out by RolesPage). Permissions
     * here drive the applicant portal itself, not the cloud matrix. */
    permissions: ['applicant:view', 'applicant:apply'],
  },
  {
    key: 'medical_admin',
    labelAr: 'مدير القومسيون الطبي',
    apps: ['medical', 'barcode', 'biometric'],
    permissions: ['medical:manage', 'results:enter', 'biometric:verify'],
  },
  {
    key: 'medical_doctor',
    labelAr: 'طبيب عيادة',
    apps: ['medical'],
    permissions: ['medical:examine', 'results:enter'],
  },
  {
    key: 'investigator',
    labelAr: 'محقق',
    apps: ['investigations'],
    permissions: ['investigations:view', 'investigations:edit'],
  },
  {
    key: 'board_admin',
    labelAr: 'أمين سر الهيئة',
    apps: ['board'],
    permissions: ['board:manage'],
  },
  {
    key: 'exams_admin',
    labelAr: 'مدير الاختبارات',
    apps: ['exams'],
    permissions: ['exams:manage', 'questions:manage', 'results:view'],
  },
  {
    key: 'biometric_user',
    labelAr: 'مستخدم بوابة الأمن',
    apps: ['biometric'],
    permissions: ['biometric:verify'],
  },
  {
    key: 'records_clerk',
    labelAr: 'مدخل نتائج',
    apps: ['medical', 'exams'],
    permissions: ['results:enter'],
  },
];

const systemRows: RoleDefinitionRow[] = CLOUD_ROLE_BLUEPRINT.map((b) => ({
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
  /* Migrated from ['payments:review', 'payments:refund_eligibility',
   * 'reports:view']. Refund-eligibility de-duped into approve. */
  permissions: ['payments:review', 'payments:sync', 'payments:approve', 'dashboard:view'],
  apps: ['admin'],
  createdAt: now,
  updatedAt: now,
};

export const ROLE_DEFINITION_SEED: RoleDefinitionRow[] = [...systemRows, financeReview];

/** No canonical role is removed from the seed; the matrix remains scoped. */
export const ROLES_REMOVED_FROM_CLOUD_SEED = [] as const;
