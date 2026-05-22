/**
 * Committee × Day Binding service.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/committee-bindings/cycles/:cycleId
 *   POST   /api/admin/committee-bindings
 *   PATCH  /api/admin/committee-bindings/:id
 *   DELETE /api/admin/committee-bindings/:id
 *   POST   /api/admin/committee-bindings/:id/toggle-active
 *   POST   /api/admin/committee-bindings/bulk-eligibility
 *   POST   /api/admin/committee-bindings/copy-row
 *   POST   /api/admin/committee-bindings/copy-column
 */

import { apiClient } from '@/shared/lib/api-client';
import type { BindingEligibility, CommitteeDayBinding } from '../types';

export interface BindingListFilters {
  cycleId: string;
  applicantCategoryId?: string;
  committeeId?: string;
  dayId?: string;
  onlyActive?: boolean;
}

export interface CreateBindingInput {
  cycleId: string;
  applicantCategoryId: string;
  committeeId: string;
  examScheduleDayId: string;
  capacity: number;
  eligibility: BindingEligibility;
  isActive: boolean;
  note?: string | null;
}

export type UpdateBindingPatch = Partial<{
  capacity: number;
  eligibility: BindingEligibility;
  isActive: boolean;
  note: string | null;
}>;

export interface BulkEligibilityInput {
  cycleId: string;
  applicantCategoryId: string;
  targets: Array<{ committeeId: string; dayId: string }>;
  eligibility: BindingEligibility;
  capacity?: number;
  overwrite?: boolean;
}

export interface CopyAxisInput {
  cycleId: string;
  applicantCategoryId: string;
  overwrite?: boolean;
}

export const committeeBindingService = {
  async list(filters: BindingListFilters): Promise<CommitteeDayBinding[]> {
    return apiClient.get(`/api/admin/committee-bindings/cycles/${encodeURIComponent(filters.cycleId)}`, {
      query: {
        categoryId: filters.applicantCategoryId,
        committeeId: filters.committeeId,
        dayId: filters.dayId,
        onlyActive: filters.onlyActive,
      },
    });
  },

  async create(input: CreateBindingInput): Promise<CommitteeDayBinding> {
    return apiClient.post('/api/admin/committee-bindings', input);
  },

  async update(
    id: string,
    patch: UpdateBindingPatch,
  ): Promise<CommitteeDayBinding> {
    return apiClient.patch(`/api/admin/committee-bindings/${encodeURIComponent(id)}`, patch);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/committee-bindings/${encodeURIComponent(id)}`);
  },

  async toggleActive(id: string): Promise<CommitteeDayBinding> {
    return apiClient.post(`/api/admin/committee-bindings/${encodeURIComponent(id)}/toggle-active`);
  },

  async bulkSetEligibility(input: BulkEligibilityInput): Promise<{ updated: number }> {
    return apiClient.post('/api/admin/committee-bindings/bulk-eligibility', input);
  },

  async copyRow(
    input: CopyAxisInput & { sourceCommitteeId: string; targetCommitteeId: string },
  ): Promise<{ created: number; skipped: number }> {
    return apiClient.post('/api/admin/committee-bindings/copy-row', input);
  },

  async copyColumn(
    input: CopyAxisInput & { sourceDayId: string; targetDayId: string },
  ): Promise<{ created: number; skipped: number }> {
    return apiClient.post('/api/admin/committee-bindings/copy-column', input);
  },
};
