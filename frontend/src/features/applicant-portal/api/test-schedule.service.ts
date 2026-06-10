/**
 * Test schedule API contract — Bucket C.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/applicant/{id}/tests           → TestSchedule[]
 *   GET    /api/applicant/{id}/tests/current   → TestSchedule | null
 */

import { MOCK } from '@/shared/mock-data';
import { applicantApiClient, isBackendEnabled } from '@/shared/lib/api-client';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import { useAuthStore } from '@/features/auth';
import type { TestSchedule } from '@/shared/types/domain';

function resolveApplicantId(passedId: string): string {
  if (!isBackendEnabled()) return passedId;
  return useAuthStore.getState().user?.id ?? passedId;
}

export const testScheduleService = {
  async list(applicantId: string): Promise<TestSchedule[]> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      return applicantApiClient.get<TestSchedule[]>(
        `/api/applicant/${encodeURIComponent(id)}/tests`,
      );
    }
    await simulateLatency();
    return MOCK.testSchedules
      .filter((t) => t.applicantId === applicantId)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  },

  /**
   * "Current" = the closest upcoming or in-evaluation test. Falls back to
   * the most recent past test if nothing is upcoming.
   */
  async current(applicantId: string): Promise<TestSchedule | null> {
    if (isBackendEnabled()) {
      const id = resolveApplicantId(applicantId);
      // "No current test" serializes as 204 No Content → undefined; coalesce
      // so the query resolves (TanStack treats undefined data as an error).
      const current = await applicantApiClient.get<TestSchedule | null | undefined>(
        `/api/applicant/${encodeURIComponent(id)}/tests/current`,
      );
      return current ?? null;
    }
    await simulateLatency(120, 240);
    const all = MOCK.testSchedules.filter((t) => t.applicantId === applicantId);
    const now = Date.now();
    const upcoming = all
      .filter((t) => t.status === 'scheduled' && new Date(t.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    if (upcoming.length > 0) return upcoming[0]!;
    const evaluating = all.filter((t) => t.status === 'attended' || t.status === 'pending_result');
    if (evaluating.length > 0) return evaluating[evaluating.length - 1]!;
    return null;
  },
};
