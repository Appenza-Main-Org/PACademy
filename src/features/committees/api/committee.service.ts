/**
 * Committees API
 *   GET /api/committees
 *   GET /api/committees/:id
 *   GET /api/committees/:id/applicants
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { Applicant, Committee } from '@/shared/types/domain';

export const committeeService = {
  async list(): Promise<Committee[]> {
    await simulateLatency();
    return MOCK.committees;
  },
  async getById(id: string): Promise<Committee | null> {
    await simulateLatency();
    return MOCK.committees.find((c) => c.id === id) ?? null;
  },
  async getApplicants(committeeName: string): Promise<Applicant[]> {
    await simulateLatency();
    return MOCK.applicants.filter((a) => a.committee === committeeName).slice(0, 50);
  },
};
