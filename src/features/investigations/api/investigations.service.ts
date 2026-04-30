/**
 * Investigations API
 *   GET /api/investigations?status=
 *   GET /api/investigations/:id
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { InvestigationStatus } from '@/shared/types/domain';

export interface InvestigationCase {
  applicantId: string;
  applicantName: string;
  nationalId: string;
  governorate: string;
  status: InvestigationStatus;
  sentAt: number;
  receivedAt: number | null;
  officer: string;
}

export const investigationsService = {
  async getCases(filters: { status?: InvestigationStatus | 'all' } = {}): Promise<InvestigationCase[]> {
    await simulateLatency();
    const status = filters.status ?? 'all';
    let items = MOCK.applicants;
    if (status !== 'all') items = items.filter((a) => a.investigation === status);
    return items.slice(0, 50).map((a, i) => ({
      applicantId: a.id,
      applicantName: a.name,
      nationalId: a.nationalId,
      governorate: a.governorate,
      status: a.investigation,
      sentAt: Date.now() - (i + 1) * 86_400_000,
      receivedAt: a.investigation === 'pending' ? null : Date.now() - i * 43_200_000,
      officer: MOCK.users.find((u) => u.role === 'investigator')?.name ?? 'محقق',
    }));
  },
  async getStats() {
    await simulateLatency();
    const all = MOCK.applicants;
    return {
      total: all.length,
      pending: all.filter((a) => a.investigation === 'pending').length,
      cleared: all.filter((a) => a.investigation === 'cleared').length,
      flagged: all.filter((a) => a.investigation === 'flagged').length,
    };
  },
};
