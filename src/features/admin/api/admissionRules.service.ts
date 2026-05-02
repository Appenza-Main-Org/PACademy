/**
 * Admission Rules API Contract — Sprint 1 (KARASA_GAPS §1.2.C).
 *
 * INTEGRATION CONTRACT:
 *   GET  /api/admission-rules?cycleId=          → AdmissionRule[] (versioned)
 *   GET  /api/admission-rules/:cycleId/current  → AdmissionRule (latest version)
 *   POST /api/admission-rules                   → AdmissionRule (new version)
 *
 * Each save creates a NEW version — rules are append-only and the active
 * rule is always the highest version per cycle.
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AdmissionRule } from '@/shared/types/domain';

const STATE: AdmissionRule[] = [...MOCK.admissionRules];

export const admissionRulesService = {
  async listForCycle(cycleId: string): Promise<AdmissionRule[]> {
    await simulateLatency();
    return STATE.filter((r) => r.cycleId === cycleId).sort((a, b) => b.version - a.version);
  },

  async getCurrent(cycleId: string): Promise<AdmissionRule | null> {
    await simulateLatency();
    const rules = STATE.filter((r) => r.cycleId === cycleId);
    if (rules.length === 0) return null;
    return rules.reduce((latest, r) => (r.version > latest.version ? r : latest));
  },

  async save(payload: Omit<AdmissionRule, 'id' | 'version' | 'effectiveAt'> & { effectiveAt?: string }): Promise<AdmissionRule> {
    await simulateLatency();
    const existing = STATE.filter((r) => r.cycleId === payload.cycleId);
    const version = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.version)) + 1;
    const next: AdmissionRule = {
      ...payload,
      id: `RULE-${payload.cycleId}-V${version}`,
      version,
      effectiveAt: payload.effectiveAt ?? new Date().toISOString(),
    };
    STATE.push(next);
    return next;
  },
};
