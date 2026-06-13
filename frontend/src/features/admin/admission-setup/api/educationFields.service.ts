/**
 * Category education-field config — admin read/write side.
 *
 * Admins manage which educational score fields the applicant profile page
 * renders per category (labels, input kind, section, required, min/max,
 * order, active). The applicant portal consumes the same rows read-only.
 * Categories with no stored rows answer with backend defaults; the first
 * save materializes the category's full row set.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/admission-setup/education-fields?categoryKey=<key>
 *     → CategoryEducationField[] (sorted by sortOrder)
 *   PUT /api/admission-setup/education-fields/:categoryKey
 *     body: CategoryEducationField[] — replaces the category's row set;
 *     422 on unknown inputKind/sectionKey, duplicate fieldKey, min > max
 */

import { apiClient } from '@/shared/lib/api-client';
import type { CategoryEducationField } from '@/shared/types/domain';

export const categoryEducationFieldsService = {
  async listByCategory(categoryKey: string): Promise<CategoryEducationField[]> {
    return apiClient.get<CategoryEducationField[]>(
      '/api/admission-setup/education-fields',
      { query: { categoryKey } },
    );
  },

  async saveCategory(
    categoryKey: string,
    rows: CategoryEducationField[],
  ): Promise<CategoryEducationField[]> {
    return apiClient.put<CategoryEducationField[]>(
      `/api/admission-setup/education-fields/${encodeURIComponent(categoryKey)}`,
      rows,
    );
  },
};
