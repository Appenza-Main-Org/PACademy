/**
 * Admission Cycles — real API integration.
 *
 * INTEGRATION CONTRACT (backend: AdminCyclesController + CyclesController):
 *   GET    /admin/cycles                    → PagedResult<CycleListItemDto>
 *   GET    /admin/cycles/:id                → CycleDetailDto
 *   POST   /admin/cycles                    → CycleDetailDto (201)
 *   PATCH  /admin/cycles/:id                → CycleDetailDto
 *   POST   /admin/cycles/:id/status         → CycleDetailDto
 *   DELETE /admin/cycles/:id                → 204
 *   GET    /cycles                          → PagedResult<CycleListItemDto> (Active+Closed only)
 */

import { apiClient } from '@/shared/api/client';
import type { PagedResult } from '@/shared/types/api';
import type { AdmissionCycle, AdmissionCycleCategoryConfig, ApplicantCategoryKey, CategoryCondition, CycleStatus } from '@/shared/types/domain';

// ── Backend DTO shapes ────────────────────────────────────────────────────────

interface OpenCategoryEntryDto {
  isOpen: boolean;
  capacity: number | null;
  notes: string | null;
}

interface CycleListItemDto {
  id: string;
  nameAr: string;
  year: number;
  cohort: 'male' | 'female';
  status: 'draft' | 'active' | 'closed' | 'archived';
  openDate: string;
  closeDate: string;
  expectedCapacity: number;
  applicantCount: number;
}

interface CycleDetailDto extends CycleListItemDto {
  openCategories: Record<string, OpenCategoryEntryDto>;
  conditionOverrides: Record<string, unknown>;
  createdAt: string;
  archivedAt: string | null;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toAdmissionCycle(dto: CycleDetailDto): AdmissionCycle {
  const openCategories: Partial<Record<ApplicantCategoryKey, AdmissionCycleCategoryConfig>> = {};
  for (const [key, val] of Object.entries(dto.openCategories)) {
    openCategories[key as ApplicantCategoryKey] = {
      isOpen: val.isOpen,
      capacity: val.capacity,
      notes: val.notes ?? '',
    };
  }
  return {
    id: dto.id,
    nameAr: dto.nameAr,
    year: dto.year,
    cohort: dto.cohort,
    status: dto.status as CycleStatus,
    openDate: dto.openDate,
    closeDate: dto.closeDate,
    expectedCapacity: dto.expectedCapacity,
    applicantCount: dto.applicantCount,
    openCategories,
    conditionOverrides: dto.conditionOverrides as Partial<Record<ApplicantCategoryKey, Partial<CategoryCondition>>>,
    createdAt: dto.createdAt,
  };
}

function listItemToAdmissionCycle(dto: CycleListItemDto): AdmissionCycle {
  return {
    id: dto.id,
    nameAr: dto.nameAr,
    year: dto.year,
    cohort: dto.cohort,
    status: dto.status as CycleStatus,
    openDate: dto.openDate,
    closeDate: dto.closeDate,
    expectedCapacity: dto.expectedCapacity,
    applicantCount: dto.applicantCount,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export function normalizeCycleStatus(status: CycleStatus): 'draft' | 'active' | 'closed' | 'archived' {
  const map: Record<CycleStatus, 'draft' | 'active' | 'closed' | 'archived'> = {
    draft: 'draft',
    open: 'active',
    active: 'active',
    closed: 'closed',
    processing: 'closed',
    finalized: 'archived',
    archived: 'archived',
  };
  return map[status] ?? 'draft';
}

export const cyclesService = {
  async list(): Promise<AdmissionCycle[]> {
    const { data } = await apiClient.get<PagedResult<CycleListItemDto>>('/admin/cycles', {
      params: { includeArchived: true, pageSize: 200 },
    });
    return data.items.map(listItemToAdmissionCycle);
  },

  async getById(id: string): Promise<AdmissionCycle | null> {
    const { data } = await apiClient.get<CycleDetailDto>(`/admin/cycles/${id}`);
    return toAdmissionCycle(data);
  },

  async getActive(): Promise<AdmissionCycle | null> {
    const { data } = await apiClient.get<PagedResult<CycleListItemDto>>('/cycles', {
      params: { status: 'active' },
    });
    const item = data.items.find((c) => c.status === 'active');
    return item ? listItemToAdmissionCycle(item) : null;
  },

  getActiveSync(): AdmissionCycle | null {
    return null;
  },

  async create(payload: Omit<AdmissionCycle, 'id' | 'applicantCount'>): Promise<AdmissionCycle> {
    const { data } = await apiClient.post<CycleDetailDto>('/admin/cycles', {
      nameAr: payload.nameAr,
      year: payload.year,
      cohort: payload.cohort,
      openDate: payload.openDate,
      closeDate: payload.closeDate,
      expectedCapacity: payload.expectedCapacity,
    });
    return toAdmissionCycle(data);
  },

  async update(id: string, patch: Partial<AdmissionCycle>): Promise<AdmissionCycle> {
    const openCategories = patch.openCategories
      ? Object.fromEntries(
          Object.entries(patch.openCategories).map(([k, v]) => [
            k,
            { isOpen: v?.isOpen ?? false, capacity: v?.capacity ?? null, notes: v?.notes ?? null },
          ]),
        )
      : undefined;

    const { data } = await apiClient.patch<CycleDetailDto>(`/admin/cycles/${id}`, {
      nameAr: patch.nameAr ?? undefined,
      openDate: patch.openDate ?? undefined,
      closeDate: patch.closeDate ?? undefined,
      expectedCapacity: patch.expectedCapacity ?? undefined,
      openCategories,
      conditionOverrides: patch.conditionOverrides ?? undefined,
    });
    return toAdmissionCycle(data);
  },

  clone(_id: string): Promise<AdmissionCycle> {
    return Promise.reject(
      new Error('Clone is not supported by the current backend. Create a new draft instead.'),
    );
  },

  async transition(id: string, next: CycleStatus): Promise<AdmissionCycle> {
    const normalised = normalizeCycleStatus(next);
    const { data } = await apiClient.post<CycleDetailDto>(`/admin/cycles/${id}/status`, {
      newStatus: normalised,
    });
    return toAdmissionCycle(data);
  },

  async activate(id: string): Promise<AdmissionCycle> {
    return cyclesService.transition(id, 'active');
  },

  async close(id: string): Promise<AdmissionCycle> {
    return cyclesService.transition(id, 'closed');
  },

  async archive(id: string): Promise<AdmissionCycle> {
    return cyclesService.transition(id, 'archived');
  },

  async remove(id: string): Promise<{ ok: true }> {
    await apiClient.delete(`/admin/cycles/${id}`);
    return { ok: true };
  },

  async toggleCategory(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    config: AdmissionCycleCategoryConfig,
  ): Promise<AdmissionCycle> {
    const existing = await cyclesService.getById(cycleId);
    const merged = { ...(existing?.openCategories ?? {}), [categoryKey]: config };
    return cyclesService.update(cycleId, { openCategories: merged });
  },

  async updateCategoryOverride(
    cycleId: string,
    categoryKey: ApplicantCategoryKey,
    overrides: Partial<CategoryCondition>,
  ): Promise<AdmissionCycle> {
    const existing = await cyclesService.getById(cycleId);
    const merged = {
      ...(existing?.conditionOverrides ?? {}),
      [categoryKey]: { ...(existing?.conditionOverrides?.[categoryKey] ?? {}), ...overrides },
    };
    return cyclesService.update(cycleId, { conditionOverrides: merged });
  },
};
