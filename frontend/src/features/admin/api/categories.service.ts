/**
 * Admin Categories API Contract.
 *
 * INTEGRATION CONTRACT:
 *   GET    /api/admin/categories                          → ApplicantCategory[]
 *   GET    /api/admin/categories/:key                     → ApplicantCategory | null
 *   PATCH  /api/admin/categories/:key                     → ApplicantCategory
 *   GET    /api/admin/categories/:key/dependencies        → DependencyResult
 *   POST   /api/admin/categories/:key/soft-delete         → ApplicantCategory
 *   POST   /api/admin/categories/:key/preview-rule-change → impact preview
 *   PATCH  /api/admin/categories/:key/conditions          → ApplicantCategory
 */

import { apiClient } from '@/shared/lib/api-client';
import type { DependencyResult } from '@/shared/lib/soft-delete';
import type {
  Applicant,
  ApplicantCategory,
  ApplicantCategoryKey,
  CategoryConditions,
} from '@/shared/types/domain';
import { APPLICANT_CATEGORY_KEYS } from '@/shared/types/domain';

const SPEC_KEYS: ReadonlySet<ApplicantCategoryKey> = new Set<ApplicantCategoryKey>(
  APPLICANT_CATEGORY_KEYS,
);

export const categoriesAdminService = {
  async list(opts: { includeDeleted?: boolean } = {}): Promise<ApplicantCategory[]> {
    return apiClient.get('/api/admin/categories', { query: opts });
  },

  async getByKey(key: ApplicantCategoryKey): Promise<ApplicantCategory | null> {
    return apiClient.get(`/api/admin/categories/${encodeURIComponent(key)}`);
  },

  async update(key: ApplicantCategoryKey, patch: Partial<ApplicantCategory>): Promise<ApplicantCategory> {
    return apiClient.patch(`/api/admin/categories/${encodeURIComponent(key)}`, patch);
  },

  isSpecCategory(key: ApplicantCategoryKey): boolean {
    return SPEC_KEYS.has(key);
  },

  async getDependencies(key: ApplicantCategoryKey): Promise<DependencyResult> {
    return apiClient.get(`/api/admin/categories/${encodeURIComponent(key)}/dependencies`);
  },

  async softDelete(key: ApplicantCategoryKey, reason: string): Promise<ApplicantCategory> {
    return apiClient.post(`/api/admin/categories/${encodeURIComponent(key)}/soft-delete`, { reason });
  },

  async previewRuleChangeImpact(
    key: ApplicantCategoryKey,
    newConditions: CategoryConditions,
  ): Promise<{ impactedApplicants: Applicant[]; conflicts: { applicantId: string; failingRule: string }[] }> {
    return apiClient.post(`/api/admin/categories/${encodeURIComponent(key)}/preview-rule-change`, {
      conditions: newConditions,
    });
  },

  async updateExpandedConditions(
    key: ApplicantCategoryKey,
    newConditions: CategoryConditions,
    options: { override?: boolean; impactedApplicantIds?: string[] } = {},
  ): Promise<ApplicantCategory> {
    return apiClient.patch(`/api/admin/categories/${encodeURIComponent(key)}/conditions`, {
      conditions: newConditions,
      ...options,
    });
  },

  async restore(key: ApplicantCategoryKey): Promise<ApplicantCategory> {
    return apiClient.post(`/api/admin/categories/${encodeURIComponent(key)}/restore`);
  },
};
