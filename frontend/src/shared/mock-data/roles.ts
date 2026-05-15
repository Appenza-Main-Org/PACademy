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

/* Kept-and-migrated roles. Cloud-only or cloud-mixed; on-prem-only roles
 * (medical/investigator/board/exams/biometric/records_clerk and their
 * sub-variants) are excluded — see ROLES_REMOVED_FROM_CLOUD_SEED below. */
const CLOUD_ROLE_BLUEPRINT: ReadonlyArray<CloudRoleBlueprint> = [
  {
    key: 'super_admin',
    labelAr: 'مدير النظام الرئيسي',
    apps: ['admin', 'applicant', 'architecture'],
    permissions: ['*'],
  },
  {
    key: 'committee_admin',
    labelAr: 'مدير لجنة قبول',
    apps: ['admin'],
    /* Migrated from legacy. On-prem perms (committees:manage, barcode:print,
     * biometric:verify, workflows:read/write) stripped — they govern on-prem
     * modules and are managed by the on-prem RBAC. */
    permissions: ['applicants:view', 'applicants:edit', 'applicants:transition'],
  },
  {
    key: 'committee_user',
    labelAr: 'موظف لجنة قبول',
    apps: ['admin'],
    /* Migrated from legacy. barcode:print and biometric:verify stripped. */
    permissions: ['applicants:view'],
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
  permissions: ['applicant_payments:approve', 'dashboard:view'],
  apps: ['admin'],
  createdAt: now,
  updatedAt: now,
};

export const ROLE_DEFINITION_SEED: RoleDefinitionRow[] = [...systemRows, financeReview];

/**
 * On-prem-only roles dropped from the cloud seed. Surfaced once on boot
 * in dev so it's obvious where they went — they're managed by the
 * separate on-prem RBAC, not this cloud plane.
 */
export const ROLES_REMOVED_FROM_CLOUD_SEED = [
  'medical_admin',
  'medical_doctor',
  'investigator',
  'board_admin',
  'exams_admin',
  'biometric_user',
  'records_clerk',
] as const;

if (import.meta.env.DEV) {
  for (const name of ROLES_REMOVED_FROM_CLOUD_SEED) {
    // eslint-disable-next-line no-console
    console.info(`[cloud-rbac] Role ${name} removed — belongs to on-prem RBAC.`);
  }
}
