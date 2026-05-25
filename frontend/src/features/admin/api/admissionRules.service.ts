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
    return apiClient.get(`/api/admission-rules/${encodeURIComponent(cycleId)}/current`);
  },

  async save(payload: Omit<AdmissionRule, 'id' | 'version' | 'effectiveAt'> & { effectiveAt?: string }): Promise<AdmissionRule> {
    return apiClient.post('/api/admission-rules', payload);
  },
};
