/**
 * Operator scoping for barcode printing (US-BC-011 → US-BC-016).
 *
 * Printing is restricted to the applicants an operator is entitled to,
 * derived from their role:
 *   - Student Committee  → only applicants assigned to that committee
 *     (US-BC-011/012).
 *   - College Exam Committee → only applicants eligible for the selected
 *     exam, gated to same-day eligibility, with an admin-configurable
 *     exception override (US-BC-013/014).
 *   - Medical Commission → only applicants with same-day medical
 *     eligibility (US-BC-015/016).
 *
 * Admin roles (super_admin / admissions_system_admin = College System
 * Administrator) are not locked to one scope: they choose which scope to
 * operate under and may toggle the same-day override. Real scoped-role
 * users (authenticated by the on-prem deployment) are locked to their own
 * scope; the same predicates apply.
 *
 * The "same-day" schedule is derived deterministically per applicant id
 * (FNV-1a, no global LCG mutation) since the seeded pool carries no exam
 * dates. INTEGRATION NOTE: the backend uses the real scheduled exam /
 * medical date instead of this derivation.
 */

import type { Role } from '@/features/auth';
import type { Applicant } from '@/shared/types/domain';
import { fnv1a } from './barcodeGroups';
import { resolveGroupValues } from './barcodeGroups';

export type OperatorScopeKind = 'admin' | 'student-committee' | 'exam-committee' | 'medical';

export interface OperatorScope {
  kind: OperatorScopeKind;
  /** student-committee: the committee ordinal name (الأولى…). */
  committee?: string;
  /** exam-committee: the selected exam-type value. */
  examType?: string;
  /** Admin same-day exception (US-BC-014). Ignored for kind === 'admin'. */
  override: boolean;
}

/** Map a role to its fixed scope kind, and whether the operator may change
 *  scope (admins) or is locked to it (scoped roles). */
export function scopeForRole(role: Role): { kind: OperatorScopeKind; locked: boolean } {
  switch (role) {
    case 'student_committee_head':
      return { kind: 'student-committee', locked: true };
    case 'exam_committee_head':
      return { kind: 'exam-committee', locked: true };
    case 'medical_committee_head':
    case 'medical_clinic_manager':
      return { kind: 'medical', locked: true };
    default:
      /* super_admin, admissions_system_admin, security_gate_user, … */
      return { kind: 'admin', locked: false };
  }
}

/** ~1-in-5 applicants are "scheduled today" for a given salt — deterministic
 *  and always non-empty across the pool. */
function scheduledToday(applicantId: string, salt: string): boolean {
  return fnv1a(`${applicantId}|${salt}`) % 5 === 0;
}

/** Applicant's resolved exam-type matches the selected exam (US-BC-013). */
export function isEligibleForExam(applicant: Applicant, examType: string): boolean {
  return resolveGroupValues(applicant).examType === examType;
}

/** Applicant has not failed the medical commission (US-BC-015). */
export function isMedicallyEligible(applicant: Applicant): boolean {
  return applicant.results.medical !== 'fail';
}

/** The single predicate every scoped print operation runs through. */
export function isApplicantInScope(applicant: Applicant, scope: OperatorScope): boolean {
  switch (scope.kind) {
    case 'admin':
      return true;
    case 'student-committee':
      return Boolean(scope.committee) && applicant.committee === scope.committee;
    case 'exam-committee': {
      if (!scope.examType) return false;
      if (!isEligibleForExam(applicant, scope.examType)) return false;
      return scope.override || scheduledToday(applicant.id, `exam:${scope.examType}`);
    }
    case 'medical':
      if (!isMedicallyEligible(applicant)) return false;
      return scope.override || scheduledToday(applicant.id, 'medical');
    default:
      return false;
  }
}

/** Whether the scope kind has a same-day gate that the override relaxes. */
export function scopeHasSameDayGate(kind: OperatorScopeKind): boolean {
  return kind === 'exam-committee' || kind === 'medical';
}
