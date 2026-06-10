/**
 * Admission Rules API Contract — Sprint 1 (KARASA_GAPS §1.2.C).
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/admission-rules?cycleId=          → AdmissionRule[]
 *   GET  /api/admission-rules/:cycleId/current  → AdmissionRule | null
 *   POST /api/admission-rules                   → AdmissionRule
 */

import { apiClient } from '@/shared/lib/api-client';
import type { AdmissionRule } from '@/shared/types/domain';

export const admissionRulesService = {
  async listForCycle(cycleId: string): Promise<AdmissionRule[]> {
    return apiClient.get('/api/admission-rules', { query: { cycleId } });
  },

  async getCurrent(cycleId: string): Promise<AdmissionRule | null> {
    // "No rule for cycle" serializes as 204 No Content → undefined; coalesce
    // so the query resolves (TanStack treats undefined data as an error).
    const rule = await apiClient.get<AdmissionRule | null | undefined>(
      `/api/admission-rules/${encodeURIComponent(cycleId)}/current`,
    );
    return rule ?? null;
  },

  async save(payload: Omit<AdmissionRule, 'id' | 'version' | 'effectiveAt'> & { effectiveAt?: string }): Promise<AdmissionRule> {
    return apiClient.post('/api/admission-rules', payload);
  },
};
