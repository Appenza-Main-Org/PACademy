/**
 * Admission Cycles API Contract — Sprint 1 (KARASA_GAPS §1.2.D).
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/cycles
 *   GET    /api/cycles/active
 *   GET    /api/cycles/:id
 *   POST   /api/cycles
 *   PATCH  /api/cycles/:id
 *   POST   /api/cycles/:id/clone
 *   POST   /api/cycles/:id/transition
 *   POST   /api/cycles/:id/activate
 *   POST   /api/cycles/:id/set-active
 *   POST   /api/cycles/:id/deactivate
 *   POST   /api/cycles/:id/close
 *   POST   /api/cycles/:id/extend
 *   POST   /api/cycles/:id/archive
 *   DELETE /api/cycles/:id
 *   GET    /api/cycles/:id/dependencies
 *   POST   /api/cycles/:id/soft-delete
 *   POST   /api/cycles/:id/restore
 *   PATCH  /api/cycles/:id/categories/:key
 *   PATCH  /api/cycles/:id/categories/:key/conditions
 */

import { apiClient } from '@/shared/lib/api-client';
import type { DependencyResult } from '@/shared/lib/soft-delete';
import type {
  AdmissionCycle,
  AdmissionCycleCategoryConfig,
  ApplicantCategoryKey,
  CategoryCondition,
  CycleStatus,
} from '@/shared/types/domain';

export function validateCategoryConfig(
  cycle: AdmissionCycle,
  config: AdmissionCycleCategoryConfig,
): string[] {
  const issues: string[] = [];
  const cycleStart = cycle.openDate ? new Date(cycle.openDate).getTime() : null;
  const cycleEnd = cycle.closeDate ? new Date(cycle.closeDate).getTime() : null;
  const start = config.startDate ? new Date(config.startDate).getTime() : null;
  const end = config.endDate ? new Date(config.endDate).getTime() : null;

  if (config.isOpen) {
    if (!config.genderTypes || config.genderTypes.length === 0) {
      issues.push('يجب اختيار نوع واحد على الأقل');
    }
    if (!config.startDate || !config.endDate) {
      issues.push('لا يمكن فتح الفئة بدون تحديد فترة التقديم');
    }
  }

  if (start !== null && cycleStart !== null && cycleEnd !== null && (start < cycleStart || start > cycleEnd)) {
    issues.push('تاريخ البداية يجب أن يكون داخل نطاق العام الدراسي');
  }
  if (end !== null && cycleStart !== null && cycleEnd !== null && (end < cycleStart || end > cycleEnd)) {
    issues.push('تاريخ النهاية يجب أن يكون داخل نطاق العام الدراسي');
  }
  if (start !== null && end !== null && end < start) {
    issues.push('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
  }

  return issues;
}

const NORMALIZE_STATUS: Record<CycleStatus, 'draft' | 'active' | 'closed' | 'archived'> = {
  draft: 'draft',
  open: 'active',
  active: 'active',
  extended: 'active',
  closed: 'closed',
  processing: 'closed',
  finalized: 'archived',
  archived: 'archived',
};

export function normalizeCycleStatus(status: CycleStatus): 'draft' | 'active' | 'closed' | 'archived' {
  return NORMALIZE_STATUS[status];
}

export const cyclesService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<AdmissionCycle[]> {
    return apiClient.get('/api/cycles', { query: opts });
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    return apiClient.get(`/api/cycles/${encodeURIComponent(id)}`);
  },

  async getActive(): Promise<AdmissionCycle | null> {
    return apiClient.get('/api/cycles/active');
  },

  async create(
    payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>,
    options: { demoteCurrentActive?: boolean } = {},
  ): Promise<AdmissionCycle> {
    return apiClient.post('/api/cycles', payload, {
      query: { demoteCurrentActive: options.demoteCurrentActive },
    });
  },

  async updateStatus(
    id: string,
    next: CycleStatus,
    options: { demoteCurrentActive?: boolean } = {},
  ): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/transition`, {
      status: next,
      demoteCurrentActive: options.demoteCurrentActive,
    });
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    return apiClient.patch(`/api/cycles/${encodeURIComponent(id)}`, patch);
  },

  async clone(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/clone`);
  },

  async setActive(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/set-active`);
  },

  async deactivate(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/deactivate`);
  },

  async transition(id: string, next: CycleStatus): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/transition`, { status: next });
  },

  async activate(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/activate`);
  },

  async swapActive(targetId: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(targetId)}/activate`, undefined, {
      query: { swap: true },
    });
  },

  async close(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/close`);
  },

  async extend(id: string, newCloseDate: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/extend`, { newCloseDate });
  },

  async archive(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/archive`);
  },

  async remove(id: string): Promise<{ ok: true }> {
    await apiClient.delete(`/api/cycles/${encodeURIComponent(id)}`);
    return { ok: true };
  },

  async toggleCategory(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    config: AdmissionCycleCategoryConfig,
  ): Promise<AdmissionCycle> {
    return apiClient.patch(
      `/api/cycles/${encodeURIComponent(cycleId)}/categories/${encodeURIComponent(categoryKey)}`,
      config,
    );
  },

  async updateCategoryOverride(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    overrides: Partial<CategoryCondition>,
  ): Promise<AdmissionCycle> {
    return apiClient.patch(
      `/api/cycles/${encodeURIComponent(cycleId)}/categories/${encodeURIComponent(categoryKey)}/conditions`,
      overrides,
    );
  },

  async getDependencies(id: string): Promise<DependencyResult> {
    return apiClient.get(`/api/cycles/${encodeURIComponent(id)}/dependencies`);
  },

  async softDelete(id: string, reason: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/soft-delete`, { reason });
  },

  async restore(id: string): Promise<AdmissionCycle> {
    return apiClient.post(`/api/cycles/${encodeURIComponent(id)}/restore`);
  },
};
