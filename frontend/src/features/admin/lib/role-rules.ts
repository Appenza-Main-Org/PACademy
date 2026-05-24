/**
 * Role-conflict rules for the admin user-creation flow.
 *
 * Default rule: `applicant` is mutually exclusive with every staff role.
 * (RoleMultiSelect already excludes `applicant` from the picker, but we
 * enforce defensively at the service / form-validation boundary so a
 * forged payload can't slip past.)
 *
 * Add new conflicts here as they emerge — keep the rules declarative;
 * `validateRoleSet` is the single consumer.
 */

import { type Role } from '@/features/auth';

interface RoleConflictRule {
  /** Set of roles that cannot co-exist with any role in `forbiddenWith`. */
  roles: ReadonlyArray<Role>;
  forbiddenWith: ReadonlyArray<Role>;
  /** Arabic message surfaced to the user when the rule trips. */
  message: string;
}

const STAFF_ROLES: ReadonlyArray<Role> = [
  'super_admin',
  'admissions_manager',
  'applicants_officer',
  'setup_admin',
  'payments_officer',
  'auditor',
  'exams_admin',
  'committee_admin',
  'committee_user',
  'medical_admin',
  'medical_doctor',
  'investigator',
  'board_admin',
  'biometric_user',
  'records_clerk',
];

const RULES: ReadonlyArray<RoleConflictRule> = [
  {
    roles: ['applicant'],
    forbiddenWith: STAFF_ROLES,
    message: 'لا يمكن جمع دور المتقدّم مع أدوار العاملين',
  },
];

export interface RoleValidationResult {
  ok: boolean;
  message?: string;
}

export function validateRoleSet(roles: ReadonlyArray<string>): RoleValidationResult {
  if (roles.length === 0) {
    return { ok: false, message: 'يجب اختيار دور واحد على الأقل' };
  }
  const set = new Set<string>(roles);
  for (const rule of RULES) {
    const hasRoleSide = rule.roles.some((r) => set.has(r));
    const hasForbidden = rule.forbiddenWith.some((r) => set.has(r));
    if (hasRoleSide && hasForbidden) {
      return { ok: false, message: rule.message };
    }
  }
  return { ok: true };
}
