/**
 * Audit API Contract
 *   GET /api/audit?action=&user=&limit=&since=
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AuditEntry, AuditAction } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string | 'all';
  limit?: number;
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    await simulateLatency();
    const { action = 'all', userId = 'all', limit = 50 } = filters;
    let items = MOCK.audit;
    if (action !== 'all') items = items.filter((e) => e.action === action);
    if (userId !== 'all') items = items.filter((e) => e.userId === userId);
    return items.slice(0, limit);
  },
};
