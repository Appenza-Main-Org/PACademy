/**
 * Cycle delete guard — blocks removing cycles that already own applicant data.
 *
 * A cycle may receive the count from the legacy `applicantCount` field or from
 * backend-specific submission/application aliases during integration.
 */

export interface CycleDeleteGuardInput {
  isActive?: boolean;
  applicantCount?: number | null;
  applicationCount?: number | null;
  applicationsCount?: number | null;
  submissionCount?: number | null;
  submissionsCount?: number | null;
}

function hasPositiveCount(value: number | null | undefined): boolean {
  return typeof value === 'number' && value > 0;
}

export function hasCycleApplicantData(cycle: CycleDeleteGuardInput): boolean {
  return (
    hasPositiveCount(cycle.applicantCount) ||
    hasPositiveCount(cycle.applicationCount) ||
    hasPositiveCount(cycle.applicationsCount) ||
    hasPositiveCount(cycle.submissionCount) ||
    hasPositiveCount(cycle.submissionsCount)
  );
}

export function cycleDeleteBlockedReason(cycle: CycleDeleteGuardInput): string | null {
  if (cycle.isActive) return 'لا يمكن حذف الدورة النشطة.';
  if (hasCycleApplicantData(cycle)) {
    return 'لا يمكن حذف دورة مرتبطة بطلبات متقدمين.';
  }
  return null;
}

export function canDeleteAdmissionCycle(cycle: CycleDeleteGuardInput): boolean {
  return cycleDeleteBlockedReason(cycle) === null;
}
