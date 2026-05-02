/**
 * Admission Cycles API Contract — Sprint 1 (KARASA_GAPS §1.2.D).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/cycles                        → AdmissionCycle[]
 *   GET    /api/cycles/:id                    → AdmissionCycle
 *   POST   /api/cycles                        → AdmissionCycle
 *   PATCH  /api/cycles/:id                    → AdmissionCycle
 *   POST   /api/cycles/:id/clone              → AdmissionCycle (new draft)
 *   POST   /api/cycles/:id/transition         → { status }
 */

import { MOCK } from '@/shared/mock-data';
import { simulateLatency } from '@/shared/lib/mock-helpers';
import type { AdmissionCycle, CycleStatus } from '@/shared/types/domain';

const STATE: AdmissionCycle[] = [...MOCK.admissionCycles];

let cloneCounter = 1;

export const cyclesService = {
  async list(): Promise<AdmissionCycle[]> {
    await simulateLatency();
    return [...STATE].sort((a, b) => b.year - a.year);
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    await simulateLatency();
    return STATE.find((c) => c.id === id) ?? null;
  },

  async create(payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>): Promise<AdmissionCycle> {
    await simulateLatency();
    const cycle: AdmissionCycle = {
      ...payload,
      id: `CYC-${payload.year}-${payload.cohort.toUpperCase().slice(0, 1)}`,
      applicantCount: 0,
    };
    STATE.unshift(cycle);
    return cycle;
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    await simulateLatency();
    const idx = STATE.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('الدورة غير موجودة');
    STATE[idx] = { ...STATE[idx], ...patch } as AdmissionCycle;
    return STATE[idx]!;
  },

  async clone(id: string): Promise<AdmissionCycle> {
    await simulateLatency();
    const source = STATE.find((c) => c.id === id);
    if (!source) throw new Error('الدورة غير موجودة');
    const draft: AdmissionCycle = {
      ...source,
      id: `${source.id}-CLONE-${cloneCounter++}`,
      nameAr: `${source.nameAr} (نسخة)`,
      status: 'draft',
      applicantCount: 0,
    };
    STATE.unshift(draft);
    return draft;
  },

  async transition(id: string, next: CycleStatus): Promise<AdmissionCycle> {
    return cyclesService.update(id, { status: next });
  },
};
