/**
 * useWizardWritePermission — returns whether the current user can mutate
 * wizard steps for the given cycle.
 *
 * Returns `canWrite: false` when:
 *  1. The cycle status is not 'draft' (FR-005 / FR-006).
 *  2. The authenticated user lacks the `admission-setup:write` permission.
 *
 * All 15 wizard step pages should wrap their mutating controls with this
 * hook and render them disabled (with an Arabic tooltip) when `!canWrite`.
 */

import { useAuthStore } from '@/features/auth';
import type { AdmissionCycle } from '@/shared/types/domain';

export interface WizardWritePermission {
  canWrite: boolean;
  reason: string | null;
}

export function useWizardWritePermission(
  cycle: AdmissionCycle | null,
): WizardWritePermission {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return { canWrite: false, reason: 'يجب تسجيل الدخول أولاً' };
  }

  const hasWritePermission =
    user.permissions.includes('*') ||
    user.permissions.includes('admission-setup:*') ||
    user.permissions.includes('admission-setup:write');

  if (!hasWritePermission) {
    return { canWrite: false, reason: 'لا تملك صلاحية تعديل إعدادات القبول' };
  }

  if (!cycle) {
    return { canWrite: false, reason: 'لم يتم تحديد دورة' };
  }

  if (cycle.status !== 'draft') {
    return {
      canWrite: false,
      reason: 'لا يمكن تعديل إعدادات دورة غير مسودة',
    };
  }

  return { canWrite: true, reason: null };
}
